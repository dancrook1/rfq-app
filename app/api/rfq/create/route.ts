import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractProductInfoFromCSVRow } from '@/lib/sku-lookup'
import { filterExcludedItems, getSKUExclusionPatterns, getCategoryExclusionPatterns } from '@/lib/sku-filter'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, priceThreshold, items } = body

    if (!name || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { message: 'Invalid request data' },
        { status: 400 }
      )
    }

    // Fetch all global suppliers
    const globalSuppliers = await prisma.globalSupplier.findMany({
      orderBy: { name: 'asc' }
    })

    // Get exclusion patterns
    const [skuExclusionPatterns, categoryExclusionPatterns] = await Promise.all([
      getSKUExclusionPatterns(),
      getCategoryExclusionPatterns()
    ])
    
    // Filter out excluded SKUs and categories
    const filteredItems = filterExcludedItems(items, skuExclusionPatterns, categoryExclusionPatterns)
    
    if (filteredItems.length === 0) {
      return NextResponse.json(
        { message: 'No items to add after applying exclusion patterns' },
        { status: 400 }
      )
    }

    // Create RFQ with items and automatically add global suppliers
    const rfq = await prisma.rFQ.create({
      data: {
        name,
        priceThreshold: priceThreshold || 10,
        items: {
          create: filteredItems.map((item: any) => {
            // Extract product info from CSV row data
            const productInfo = extractProductInfoFromCSVRow(
              item.sku,
              item.productName,
              item.category
            )
            
            return {
              sku: item.sku,
              productName: productInfo.productName,
              mpn: productInfo.mpn,
              category: productInfo.category,
              targetPrice: item.targetPrice || 0,
              quantity: item.quantity || 0,
              onOrder: item.onOrder || 0,
            }
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
    })

    return NextResponse.json({ rfqId: rfq.id })
  } catch (error: any) {
    console.error('Error creating RFQ:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create RFQ' },
      { status: 500 }
    )
  }
}

