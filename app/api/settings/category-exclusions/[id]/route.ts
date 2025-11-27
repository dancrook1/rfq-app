import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.categoryExclusionPattern.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting category exclusion pattern:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete exclusion pattern' },
      { status: 500 }
    )
  }
}

