import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DearInventoryClient } from '@/lib/dear-inventory'
import CryptoJS from 'crypto-js'

// Simple encryption key - in production, use environment variable
const ENCRYPTION_KEY = process.env.DEAR_INVENTORY_ENCRYPTION_KEY || 'default-key-change-in-production'

function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString()
}

function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export async function GET() {
  try {
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    })

    if (!config) {
      return NextResponse.json({ config: null })
    }

    return NextResponse.json({
      config: {
        id: config.id,
        accountId: config.accountId,
        baseUrl: config.baseUrl,
        isActive: config.isActive,
        lastProductSync: config.lastProductSync,
        lastSupplierSync: config.lastSupplierSync,
        // Don't return encrypted key
      }
    })
  } catch (error: any) {
    console.error('Error fetching Dear Inventory config:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch config' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accountId, applicationKey, baseUrl } = body

    if (!accountId || !applicationKey) {
      return NextResponse.json(
        { message: 'Account ID and Application Key are required' },
        { status: 400 }
      )
    }

    // Test connection before saving
    const client = new DearInventoryClient({
      accountId,
      applicationKey,
      baseUrl: baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2'
    })

    try {
      await client.testConnection()
    } catch (error: any) {
      return NextResponse.json(
        { message: `Failed to connect to Dear Inventory: ${error.message || 'Please check your credentials and API endpoint.'}` },
        { status: 400 }
      )
    }

    // Encrypt the application key
    const encryptedKey = encrypt(applicationKey)

    // Check if config exists
    const existing = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    })

    let config
    if (existing) {
      // Update existing
      config = await prisma.dearInventoryConfig.update({
        where: { id: existing.id },
        data: {
          accountId,
          applicationKey: encryptedKey,
          baseUrl: baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2',
          isActive: true,
        }
      })
    } else {
      // Create new
      config = await prisma.dearInventoryConfig.create({
        data: {
          accountId,
          applicationKey: encryptedKey,
          baseUrl: baseUrl || 'https://inventory.dearsystems.com/ExternalApi/v2',
          isActive: true,
        }
      })
    }

    return NextResponse.json({
      success: true,
      config: {
        id: config.id,
        accountId: config.accountId,
        baseUrl: config.baseUrl,
        isActive: config.isActive,
      }
    })
  } catch (error: any) {
    console.error('Error saving Dear Inventory config:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to save config' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    })

    if (config) {
      await prisma.dearInventoryConfig.update({
        where: { id: config.id },
        data: { isActive: false }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting Dear Inventory config:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete config' },
      { status: 500 }
    )
  }
}

