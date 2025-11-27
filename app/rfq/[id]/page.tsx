'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Papa from 'papaparse'

interface Supplier {
  id: string
  name: string
  email: string
  uniqueToken: string
}

interface RFQItem {
  id: string
  sku: string
  productName: string
  mpn: string
  category: string
  targetPrice: number
  quantity: number
  onOrder: number
}

interface QuoteSummary {
  itemId: string
  sku: string
  productName: string
  mpn: string
  category: string
  targetPrice: number
  quantity: number
  onOrder: number
  forcedSupplierId: string | null
  quotes: Array<{
    supplierId: string
    supplierName: string
    supplierEmail: string
    quotedPrice: number | null
    supplierMpn: string | null
    comments: string | null
  }>
}

interface RFQData {
  id: string
  name: string
  priceThreshold: number
  suppliers: Supplier[]
  items: RFQItem[]
}

export default function RFQDetail() {
  const params = useParams()
  const router = useRouter()
  const [rfq, setRfq] = useState<RFQData | null>(null)
  const [summary, setSummary] = useState<QuoteSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>('summary')
  const [deleting, setDeleting] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierEmail, setNewSupplierEmail] = useState('')
  const [addingSupplier, setAddingSupplier] = useState(false)
  const [globalSuppliers, setGlobalSuppliers] = useState<Array<{id: string, name: string, email: string}>>([])
  const [selectedGlobalSupplier, setSelectedGlobalSupplier] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({
    productName: '',
    sku: '',
    mpn: '',
    supplier: '',
  })
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [editingQuantity, setEditingQuantity] = useState<Record<string, string>>({})
  const [updatingQuantity, setUpdatingQuantity] = useState<string | null>(null)
  const [showWinningOnly, setShowWinningOnly] = useState<Record<string, boolean>>({})
  const [overridingItem, setOverridingItem] = useState<string | null>(null)
  const [creatingPO, setCreatingPO] = useState<string | null>(null)
  const [showNoQuotes, setShowNoQuotes] = useState<boolean>(false)
  const [showExceedsThreshold, setShowExceedsThreshold] = useState<boolean>(false)

  useEffect(() => {
    fetchRFQ()
    fetchSummary()
    fetchGlobalSuppliers()

    // Auto-refresh summary every 5 seconds
    const interval = setInterval(() => {
      if (activeTab === 'summary') {
        fetchSummary()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [params.id, activeTab])

  const fetchGlobalSuppliers = async () => {
    try {
      const response = await fetch('/api/settings/suppliers')
      const data = await response.json()
      setGlobalSuppliers(data)
    } catch (error) {
      console.error('Error fetching global suppliers:', error)
    }
  }

  const fetchRFQ = async () => {
    try {
      const response = await fetch(`/api/rfq/${params.id}`)
      const data = await response.json()
      setRfq(data)
    } catch (error) {
      console.error('Error fetching RFQ:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSummary = async () => {
    try {
      const response = await fetch(`/api/rfq/${params.id}/summary`)
      const data = await response.json()
      setSummary(data.summary)
    } catch (error) {
      console.error('Error fetching summary:', error)
    }
  }

  const handleQuantityChange = (itemId: string, newQuantity: string) => {
    setEditingQuantity(prev => ({
      ...prev,
      [itemId]: newQuantity
    }))
  }

  const handleQuantityBlur = async (itemId: string) => {
    const newQuantity = editingQuantity[itemId]
    if (newQuantity === undefined) return

    const item = summary.find(i => i.itemId === itemId)
    if (!item || parseInt(newQuantity) === item.quantity) {
      setEditingQuantity(prev => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      return
    }

    setUpdatingQuantity(itemId)
    try {
      const response = await fetch(`/api/rfq/${params.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: parseInt(newQuantity) })
      })

      if (response.ok) {
        await fetchSummary()
        setEditingQuantity(prev => {
          const next = { ...prev }
          delete next[itemId]
          return next
        })
      }
    } catch (error) {
      console.error('Error updating quantity:', error)
    } finally {
      setUpdatingQuantity(null)
    }
  }

  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, itemId: string) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    } else if (e.key === 'Escape') {
      setEditingQuantity(prev => {
        const next = { ...prev }
        delete next[itemId]
        return next
      })
      e.currentTarget.blur()
    }
  }

  const handleDeleteRFQ = async () => {
    if (!rfq) return

    const confirmed = confirm(
      `Are you sure you want to delete \"${rfq.name}\"?\n\nThis will permanently delete:\n- All RFQ items\n- All supplier quotes\n- All supplier links\n\nThis action cannot be undone.`
    )

    if (!confirmed) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/rfq/${params.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        router.push('/')
      } else {
        const error = await response.json()
        alert(`Failed to delete RFQ: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting RFQ:', error)
      alert('Failed to delete RFQ. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    
    let name = newSupplierName
    let email = newSupplierEmail

    // If a global supplier is selected, use that
    if (selectedGlobalSupplier) {
      const globalSupplier = globalSuppliers.find(s => s.id === selectedGlobalSupplier)
      if (globalSupplier) {
        name = globalSupplier.name
        email = globalSupplier.email
      }
    }

    if (!name || !email) return

    setAddingSupplier(true)
    try {
      const response = await fetch(`/api/rfq/${params.id}/supplier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
        })
      })

      if (response.ok) {
        setNewSupplierName('')
        setNewSupplierEmail('')
        setSelectedGlobalSupplier('')
        fetchRFQ()
        setActiveTab('summary')
      }
    } catch (error) {
      console.error('Error adding supplier:', error)
    } finally {
      setAddingSupplier(false)
    }
  }

  const getSupplierLink = (token: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/supplier/${token}`
    }
    return ''
  }

  const getCheapestQuote = (quotes: QuoteSummary['quotes'], forcedSupplierId: string | null = null) => {
    const validQuotes = quotes.filter(q => q.quotedPrice !== null && q.quotedPrice > 0)
    if (validQuotes.length === 0) return null
    
    // If there's a forced supplier, return that supplier's quote (if they have one)
    if (forcedSupplierId) {
      const forcedQuote = validQuotes.find(q => q.supplierId === forcedSupplierId)
      if (forcedQuote) return forcedQuote
    }
    
    // Otherwise, return the cheapest quote
    return validQuotes.reduce((min, q) => 
      (q.quotedPrice || Infinity) < (min.quotedPrice || Infinity) ? q : min
    )
  }

  const isPriceIncrease = (targetPrice: number, quotedPrice: number | null) => {
    if (!quotedPrice || !rfq) return false
    const increase = ((quotedPrice - targetPrice) / targetPrice) * 100
    return increase > (rfq.priceThreshold || 10)
  }

  const handleExportCSV = () => {
    const exportData = summary.map(item => {
      const cheapest = getCheapestQuote(item.quotes)
      return {
        SKU: item.sku,
        'Product Name': item.productName,
        MPN: item.mpn,
        Category: item.category,
        'Quantity Needed': item.quantity,
        'On Order': item.onOrder || 0,
        'Target Price': `£${item.targetPrice.toFixed(2)}`,
        'Selected Supplier': cheapest?.supplierName || '',
        'Selected Price': cheapest?.quotedPrice ? `£${cheapest.quotedPrice.toFixed(2)}` : '',
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

  if (!rfq) {
    return <div className="min-h-screen p-8">RFQ not found</div>
  }

  const suppliers = Array.from(new Set(
    summary.flatMap(item => item.quotes.map(q => q.supplierName).filter(Boolean))
  ))

  // Apply column filters and status filters
  let filteredSummary = summary.filter(item => {
    const cheapest = getCheapestQuote(item.quotes, item.forcedSupplierId)
    
    // Column filters
    if (columnFilters.productName && !item.productName.toLowerCase().includes(columnFilters.productName.toLowerCase())) {
      return false
    }
    if (columnFilters.sku && !item.sku.toLowerCase().includes(columnFilters.sku.toLowerCase())) {
      return false
    }
    if (columnFilters.mpn && !item.mpn.toLowerCase().includes(columnFilters.mpn.toLowerCase())) {
      return false
    }
    if (columnFilters.supplier && cheapest?.supplierName !== columnFilters.supplier) {
      return false
    }

    // Status filters
    if (showNoQuotes) {
      // Only show items with no quotes
      const hasAnyQuote = item.quotes.some(q => q.quotedPrice !== null && q.quotedPrice > 0)
      if (hasAnyQuote) {
        return false
      }
    }

    if (showExceedsThreshold) {
      // Only show items where price exceeds threshold
      if (!cheapest) {
        return false
      }
      const exceedsThreshold = isPriceIncrease(item.targetPrice, cheapest.quotedPrice)
      if (!exceedsThreshold) {
        return false
      }
    }

    return true
  })

  // Apply sorting
  const sortedSummary = [...filteredSummary].sort((a, b) => {
    if (sortColumn) {
      let aValue: any
      let bValue: any

      switch (sortColumn) {
        case 'productName':
          aValue = a.productName
          bValue = b.productName
          break
        case 'sku':
          aValue = a.sku
          bValue = b.sku
          break
        case 'mpn':
          aValue = a.mpn
          bValue = b.mpn
          break
        case 'targetPrice':
          aValue = a.targetPrice
          bValue = b.targetPrice
          break
        case 'quantity':
          aValue = a.quantity
          bValue = b.quantity
          break
        case 'bestPrice':
          aValue = getCheapestQuote(a.quotes)?.quotedPrice || Infinity
          bValue = getCheapestQuote(b.quotes)?.quotedPrice || Infinity
          break
        case 'supplier':
          aValue = getCheapestQuote(a.quotes)?.supplierName || ''
          bValue = getCheapestQuote(b.quotes)?.supplierName || ''
          break
        default:
          return 0
      }

      if (typeof aValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      } else {
        return sortDirection === 'asc' 
          ? (aValue || 0) - (bValue || 0)
          : (bValue || 0) - (aValue || 0)
      }
    }
    return 0
  })

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const getSupplierQuotes = (supplierId: string) => {
    return summary.map(item => {
      const quote = item.quotes.find(q => q.supplierId === supplierId)
      return {
        ...item,
        quote: quote || null
      }
    })
  }

  const renderSummaryTab = () => {
    // Get all suppliers from RFQ
    const allSuppliers = rfq?.suppliers || []
    const cheapestSupplierIds = new Map(
      sortedSummary.map(item => {
        const cheapest = getCheapestQuote(item.quotes, item.forcedSupplierId)
        return [item.itemId, cheapest?.supplierId || null]
      })
    )

    return (
      <div>
        <div className="card p-4 mb-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900">Summary</h2>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => setShowNoQuotes(!showNoQuotes)}
                className={`btn-secondary text-sm py-2 px-4 ${
                  showNoQuotes ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
                }`}
              >
                {showNoQuotes ? '✓ Unavailable Only' : 'Filter: Unavailable'}
              </button>
              <button
                onClick={() => setShowExceedsThreshold(!showExceedsThreshold)}
                className={`btn-secondary text-sm py-2 px-4 ${
                  showExceedsThreshold ? 'bg-red-600 text-white hover:bg-red-700' : ''
                }`}
              >
                {showExceedsThreshold ? '✓ Exceeds Threshold Only' : 'Filter: Exceeds Threshold'}
              </button>
              <button
                onClick={handleExportCSV}
                className="btn-primary bg-green-600 hover:bg-green-700 text-sm py-2 px-4"
              >
                📥 Export CSV
              </button>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <span>Product Name</span>
                      <button
                        onClick={() => handleSort('productName')}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {sortColumn === 'productName' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={columnFilters.productName}
                      onChange={(e) => setColumnFilters({...columnFilters, productName: e.target.value})}
                      placeholder="Filter..."
                      className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <span>SKU</span>
                      <button
                        onClick={() => handleSort('sku')}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {sortColumn === 'sku' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={columnFilters.sku}
                      onChange={(e) => setColumnFilters({...columnFilters, sku: e.target.value})}
                      placeholder="Filter..."
                      className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                    <div className="flex items-center gap-2">
                      <span>MPN</span>
                      <button
                        onClick={() => handleSort('mpn')}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {sortColumn === 'mpn' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={columnFilters.mpn}
                      onChange={(e) => setColumnFilters({...columnFilters, mpn: e.target.value})}
                      placeholder="Filter..."
                      className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[100px]">
                    <div className="flex items-center justify-end gap-2">
                      <span>Target</span>
                      <button
                        onClick={() => handleSort('targetPrice')}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {sortColumn === 'targetPrice' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[80px]">
                    <div className="flex items-center justify-end gap-2">
                      <span>Qty Needed</span>
                      <button
                        onClick={() => handleSort('quantity')}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {sortColumn === 'quantity' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[80px]">
                    <div className="flex items-center justify-end gap-2">
                      <span>On Order</span>
                    </div>
                  </th>
                  {allSuppliers.map(supplier => (
                    <th key={supplier.id} className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                      <div className="flex items-center justify-end gap-2">
                        <span>{supplier.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[100px] sticky right-0 bg-gray-50 z-10">
                    <span>Winning</span>
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[100px]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  // Group items by category
                  const groupedByCategory = sortedSummary.reduce((acc, item) => {
                    const category = item.category || 'Other'
                    if (!acc[category]) {
                      acc[category] = []
                    }
                    acc[category].push(item)
                    return acc
                  }, {} as Record<string, typeof sortedSummary>)

                  // Render grouped items
                  return Object.entries(groupedByCategory).flatMap(([category, items]) => [
                    // Category Header Row
                    <tr key={`header-${category}`} className="bg-gray-100 border-t-2 border-gray-300">
                      <td colSpan={7 + allSuppliers.length + 2} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-gray-800">{category}</span>
                          <span className="text-sm text-gray-600">({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                        </div>
                      </td>
                    </tr>,
                      // Items in this category
                      ...items.map((item) => {
                        const cheapest = getCheapestQuote(item.quotes, item.forcedSupplierId)
                        const priceExceedsThreshold = cheapest && isPriceIncrease(item.targetPrice, cheapest.quotedPrice)
                        const winningSupplierId = cheapestSupplierIds.get(item.itemId)

                      return (
                        <tr
                          key={item.itemId}
                          className={`hover:bg-gray-50 transition-colors ${
                            priceExceedsThreshold ? 'bg-red-50/30' : cheapest ? 'bg-green-50/30' : ''
                          }`}
                        >
                          <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-0 relative">
                            <div className="flex items-center gap-1">
                              {item.productName}
                              {(() => {
                                // Get all comments for this item
                                const allComments = item.quotes
                                  .filter(q => q.comments && q.comments.trim() !== '')
                                  .map(q => {
                                    const supplier = allSuppliers.find(s => s.id === q.supplierId)
                                    return { supplier: supplier?.name || 'Unknown', comment: q.comments }
                                  })
                                
                                if (allComments.length === 0) return null
                                
                                return (
                                  <div className="relative group/comment">
                                    <span className="text-xs text-blue-600 cursor-help">💬</span>
                                    <div className="absolute left-0 top-full mt-1 w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/comment:opacity-100 group-hover/comment:visible transition-all duration-200 pointer-events-none z-[9999]">
                                      <div className="font-semibold mb-2 text-blue-300">Supplier Comments:</div>
                                      {allComments.map((c, idx) => (
                                        <div key={idx} className="mb-2 last:mb-0">
                                          <div className="font-semibold text-blue-300">{c.supplier}:</div>
                                          <div className="whitespace-pre-wrap break-words ml-2">{c.comment}</div>
                                        </div>
                                      ))}
                                      <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-xs">{item.sku}</td>
                          <td className="px-3 py-2 text-gray-600 font-mono text-xs">{item.mpn}</td>
                          <td className="px-3 py-2 text-right text-gray-700 font-medium">
                            £{item.targetPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-700 font-medium">
                            {editingQuantity[item.itemId] !== undefined ? (
                              <input
                                type="number"
                                value={editingQuantity[item.itemId]}
                                onChange={(e) => handleQuantityChange(item.itemId, e.target.value)}
                                onBlur={() => handleQuantityBlur(item.itemId)}
                                onKeyDown={(e) => handleQuantityKeyDown(e, item.itemId)}
                                className="w-20 px-2 py-1 text-sm text-right border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                min="0"
                                autoFocus
                              />
                            ) : (
                              <button
                                onClick={() => handleQuantityChange(item.itemId, item.quantity.toString())}
                                className="text-gray-700 font-medium hover:text-blue-600 hover:underline px-2 py-1 rounded transition-colors"
                                disabled={updatingQuantity === item.itemId}
                                title="Click to edit quantity"
                              >
                                {updatingQuantity === item.itemId ? (
                                  <span className="text-xs">Updating...</span>
                                ) : (
                                  item.quantity
                                )}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 font-medium">
                            {item.onOrder > 0 ? item.onOrder : '-'}
                          </td>
                          {allSuppliers.map(supplier => {
                            const quote = item.quotes.find(q => q.supplierId === supplier.id)
                            const isWinning = winningSupplierId === supplier.id
                            const hasQuote = quote && quote.quotedPrice !== null && quote.quotedPrice > 0
                            const exceedsThreshold = hasQuote && isPriceIncrease(item.targetPrice, quote.quotedPrice)
                            const hasComments = quote && quote.comments && String(quote.comments).trim() !== ''

                            return (
                              <td
                                key={supplier.id}
                                className={`px-3 py-2 text-right font-medium ${
                                  isWinning ? 'bg-green-200 font-bold' : ''
                                } ${
                                  exceedsThreshold ? 'text-red-600' : hasQuote ? 'text-gray-700' : 'text-gray-400'
                                }`}
                              >
                                <div className="flex items-center justify-end gap-1">
                                  {hasQuote ? `£${quote.quotedPrice?.toFixed(2)}` : '-'}
                                  {hasComments && (
                                    <div className="relative inline-block group/comment">
                                      <span className="text-xs text-blue-600 cursor-help hover:text-blue-800">💬</span>
                                      <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover/comment:opacity-100 group-hover/comment:visible transition-all duration-200 pointer-events-none z-[9999] whitespace-normal">
                                        <div className="font-semibold mb-1 text-blue-300">{supplier.name} Comments:</div>
                                        <div className="whitespace-pre-wrap break-words">{String(quote.comments)}</div>
                                        <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-center sticky right-0 bg-white z-0">
                            {winningSupplierId ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 text-yellow-800 font-bold">
                                {allSuppliers.find(s => s.id === winningSupplierId)?.name || 'Winner'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {priceExceedsThreshold ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                ⚠ Exceeds
                              </span>
                            ) : cheapest ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                ✓ Good
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                Pending
                              </span>
                            )}
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

        {sortedSummary.length === 0 && (
          <div className="card p-8 text-center text-gray-500">
            No items match the current filters
          </div>
        )}
      </div>
    )
  }

  const handleOverride = async (itemId: string, supplierId: string | null) => {
    setOverridingItem(itemId)
    try {
      const response = await fetch(`/api/rfq/${params.id}/items/${itemId}/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forcedSupplierId: supplierId })
      })

      if (response.ok) {
        fetchSummary() // Refresh summary to update winning suppliers
      } else {
        const error = await response.json()
        alert(`Failed to set override: ${error.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error setting override:', error)
      alert('Failed to set override. Please try again.')
    } finally {
      setOverridingItem(null)
    }
  }

  const handleCreatePO = async (supplierId: string) => {
    if (!confirm('Create Purchase Order in Cin7 for all winning items for this supplier?')) {
      return
    }

    setCreatingPO(supplierId)
    try {
      const response = await fetch(`/api/rfq/${params.id}/supplier/${supplierId}/create-po`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Purchase Order ${data.orderNumber} created successfully!\n\n${data.itemCount} items added to PO.`)
      } else {
        alert(`Failed to create PO: ${data.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error creating PO:', error)
      alert('Failed to create Purchase Order. Please try again.')
    } finally {
      setCreatingPO(null)
    }
  }

  const renderSupplierTab = (supplier: Supplier) => {
    let supplierQuotes = getSupplierQuotes(supplier.id)
    const quotedCount = supplierQuotes.filter(item => item.quote && item.quote.quotedPrice !== null && item.quote.quotedPrice > 0).length
    
    // Filter to show only winning items if filter is enabled
    const filterKey = supplier.id
    if (showWinningOnly[filterKey]) {
      supplierQuotes = supplierQuotes.filter(item => {
        const cheapest = getCheapestQuote(item.quotes || [], item.forcedSupplierId)
        return cheapest?.supplierId === supplier.id || item.forcedSupplierId === supplier.id
      })
    }

    return (
      <div>
        <div className="card p-4 mb-4">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{supplier.name}</h2>
              <p className="text-sm text-gray-600">{supplier.email}</p>
              <p className="text-xs text-gray-500 mt-1">
                {quotedCount} of {getSupplierQuotes(supplier.id).length} items quoted
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={() => setShowWinningOnly({...showWinningOnly, [filterKey]: !showWinningOnly[filterKey]})}
                className={`btn-secondary text-sm py-2 px-4 ${
                  showWinningOnly[filterKey] ? 'bg-blue-600 text-white hover:bg-blue-700' : ''
                }`}
              >
                {showWinningOnly[filterKey] ? '✓ Showing Winning Only' : 'Filter: Show Winning Only'}
              </button>
              <button
                onClick={() => handleCreatePO(supplier.id)}
                disabled={creatingPO === supplier.id}
                className="btn-primary bg-green-600 hover:bg-green-700 text-sm py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingPO === supplier.id ? 'Creating PO...' : '📦 Create PO in Cin7'}
              </button>
            </div>
            <div className="w-full lg:w-auto">
              <p className="text-xs font-semibold text-gray-700 mb-1">Supplier Portal Link:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getSupplierLink(supplier.uniqueToken)}
                  className="input-field text-xs flex-1 lg:w-96 py-1.5"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(getSupplierLink(supplier.uniqueToken))
                    alert('Link copied to clipboard!')
                  }}
                  className="btn-secondary whitespace-nowrap text-sm py-1.5"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                    Product Name
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                    SKU
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                    MPN
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                    Category
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[100px]">
                    Target
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[80px]">
                    Qty Needed
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[80px]">
                    On Order
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[100px]">
                    Quoted Price
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                    Supplier MPN
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[100px]">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[200px]">
                    Comments
                  </th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-700 text-xs uppercase tracking-wide min-w-[120px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplierQuotes.map((item) => {
                  const quote = item.quote
                  const hasQuote = quote && quote.quotedPrice !== null && quote.quotedPrice > 0
                  const priceExceedsThreshold = hasQuote && isPriceIncrease(item.targetPrice, quote.quotedPrice)
                  
                  // Check if this supplier is winning (cheapest or forced)
                  const cheapest = getCheapestQuote(item.quotes || [], item.forcedSupplierId)
                  const isWinning = cheapest?.supplierId === supplier.id || item.forcedSupplierId === supplier.id
                  const isForced = item.forcedSupplierId === supplier.id

                  return (
                    <tr
                      key={item.itemId}
                      className={`hover:bg-gray-50 transition-colors ${
                        isWinning ? 'bg-yellow-50/50' : priceExceedsThreshold ? 'bg-red-50/30' : hasQuote ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-gray-900 sticky left-0 bg-white z-0">
                        {item.productName}
                      </td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">{item.sku}</td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">{item.mpn}</td>
                      <td className="px-3 py-2 text-gray-600">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">{item.category}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium">
                        £{item.targetPrice.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700 font-medium">
                        {item.quantity}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 font-medium">
                        {item.onOrder > 0 ? item.onOrder : '-'}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        priceExceedsThreshold ? 'text-red-600' : hasQuote ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                        {hasQuote ? `£${quote.quotedPrice?.toFixed(2)}` : 'Not quoted'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 font-mono text-xs">
                        {hasQuote && quote.supplierMpn ? quote.supplierMpn : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isWinning ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 text-yellow-800 font-bold">
                            {isForced ? '🔒 Forced' : '🏆 Winning'}
                          </span>
                        ) : priceExceedsThreshold ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            ⚠ Exceeds
                          </span>
                        ) : hasQuote ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            ✓ Quoted
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600 text-sm">
                        {hasQuote && quote.comments ? quote.comments : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isForced ? (
                          <button
                            onClick={() => handleOverride(item.itemId, null)}
                            disabled={overridingItem === item.itemId}
                            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Remove override"
                          >
                            {overridingItem === item.itemId ? '...' : 'Remove Override'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOverride(item.itemId, supplier.id)}
                            disabled={overridingItem === item.itemId || !hasQuote}
                            className="px-3 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Force purchase from this supplier even if price is higher"
                          >
                            {overridingItem === item.itemId ? '...' : 'Force Override'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Home
            </Link>
            <button
              onClick={handleDeleteRFQ}
              disabled={deleting}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete RFQ
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{rfq.name}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{rfq.items.length} items</span>
            <span>•</span>
            <span>{rfq.suppliers.length} suppliers</span>
            <span>•</span>
            <span>Threshold: {rfq.priceThreshold}%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="card mb-6 overflow-hidden">
          <div className="border-b border-gray-200 bg-white">
            <nav className="flex -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-6 py-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'summary'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                📊 Summary
              </button>
              {rfq.suppliers.map((supplier) => (
                <button
                  key={supplier.id}
                  onClick={() => setActiveTab(supplier.id)}
                  className={`px-6 py-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                    activeTab === supplier.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  👤 {supplier.name}
                </button>
              ))}
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-6 py-4 font-semibold text-sm border-b-2 transition-all whitespace-nowrap ${
                  activeTab === 'manage'
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                ⚙️ Manage Suppliers
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'summary' && renderSummaryTab()}
          {activeTab === 'manage' && (
            <div>
              <div className="card p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Add New Supplier</h2>
                  <Link href="/settings" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    ⚙️ Manage Global Suppliers →
                  </Link>
                </div>
                <form onSubmit={handleAddSupplier} className="space-y-4">
                  {globalSuppliers.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Or Select from Global Suppliers
                      </label>
                      <select
                        value={selectedGlobalSupplier}
                        onChange={(e) => {
                          setSelectedGlobalSupplier(e.target.value)
                          if (e.target.value) {
                            const supplier = globalSuppliers.find(s => s.id === e.target.value)
                            if (supplier) {
                              setNewSupplierName(supplier.name)
                              setNewSupplierEmail(supplier.email)
                            }
                          }
                        }}
                        className="input-field"
                      >
                        <option value="">Select a global supplier...</option>
                        {globalSuppliers.map(supplier => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name} ({supplier.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier Name</label>
                      <input
                        type="text"
                        placeholder="Enter supplier name"
                        value={newSupplierName}
                        onChange={(e) => {
                          setNewSupplierName(e.target.value)
                          setSelectedGlobalSupplier('')
                        }}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier Email</label>
                      <input
                        type="email"
                        placeholder="supplier@example.com"
                        value={newSupplierEmail}
                        onChange={(e) => {
                          setNewSupplierEmail(e.target.value)
                          setSelectedGlobalSupplier('')
                        }}
                        className="input-field"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={addingSupplier}
                    className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {addingSupplier ? 'Adding...' : '+ Add Supplier'}
                  </button>
                </form>
              </div>

              <div className="space-y-4">
                {rfq.suppliers.map((supplier) => (
                  <div key={supplier.id} className="card p-5">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div>
                        <h3 className="font-bold text-lg text-gray-900">{supplier.name}</h3>
                        <p className="text-sm text-gray-600">{supplier.email}</p>
                      </div>
                      <div className="w-full lg:w-auto">
                        <p className="text-sm font-semibold text-gray-700 mb-2">Supplier Portal Link:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={getSupplierLink(supplier.uniqueToken)}
                            className="input-field text-sm flex-1 lg:w-96"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(getSupplierLink(supplier.uniqueToken))
                              alert('Link copied to clipboard!')
                            }}
                            className="btn-secondary whitespace-nowrap"
                          >
                            📋 Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {rfq.suppliers.map((supplier) => (
            activeTab === supplier.id && renderSupplierTab(supplier)
          ))}
        </div>
      </div>
    </main>
  )
}
