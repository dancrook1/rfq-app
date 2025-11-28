const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { DearInventoryClient } = require('../lib/dear-inventory');
const CryptoJS = require('crypto-js');

const prisma = new PrismaClient();
const ENCRYPTION_KEY = process.env.DEAR_INVENTORY_ENCRYPTION_KEY || 'default-key-change-in-production';

function encrypt(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

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

// ========== Global Suppliers ==========

// GET /api/settings/suppliers
router.get('/suppliers', async (req, res) => {
  try {
    const suppliers = await prisma.globalSupplier.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(suppliers);
  } catch (error) {
    console.error('Error fetching global suppliers:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch suppliers' });
  }
});

// POST /api/settings/suppliers
router.post('/suppliers', async (req, res) => {
  try {
    const { name, email, dearSupplierId } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const supplier = await prisma.globalSupplier.create({
      data: {
        name,
        email,
        dearSupplierId: dearSupplierId || null,
        syncedFromDear: !!dearSupplierId,
        lastSyncedAt: dearSupplierId ? new Date() : null,
      }
    });

    res.json(supplier);
  } catch (error) {
    console.error('Error creating global supplier:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'A supplier with this name already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create supplier' });
  }
});

// DELETE /api/settings/suppliers (delete all)
router.delete('/suppliers', async (req, res) => {
  try {
    const deleted = await prisma.globalSupplier.deleteMany({});
    res.json({
      success: true,
      deletedCount: deleted.count
    });
  } catch (error) {
    console.error('Error deleting all global suppliers:', error);
    res.status(500).json({ message: error.message || 'Failed to delete all suppliers' });
  }
});

// DELETE /api/settings/suppliers/:id
router.delete('/suppliers/:id', async (req, res) => {
  try {
    await prisma.globalSupplier.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting global supplier:', error);
    res.status(500).json({ message: error.message || 'Failed to delete supplier' });
  }
});

// POST /api/settings/suppliers/sync
router.post('/suppliers/sync', async (req, res) => {
  try {
    const { strategy = 'merge', onlyActive = true } = req.body;

    // Get Dear Inventory config
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      return res.status(400).json({
        message: 'Dear Inventory not configured. Please set up API credentials first.'
      });
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

    // Fetch suppliers from Dear Inventory
    const dearSuppliers = onlyActive
      ? await client.getActiveSuppliers()
      : await client.getAllSuppliers();

    // Get existing global suppliers
    const existingSuppliers = await prisma.globalSupplier.findMany();

    let added = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    // Process each Dear Inventory supplier
    for (const dearSupplier of dearSuppliers) {
      try {
        // Determine email from Contacts array (first contact with email) or Email/Contact field
        let email = '';
        if (dearSupplier.Contacts && Array.isArray(dearSupplier.Contacts) && dearSupplier.Contacts.length > 0) {
          const contactWithEmail = dearSupplier.Contacts.find((c) => c.Email);
          email = contactWithEmail?.Email || '';
        }
        // Fallback to direct Email or Contact field
        if (!email) {
          email = dearSupplier.Email || dearSupplier.Contact || '';
        }
        
        if (!email) {
          skipped++;
          errors.push(`Supplier "${dearSupplier.Name}" skipped: No email found`);
          continue;
        }

        // Find existing supplier
        let existing = existingSuppliers.find(
          s => s.dearSupplierId === dearSupplier.ID
        );

        if (!existing) {
          // Try matching by name
          existing = existingSuppliers.find(
            s => s.name.toLowerCase() === dearSupplier.Name.toLowerCase()
          );
        }

        if (strategy === 'replace') {
          // Delete all existing and create new
          if (existing) {
            await prisma.globalSupplier.delete({ where: { id: existing.id } });
          }
          await prisma.globalSupplier.create({
            data: {
              name: dearSupplier.Name,
              email: email,
              dearSupplierId: dearSupplier.ID,
              syncedFromDear: true,
              lastSyncedAt: new Date(),
            }
          });
          added++;
        } else if (strategy === 'merge') {
          if (existing) {
            // Update existing supplier
            await prisma.globalSupplier.update({
              where: { id: existing.id },
              data: {
                name: dearSupplier.Name,
                email: email,
                dearSupplierId: dearSupplier.ID,
                syncedFromDear: true,
                lastSyncedAt: new Date(),
              }
            });
            updated++;
          } else {
            // Create new supplier
            await prisma.globalSupplier.create({
              data: {
                name: dearSupplier.Name,
                email: email,
                dearSupplierId: dearSupplier.ID,
                syncedFromDear: true,
                lastSyncedAt: new Date(),
              }
            });
            added++;
          }
        } else if (strategy === 'supplement') {
          // Only add if doesn't exist
          if (!existing) {
            await prisma.globalSupplier.create({
              data: {
                name: dearSupplier.Name,
                email: email,
                dearSupplierId: dearSupplier.ID,
                syncedFromDear: true,
                lastSyncedAt: new Date(),
              }
            });
            added++;
          } else {
            skipped++;
          }
        }
      } catch (error) {
        errors.push(`Error processing supplier "${dearSupplier.Name}": ${error.message}`);
        skipped++;
      }
    }

    // Update last sync time
    await prisma.dearInventoryConfig.update({
      where: { id: config.id },
      data: { lastSupplierSync: new Date() }
    });

    res.json({
      success: true,
      results: {
        added,
        updated,
        skipped,
        total: dearSuppliers.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      lastSyncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error syncing suppliers:', error);
    res.status(500).json({ message: error.message || 'Failed to sync suppliers' });
  }
});

// GET /api/settings/suppliers/dear
router.get('/suppliers/dear', async (req, res) => {
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

    // Fetch all suppliers from Dear Inventory
    const suppliers = await client.getAllSuppliers();

    // Get existing global suppliers to mark which are already added
    const existingSuppliers = await prisma.globalSupplier.findMany({
      select: { dearSupplierId: true }
    });
    const existingIds = new Set(existingSuppliers.map(s => s.dearSupplierId).filter(Boolean));

    // Map to a simpler format for the select box
    const mappedSuppliers = suppliers.map(supplier => {
      // Extract email from Contacts array or use Email/Contact field
      let email = '';
      if (supplier.Contacts && Array.isArray(supplier.Contacts) && supplier.Contacts.length > 0) {
        const contactWithEmail = supplier.Contacts.find((c) => c.Email);
        email = contactWithEmail?.Email || '';
      }
      if (!email) {
        email = supplier.Email || supplier.Contact || '';
      }

      return {
        id: supplier.ID,
        name: supplier.Name,
        email: email,
        status: supplier.Status || 'Active',
        alreadyAdded: existingIds.has(supplier.ID)
      };
    });

    res.json({
      success: true,
      suppliers: mappedSuppliers
    });
  } catch (error) {
    console.error('Error fetching Dear Inventory suppliers:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch suppliers' });
  }
});

// ========== Dear Inventory Config ==========

// GET /api/settings/dear-inventory
router.get('/dear-inventory', async (req, res) => {
  try {
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    });

    if (!config) {
      return res.json({ config: null });
    }

    res.json({
      config: {
        id: config.id,
        accountId: config.accountId,
        baseUrl: config.baseUrl,
        isActive: config.isActive,
        lastProductSync: config.lastProductSync,
        lastSupplierSync: config.lastSupplierSync,
        // Don't return encrypted key
      }
    });
  } catch (error) {
    console.error('Error fetching Dear Inventory config:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch config' });
  }
});

