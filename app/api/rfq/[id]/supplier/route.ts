import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, email } = body

    if (!name || !email) {
      return NextResponse.json(
        { message: 'Name and email are required' },
        { status: 400 }
      )
    }

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

    // Create supplier with unique token
    const supplier = await prisma.supplier.create({
      data: {
        rfqId: params.id,
        name,
        email,
        uniqueToken: uuidv4(),
      }
    })

    return NextResponse.json(supplier)
  } catch (error: any) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create supplier' },
      { status: 500 }
    )
  }
}

