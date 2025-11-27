import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DearInventoryClient } from '@/lib/dear-inventory'
import CryptoJS from 'crypto-js'

const ENCRYPTION_KEY = process.env.DEAR_INVENTORY_ENCRYPTION_KEY || 'default-key-change-in-production'

function decrypt(encryptedText: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY)
  return bytes.toString(CryptoJS.enc.Utf8)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { strategy = 'merge', onlyActive = true } = body

    // Get Dear Inventory config
    const config = await prisma.dearInventoryConfig.findFirst({
      where: { isActive: true }
    })

    if (!config) {
      return NextResponse.json(
        { message: 'Dear Inventory not configured. Please set up API credentials first.' },
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

    // Fetch suppliers from Dear Inventory
    const dearSuppliers = onlyActive
      ? await client.getActiveSuppliers()
      : await client.getAllSuppliers()

    // Get existing global suppliers
    const existingSuppliers = await prisma.globalSupplier.findMany()

    let added = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    // Process each Dear Inventory supplier
    for (const dearSupplier of dearSuppliers) {
      try {
        // Determine email from Contacts array (first contact with email) or Email/Contact field
        let email = ''
        if (dearSupplier.Contacts && Array.isArray(dearSupplier.Contacts) && dearSupplier.Contacts.length > 0) {
          const contactWithEmail = dearSupplier.Contacts.find((c: any) => c.Email)
          email = contactWithEmail?.Email || ''
        }
        // Fallback to direct Email or Contact field
        if (!email) {
          email = dearSupplier.Email || dearSupplier.Contact || ''
        }
        
        if (!email) {
          skipped++
          errors.push(`Supplier "${dearSupplier.Name}" skipped: No email found`)
          continue
        }

        // Find existing supplier
        let existing = existingSuppliers.find(
          s => s.dearSupplierId === dearSupplier.ID
        )

        if (!existing) {
          // Try matching by name
          existing = existingSuppliers.find(
            s => s.name.toLowerCase() === dearSupplier.Name.toLowerCase()
          )
        }

        if (strategy === 'replace') {
          // Delete all existing and create new
          if (existing) {
            await prisma.globalSupplier.delete({ where: { id: existing.id } })
          }
          await prisma.globalSupplier.create({
            data: {
              name: dearSupplier.Name,
              email: email,
              dearSupplierId: dearSupplier.ID,
              syncedFromDear: true,
              lastSyncedAt: new Date(),
            }
          })
          added++
        } else if (strategy === 'merge') {
          if (existing) {
            // Update existing supplier
            await prisma.globalSupplier.update({
              where: { id: existing.id },
              data: {
                name: dearSupplier.Name,
                email: email,
                dearSupplierId: dearSupplier.ID,
                syncedFromDear: true,
                lastSyncedAt: new Date(),
              }
            })
            updated++
          } else {
            // Create new supplier
            await prisma.globalSupplier.create({
              data: {
                name: dearSupplier.Name,
                email: email,
                dearSupplierId: dearSupplier.ID,
                syncedFromDear: true,
                lastSyncedAt: new Date(),
              }
            })
            added++
          }
        } else if (strategy === 'supplement') {
          // Only add if doesn't exist
          if (!existing) {
            await prisma.globalSupplier.create({
              data: {
                name: dearSupplier.Name,
                email: email,
                dearSupplierId: dearSupplier.ID,
                syncedFromDear: true,
                lastSyncedAt: new Date(),
              }
            })
            added++
          } else {
            skipped++
          }
        }
      } catch (error: any) {
        errors.push(`Error processing supplier "${dearSupplier.Name}": ${error.message}`)
        skipped++
      }
    }

    // Update last sync time
    await prisma.dearInventoryConfig.update({
      where: { id: config.id },
      data: { lastSupplierSync: new Date() }
    })

    return NextResponse.json({
      success: true,
      results: {
        added,
        updated,
        skipped,
        total: dearSuppliers.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      lastSyncedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error syncing suppliers:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to sync suppliers' },
      { status: 500 }
    )
  }
}

