import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DearInventoryClient } from '@/lib/dear-inventory'
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.DEAR_INVENTORY_ENCRYPTION_KEY || 'default-key-change-in-production'

function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export async function GET() {
  try {
    // Get Dear Inventory config
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    })

    if (!config) {
      return NextResponse.json(
        { message: 'Dear Inventory not configured' },
        { status: 400 }
      )
    }

    // Decrypt application key
    const applicationKey = decrypt(config.applicationKey)

    // Initialize Dear Inventory client
    const client = new DearInventoryClient({
      accountId: config.accountId,
      applicationKey,
      baseUrl: config.baseUrl
    })

    // Fetch all categories from Dear Inventory
    const categories = await client.getAllCategories()

    // Get existing category exclusion patterns to mark which are already excluded
    const existingPatterns = await prisma.categoryExclusionPattern.findMany({
      select: { pattern: true }
    })
    const excludedCategories = new Set(existingPatterns.map(p => p.pattern))

    // Map to simpler format and mark which are excluded
    const mappedCategories = categories.map(category => ({
      id: category.ID,
      name: category.Name,
      isExcluded: excludedCategories.has(category.Name)
    }))

    // Sort alphabetically
    mappedCategories.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      success: true,
      categories: mappedCategories
    })
  } catch (error: any) {
    console.error('Error fetching categories from Dear Inventory:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

