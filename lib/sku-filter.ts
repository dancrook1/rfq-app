/**
 * SKU and Category filtering utilities
 * Handles wildcard pattern matching for SKU and Category exclusions
 */

/**
 * Convert wildcard pattern to regex
 * Supports * for any characters
 * Example: "BT_W2F_*" matches "BT_W2F_ABC", "BT_W2F_123", etc.
 */
function patternToRegex(pattern: string): RegExp {
  // Escape special regex characters except *
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  
  return new RegExp(`^${escaped}$`, 'i') // Case-insensitive
}

/**
 * Check if a SKU matches any exclusion pattern
 */
export function isSKUExcluded(sku: string, exclusionPatterns: string[]): boolean {
  if (!sku || exclusionPatterns.length === 0) {
    return false
  }

  const trimmedSku = sku.trim()
  
  for (const pattern of exclusionPatterns) {
    try {
      const regex = patternToRegex(pattern)
      if (regex.test(trimmedSku)) {
        return true
      }
    } catch (error) {
      console.error(`Invalid exclusion pattern: ${pattern}`, error)
    }
  }

  return false
}

/**
 * Check if a category matches any exclusion pattern
 */
export function isCategoryExcluded(category: string, exclusionPatterns: string[]): boolean {
  if (!category || exclusionPatterns.length === 0) {
    return false
  }

  const trimmedCategory = category.trim()
  
  for (const pattern of exclusionPatterns) {
    try {
      const regex = patternToRegex(pattern)
      if (regex.test(trimmedCategory)) {
        return true
      }
    } catch (error) {
      console.error(`Invalid exclusion pattern: ${pattern}`, error)
    }
  }

  return false
}

/**
 * Filter out excluded SKUs from an array
 */
export function filterExcludedSKUs<T extends { sku: string }>(
  items: T[],
  exclusionPatterns: string[]
): T[] {
  if (exclusionPatterns.length === 0) {
    return items
  }

  return items.filter(item => !isSKUExcluded(item.sku, exclusionPatterns))
}

/**
 * Filter out excluded categories from an array
 */
export function filterExcludedCategories<T extends { category: string }>(
  items: T[],
  exclusionPatterns: string[]
): T[] {
  if (exclusionPatterns.length === 0) {
    return items
  }

  return items.filter(item => !isCategoryExcluded(item.category, exclusionPatterns))
}

/**
 * Filter out both excluded SKUs and categories from an array
 */
export function filterExcludedItems<T extends { sku: string; category: string }>(
  items: T[],
  skuExclusionPatterns: string[],
  categoryExclusionPatterns: string[]
): T[] {
  let filtered = items
  
  if (skuExclusionPatterns.length > 0) {
    filtered = filtered.filter(item => !isSKUExcluded(item.sku, skuExclusionPatterns))
  }
  
  if (categoryExclusionPatterns.length > 0) {
    filtered = filtered.filter(item => !isCategoryExcluded(item.category, categoryExclusionPatterns))
  }
  
  return filtered
}

/**
 * Get all active SKU exclusion patterns from database
 * This is a helper that can be used in API routes
 */
export async function getSKUExclusionPatterns(): Promise<string[]> {
  const { prisma } = await import('@/lib/prisma')
  const patterns = await prisma.sKUExclusionPattern.findMany({
    where: {}, // Could add isActive flag in future
    select: { pattern: true }
  })
  return patterns.map(p => p.pattern)
}

/**
 * Get all active category exclusion patterns from database
 * This is a helper that can be used in API routes
 */
export async function getCategoryExclusionPatterns(): Promise<string[]> {
  const { prisma } = await import('@/lib/prisma')
  const patterns = await prisma.categoryExclusionPattern.findMany({
    where: {}, // Could add isActive flag in future
    select: { pattern: true }
  })
  return patterns.map(p => p.pattern)
}

/**
 * Get all exclusion patterns (both SKU and Category)
 * Returns an object with skuPatterns and categoryPatterns
 */
export async function getAllExclusionPatterns(): Promise<{ skuPatterns: string[]; categoryPatterns: string[] }> {
  const [skuPatterns, categoryPatterns] = await Promise.all([
    getSKUExclusionPatterns(),
    getCategoryExclusionPatterns()
  ])
  return { skuPatterns, categoryPatterns }
}

