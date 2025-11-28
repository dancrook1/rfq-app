const express = require('express');
const router = express.Router({ mergeParams: true });
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');
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
    throw new Error(`Failed to decrypt: ${error.message}. This may indicate the encryption key has changed or the data is corrupted.`);
  }
}

// POST /api/rfq/:id/supplier - Create supplier for RFQ
router.post('/', async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    // Check if RFQ exists
    const rfq = await prisma.rFQ.findUnique({
      where: { id: req.params.id }
    });

    if (!rfq) {
      return res.status(404).json({ message: 'RFQ not found' });
    }

    // Create supplier with unique token
    const supplier = await prisma.supplier.create({
      data: {
        rfqId: req.params.id,
        name,
        email,
        uniqueToken: uuidv4(),
      }
    });

    res.json(supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ message: error.message || 'Failed to create supplier' });
  }
});

// POST /api/rfq/:id/supplier/:supplierId/create-po - Create PO in Cin7
router.post('/:supplierId/create-po', async (req, res) => {
  try {
    // Get Dear Inventory config
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      return res.status(400).json({ message: 'Dear Inventory not configured' });
    }

    if (!config.applicationKey) {
      return res.status(400).json({ 
        message: 'Application key not found in configuration. Please reconfigure Dear Inventory in Settings.' 
      });
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

    // Get RFQ and supplier
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
        },
        suppliers: true
      }
    });

    if (!rfq) {
      return res.status(404).json({ message: 'RFQ not found' });
    }

    const supplier = rfq.suppliers.find(s => s.id === req.params.supplierId);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Get global supplier to find Dear Inventory supplier ID
    const globalSupplier = await prisma.globalSupplier.findFirst({
      where: { name: supplier.name }
    });

    // Filter items where this supplier is winning (cheapest or forced)
    const winningItems = rfq.items
      .filter(item => {
        // Skip SYS_ and MPC_ SKUs
        if (item.sku.startsWith('SYS_') || item.sku.startsWith('MPC_')) {
          return false;
        }

        // Skip items where quantity equals on order
        if (item.quantity === item.onOrder) {
          return false;
        }

        // Check if this supplier is winning
        const quote = item.quotes.find(q => q.supplierId === supplier.id);
        const hasQuote = quote && quote.quotedPrice !== null && quote.quotedPrice > 0;

        if (!hasQuote) {
          return false;
        }

        // Check if forced to this supplier
        if (item.forcedSupplierId === supplier.id) {
          return true;
        }

        // Check if cheapest
        const validQuotes = item.quotes.filter(q => q.quotedPrice !== null && q.quotedPrice > 0);
        if (validQuotes.length === 0) {
          return false;
        }

        // If there's a forced supplier, they win
        if (item.forcedSupplierId) {
          return item.forcedSupplierId === supplier.id;
        }

        // Otherwise, find cheapest
        const cheapestQuote = validQuotes.reduce((min, q) =>
          (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
        );

        return cheapestQuote.supplierId === supplier.id;
      })
      .map(item => {
        const quote = item.quotes.find(q => q.supplierId === supplier.id);
        return {
          item,
          quote,
        };
      });

    if (winningItems.length === 0) {
      return res.status(400).json({ message: 'No winning items found for this supplier' });
    }

    // Get product IDs for all SKUs
    const productMap = new Map();
    for (const { item } of winningItems) {
      if (!productMap.has(item.sku)) {
        const product = await client.getProductBySKU(item.sku);
        if (product) {
          productMap.set(item.sku, product.ID);
        }
      }
    }

    // Build order lines
    const orderLines = await Promise.all(
      winningItems.map(async ({ item, quote }) => {
        const productId = productMap.get(item.sku);
        
        // Build comment from supplier comments and MPN
        const commentParts = [];
        if (quote.comments) {
          commentParts.push(quote.comments);
        }
        if (quote.supplierMpn) {
          commentParts.push(`Supplier MPN: ${quote.supplierMpn}`);
        }
        const comment = commentParts.join(' | ') || undefined;

        const line = {
          SKU: item.sku,
          Quantity: item.quantity,
          Price: quote.quotedPrice,
          Discount: 0,
          Tax: 0,
          Total: quote.quotedPrice * item.quantity,
        };

        if (productId) {
          line.ProductID = productId;
        }

        if (item.productName) {
          line.Name = item.productName;
        }

        if (quote.supplierMpn) {
          line.SupplierSKU = quote.supplierMpn;
        }

        if (comment) {
          line.Comment = comment;
        }

        return line;
      })
    );

    // Get default location (you may want to make this configurable)
    const defaultLocation = 'Main Warehouse'; // TODO: Make this configurable

    // Create the Purchase Order
    const result = await client.createPurchaseOrder(
      globalSupplier?.dearSupplierId || null,
      supplier.name,
      defaultLocation,
      orderLines,
      `RFQ: ${rfq.name} - Generated from RFQ system`,
      'STOCK'
    );

    res.json({
      success: true,
      purchaseOrderId: result.ID,
      orderNumber: result.OrderNumber,
      itemCount: winningItems.length,
      message: `Purchase Order ${result.OrderNumber} created successfully with ${winningItems.length} items`
    });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ message: error.message || 'Failed to create purchase order' });
  }
});

module.exports = router;

