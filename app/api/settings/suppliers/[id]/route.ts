import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.globalSupplier.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting global supplier:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete supplier' },
      { status: 500 }
    )
  }
}

