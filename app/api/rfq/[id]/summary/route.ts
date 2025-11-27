import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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
        }
      }
    })

    if (!rfq) {
      return NextResponse.json(
        { message: 'RFQ not found' },
        { status: 404 }
      )
    }

    // Filter out SYS_ and MPC_ SKUs (systems and barebone chassis) - only show components
    const componentItems = rfq.items.filter(item => 
      !item.sku.startsWith('SYS_') && !item.sku.startsWith('MPC_')
    )

    const summary = componentItems.map(item => ({
      itemId: item.id,
      sku: item.sku,
      productName: item.productName || '',
      mpn: item.mpn || '',
      category: item.category,
      targetPrice: item.targetPrice,
      quantity: item.quantity,
      onOrder: item.onOrder || 0,
      forcedSupplierId: item.forcedSupplierId,
      quotes: item.quotes.map(quote => ({
        supplierId: quote.supplier.id,
        supplierName: quote.supplier.name,
        supplierEmail: quote.supplier.email,
        quotedPrice: quote.quotedPrice,
        supplierMpn: quote.supplierMpn,
        comments: quote.comments,
      }))
    }))

    return NextResponse.json({
      summary,
      priceThreshold: rfq.priceThreshold
    })
  } catch (error: any) {
    console.error('Error fetching summary:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch summary' },
      { status: 500 }
    )
  }
}

