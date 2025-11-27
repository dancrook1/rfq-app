'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'

interface CSVRow {
  SKU: string
  ProductName: string
  Category: string
  PriceTier1: string
  Available: string
  OnHand: string
  OnOrder: string
}

interface GlobalSupplier {
  id: string
  name: string
  email: string
}

interface DearProduct {
  sku: string
  productName: string
  category: string
  mpn: string
  targetPrice: number
  quantity: number
  onOrder: number
  available: number
  onHand: number
  dearProductId: string
}

export default function CreateRFQ() {
  const router = useRouter()
  const [rfqName, setRfqName] = useState('')
  const [priceThreshold, setPriceThreshold] = useState('10')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [globalSuppliers, setGlobalSuppliers] = useState<GlobalSupplier[]>([])
  const [dataSource, setDataSource] = useState<'csv' | 'api'>('csv')
  const [dearConfig, setDearConfig] = useState<any>(null)
  const [fetchingProducts, setFetchingProducts] = useState(false)
  const [dearProducts, setDearProducts] = useState<DearProduct[]>([])

  useEffect(() => {
    fetchGlobalSuppliers()
    checkDearConfig()
  }, [])

  const fetchGlobalSuppliers = async () => {
    try {
      const response = await fetch('/api/settings/suppliers')
      const data = await response.json()
      setGlobalSuppliers(data)
    } catch (error) {
      console.error('Error fetching global suppliers:', error)
    }
  }

  const checkDearConfig = async () => {
    try {
      const response = await fetch('/api/settings/dear-inventory')
      const data = await response.json()
      if (data.config) {
        setDearConfig(data.config)
      }
    } catch (error) {
      console.error('Error checking Dear Inventory config:', error)
    }
  }

  const handleFetchFromDear = async () => {
    setFetchingProducts(true)
    setError('')
    setDearProducts([])
    try {
      const response = await fetch('/api/dear-inventory/products')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch products')
      }

      setDearProducts(data.products || [])
      if (data.products && data.products.length === 0) {
        // Show helpful message from API if available
        setError(data.message || 'No products found that need restocking. This could mean all products have sufficient stock, or no inventory records exist.')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products from Dear Inventory')
    } finally {
      setFetchingProducts(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!rfqName) {
      setError('Please provide RFQ name')
      return
    }

    if (dataSource === 'csv' && !csvFile) {
      setError('Please provide CSV file')
      return
    }

    if (dataSource === 'api' && dearProducts.length === 0) {
      setError('Please fetch products from Dear Inventory first')
      return
    }

    setLoading(true)
    setError('')

    try {
      let items: any[] = []

      if (dataSource === 'csv') {
        // Parse CSV
        const text = await csvFile!.text()
        await new Promise<void>((resolve, reject) => {
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              try {
                const rows = results.data as CSVRow[]
                
                if (rows.length === 0) {
                  setError('CSV file is empty')
                  setLoading(false)
                  reject(new Error('CSV file is empty'))
                  return
                }

                items = rows
                  .filter(row => {
                    const sku = row.SKU?.trim();
                    const available = parseFloat(row.Available || '0');
                    if (!sku || sku.startsWith('SYS_') || sku.startsWith('MPC_')) {
                      return false;
                    }
                    return available < 0;
                  })
                  .map(row => {
                    const available = parseFloat(row.Available || '0');
                    const onOrder = parseFloat(row.OnOrder || '0');
                    
                    // Calculate quantity needed without using Allocated
                    // Available = OnHand - Allocated - OnOrder
                    // Quantity needed = |Available| (the shortfall) minus what's on order
                    // This gives us what we still need to purchase
                    // Example: Available = -10, OnOrder = 3 → need 7 more
                    // Example: Available = -5, OnOrder = 0 → need 5
                    const quantityNeeded = Math.max(0, Math.abs(available) - onOrder);
                    
                    const salesPrice = parseFloat(row.PriceTier1 || '0')
                    const expectedBuyPrice = salesPrice > 0 ? salesPrice / 1.2 : 0
                    
                    return {
                      sku: row.SKU?.trim() || '',
                      productName: row.ProductName?.trim() || '',
                      category: row.Category?.trim() || 'Other',
                      targetPrice: expectedBuyPrice,
                      quantity: quantityNeeded,
                      onOrder: Math.max(0, onOrder)
                    }
                  })
                resolve()
              } catch (err) {
                reject(err)
              }
            },
            error: (error) => {
              reject(new Error(`CSV parsing error: ${error.message}`))
            }
          })
        })
      } else {
        // Use Dear Inventory products
        items = dearProducts.map(product => ({
          sku: product.sku,
          productName: product.productName,
          category: product.category,
          targetPrice: product.targetPrice,
          quantity: product.quantity,
          onOrder: product.onOrder
        }))
      }

      // Send to API
      const response = await fetch('/api/rfq/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: rfqName,
          priceThreshold: parseFloat(priceThreshold),
          items: items
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create RFQ')
      }

      const data = await response.json()
      router.push(`/rfq/${data.rfqId}`)
    } catch (err: any) {
      setError(err.message || 'Failed to process data')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New RFQ</h1>
          <p className="text-gray-600">Import data from CSV or fetch directly from Dear Inventory</p>
          {globalSuppliers.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium mb-1">
                ℹ️ {globalSuppliers.length} global supplier{globalSuppliers.length !== 1 ? 's' : ''} will be automatically added:
              </p>
              <ul className="text-xs text-blue-700 list-disc list-inside">
                {globalSuppliers.map(supplier => (
                  <li key={supplier.id}>{supplier.name}</li>
                ))}
              </ul>
            </div>
          )}
          {globalSuppliers.length === 0 && (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ No global suppliers found. <Link href="/settings" className="font-medium underline">Add suppliers in Settings</Link> to automatically include them in new RFQs.
              </p>
            </div>
          )}
        </div>
        
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                RFQ Name
              </label>
              <input
                type="text"
                value={rfqName}
                onChange={(e) => setRfqName(e.target.value)}
                className="input-field"
                placeholder="e.g., Q4 2025 Component RFQ"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Price Increase Threshold (%)
              </label>
              <input
                type="number"
                value={priceThreshold}
                onChange={(e) => setPriceThreshold(e.target.value)}
                className="input-field"
                min="0"
                step="0.1"
                required
              />
              <p className="text-sm text-gray-500 mt-2">
                Quotes exceeding the expected price by this percentage will be highlighted in red
              </p>
            </div>

            {/* Data Source Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Data Source
              </label>
              <div className="flex gap-4 mb-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="csv"
                    checked={dataSource === 'csv'}
                    onChange={(e) => {
                      setDataSource('csv')
                      setDearProducts([])
                      setError('')
                    }}
                    className="mr-2"
                  />
                  <span>CSV Upload</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="api"
                    checked={dataSource === 'api'}
                    onChange={(e) => {
                      setDataSource('api')
                      setCsvFile(null)
                      setError('')
                    }}
                    className="mr-2"
                    disabled={!dearConfig}
                  />
                  <span>Dear Inventory API {!dearConfig && '(Not configured)'}</span>
                </label>
              </div>
            </div>

            {/* CSV Upload Section */}
            {dataSource === 'csv' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Availability Report CSV
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition-colors">
                <div className="space-y-1 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="flex text-sm text-gray-600">
                    <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="sr-only"
                        required
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    CSV files only. Required columns: SKU, ProductName, Category, PriceTier1, Available, OnOrder
                    <br />
                    <span className="text-blue-600 font-medium">Note: Only items with negative Available (stock needed) will be imported</span>
                  </p>
                  {csvFile && (
                    <p className="text-sm text-green-600 font-medium mt-2">
                      ✓ {csvFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Dear Inventory API Section */}
            {dataSource === 'api' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fetch Products from Dear Inventory
              </label>
              {!dearConfig ? (
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Dear Inventory API is not configured. <Link href="/settings" className="font-medium underline">Configure it in Settings</Link> first.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={handleFetchFromDear}
                    disabled={fetchingProducts}
                    className="btn-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {fetchingProducts ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Fetching...
                      </span>
                    ) : (
                      'Fetch Products from Dear Inventory'
                    )}
                  </button>
                  {dearProducts.length > 0 && (
                    <div className="p-4 bg-green-50 border-l-4 border-green-400 rounded-lg">
                      <p className="text-sm text-green-800 font-medium">
                        ✓ Found {dearProducts.length} product{dearProducts.length !== 1 ? 's' : ''} that need restocking
                      </p>
                      <p className="text-xs text-green-700 mt-1">
                        Products with negative Available quantity (excluding SYS_ and MPC_ SKUs)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border-l-4 border-red-400 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (dataSource === 'api' && dearProducts.length === 0)}
              className="w-full btn-primary text-lg py-3 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Create RFQ'
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

