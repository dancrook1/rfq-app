import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { uniqueToken: params.token },
      include: {
        rfq: {
          include: {
            items: {
              include: {
                quotes: true
              }
            }
          }
        },
        quotes: true
      }
    })

    if (!supplier) {
      return NextResponse.json(
        { message: 'Invalid supplier token' },
        { status: 404 }
      )
    }

    // Format existing quotes as a map
    const existingQuotes: Record<string, any> = {}
    supplier.quotes.forEach(quote => {
      existingQuotes[quote.rfqItemId] = {
        id: quote.id,
        rfqItemId: quote.rfqItemId,
        quotedPrice: quote.quotedPrice?.toString() || '',
        supplierMpn: quote.supplierMpn || '',
        comments: quote.comments || ''
      }
    })

    // Filter out SYS_ and MPC_ SKUs (systems and barebone chassis) - only show components
    // Also filter out items where quantity needed equals on order (already fully covered by existing orders)
    const filteredItems = supplier.rfq.items
      .filter(item => 
        !item.sku.startsWith('SYS_') && !item.sku.startsWith('MPC_') &&
        item.quantity !== item.onOrder // Exclude items where quantity needed equals on order
      )
      .map(item => {
        // Get all valid quotes
        const validQuotes = item.quotes?.filter(q => q.quotedPrice !== null && q.quotedPrice! > 0) || []
        
        // Determine winning supplier (considering forced supplier override)
        let winningSupplierId: string | null = null
        if (item.forcedSupplierId) {
          // If there's a forced supplier, they win (if they have a quote)
          const forcedQuote = validQuotes.find(q => q.supplierId === item.forcedSupplierId)
          if (forcedQuote) {
            winningSupplierId = item.forcedSupplierId
          }
        }
        
        // If no forced supplier or forced supplier has no quote, find cheapest
        if (!winningSupplierId && validQuotes.length > 0) {
          const cheapestQuote = validQuotes.reduce((min, q) =>
            (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
          )
          winningSupplierId = cheapestQuote.supplierId
        }
        
        // Get best price (lowest quote from any supplier)
        const bestQuote = validQuotes.length > 0
          ? validQuotes.reduce((min, q) =>
              (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
            )
          : null

        // Check if this supplier is winning
        const isWinning = winningSupplierId === supplier.id

        const { quotes, ...rest } = item
        return {
          ...rest,
          bestPrice: bestQuote?.quotedPrice || null,
          isWinning: isWinning
        }
      })

    return NextResponse.json({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      rfq: {
        ...supplier.rfq,
        items: filteredItems
      },
      existingQuotes
    })
  } catch (error: any) {
    console.error('Error fetching supplier data:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch supplier data' },
      { status: 500 }
    )
  }
}