// POST /api/settings/dear-inventory
router.post('/dear-inventory', async (req, res) => {
  try {
    const { accountId, applicationKey, baseUrl } = req.body;

    if (!accountId || !applicationKey) {
      return res.status(400).json({ message: 'Account ID and Application Key are required' });
    }

    // Test connection before saving
    const client = new DearInventoryClient({
      accountId,
      applicationKey,
      baseUrl: baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2'
    });

    try {
      await client.testConnection();
    } catch (error) {
      return res.status(400).json({
        message: `Failed to connect to Dear Inventory: ${error.message || 'Please check your credentials and API endpoint.'}`
      });
    }

    // Encrypt the application key
    const encryptedKey = encrypt(applicationKey);

    // Check if config exists
    const existing = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    });

    let config;
    if (existing) {
      // Update existing
      config = await prisma.dearInventoryConfig.update({
        where: { id: existing.id },
        data: {
          accountId,
          applicationKey: encryptedKey,
          baseUrl: baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2',
          isActive: true,
        }
      });
    } else {
      // Create new
      config = await prisma.dearInventoryConfig.create({
        data: {
          accountId,
          applicationKey: encryptedKey,
          baseUrl: baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2',
          isActive: true,
        }
      });
    }

    res.json({
      success: true,
      config: {
        id: config.id,
        accountId: config.accountId,
        baseUrl: config.baseUrl,
        isActive: config.isActive,
      }
    });
  } catch (error) {
    console.error('Error saving Dear Inventory config:', error);
    res.status(500).json({ message: error.message || 'Failed to save config' });
  }
});

