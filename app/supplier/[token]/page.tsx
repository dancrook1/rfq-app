'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface RFQItem {
  id: string
  sku: string
  productName: string
  mpn: string
  category: string
  targetPrice: number
  quantity: number
  bestPrice?: number | null
  isWinning?: boolean
}

interface Quote {
  id?: string
  rfqItemId: string
  quotedPrice: string
  supplierMpn: string
  comments: string
}

interface SupplierData {
  id: string
  name: string
  email: string
  rfq: {
    id: string
    name: string
    items: RFQItem[]
  }
}

export default function SupplierPortal() {
  const params = useParams()
  const [supplierData, setSupplierData] = useState<SupplierData | null>(null)
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string>('')

  useEffect(() => {
    fetchSupplierData()

    const interval = setInterval(() => fetchSupplierData({ skipQuoteInit: true }), 5000)
    return () => clearInterval(interval)
  }, [params.token])

  const fetchSupplierData = async ({ skipQuoteInit = false }: { skipQuoteInit?: boolean } = {}) => {
    try {
      const response = await fetch(`/api/supplier/${params.token}`)
      if (!response.ok) {
        throw new Error('Invalid supplier token')
      }
      const data = await response.json()
      setSupplierData(data)
      
      // Initialize quotes object only if not skipping
      if (!skipQuoteInit) {
        const initialQuotes: Record<string, Quote> = {}
        data.rfq.items.forEach((item: RFQItem) => {
          if (data.existingQuotes && data.existingQuotes[item.id]) {
            initialQuotes[item.id] = data.existingQuotes[item.id]
          } else {
            initialQuotes[item.id] = {
              rfqItemId: item.id,
              quotedPrice: '',
              supplierMpn: '',
              comments: ''
            }
          }
        })
        setQuotes(initialQuotes)
        setActiveCategory('all')
      }
    } catch (error) {
      console.error('Error fetching supplier data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateQuote = (itemId: string, field: keyof Quote, value: string) => {
    setQuotes(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }))
    setSaved(false)
  }

  const handleSubmit = async () => {
    if (!supplierData) return

    setSaving(true)
    try {
      const response = await fetch(`/api/supplier/${params.token}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quotes: Object.values(quotes)
        })
      })

      if (response.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch (error) {
      console.error('Error saving quotes:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen p-8">Loading...</div>
  }

  if (!supplierData) {
    return <div className="min-h-screen p-8">Invalid supplier link</div>
  }

  const categories = Array.from(new Set(supplierData.rfq.items.map(item => item.category))).sort()
  const itemsInCategory = activeCategory === 'all' 
    ? supplierData.rfq.items 
    : supplierData.rfq.items.filter(item => item.category === activeCategory)

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold mb-2">{supplierData.rfq.name}</h1>
              <p className="text-gray-600">Supplier: {supplierData.name}</p>
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`px-6 py-3 rounded-lg text-white font-semibold ${
                saved
                  ? 'bg-green-600'
                  : saving
                  ? 'bg-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Submit Prices'}
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-lg transition font-medium ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Categories ({supplierData.rfq.items.length})
            </button>
            {categories.map((category) => {
              const categoryCount = supplierData.rfq.items.filter(item => item.category === category).length
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-2 rounded-lg transition ${
                    activeCategory === category
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {category} ({categoryCount})
                </button>
              )
            })}
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">SKU</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Product Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">MPN</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Target Price</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Current Lowest</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">Your Price</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Your MPN</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Comments</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  // Group items by category
                  const groupedByCategory = itemsInCategory.reduce((acc, item) => {
                    const category = item.category || 'Other'
                    if (!acc[category]) {
                      acc[category] = []
                    }
                    acc[category].push(item)
                    return acc
                  }, {} as Record<string, typeof itemsInCategory>)

                  // Render grouped items
                  return Object.entries(groupedByCategory).flatMap(([category, items]) => [
                    // Category Header Row
                    <tr key={`header-${category}`} className="bg-gray-100 border-t-2 border-gray-300">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-800">{category}</span>
                          <span className="text-sm text-gray-600">({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                        </div>
                      </td>
                    </tr>,
                    // Items in this category
                    ...items.map((item) => {
                      const quote = quotes[item.id] || {
                        rfqItemId: item.id,
                        quotedPrice: '',
                        supplierMpn: '',
                        comments: ''
                      }
                      const isWinning = item.isWinning || false
                      return (
                        <tr 
                          key={item.id} 
                          className={`border-b hover:bg-gray-50 ${
                            isWinning ? 'bg-green-100' : ''
                          }`}
                        >
                      <td className="px-4 py-3 text-sm">{item.sku}</td>
                      <td className="px-4 py-3 text-sm">{item.productName}</td>
                      <td className="px-4 py-3 text-sm">{item.mpn}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <div className="font-semibold">£{item.targetPrice.toFixed(2)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {item.bestPrice && item.bestPrice > 0 ? (
                          <span className="text-green-600 font-semibold">£{item.bestPrice.toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">No quotes yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{item.quantity}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quote.quotedPrice}
                          onChange={(e) => updateQuote(item.id, 'quotedPrice', e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={quote.supplierMpn}
                          onChange={(e) => updateQuote(item.id, 'supplierMpn', e.target.value)}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Your MPN"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <textarea
                          value={quote.comments}
                          onChange={(e) => updateQuote(item.id, 'comments', e.target.value)}
                          className="w-48 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Comments..."
                          rows={2}
                        />
                      </td>
                    </tr>
                      )
                    })
                  ])
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`px-6 py-3 rounded-lg text-white font-semibold ${
              saved
                ? 'bg-green-600'
                : saving
                ? 'bg-gray-400'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Submit Prices'}
          </button>
        </div>
      </div>
    </main>
  )
}

