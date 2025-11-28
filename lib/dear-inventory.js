/**
 * Dear Inventory (Cin7) API Client
 * Documentation: https://dearinventory.docs.apiary.io/#
 */

class DearInventoryClient {
  constructor(config) {
    this.config = config;
    // Note: Base URL should end with /ExternalApi/v2/ (capital E and A)
    this.baseUrl = config.baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2';
    // Ensure base URL doesn't end with a slash (we'll add it in endpoints)
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers = {
      'api-auth-accountid': this.config.accountId,
      'api-auth-applicationkey': this.config.applicationKey,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Get response text first to check if it's JSON
      const responseText = await response.text();
      
      // Check if response is HTML (error page)
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
        const errorPreview = responseText.substring(0, 1000);
        console.error('Dear Inventory API returned HTML instead of JSON. Response preview:', errorPreview);
        
        // Try to extract error message from HTML if possible
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        const h1Match = responseText.match(/<h1[^>]*>(.*?)<\/h1>/i);
        const errorMsg = titleMatch ? titleMatch[1] : (h1Match ? h1Match[1] : 'Unknown error');
        
        throw new Error(
          `Dear Inventory API authentication failed (Status: ${response.status}). ` +
          `The API returned an HTML error page instead of JSON. ` +
          `Please verify: 1) Your Account ID and Application Key are correct, ` +
          `2) The Base URL is correct (default: https://inventory.dearsystems.com/ExternalApi/v2), ` +
          `3) Your API credentials have the necessary permissions. ` +
          `Error: ${errorMsg}`
        );
      }

      if (!response.ok) {
        // Try to parse as JSON error first
        try {
          const errorJson = JSON.parse(responseText);
          throw new Error(`Dear Inventory API error (${response.status}): ${errorJson.message || JSON.stringify(errorJson)}`);
        } catch {
          throw new Error(`Dear Inventory API error (${response.status}): ${responseText.substring(0, 200)}`);
        }
      }

      // Try to parse as JSON
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response:', responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Dear Inventory API: ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      console.error('Dear Inventory API request failed:', error);
      throw error;
    }
  }

  /**
   * Test API connection
   */
  async testConnection() {
    try {
      // Try to fetch a simple endpoint to test connection
      // Use /product endpoint with Limit parameter (capital L) to test
      const result = await this.request('/product?Limit=1');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all products
   */
  async getAllProducts() {
    const products = [];
    let page = 1;
    const limit = 100; // Adjust based on API limits

    while (true) {
      // API uses capital P and L for Page and Limit parameters
      const response = await this.request(`/product?Page=${page}&Limit=${limit}`);
      
      // Response format: { "Products": [...], "Total": ..., "Page": ... }
      if (!response || !response.Products || !Array.isArray(response.Products) || response.Products.length === 0) {
        break;
      }

      products.push(...response.Products);
      
      // If we got fewer than limit, we've reached the end
      if (response.Products.length < limit) {
        break;
      }

      page++;
    }

    return products;
  }

  /**
   * Get product by SKU
   */
  async getProductBySKU(sku) {
    try {
      // API uses capital S for Sku parameter
      const response = await this.request(`/product?Sku=${encodeURIComponent(sku)}`);
      
      // Response format: { "Products": [...], "Total": ..., "Page": ... }
      if (response && response.Products && Array.isArray(response.Products) && response.Products.length > 0) {
        return response.Products[0];
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching product by SKU ${sku}:`, error);
      return null;
    }
  }

  /**
   * Get inventory levels for products
   * Note: API pagination supports up to 1000 records per page
   */
  async getInventoryLevels(skus) {
    try {
      const allLevels = [];
      let page = 1;
      const limit = 1000; // Maximum page size
      
      while (true) {
        // API uses /ref/productavailability endpoint
        let endpoint = `/ref/productavailability?Page=${page}&Limit=${limit}`;
        
        // If filtering by SKU, add Sku parameter (API may only support single SKU)
        if (skus && skus.length === 1) {
          endpoint += `&Sku=${encodeURIComponent(skus[0])}`;
        }
        
        const response = await this.request(endpoint);
        // Response format: { "ProductAvailabilityList": [...], "Total": ..., "Page": ... }
        if (!response || !response.ProductAvailabilityList || !Array.isArray(response.ProductAvailabilityList)) {
          break;
        }
        
        const levels = response.ProductAvailabilityList;
        if (levels.length === 0) {
          break;
        }
        
        // If filtering by multiple SKUs, filter results
        if (skus && skus.length > 1) {
          const filtered = levels.filter((item) => {
            const itemSku = (item.SKU || '').trim();
            return skus.some(sku => sku.trim() === itemSku);
          });
          allLevels.push(...filtered);
        } else {
          allLevels.push(...levels);
        }
        
        // Check if we've reached the end
        const total = response.Total || 0;
        if (levels.length < limit || allLevels.length >= total) {
          break;
        }
        
        page++;
      }
      
      return allLevels;
    } catch (error) {
      console.error('Error fetching inventory levels:', error);
      return [];
    }
  }

  /**
   * Get products with inventory data that need restocking (Available < 0)
   */
  async getProductsNeedingStock() {
    try {
      console.log('Fetching all products...');
      const products = await this.getAllProducts();
      console.log(`Found ${products.length} total products`);
      
      // Filter out SYS_ and MPC_ SKUs first
      const componentProducts = products.filter(product => {
        const sku = (product.SKU || '').trim();
        return !sku.startsWith('SYS_') && !sku.startsWith('MPC_');
      });
      console.log(`Found ${componentProducts.length} component products (excluding SYS_/MPC_)`);
      
      // Get SKUs for component products
      const componentSKUs = componentProducts.map(p => (p.SKU || '').trim()).filter(sku => sku);
      console.log(`Fetching inventory for ${componentSKUs.length} component SKUs...`);
      
      // Fetch inventory levels - we'll fetch all and filter
      // Note: API might not support filtering by multiple SKUs, so fetch all and filter
      const allInventoryLevels = await this.getInventoryLevels();
      console.log(`Found ${allInventoryLevels.length} inventory level records`);
      
      // Create a map of SKU to inventory level (aggregate across locations)
      const inventoryMap = new Map();
      allInventoryLevels.forEach(level => {
        const sku = (level.SKU || '').trim();
        if (!sku) return;
        
        const existing = inventoryMap.get(sku);
        if (existing) {
          // Aggregate inventory across locations
          existing.OnHand = (existing.OnHand || 0) + (level.OnHand || 0);
          existing.Available = (existing.Available || 0) + (level.Available || 0);
          existing.OnOrder = (existing.OnOrder || 0) + (level.OnOrder || 0);
          existing.Allocated = (existing.Allocated || 0) + (level.Allocated || 0);
        } else {
          inventoryMap.set(sku, {
            SKU: sku,
            OnHand: level.OnHand || 0,
            Available: level.Available || 0,
            OnOrder: level.OnOrder || 0,
            Allocated: level.Allocated || 0,
          });
        }
      });
      
      console.log(`Created inventory map with ${inventoryMap.size} unique SKUs`);

      // Filter products that need stock
      // Exclude non-inventory and service items (Type = "Service" or "Non-Inventory")
      // Use Available < 0 to identify items needing stock, but calculate quantity without Allocated
      // Allocated represents reserved/committed stock and shouldn't affect purchase quantity
      console.log(`Filtering ${componentProducts.length} component products for stock needs...`);
      
      const productsNeedingStock = componentProducts
        .filter(product => {
          const sku = (product.SKU || '').trim();
          const inventory = inventoryMap.get(sku);
          
          if (!inventory) {
            // Product exists but no inventory record - might be new product
            console.log(`Product ${sku} excluded: No inventory record`);
            return false;
          }
          
          // Exclude non-inventory and service items
          // These show negative Available but aren't physical items to purchase
          const productType = (product.Type || '').trim();
          if (productType && (
              productType.toLowerCase() === 'service' || 
              productType.toLowerCase() === 'non-inventory' || 
              productType.toLowerCase() === 'non inventory')) {
            console.log(`Product ${sku} excluded: Type="${product.Type}" (non-inventory/service item)`);
            return false;
          }
          
          // Use Available < 0 to determine if stock is needed
          // Available = OnHand - Allocated - OnOrder
          // If Available < 0, we need stock (regardless of OnHand value)
          const available = inventory.Available || 0;
          const onHand = inventory.OnHand || 0;
          const onOrder = inventory.OnOrder || 0;
          const allocated = inventory.Allocated || 0;
          const needsStock = available < 0;
          
          if (needsStock) {
            console.log(`Product ${sku} needs stock: Available=${available}, OnHand=${onHand}, OnOrder=${onOrder}, Allocated=${allocated}, Type=${productType || 'Stock'}`);
          } else {
            // Log why it's not needed (for debugging)
            if (available >= 0) {
              console.log(`Product ${sku} doesn't need stock: Available=${available} (positive or zero)`);
            }
          }
          
          return needsStock;
        })
        .map(product => {
          const sku = (product.SKU || '').trim();
          const inventory = inventoryMap.get(sku);
          
          // Calculate quantity needed without using Allocated
          // Available = OnHand - Allocated - OnOrder
          // We want to calculate what we need to purchase, ignoring Allocated
          // 
          // The issue: Available includes Allocated, which is reserved stock
          // We should calculate: what we need = -(OnHand - OnOrder) if OnHand < OnOrder
          // But simpler: if Available < 0, we need stock
          // Quantity needed = |Available| (the shortfall shown)
          // However, Available already subtracts OnOrder, so |Available| is what we need total
          // But we should still show OnOrder separately so user knows what's coming
          const available = inventory.Available || 0;
          const onHand = inventory.OnHand || 0;
          const onOrder = inventory.OnOrder || 0;
          
          // Quantity needed = absolute value of Available
          // Available already accounts for OnOrder, so |Available| is the total shortfall
          // We display OnOrder separately so user can see what's coming
          // Example: Available = -10, OnOrder = 3 → quantity needed = 10 (OnOrder of 3 is shown separately)
          // This way the user sees: need 10 total, but 3 are coming, so effectively need 7 more
          const quantityNeeded = Math.abs(available);
          
          return {
            ...product,
            inventory: {
              ...inventory,
              calculatedQuantityNeeded: quantityNeeded
            },
          };
        });

      console.log(`Found ${productsNeedingStock.length} products needing restocking`);
      return productsNeedingStock;
    } catch (error) {
      console.error('Error fetching products needing stock:', error);
      throw error;
    }
  }

  /**
   * Get all suppliers from Dear Inventory
   */
  async getAllSuppliers() {
    try {
      const suppliers = [];
      let page = 1;
      const limit = 100;

      while (true) {
        // API uses /supplier (singular) with capital P and L
        const response = await this.request(`/supplier?Page=${page}&Limit=${limit}`);
        
        // Response format: { "SupplierList": [...], "Total": ..., "Page": ... }
        if (!response || !response.SupplierList || !Array.isArray(response.SupplierList) || response.SupplierList.length === 0) {
          break;
        }

        suppliers.push(...response.SupplierList);
        
        if (response.SupplierList.length < limit) {
          break;
        }

        page++;
      }

      return suppliers;
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }
  }

  /**
   * Get active suppliers only
   */
  async getActiveSuppliers() {
    // API supports IncludeDeprecated parameter, but we'll filter by Status field
    // Status can be "Active" or "Deprecated"
    const allSuppliers = await this.getAllSuppliers();
    return allSuppliers.filter(supplier => {
      // Check Status field (should be "Active") or IsActive if available
      return supplier.Status === 'Active' || supplier.IsActive !== false;
    });
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(id) {
    try {
      // API uses ID parameter in query string, not path
      const response = await this.request(`/supplier?ID=${encodeURIComponent(id)}`);
      // Response format: { "SupplierList": [...], "Total": ..., "Page": ... }
      if (response && response.SupplierList && Array.isArray(response.SupplierList) && response.SupplierList.length > 0) {
        return response.SupplierList[0];
      }
      return null;
    } catch (error) {
      console.error(`Error fetching supplier ${id}:`, error);
      return null;
    }
  }

  /**
   * Get all categories from Dear Inventory
   */
  async getAllCategories() {
    try {
      const categories = [];
      let page = 1;
      const limit = 100;

      while (true) {
        // API uses /ref/category endpoint with capital P and L
        const response = await this.request(`/ref/category?Page=${page}&Limit=${limit}`);
        
        // Response format: { "CategoryList": [...], "Total": ..., "Page": ... }
        if (!response || !response.CategoryList || !Array.isArray(response.CategoryList) || response.CategoryList.length === 0) {
          break;
        }

        categories.push(...response.CategoryList);
        
        if (response.CategoryList.length < limit) {
          break;
        }

        page++;
      }

      return categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Extract MPN from product (from SKU or custom field)
   * Uses existing extraction logic from sku-lookup.ts
   */
  extractMPN(product) {
    // Use existing MPN extraction logic
    const sku = product.SKU || '';
    
    // Handle SKUs with prefix like "FIFO-" by removing it first
    let cleanSku = sku;
    if (sku.includes('-') && sku.split('-').length > 1) {
      const firstPart = sku.split('-')[0];
      const rest = sku.substring(sku.indexOf('-') + 1);
      if (!firstPart.includes('_') && rest.includes('_')) {
        cleanSku = rest;
      }
    }
    
    // Split by underscore
    const parts = cleanSku.split('_');
    
    // Format is typically: CATEGORY_BRAND_MPN or CATEGORY_BRAND_MPN_SUFFIX
    if (parts.length >= 3) {
      return parts[2];
    } else if (parts.length === 2) {
      return parts[1];
    }
    
    // Fallback: return the SKU as-is if format doesn't match
    return sku;
  }

  /**
   * Create a Purchase Order in Dear Inventory
   * @param {string|null} supplierId - Dear Inventory Supplier ID
   * @param {string} supplierName - Supplier name (used if supplierId not available)
   * @param {string} location - Default location for stock
   * @param {Array} orderLines - Array of order line items
   * @param {string} note - Optional note for the purchase
   * @param {string} approach - "INVOICE" or "STOCK" (default: "STOCK")
   * @returns {Promise<{ID: string, TaskID: string, OrderNumber: string}>} The created Purchase Order with TaskID
   */
  async createPurchaseOrder(
    supplierId,
    supplierName,
    location,
    orderLines,
    note,
    approach = 'STOCK'
  ) {
    try {
      // Step 1: Create the Purchase (this creates the TaskID)
      const purchaseData = {
        Approach: approach,
        Location: location,
        BlindReceipt: false,
        CurrencyRate: 1,
      };

      if (supplierId) {
        purchaseData.SupplierID = supplierId;
      } else {
        purchaseData.Supplier = supplierName;
      }

      if (note) {
        purchaseData.Note = note;
      }

      const purchaseResponse = await this.request('/purchase', {
        method: 'POST',
        body: JSON.stringify(purchaseData),
      });

      if (!purchaseResponse.ID) {
        throw new Error('Failed to create purchase: No ID returned');
      }

      const taskId = purchaseResponse.ID;

      // Step 2: Create the Purchase Order with lines
      const orderData = {
        TaskID: taskId,
        CombineAdditionalCharges: false,
        Memo: note || '',
        Status: 'AUTHORISED',
        Lines: orderLines,
      };

      const orderResponse = await this.request('/purchase/order', {
        method: 'POST',
        body: JSON.stringify(orderData),
      });

      return {
        ID: taskId,
        TaskID: taskId,
        OrderNumber: purchaseResponse.OrderNumber || `PO-${taskId.substring(0, 8)}`,
      };
    } catch (error) {
      console.error('Error creating purchase order:', error);
      throw new Error(`Failed to create purchase order: ${error.message || 'Unknown error'}`);
    }
  }
}

module.exports = { DearInventoryClient };

