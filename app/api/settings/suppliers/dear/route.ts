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

    // Fetch all suppliers from Dear Inventory
    const suppliers = await client.getAllSuppliers()

    // Get existing global suppliers to mark which are already added
    const existingSuppliers = await prisma.globalSupplier.findMany({
      select: { dearSupplierId: true }
    })
    const existingIds = new Set(existingSuppliers.map(s => s.dearSupplierId).filter(Boolean))

    // Map to a simpler format for the select box
    const mappedSuppliers = suppliers.map(supplier => {
      // Extract email from Contacts array or use Email/Contact field
      let email = ''
      if (supplier.Contacts && Array.isArray(supplier.Contacts) && supplier.Contacts.length > 0) {
        const contactWithEmail = supplier.Contacts.find((c: any) => c.Email)
        email = contactWithEmail?.Email || ''
      }
      if (!email) {
        email = supplier.Email || supplier.Contact || ''
      }

      return {
        id: supplier.ID,
        name: supplier.Name,
        email: email,
        status: (supplier as any).Status || 'Active',
        alreadyAdded: existingIds.has(supplier.ID)
      }
    })

    return NextResponse.json({
      success: true,
      suppliers: mappedSuppliers
    })
  } catch (error: any) {
    console.error('Error fetching Dear Inventory suppliers:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

