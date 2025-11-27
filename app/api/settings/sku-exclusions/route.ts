import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const patterns = await prisma.sKUExclusionPattern.findMany({
      orderBy: { pattern: 'asc' }
    })
    return NextResponse.json(patterns)
  } catch (error: any) {
    console.error('Error fetching SKU exclusion patterns:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch exclusion patterns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { pattern, description } = body

    if (!pattern || typeof pattern !== 'string' || pattern.trim() === '') {
      return NextResponse.json(
        { message: 'Pattern is required' },
        { status: 400 }
      )
    }

    const patternRecord = await prisma.sKUExclusionPattern.create({
      data: {
        pattern: pattern.trim(),
        description: description?.trim() || null,
      }
    })

    return NextResponse.json(patternRecord)
  } catch (error: any) {
    console.error('Error creating SKU exclusion pattern:', error)
    if (error.code === 'P2002') {
      return NextResponse.json(
        { message: 'This exclusion pattern already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { message: error.message || 'Failed to create exclusion pattern' },
      { status: 500 }
    )
  }
}

