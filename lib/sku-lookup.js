/**
 * SKU lookup and product information extraction
 */

// Extract MPN from SKU format: XX_XX_MPN HERE
// Examples:
// - FIFO-MM_GS_F5-5600J3636C16GX2-RS5K_FIFO -> F5-5600J3636C16GX2-RS5K
// - PS_CS_SHFT1000 -> SHFT1000
// - MM_W2F_16D43600DC -> 16D43600DC
// - MB_AS_90MB1M90-M0EAY0 -> 90MB1M90-M0EAY0
function extractMPNFromSKU(sku) {
  if (!sku) return '';
  
  // Handle SKUs with prefix like "FIFO-" by removing it first
  let cleanSku = sku;
  if (sku.includes('-') && sku.split('-').length > 1) {
    // Check if there's a prefix pattern (e.g., "FIFO-MM_GS_...")
    const firstPart = sku.split('-')[0];
    const rest = sku.substring(sku.indexOf('-') + 1);
    // If the first part doesn't contain underscore and rest does, it's likely a prefix
    if (!firstPart.includes('_') && rest.includes('_')) {
      cleanSku = rest;
    }
  }
  
  // Split by underscore
  const parts = cleanSku.split('_');
  
  // Format is typically: CATEGORY_BRAND_MPN or CATEGORY_BRAND_MPN_SUFFIX
  // MPN is always the 3rd part (index 2) if we have at least 3 parts
  if (parts.length >= 3) {
    return parts[2];
  } else if (parts.length === 2) {
    // Some SKUs might only have 2 parts, use the second as MPN
    return parts[1];
  }
  
  // Fallback: return the SKU as-is if format doesn't match
  return sku;
}

/**
 * Extract product information from CSV row data
 * @param {string} sku - Product SKU
 * @param {string} productName - Product name from CSV
 * @param {string} category - Category from CSV
 * @returns {Object} Product info with productName, mpn, and category
 */
function extractProductInfoFromCSVRow(sku, productName, category) {
  const mpn = extractMPNFromSKU(sku);
  
  return {
    productName: productName || sku,
    mpn: mpn,
    category: category || 'Uncategorized'
  };
}

module.exports = {
  extractMPNFromSKU,
  extractProductInfoFromCSVRow
};

