import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const body = await request.json()
    const { forcedSupplierId } = body

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

    // If forcedSupplierId is provided, verify the supplier belongs to this RFQ
    if (forcedSupplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: forcedSupplierId,
          rfqId: params.id
        }
      })

      if (!supplier) {
        return NextResponse.json(
          { message: 'Supplier not found' },
          { status: 404 }
        )
      }
    }

    // Update the forced supplier
    const updatedItem = await prisma.rFQItem.update({
      where: { id: params.itemId },
      data: { forcedSupplierId: forcedSupplierId || null }
    })

    return NextResponse.json(updatedItem)
  } catch (error: any) {
    console.error('Error updating item override:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update override' },
      { status: 500 }
    )
  }
}

