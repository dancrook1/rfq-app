const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { extractProductInfoFromCSVRow } = require('../lib/sku-lookup');
const { filterExcludedItems, getSKUExclusionPatterns, getCategoryExclusionPatterns } = require('../lib/sku-filter');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// GET /api/rfq/list - List all RFQs
router.get('/list', async (req, res) => {
  try {
    const rfqs = await prisma.rFQ.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        suppliers: true,
      }
    });

    const formatted = rfqs.map(rfq => ({
      id: rfq.id,
      name: rfq.name,
      createdAt: rfq.createdAt.toISOString(),
      itemCount: rfq.items.length,
      supplierCount: rfq.suppliers.length,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching RFQs:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch RFQs' });
  }
});

// POST /api/rfq/create - Create new RFQ
router.post('/create', async (req, res) => {
  try {
    const { name, priceThreshold, items } = req.body;

    if (!name || !items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid request data' });
    }

    // Fetch all urgent stock items and add them to the RFQ
    const urgentItems = await prisma.urgentStock.findMany();
    const urgentItemsForRFQ = urgentItems.map(urgent => ({
      sku: urgent.sku,
      productName: urgent.productName || '',
      category: urgent.category || 'Other',
      targetPrice: urgent.targetPrice || 0,
      quantity: urgent.quantity || 1,
      onOrder: 0,
      isUrgent: true // Flag to identify urgent items
    }));

    // Combine regular items with urgent items
    const allItems = [...items, ...urgentItemsForRFQ];

    // Fetch all global suppliers
    const globalSuppliers = await prisma.globalSupplier.findMany({
      orderBy: { name: 'asc' }
    });

    // Get exclusion patterns
    const [skuExclusionPatterns, categoryExclusionPatterns] = await Promise.all([
      getSKUExclusionPatterns(),
      getCategoryExclusionPatterns()
    ]);
    
    // Filter out excluded SKUs and categories
    const filteredItems = filterExcludedItems(allItems, skuExclusionPatterns, categoryExclusionPatterns);
    
    if (filteredItems.length === 0) {
      return res.status(400).json({ message: 'No items to add after applying exclusion patterns' });
    }

    // Create RFQ with items and automatically add global suppliers
    const rfq = await prisma.rFQ.create({
      data: {
        name,
        priceThreshold: priceThreshold || 10,
        items: {
          create: filteredItems.map((item) => {
            // Extract product info from CSV row data
            const productInfo = extractProductInfoFromCSVRow(
              item.sku,
              item.productName,
              item.category
            );
            
            return {
              sku: item.sku,
              productName: productInfo.productName,
              mpn: productInfo.mpn,
              category: productInfo.category,
              targetPrice: item.targetPrice || 0,
              quantity: item.quantity || 0,
              onOrder: item.onOrder || 0,
              isUrgent: item.isUrgent || false,
            };
          })
        },
        suppliers: {
          create: globalSuppliers.map(globalSupplier => ({
            name: globalSupplier.name,
            email: globalSupplier.email,
            uniqueToken: uuidv4(),
          }))
        }
      }
    });

    // Clear urgent stock items after adding them to RFQ
    if (urgentItems.length > 0) {
      await prisma.urgentStock.deleteMany({});
    }

    res.json({ rfqId: rfq.id, urgentItemsAdded: urgentItems.length });
  } catch (error) {
    console.error('Error creating RFQ:', error);
    res.status(500).json({ message: error.message || 'Failed to create RFQ' });
  }
});

// GET /api/rfq/:id - Get single RFQ
router.get('/:id', async (req, res) => {
  try {
    const rfq = await prisma.rFQ.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        suppliers: true,
      }
    });

    if (!rfq) {
      return res.status(404).json({ message: 'RFQ not found' });
    }

    res.json(rfq);
  } catch (error) {
    console.error('Error fetching RFQ:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch RFQ' });
  }
});

// DELETE /api/rfq/:id - Delete RFQ
router.delete('/:id', async (req, res) => {
  try {
    // Check if RFQ exists
    const rfq = await prisma.rFQ.findUnique({
      where: { id: req.params.id }
    });

    if (!rfq) {
      return res.status(404).json({ message: 'RFQ not found' });
    }

    // Delete RFQ (cascading deletes will handle items, suppliers, and quotes)
    await prisma.rFQ.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true, message: 'RFQ deleted successfully' });
  } catch (error) {
    console.error('Error deleting RFQ:', error);
    res.status(500).json({ message: error.message || 'Failed to delete RFQ' });
  }
});

// Include nested routes
router.use('/:id', require('./rfq-id'));

module.exports = router;

