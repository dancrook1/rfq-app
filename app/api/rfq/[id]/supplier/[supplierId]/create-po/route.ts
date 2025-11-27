import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DearInventoryClient } from '@/lib/dear-inventory'
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.DEAR_INVENTORY_ENCRYPTION_KEY || 'default-key-change-in-production'

function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; supplierId: string } }
) {
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

    // Get RFQ and supplier
    const rfq = await prisma.rFQ.findUnique({
      where: { id: params.id },
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
    })

    if (!rfq) {
      return NextResponse.json(
        { message: 'RFQ not found' },
        { status: 404 }
      )
    }

    const supplier = rfq.suppliers.find(s => s.id === params.supplierId)
    if (!supplier) {
      return NextResponse.json(
        { message: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Get global supplier to find Dear Inventory supplier ID
    const globalSupplier = await prisma.globalSupplier.findFirst({
      where: { name: supplier.name }
    })

    // Filter items where this supplier is winning (cheapest or forced)
    const winningItems = rfq.items
      .filter(item => {
        // Skip SYS_ and MPC_ SKUs
        if (item.sku.startsWith('SYS_') || item.sku.startsWith('MPC_')) {
          return false
        }

        // Skip items where quantity equals on order
        if (item.quantity === item.onOrder) {
          return false
        }

        // Check if this supplier is winning
        const quote = item.quotes.find(q => q.supplierId === supplier.id)
        const hasQuote = quote && quote.quotedPrice !== null && quote.quotedPrice > 0

        if (!hasQuote) {
          return false
        }

        // Check if forced to this supplier
        if (item.forcedSupplierId === supplier.id) {
          return true
        }

        // Check if cheapest
        const validQuotes = item.quotes.filter(q => q.quotedPrice !== null && q.quotedPrice > 0)
        if (validQuotes.length === 0) {
          return false
        }

        // If there's a forced supplier, they win
        if (item.forcedSupplierId) {
          return item.forcedSupplierId === supplier.id
        }

        // Otherwise, find cheapest
        const cheapestQuote = validQuotes.reduce((min, q) =>
          (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
        )

        return cheapestQuote.supplierId === supplier.id
      })
      .map(item => {
        const quote = item.quotes.find(q => q.supplierId === supplier.id)!
        return {
          item,
          quote,
        }
      })

    if (winningItems.length === 0) {
      return NextResponse.json(
        { message: 'No winning items found for this supplier' },
        { status: 400 }
      )
    }

    // Get product IDs for all SKUs
    const productMap = new Map<string, string>()
    for (const { item } of winningItems) {
      if (!productMap.has(item.sku)) {
        const product = await client.getProductBySKU(item.sku)
        if (product) {
          productMap.set(item.sku, product.ID)
        }
      }
    }

    // Build order lines
    const orderLines = await Promise.all(
      winningItems.map(async ({ item, quote }) => {
        const productId = productMap.get(item.sku)
        
        // Build comment from supplier comments and MPN
        const commentParts: string[] = []
        if (quote.comments) {
          commentParts.push(quote.comments)
        }
        if (quote.supplierMpn) {
          commentParts.push(`Supplier MPN: ${quote.supplierMpn}`)
        }
        const comment = commentParts.join(' | ') || undefined

        const line: any = {
          SKU: item.sku,
          Quantity: item.quantity,
          Price: quote.quotedPrice!,
          Discount: 0,
          Tax: 0,
          Total: quote.quotedPrice! * item.quantity,
        }

        if (productId) {
          line.ProductID = productId
        }

        if (item.productName) {
          line.Name = item.productName
        }

        if (quote.supplierMpn) {
          line.SupplierSKU = quote.supplierMpn
        }

        if (comment) {
          line.Comment = comment
        }

        return line
      })
    )

    // Get default location (you may want to make this configurable)
    const defaultLocation = 'Main Warehouse' // TODO: Make this configurable

    // Create the Purchase Order
    const result = await client.createPurchaseOrder(
      globalSupplier?.dearSupplierId || null,
      supplier.name,
      defaultLocation,
      orderLines,
      `RFQ: ${rfq.name} - Generated from RFQ system`,
      'STOCK'
    )

    return NextResponse.json({
      success: true,
      purchaseOrderId: result.ID,
      orderNumber: result.OrderNumber,
      itemCount: winningItems.length,
      message: `Purchase Order ${result.OrderNumber} created successfully with ${winningItems.length} items`
    })
  } catch (error: any) {
    console.error('Error creating purchase order:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create purchase order' },
      { status: 500 }
    )
  }
}

