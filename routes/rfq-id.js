const express = require('express');
const router = express.Router({ mergeParams: true });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// GET /api/rfq/:id/summary - Get RFQ summary
router.get('/summary', async (req, res) => {
  try {
    const rfq = await prisma.rFQ.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            quotes: {
              include: {
                supplier: true
              }
            }
          }
        }
      }
    });

    if (!rfq) {
      return res.status(404).json({ message: 'RFQ not found' });
    }

    // Filter out SYS_ and MPC_ SKUs (systems and barebone chassis) - only show components
    const componentItems = rfq.items.filter(item => 
      !item.sku.startsWith('SYS_') && !item.sku.startsWith('MPC_')
    );

    const summary = componentItems.map(item => ({
      itemId: item.id,
      sku: item.sku,
      productName: item.productName || '',
      mpn: item.mpn || '',
      category: item.category,
      targetPrice: item.targetPrice,
      quantity: item.quantity,
      onOrder: item.onOrder || 0,
      forcedSupplierId: item.forcedSupplierId,
      quotes: item.quotes.map(quote => ({
        supplierId: quote.supplier.id,
        supplierName: quote.supplier.name,
        supplierEmail: quote.supplier.email,
        quotedPrice: quote.quotedPrice,
        supplierMpn: quote.supplierMpn,
        comments: quote.comments,
      }))
    }));

    res.json({
      summary,
      priceThreshold: rfq.priceThreshold
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch summary' });
  }
});

// PATCH /api/rfq/:id/items/:itemId - Update item quantity
router.patch('/items/:itemId', async (req, res) => {
  try {
    const { quantity } = req.body;

    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ message: 'Invalid quantity' });
    }

    // Verify the item belongs to this RFQ
    const item = await prisma.rFQItem.findFirst({
      where: {
        id: req.params.itemId,
        rfqId: req.params.id
      }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // Update quantity
    const updatedItem = await prisma.rFQItem.update({
      where: { id: req.params.itemId },
      data: { quantity: parseInt(quantity) }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item quantity:', error);
    res.status(500).json({ message: error.message || 'Failed to update quantity' });
  }
});

// PATCH /api/rfq/:id/items/:itemId/override - Set/clear forced supplier
router.patch('/items/:itemId/override', async (req, res) => {
  try {
    const { forcedSupplierId } = req.body;

    // Verify the item belongs to this RFQ
    const item = await prisma.rFQItem.findFirst({
      where: {
        id: req.params.itemId,
        rfqId: req.params.id
      }
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // If forcedSupplierId is provided, verify the supplier belongs to this RFQ
    if (forcedSupplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: forcedSupplierId,
          rfqId: req.params.id
        }
      });

      if (!supplier) {
        return res.status(404).json({ message: 'Supplier not found' });
      }
    }

    // Update the forced supplier
    const updatedItem = await prisma.rFQItem.update({
      where: { id: req.params.itemId },
      data: { forcedSupplierId: forcedSupplierId || null }
    });

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item override:', error);
    res.status(500).json({ message: error.message || 'Failed to update override' });
  }
});

// Include supplier routes
const rfqSupplierRouter = require('./rfq-supplier');
router.use('/supplier', rfqSupplierRouter);

module.exports = router;

