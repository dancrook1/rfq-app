/**
 * SKU and Category filtering utilities
 * Handles wildcard pattern matching for SKU and Category exclusions
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Convert wildcard pattern to regex
 * Supports * for any characters
 * Example: "BT_W2F_*" matches "BT_W2F_ABC", "BT_W2F_123", etc.
 */
function patternToRegex(pattern) {
  // Escape special regex characters except *
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  
  return new RegExp(`^${escaped}$`, 'i'); // Case-insensitive
}

/**
 * Check if a SKU matches any exclusion pattern
 */
function isSKUExcluded(sku, exclusionPatterns) {
  if (!sku || !exclusionPatterns || exclusionPatterns.length === 0) {
    return false;
  }

  const trimmedSku = sku.trim();
  
  for (const pattern of exclusionPatterns) {
    try {
      const regex = patternToRegex(pattern.pattern || pattern);
      if (regex.test(trimmedSku)) {
        return true;
      }
    } catch (error) {
      console.error(`Invalid exclusion pattern: ${pattern}`, error);
    }
  }

  return false;
}

/**
 * Check if a category matches any exclusion pattern
 */
function isCategoryExcluded(category, exclusionPatterns) {
  if (!category || !exclusionPatterns || exclusionPatterns.length === 0) {
    return false;
  }

  const trimmedCategory = category.trim();
  
  for (const pattern of exclusionPatterns) {
    try {
      const regex = patternToRegex(pattern.pattern || pattern);
      if (regex.test(trimmedCategory)) {
        return true;
      }
    } catch (error) {
      console.error(`Invalid exclusion pattern: ${pattern}`, error);
    }
  }

  return false;
}

/**
 * Filter out excluded items (both SKU and Category)
 */
function filterExcludedItems(items, skuExclusionPatterns, categoryExclusionPatterns) {
  let filtered = items;
  
  if (skuExclusionPatterns && skuExclusionPatterns.length > 0) {
    filtered = filtered.filter(item => !isSKUExcluded(item.sku, skuExclusionPatterns));
  }
  
  if (categoryExclusionPatterns && categoryExclusionPatterns.length > 0) {
    filtered = filtered.filter(item => !isCategoryExcluded(item.category, categoryExclusionPatterns));
  }
  
  return filtered;
}

/**
 * Get all active SKU exclusion patterns from database
 */
async function getSKUExclusionPatterns() {
  const patterns = await prisma.sKUExclusionPattern.findMany({
    where: {},
    select: { pattern: true }
  });
  return patterns;
}

/**
 * Get all active category exclusion patterns from database
 */
async function getCategoryExclusionPatterns() {
  const patterns = await prisma.categoryExclusionPattern.findMany({
    where: {},
    select: { pattern: true }
  });
  return patterns;
}

module.exports = {
  isSKUExcluded,
  isCategoryExcluded,
  filterExcludedItems,
  getSKUExclusionPatterns,
  getCategoryExclusionPatterns
};

