import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const body = await request.json()
    const { quantity } = body

    if (quantity === undefined || quantity < 0) {
      return NextResponse.json(
        { message: 'Invalid quantity' },
        { status: 400 }
      )
    }

    // Verify the item belongs to this RFQ
    const item = await prisma.rFQItem.findFirst({
      where: {
        id: params.itemId,
        rfqId: params.id
      }
    })

    if (!item) {
      return NextResponse.json(
        { message: 'Item not found' },
        { status: 404 }
      )
    }

    // Update quantity
    const updatedItem = await prisma.rFQItem.update({
      where: { id: params.itemId },
      data: { quantity: parseInt(quantity) }
    })

    return NextResponse.json(updatedItem)
  } catch (error: any) {
    console.error('Error updating item quantity:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update quantity' },
      { status: 500 }
    )
  }
}

