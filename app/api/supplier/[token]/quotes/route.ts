import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const body = await request.json()
    const { quotes } = body

    if (!quotes || !Array.isArray(quotes)) {
      return NextResponse.json(
        { message: 'Invalid quotes data' },
        { status: 400 }
      )
    }

    // Get supplier
    const supplier = await prisma.supplier.findUnique({
      where: { uniqueToken: params.token }
    })

    if (!supplier) {
      return NextResponse.json(
        { message: 'Invalid supplier token' },
        { status: 404 }
      )
    }

    // Upsert quotes
    await Promise.all(
      quotes.map(async (quote: any) => {
        if (quote.id) {
          // Update existing quote
          await prisma.quote.update({
            where: { id: quote.id },
            data: {
              quotedPrice: quote.quotedPrice ? parseFloat(quote.quotedPrice) : null,
              supplierMpn: quote.supplierMpn || null,
              comments: quote.comments || null,
            }
          })
        } else {
          // Create new quote
          await prisma.quote.create({
            data: {
              supplierId: supplier.id,
              rfqItemId: quote.rfqItemId,
              quotedPrice: quote.quotedPrice ? parseFloat(quote.quotedPrice) : null,
              supplierMpn: quote.supplierMpn || null,
              comments: quote.comments || null,
            }
          })
        }
      })
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving quotes:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to save quotes' },
      { status: 500 }
    )
  }
}

