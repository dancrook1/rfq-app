'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RFQSummary {
  id: string
  name: string
  createdAt: string
  itemCount: number
  supplierCount: number
  priceThreshold: number
  items: Array<{
    id: string
    sku: string
    productName: string
    mpn: string
    category: string
    targetPrice: number
    quantity: number
    onOrder: number
    quotes: Array<{
      supplierId: string
      supplierName: string
      quotedPrice: number | null
    }>
  }>
}

export default function Home() {
  const [rfqs, setRfqs] = useState<RFQSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllRFQs()
  }, [])

  const fetchAllRFQs = async () => {
    try {
      const response = await fetch('/api/rfq/list')
      const rfqList = await response.json()
      
      // Fetch summary for each RFQ
      const rfqSummaries = await Promise.all(
        rfqList.map(async (rfq: any) => {
          try {
            const summaryResponse = await fetch(`/api/rfq/${rfq.id}/summary`)
            const summaryData = await summaryResponse.json()
            return {
              ...rfq,
              priceThreshold: summaryData.priceThreshold || 10,
              items: summaryData.summary || []
            }
          } catch (error) {
            return {
              ...rfq,
              priceThreshold: 10,
              items: []
            }
          }
        })
      )
      
      setRfqs(rfqSummaries)
    } catch (error) {
      console.error('Error fetching RFQs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCheapestQuote = (quotes: RFQSummary['items'][0]['quotes']) => {
    const validQuotes = quotes.filter(q => q.quotedPrice !== null && q.quotedPrice > 0)
    if (validQuotes.length === 0) return null
    return validQuotes.reduce((min, q) => 
      (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
    )
  }

const isPriceIncrease = (targetPrice: number, quotedPrice: number | null, threshold: number) => {
  if (!quotedPrice || targetPrice <= 0) return false
  const increase = ((quotedPrice - targetPrice) / targetPrice) * 100
    return increase > threshold
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading RFQs...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">RFQ Management System</h1>
              <p className="text-gray-600">View and manage all your Request for Quotations</p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/settings"
                className="btn-secondary text-lg px-6 py-3"
              >
                ⚙️ Settings
              </Link>
              <Link
                href="/rfq/create"
                className="btn-primary text-lg px-6 py-3"
              >
                + Create New RFQ
              </Link>
            </div>
          </div>
        </div>

        {rfqs.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="max-w-md mx-auto">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No RFQs yet</h3>
              <p className="mt-2 text-sm text-gray-500">Get started by creating your first RFQ</p>
              <div className="mt-6">
                <Link href="/rfq/create" className="btn-primary">
                  Create RFQ
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {rfqs.map((rfq) => {
              const itemsWithQuotes = rfq.items.filter(item => 
                item.quotes.some(q => q.quotedPrice !== null && q.quotedPrice > 0)
              )
              const totalItems = rfq.items.length
              const quotedItems = itemsWithQuotes.length

              return (
                <div key={rfq.id} className="card p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <Link href={`/rfq/${rfq.id}`}>
                        <h2 className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
                          {rfq.name}
                        </h2>
                      </Link>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
                        <span>Created: {new Date(rfq.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{totalItems} items</span>
                        <span>•</span>
                        <span>{rfq.supplierCount} suppliers</span>
                        <span>•</span>
                        <span className={quotedItems === totalItems ? 'text-green-600 font-medium' : 'text-orange-600 font-medium'}>
                          {quotedItems}/{totalItems} quoted
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/rfq/${rfq.id}`}
                      className="btn-primary"
                    >
                      View Details →
                    </Link>
                  </div>

                  {/* Quick Summary Table */}
                  {itemsWithQuotes.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Product Name</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">SKU</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">MPN</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Target</th>
                            <th className="text-right py-3 px-4 font-semibold text-gray-700">Best Price</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Supplier</th>
                            <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {itemsWithQuotes.slice(0, 5).map((item) => {
                            const cheapest = getCheapestQuote(item.quotes)
                            const priceExceeds = cheapest && isPriceIncrease(
                              item.targetPrice,
                              cheapest.quotedPrice,
                              rfq.priceThreshold
                            )

                            return (
                              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-3 px-4 font-medium text-gray-900">{item.productName}</td>
                                <td className="py-3 px-4 text-gray-600">{item.sku}</td>
                                <td className="py-3 px-4 text-gray-600">{item.mpn}</td>
                                <td className="py-3 px-4 text-right text-gray-700">£{(item.targetPrice ?? 0).toFixed(2)}</td>
                                <td className={`py-3 px-4 text-right font-semibold ${priceExceeds ? 'text-red-600' : 'text-green-600'}`}>
                                  {cheapest ? `£${cheapest.quotedPrice?.toFixed(2)}` : '-'}
                                </td>
                                <td className="py-3 px-4 text-gray-600">{cheapest?.supplierName || '-'}</td>
                                <td className="py-3 px-4 text-center">
                                  {priceExceeds ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      ⚠ Exceeds
                                    </span>
                                  ) : cheapest ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      ✓ Good
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      Pending
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {itemsWithQuotes.length > 5 && (
                        <div className="mt-4 text-center">
                          <Link
                            href={`/rfq/${rfq.id}`}
                            className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                          >
                            View all {itemsWithQuotes.length} items →
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No quotes received yet. Share supplier links to get started.
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
