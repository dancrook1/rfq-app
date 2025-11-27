'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'

interface QuoteSummary {
  itemId: string
  sku: string
  productName: string
  mpn: string
  category: string
  targetPrice: number
  quantity: number
  quotes: Array<{
    supplierName: string
    supplierEmail: string
    quotedPrice: number | null
    supplierMpn: string | null
    comments: string | null
  }>
}

export default function RFQSummary() {
  const params = useParams()
  const [summary, setSummary] = useState<QuoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [priceThreshold, setPriceThreshold] = useState(10)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price')

  useEffect(() => {
    fetchSummary()
  }, [params.id])

  const fetchSummary = async () => {
    try {
      const response = await fetch(`/api/rfq/${params.id}/summary`)
      const data = await response.json()
      setSummary(data.summary)
      setPriceThreshold(data.priceThreshold || 10)
    } catch (error) {
      console.error('Error fetching summary:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCheapestQuote = (quotes: QuoteSummary['quotes']) => {
    const validQuotes = quotes.filter(q => q.quotedPrice !== null && q.quotedPrice > 0)
    if (validQuotes.length === 0) return null
    return validQuotes.reduce((min, q) => 
      (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
    )
  }

const isPriceIncrease = (targetPrice: number, quotedPrice: number | null) => {
  if (!quotedPrice || targetPrice <= 0) return false
  const increase = ((quotedPrice - targetPrice) / targetPrice) * 100
    return increase > priceThreshold
  }

  const handleExportCSV = () => {
    const exportData = summary.map(item => {
      const cheapest = getCheapestQuote(item.quotes)
      return {
        SKU: item.sku,
        'Product Name': item.productName,
        MPN: item.mpn,
        Category: item.category,
        Quantity: item.quantity,
        'Target Price': item.targetPrice,
        'Selected Supplier': cheapest?.supplierName || '',
        'Selected Price': cheapest?.quotedPrice || '',
        'Selected MPN': cheapest?.supplierMpn || '',
        'Supplier Comments': cheapest?.comments || '',
      }
    })

    const csv = Papa.unparse(exportData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rfq-export-${params.id}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="min-h-screen p-8">Loading...</div>
  }

  const categories = Array.from(new Set(summary.map(item => item.category)))
  const filteredSummary = selectedCategory === 'all'
    ? summary
    : summary.filter(item => item.category === selectedCategory)

  const sortedSummary = [...filteredSummary].sort((a, b) => {
    if (sortBy === 'price') {
      const aCheapest = getCheapestQuote(a.quotes)?.quotedPrice || Infinity
      const bCheapest = getCheapestQuote(b.quotes)?.quotedPrice || Infinity
      return aCheapest - bCheapest
    } else {
      return a.productName.localeCompare(b.productName)
    }
  })

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href={`/rfq/${params.id}`} className="text-blue-600 hover:underline">
            ← Back to RFQ
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold">RFQ Summary</h1>
            <button
              onClick={handleExportCSV}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Export CSV for ERP
            </button>
          </div>

          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium mb-1">Filter by Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'price' | 'name')}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="price">Price (Lowest First)</option>
                <option value="name">Product Name</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {sortedSummary.map((item) => {
            const cheapest = getCheapestQuote(item.quotes)
            const hasQuotes = item.quotes.some(q => q.quotedPrice !== null && q.quotedPrice > 0)

            return (
              <div key={item.itemId} className="bg-white rounded-lg shadow-md p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{item.productName}</h3>
                    <p className="text-sm text-gray-600">SKU: {item.sku} | MPN: {item.mpn}</p>
                    <p className="text-sm text-gray-600">Category: {item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Target Price: <span className="font-semibold">£{item.targetPrice.toFixed(2)}</span></p>
                    <p className="text-sm text-gray-600">Quantity: <span className="font-semibold">{item.quantity}</span></p>
                    {cheapest && (
                      <p className="text-sm mt-2">
                        Best Price: <span className={`font-semibold ${isPriceIncrease(item.targetPrice, cheapest.quotedPrice) ? 'text-red-600' : 'text-green-600'}`}>
                          £{cheapest.quotedPrice?.toFixed(2)}
                        </span>
                        {isPriceIncrease(item.targetPrice, cheapest.quotedPrice) && (
                          <span className="text-red-600 ml-2">⚠ Exceeds threshold</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {hasQuotes ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left">Supplier</th>
                          <th className="px-4 py-2 text-right">Quoted Price</th>
                          <th className="px-4 py-2 text-left">Supplier MPN</th>
                          <th className="px-4 py-2 text-left">Comments</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.quotes
                          .filter(q => q.quotedPrice !== null && q.quotedPrice > 0)
                          .sort((a, b) => (a.quotedPrice || 0) - (b.quotedPrice || 0))
                          .map((quote, idx) => (
                            <tr
                              key={idx}
                              className={`border-b ${
                                quote === cheapest ? 'bg-green-50' : ''
                              } ${
                                isPriceIncrease(item.targetPrice, quote.quotedPrice) ? 'bg-red-50' : ''
                              }`}
                            >
                              <td className="px-4 py-2">
                                {quote.supplierName}
                                {quote === cheapest && <span className="ml-2 text-green-600">✓ Best</span>}
                              </td>
                              <td className={`px-4 py-2 text-right font-semibold ${
                                isPriceIncrease(item.targetPrice, quote.quotedPrice) ? 'text-red-600' : ''
                              }`}>
                                £{quote.quotedPrice?.toFixed(2)}
                              </td>
                              <td className="px-4 py-2">{quote.supplierMpn || '-'}</td>
                              <td className="px-4 py-2">{quote.comments || '-'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No quotes received yet</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}

