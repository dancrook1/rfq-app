const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/supplier/:token - Get supplier data
router.get('/:token', async (req, res) => {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { uniqueToken: req.params.token },
      include: {
        rfq: {
          include: {
            items: {
              include: {
                quotes: true
              }
            }
          }
        },
        quotes: true
      }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Invalid supplier token' });
    }

    // Format existing quotes as a map
    const existingQuotes = {};
    supplier.quotes.forEach(quote => {
      existingQuotes[quote.rfqItemId] = {
        id: quote.id,
        rfqItemId: quote.rfqItemId,
        quotedPrice: quote.quotedPrice?.toString() || '',
        supplierMpn: quote.supplierMpn || '',
        comments: quote.comments || ''
      };
    });

    // Filter out SYS_ and MPC_ SKUs (systems and barebone chassis) - only show components
    // Also filter out items where quantity needed equals on order (already fully covered by existing orders)
    const filteredItems = supplier.rfq.items
      .filter(item => 
        !item.sku.startsWith('SYS_') && !item.sku.startsWith('MPC_') &&
        item.quantity !== item.onOrder // Exclude items where quantity needed equals on order
      )
      .map(item => {
        // Get all valid quotes
        const validQuotes = item.quotes?.filter(q => q.quotedPrice !== null && q.quotedPrice > 0) || [];
        
        // Determine winning supplier (considering forced supplier override)
        let winningSupplierId = null;
        if (item.forcedSupplierId) {
          // If there's a forced supplier, they win (if they have a quote)
          const forcedQuote = validQuotes.find(q => q.supplierId === item.forcedSupplierId);
          if (forcedQuote) {
            winningSupplierId = item.forcedSupplierId;
          }
        }
        
        // If no forced supplier or forced supplier has no quote, find cheapest
        if (!winningSupplierId && validQuotes.length > 0) {
          const cheapestQuote = validQuotes.reduce((min, q) =>
            (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
          );
          winningSupplierId = cheapestQuote.supplierId;
        }
        
        // Get best price (lowest quote from any supplier)
        const bestQuote = validQuotes.length > 0
          ? validQuotes.reduce((min, q) =>
              (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
            )
          : null;

        // Check if this supplier is winning
        const isWinning = winningSupplierId === supplier.id;

        const { quotes, ...rest } = item;
        return {
          ...rest,
          bestPrice: bestQuote?.quotedPrice || null,
          isWinning: isWinning
        };
      });

    res.json({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      rfq: {
        ...supplier.rfq,
        items: filteredItems
      },
      existingQuotes
    });
  } catch (error) {
    console.error('Error fetching supplier data:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch supplier data' });
  }
});

// POST /api/supplier/:token/quotes - Submit quotes
router.post('/:token/quotes', async (req, res) => {
  try {
    const { quotes } = req.body;

    if (!quotes || !Array.isArray(quotes)) {
      return res.status(400).json({ message: 'Invalid quotes data' });
    }

    // Get supplier
    const supplier = await prisma.supplier.findUnique({
      where: { uniqueToken: req.params.token }
    });

    if (!supplier) {
      return res.status(404).json({ message: 'Invalid supplier token' });
    }

    // Upsert quotes
    await Promise.all(
      quotes.map(async (quote) => {
        if (quote.id) {
          // Update existing quote
          await prisma.quote.update({
            where: { id: quote.id },
            data: {
              quotedPrice: quote.quotedPrice ? parseFloat(quote.quotedPrice) : null,
              supplierMpn: quote.supplierMpn || null,
              comments: quote.comments || null,
            }
          });
        } else {
          // Create new quote
          await prisma.quote.create({
            data: {
              supplierId: supplier.id,
              rfqItemId: quote.rfqItemId,
              quotedPrice: quote.quotedPrice ? parseFloat(quote.quotedPrice) : null,
              supplierMpn: quote.supplierMpn || null,
              comments: quote.comments || null,
            }
          });
        }
      })
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving quotes:', error);
    res.status(500).json({ message: error.message || 'Failed to save quotes' });
  }
});

module.exports = router;

