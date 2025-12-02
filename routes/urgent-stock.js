const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { DearInventoryClient } = require('../lib/dear-inventory');
const CryptoJS = require('crypto-js');

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.DEAR_INVENTORY_ENCRYPTION_KEY || 'default-key-change-in-production';

function decrypt(encryptedText) {
  if (!encryptedText) {
    throw new Error('No encrypted text provided');
  }
  
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted || decrypted.length === 0) {
      throw new Error('Decryption resulted in empty string - possibly wrong encryption key or corrupted data');
    }
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error(`Failed to decrypt application key: ${error.message}. This may indicate the encryption key has changed or the data is corrupted.`);
  }
}

// GET /api/urgent-stock/search - Search products in Dear Inventory
router.get('/search', async (req, res) => {
  try {
    const { query, limit = 50 } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    // Get Dear Inventory config
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      return res.status(400).json({ message: 'Dear Inventory not configured' });
    }

    if (!config.applicationKey) {
      return res.status(400).json({ message: 'Application key not found in configuration' });
    }

    // Decrypt application key
    let applicationKey;
    try {
      applicationKey = decrypt(config.applicationKey);
    } catch (error) {
      console.error('Failed to decrypt application key:', error);
      return res.status(500).json({ 
        message: 'Failed to decrypt application key. Please reconfigure Dear Inventory in Settings.' 
      });
    }

    // Initialize Dear Inventory client
    const client = new DearInventoryClient({
      accountId: config.accountId,
      applicationKey,
      baseUrl: config.baseUrl
    });

    // Search products by SKU or name
    const searchTerm = query.trim();
    const searchLower = searchTerm.toLowerCase();
    const maxResults = parseInt(limit);
    let matchingProducts = [];
    
    // First, try exact SKU match if search looks like a SKU (contains underscore or is alphanumeric)
    if (searchTerm.length > 0 && (searchTerm.includes('_') || /^[A-Z0-9_-]+$/i.test(searchTerm))) {
      try {
        const exactProduct = await client.getProductBySKU(searchTerm);
        if (exactProduct) {
          matchingProducts.push(exactProduct);
        }
      } catch (error) {
        console.log('Exact SKU search failed, falling back to full search:', error.message);
      }
    }
    
    // If we don't have enough results, search through products with pagination
    if (matchingProducts.length < maxResults) {
      let page = 1;
      const pageLimit = 100; // Products per page
      const maxPages = 20; // Limit to 20 pages (2000 products) to avoid timeout
      
      while (matchingProducts.length < maxResults && page <= maxPages) {
        try {
          // Fetch products page by page
          const response = await client.request(`/product?Page=${page}&Limit=${pageLimit}`);
          
          if (!response || !response.Products || !Array.isArray(response.Products) || response.Products.length === 0) {
            break;
          }
          
          // Filter products by search term (SKU or name)
          const pageMatches = response.Products.filter(product => {
            // Skip if already in results (from exact SKU match)
            if (matchingProducts.some(p => p.ID === product.ID)) {
              return false;
            }
            
            const sku = (product.SKU || '').toLowerCase();
            const name = (product.Name || '').toLowerCase();
            return sku.includes(searchLower) || name.includes(searchLower);
          });
          
          matchingProducts.push(...pageMatches);
          
          // If we got fewer products than requested, we've reached the end
          if (response.Products.length < pageLimit) {
            break;
          }
          
          page++;
        } catch (error) {
          console.error(`Error fetching products page ${page}:`, error);
          break;
        }
      }
      
      // Limit to maxResults
      matchingProducts = matchingProducts.slice(0, maxResults);
    }

    if (matchingProducts.length === 0) {
      return res.json({
        success: true,
        products: [],
        count: 0,
        message: 'No products found matching your search'
      });
    }

    // Get inventory levels for matching products
    const skus = matchingProducts.map(p => p.SKU).filter(Boolean);
    let inventoryLevels = [];
    
    // Fetch inventory levels - API doesn't support multiple SKU filtering efficiently
    // So we fetch all and filter, but this is done inside getInventoryLevels
    if (skus.length > 0) {
      inventoryLevels = await client.getInventoryLevels(skus);
    }
    const inventoryMap = new Map();
    
    inventoryLevels.forEach(level => {
      const sku = (level.SKU || '').trim();
      if (!sku) return;
      
      const existing = inventoryMap.get(sku);
      if (existing) {
        existing.OnHand = (existing.OnHand || 0) + (level.OnHand || 0);
        existing.Available = (existing.Available || 0) + (level.Available || 0);
        existing.OnOrder = (existing.OnOrder || 0) + (level.OnOrder || 0);
        existing.Allocated = (existing.Allocated || 0) + (level.Allocated || 0);
      } else {
        inventoryMap.set(sku, {
          OnHand: level.OnHand || 0,
          Available: level.Available || 0,
          OnOrder: level.OnOrder || 0,
          Allocated: level.Allocated || 0,
        });
      }
    });

    // Map products to response format
    const results = matchingProducts.map(product => {
      const sku = product.SKU || '';
      const inventory = inventoryMap.get(sku) || { OnHand: 0, Available: 0, OnOrder: 0, Allocated: 0 };
      const mpn = client.extractMPN(product);
      const salesPrice = product.PriceTier1 || 0;
      const targetPrice = salesPrice > 0 ? salesPrice / 1.2 : 0;

      return {
        sku: sku,
        productName: product.Name || '',
        category: product.Category || 'Other',
        mpn: mpn,
        targetPrice: targetPrice,
        available: inventory.Available,
        onHand: inventory.OnHand,
        onOrder: inventory.OnOrder,
        allocated: inventory.Allocated,
        dearProductId: product.ID,
      };
    });

    res.json({
      success: true,
      products: results,
      count: results.length
    });
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Failed to search products',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// GET /api/urgent-stock - Get all urgent stock items
router.get('/', async (req, res) => {
  try {
    const urgentItems = await prisma.urgentStock.findMany({
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      items: urgentItems,
      count: urgentItems.length
    });
  } catch (error) {
    console.error('Error fetching urgent stock:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch urgent stock' });
  }
});

// POST /api/urgent-stock - Add item to urgent stock
router.post('/', async (req, res) => {
  try {
    const { sku, productName, mpn, category, quantity, targetPrice, notes, requestedBy, dearProductId } = req.body;

    if (!sku || !sku.trim()) {
      return res.status(400).json({ message: 'SKU is required' });
    }

    // Check if item already exists
    const existing = await prisma.urgentStock.findUnique({
      where: { sku: sku.trim() }
    });

    if (existing) {
      // Update existing item
      const updated = await prisma.urgentStock.update({
        where: { sku: sku.trim() },
        data: {
          productName: productName || existing.productName,
          mpn: mpn || existing.mpn,
          category: category || existing.category,
          quantity: quantity || existing.quantity,
          targetPrice: targetPrice !== undefined ? targetPrice : existing.targetPrice,
          notes: notes || existing.notes,
          requestedBy: requestedBy || existing.requestedBy,
          dearProductId: dearProductId || existing.dearProductId,
          updatedAt: new Date()
        }
      });

      return res.json({
        success: true,
        item: updated,
        message: 'Urgent stock item updated'
      });
    }

    // Create new item
    const newItem = await prisma.urgentStock.create({
      data: {
        sku: sku.trim(),
        productName: productName || null,
        mpn: mpn || null,
        category: category || 'Other',
        quantity: quantity || 1,
        targetPrice: targetPrice || null,
        notes: notes || null,
        requestedBy: requestedBy || null,
        dearProductId: dearProductId || null,
      }
    });

    res.json({
      success: true,
      item: newItem,
      message: 'Urgent stock item added'
    });
  } catch (error) {
    console.error('Error adding urgent stock:', error);
    res.status(500).json({ message: error.message || 'Failed to add urgent stock' });
  }
});

// DELETE /api/urgent-stock/:id - Remove item from urgent stock
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const item = await prisma.urgentStock.findUnique({
      where: { id }
    });

    if (!item) {
      return res.status(404).json({ message: 'Urgent stock item not found' });
    }

    await prisma.urgentStock.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Urgent stock item removed'
    });
  } catch (error) {
    console.error('Error removing urgent stock:', error);
    res.status(500).json({ message: error.message || 'Failed to remove urgent stock' });
  }
});

// DELETE /api/urgent-stock - Clear all urgent stock items
router.delete('/', async (req, res) => {
  try {
    await prisma.urgentStock.deleteMany({});

    res.json({
      success: true,
      message: 'All urgent stock items cleared'
    });
  } catch (error) {
    console.error('Error clearing urgent stock:', error);
    res.status(500).json({ message: error.message || 'Failed to clear urgent stock' });
  }
});

module.exports = router;

