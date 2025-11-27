import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DearInventoryClient } from '@/lib/dear-inventory'
import { filterExcludedItems, getSKUExclusionPatterns, getCategoryExclusionPatterns } from '@/lib/sku-filter'
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.DEAR_INVENTORY_ENCRYPTION_KEY || 'default-key-change-in-production'

function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export async function GET() {
  try {
    // Get Dear Inventory config
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    })

    if (!config) {
      return NextResponse.json(
        { message: 'Dear Inventory not configured' },
        { status: 400 }
      )
    }

    // Decrypt application key
    const applicationKey = decrypt(config.applicationKey)

    // Initialize Dear Inventory client
    const client = new DearInventoryClient({
      accountId: config.accountId,
      applicationKey,
      baseUrl: config.baseUrl
    })

    // Fetch products needing stock
    console.log('Fetching products needing stock from Dear Inventory...')
    const products = await client.getProductsNeedingStock()
    console.log(`Found ${products.length} products needing stock`)

    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        count: 0,
        message: 'No products found that need restocking. This could mean: 1) All products have sufficient stock (Available >= 0), 2) No inventory records exist for your products, or 3) Products may need to be synced in Dear Inventory first.'
      })
    }

    // Get exclusion patterns and filter
    const [skuExclusionPatterns, categoryExclusionPatterns] = await Promise.all([
      getSKUExclusionPatterns(),
      getCategoryExclusionPatterns()
    ])
    const filteredProducts = filterExcludedItems(products, skuExclusionPatterns, categoryExclusionPatterns)
    console.log(`After exclusion patterns: ${filteredProducts.length} products remaining (SKU patterns: ${skuExclusionPatterns.length}, Category patterns: ${categoryExclusionPatterns.length})`)

    if (filteredProducts.length === 0) {
      return NextResponse.json({
        success: true,
        products: [],
        count: 0,
        message: 'No products found after applying exclusion patterns. All products were excluded by your SKU exclusion rules.'
      })
    }

    // Map to RFQ format
    const mappedProducts = filteredProducts.map(product => {
      const inventory = product.inventory!
      const mpn = client.extractMPN(product)
      const salesPrice = product.PriceTier1 || 0
      const targetPrice = salesPrice > 0 ? salesPrice / 1.2 : 0
      
      // Use calculated quantity needed from the client (which accounts for OnHand and OnOrder, not Allocated)
      // Fallback to Available if calculatedQuantityNeeded is not available
      const quantityNeeded = (inventory as any).calculatedQuantityNeeded ?? Math.abs(inventory.Available)

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
      }
    })

    // Update last sync time
    await prisma.dearInventoryConfig.update({
      where: { id: config.id },
      data: { lastProductSync: new Date() }
    })

    return NextResponse.json({
      success: true,
      products: mappedProducts,
      count: mappedProducts.length,
    })
  } catch (error: any) {
    console.error('Error fetching products from Dear Inventory:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch products' },
      { status: 500 }
    )
  }
}

