const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { DearInventoryClient } = require('../lib/dear-inventory');
const { filterExcludedItems, getSKUExclusionPatterns, getCategoryExclusionPatterns } = require('../lib/sku-filter');
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

// GET /api/dear-inventory/products
router.get('/products', async (req, res) => {
  try {
    // Get Dear Inventory config
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      return res.status(400).json({ message: 'Dear Inventory not configured' });
    }

    if (!config.applicationKey) {
      return res.status(400).json({ message: 'Application key not found in configuration. Please reconfigure Dear Inventory in Settings.' });
    }

    // Decrypt application key
    let applicationKey;
    try {
      applicationKey = decrypt(config.applicationKey);
    } catch (error) {
      console.error('Failed to decrypt application key:', error);
      return res.status(500).json({ 
        message: 'Failed to decrypt application key. Please reconfigure Dear Inventory in Settings with a new application key.' 
      });
    }

    // Initialize Dear Inventory client
    const client = new DearInventoryClient({
      accountId: config.accountId,
      applicationKey,
      baseUrl: config.baseUrl
    });

    // Fetch products needing stock
    console.log('Fetching products needing stock from Dear Inventory...');
    const products = await client.getProductsNeedingStock();
    console.log(`Found ${products.length} products needing stock`);

    if (products.length === 0) {
      return res.json({
        success: true,
        products: [],
        count: 0,
        message: 'No products found that need restocking. This could mean: 1) All products have sufficient stock (Available >= 0), 2) No inventory records exist for your products, or 3) Products may need to be synced in Dear Inventory first.'
      });
    }

    // Get exclusion patterns and filter
    const [skuExclusionPatterns, categoryExclusionPatterns] = await Promise.all([
      getSKUExclusionPatterns(),
      getCategoryExclusionPatterns()
    ]);
    const filteredProducts = filterExcludedItems(products, skuExclusionPatterns, categoryExclusionPatterns);
    console.log(`After exclusion patterns: ${filteredProducts.length} products remaining (SKU patterns: ${skuExclusionPatterns.length}, Category patterns: ${categoryExclusionPatterns.length})`);

    if (filteredProducts.length === 0) {
      return res.json({
        success: true,
        products: [],
        count: 0,
        message: 'No products found after applying exclusion patterns. All products were excluded by your SKU exclusion rules.'
      });
    }

    // Map to RFQ format
    const mappedProducts = filteredProducts.map(product => {
      const inventory = product.inventory;
      const mpn = client.extractMPN(product);
      const salesPrice = product.PriceTier1 || 0;
      const targetPrice = salesPrice > 0 ? salesPrice / 1.2 : 0;
      
      // Use calculated quantity needed from the client (which accounts for OnHand and OnOrder, not Allocated)
      // Fallback to Available if calculatedQuantityNeeded is not available
      const quantityNeeded = inventory.calculatedQuantityNeeded ?? Math.abs(inventory.Available);

      return {
        sku: product.SKU,
        productName: product.Name,
        category: product.Category || 'Other',
        mpn: mpn,
        targetPrice: targetPrice,
        quantity: quantityNeeded,
        onOrder: Math.max(0, inventory.OnOrder || 0),
        available: inventory.Available,
        onHand: inventory.OnHand,
        allocated: inventory.Allocated || 0,
        dearProductId: product.ID,
      };
    });

    // Update last sync time
    await prisma.dearInventoryConfig.update({
      where: { id: config.id },
      data: { lastProductSync: new Date() }
    });

    res.json({
      success: true,
      products: mappedProducts,
      count: mappedProducts.length,
    });
  } catch (error) {
    console.error('Error fetching products from Dear Inventory:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch products' });
  }
});

module.exports = router;

