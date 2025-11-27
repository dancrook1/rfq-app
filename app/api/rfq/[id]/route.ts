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
        items: true,
        suppliers: true,
      }
    })

    if (!rfq) {
      return NextResponse.json(
        { message: 'RFQ not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(rfq)
  } catch (error: any) {
    console.error('Error fetching RFQ:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch RFQ' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if RFQ exists
    const rfq = await prisma.rFQ.findUnique({
      where: { id: params.id }
    })

    if (!rfq) {
      return NextResponse.json(
        { message: 'RFQ not found' },
        { status: 404 }
      )
    }

    // Delete RFQ (cascading deletes will handle items, suppliers, and quotes)
    await prisma.rFQ.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true, message: 'RFQ deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting RFQ:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete RFQ' },
      { status: 500 }
    )
  }
}