// DELETE /api/settings/dear-inventory
router.delete('/dear-inventory', async (req, res) => {
  try {
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    });

    if (config) {
      await prisma.dearInventoryConfig.update({
        where: { id: config.id },
        data: { isActive: false }
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Dear Inventory config:', error);
    res.status(500).json({ message: error.message || 'Failed to delete config' });
  }
});

// ========== SKU Exclusions ==========

// GET /api/settings/sku-exclusions
router.get('/sku-exclusions', async (req, res) => {
  try {
    const patterns = await prisma.sKUExclusionPattern.findMany({
      orderBy: { pattern: 'asc' }
    });
    res.json(patterns);
  } catch (error) {
    console.error('Error fetching SKU exclusion patterns:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch exclusion patterns' });
  }
});

// POST /api/settings/sku-exclusions
router.post('/sku-exclusions', async (req, res) => {
  try {
    const { pattern, description } = req.body;

    if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
      return res.status(400).json({ message: 'Pattern is required' });
    }

    const patternRecord = await prisma.sKUExclusionPattern.create({
      data: {
        pattern: pattern.trim(),
        description: description?.trim() || null,
      }
    });

    res.json(patternRecord);
  } catch (error) {
    console.error('Error creating SKU exclusion pattern:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'This exclusion pattern already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create exclusion pattern' });
  }
});

// DELETE /api/settings/sku-exclusions/:id
router.delete('/sku-exclusions/:id', async (req, res) => {
  try {
    await prisma.sKUExclusionPattern.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting SKU exclusion pattern:', error);
    res.status(500).json({ message: error.message || 'Failed to delete exclusion pattern' });
  }
});

// ========== Category Exclusions ==========

// GET /api/settings/category-exclusions
router.get('/category-exclusions', async (req, res) => {
  try {
    const patterns = await prisma.categoryExclusionPattern.findMany({
      orderBy: { pattern: 'asc' }
    });
    res.json(patterns);
  } catch (error) {
    console.error('Error fetching category exclusion patterns:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch exclusion patterns' });
  }
});

// POST /api/settings/category-exclusions
router.post('/category-exclusions', async (req, res) => {
  try {
    const { pattern, description } = req.body;

    if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
      return res.status(400).json({ message: 'Pattern is required' });
    }

    const patternRecord = await prisma.categoryExclusionPattern.create({
      data: {
        pattern: pattern.trim(),
        description: description?.trim() || null,
      }
    });

    res.json(patternRecord);
  } catch (error) {
    console.error('Error creating category exclusion pattern:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'This exclusion pattern already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create exclusion pattern' });
  }
});

// DELETE /api/settings/category-exclusions/:id
router.delete('/category-exclusions/:id', async (req, res) => {
  try {
    await prisma.categoryExclusionPattern.delete({
      where: { id: req.params.id }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category exclusion pattern:', error);
    res.status(500).json({ message: error.message || 'Failed to delete exclusion pattern' });
  }
});

// ========== Categories ==========

// GET /api/settings/categories
router.get('/categories', async (req, res) => {
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

    // Fetch all categories from Dear Inventory
    const categories = await client.getAllCategories();

    // Get existing category exclusion patterns to mark which are already excluded
    const existingPatterns = await prisma.categoryExclusionPattern.findMany({
      select: { pattern: true }
    });
    const excludedCategories = new Set(existingPatterns.map(p => p.pattern));

    // Map to simpler format and mark which are excluded
    const mappedCategories = categories.map(category => ({
      id: category.ID,
      name: category.Name,
      isExcluded: excludedCategories.has(category.Name)
    }));

    // Sort alphabetically
    mappedCategories.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      success: true,
      categories: mappedCategories
    });
  } catch (error) {
    console.error('Error fetching categories from Dear Inventory:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch categories' });
  }
});

module.exports = router;

