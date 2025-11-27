import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const rfqs = await prisma.rFQ.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        suppliers: true,
      }
    })

    const formatted = rfqs.map(rfq => ({
      id: rfq.id,
      name: rfq.name,
      createdAt: rfq.createdAt.toISOString(),
      itemCount: rfq.items.length,
      supplierCount: rfq.suppliers.length,
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error('Error fetching RFQs:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch RFQs' },
      { status: 500 }
    )
  }
}

