import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const suppliers = await prisma.globalSupplier.findMany({
      orderBy: { name: 'asc' }
    })
    return NextResponse.json(suppliers)
  } catch (error: any) {
    console.error('Error fetching global suppliers:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, dearSupplierId } = body

    if (!name || !email) {
      return NextResponse.json(
        { message: 'Name and email are required' },
        { status: 400 }
      )
    }

    const supplier = await prisma.globalSupplier.create({
      data: {
        name,
        email,
        dearSupplierId: dearSupplierId || null,
        syncedFromDear: !!dearSupplierId,
        lastSyncedAt: dearSupplierId ? new Date() : null,
      }
    })

    return NextResponse.json(supplier)
  } catch (error: any) {
    console.error('Error creating global supplier:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { message: 'A supplier with this name already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { message: error.message || 'Failed to create supplier' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const deleted = await prisma.globalSupplier.deleteMany({})
    return NextResponse.json({
      success: true,
      deletedCount: deleted.count
    })
  } catch (error: any) {
    console.error('Error deleting all global suppliers:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete all suppliers' },
      { status: 500 }
    )
  }
}

