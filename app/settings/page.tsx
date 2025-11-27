'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface GlobalSupplier {
  id: string
  name: string
  email: string
  dearSupplierId?: string | null
  syncedFromDear: boolean
  lastSyncedAt?: string | null
}

interface DearInventoryConfig {
  id: string
  accountId: string
  baseUrl: string
  isActive: boolean
  lastProductSync?: string | null
  lastSupplierSync?: string | null
}

export default function Settings() {
  const [suppliers, setSuppliers] = useState<GlobalSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [newSupplierName, setNewSupplierName] = useState('')
  const [newSupplierEmail, setNewSupplierEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  
  // Dear Inventory config state
  const [dearConfig, setDearConfig] = useState<DearInventoryConfig | null>(null)
  const [configAccountId, setConfigAccountId] = useState('')
  const [configApplicationKey, setConfigApplicationKey] = useState('')
  const [configBaseUrl, setConfigBaseUrl] = useState('https://inventory.dearsystems.com/ExternalApi/v2')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configError, setConfigError] = useState('')
  const [testingConnection, setTestingConnection] = useState(false)
  
  // Supplier sync state
  const [syncing, setSyncing] = useState(false)
  const [syncStrategy, setSyncStrategy] = useState<'merge' | 'replace' | 'supplement'>('merge')
  const [onlyActive, setOnlyActive] = useState(true)
  const [syncResults, setSyncResults] = useState<any>(null)
  
  // Individual supplier selection state
  const [dearSuppliers, setDearSuppliers] = useState<any[]>([])
  const [loadingDearSuppliers, setLoadingDearSuppliers] = useState(false)
  const [selectedDearSupplier, setSelectedDearSupplier] = useState('')
  const [addingSelectedSupplier, setAddingSelectedSupplier] = useState(false)
  
  // SKU Exclusion patterns state
  const [exclusionPatterns, setExclusionPatterns] = useState<any[]>([])
  const [newPattern, setNewPattern] = useState('')
  const [newPatternDescription, setNewPatternDescription] = useState('')
  const [addingPattern, setAddingPattern] = useState(false)
  
  // Category Exclusion patterns state
  const [categoryExclusionPatterns, setCategoryExclusionPatterns] = useState<any[]>([])
  const [newCategoryPattern, setNewCategoryPattern] = useState('')
  const [newCategoryPatternDescription, setNewCategoryPatternDescription] = useState('')
  const [addingCategoryPattern, setAddingCategoryPattern] = useState(false)
  const [dearCategories, setDearCategories] = useState<any[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')

  useEffect(() => {
    fetchSuppliers()
    fetchDearConfig()
    fetchExclusionPatterns()
    fetchCategoryExclusionPatterns()
  }, [])

  const fetchExclusionPatterns = async () => {
    try {
      const response = await fetch('/api/settings/sku-exclusions')
      const data = await response.json()
      setExclusionPatterns(data)
    } catch (error) {
      console.error('Error fetching exclusion patterns:', error)
    }
  }

  const handleAddExclusionPattern = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPattern.trim()) {
      setError('Please enter a pattern')
      return
    }

    setAddingPattern(true)
    setError('')
    try {
      const response = await fetch('/api/settings/sku-exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: newPattern.trim(),
          description: newPatternDescription.trim() || null,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add exclusion pattern')
      }

      setNewPattern('')
      setNewPatternDescription('')
      fetchExclusionPatterns()
    } catch (err: any) {
      setError(err.message || 'Failed to add exclusion pattern')
    } finally {
      setAddingPattern(false)
    }
  }

  const handleDeleteExclusionPattern = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exclusion pattern?')) return

    try {
      const response = await fetch(`/api/settings/sku-exclusions/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchExclusionPatterns()
      }
    } catch (error) {
      console.error('Error deleting exclusion pattern:', error)
    }
  }

  const fetchCategoryExclusionPatterns = async () => {
    try {
      const response = await fetch('/api/settings/category-exclusions')
      const data = await response.json()
      setCategoryExclusionPatterns(data)
    } catch (error) {
      console.error('Error fetching category exclusion patterns:', error)
    }
  }

  const handleLoadCategories = async () => {
    if (!dearConfig) {
      setConfigError('Please configure Dear Inventory API first')
      return
    }

    setLoadingCategories(true)
    setConfigError('')
    try {
      const response = await fetch('/api/settings/categories')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch categories')
      }

      setDearCategories(data.categories || [])
    } catch (err: any) {
      setConfigError(err.message || 'Failed to fetch categories from Dear Inventory')
    } finally {
      setLoadingCategories(false)
    }
  }

  const handleAddCategoryExclusionPattern = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Use selected category from dropdown if available, otherwise use manual input
    const categoryToAdd = selectedCategory || newCategoryPattern.trim()
    
    if (!categoryToAdd) {
      setError('Please select a category or enter a pattern')
      return
    }

    setAddingCategoryPattern(true)
    setError('')
    try {
      const response = await fetch('/api/settings/category-exclusions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: categoryToAdd,
          description: newCategoryPatternDescription.trim() || null,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add exclusion pattern')
      }

      setNewCategoryPattern('')
      setNewCategoryPatternDescription('')
      setSelectedCategory('')
      await fetchCategoryExclusionPatterns()
      // Reload categories to update "isExcluded" status
      if (dearCategories.length > 0) {
        await handleLoadCategories()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add exclusion pattern')
    } finally {
      setAddingCategoryPattern(false)
    }
  }

  const handleDeleteCategoryExclusionPattern = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exclusion pattern?')) return

    try {
      const response = await fetch(`/api/settings/category-exclusions/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchCategoryExclusionPatterns()
      }
    } catch (error) {
      console.error('Error deleting category exclusion pattern:', error)
    }
  }

  const fetchSuppliers = async () => {
    try {
      const response = await fetch('/api/settings/suppliers')
      const data = await response.json()
      setSuppliers(data)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSupplierName || !newSupplierEmail) {
      setError('Please provide both name and email')
      return
    }

    setAdding(true)
    setError('')
    try {
      const response = await fetch('/api/settings/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSupplierName,
          email: newSupplierEmail,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add supplier')
      }

      setNewSupplierName('')
      setNewSupplierEmail('')
      fetchSuppliers()
    } catch (err: any) {
      setError(err.message || 'Failed to add supplier')
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return

    try {
      const response = await fetch(`/api/settings/suppliers/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchSuppliers()
      }
    } catch (error) {
      console.error('Error deleting supplier:', error)
    }
  }

  const handleDeleteAllSuppliers = async () => {
    if (!confirm('Are you sure you want to delete ALL global suppliers? This action cannot be undone.')) return

    try {
      const response = await fetch('/api/settings/suppliers', {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully deleted ${data.deletedCount} supplier(s)`)
        fetchSuppliers()
      } else {
        const error = await response.json()
        setError(error.message || 'Failed to delete all suppliers')
      }
    } catch (error) {
      console.error('Error deleting all suppliers:', error)
      setError('Failed to delete all suppliers')
    }
  }

  const handleLoadDearSuppliers = async () => {
    if (!dearConfig) {
      setConfigError('Please configure Dear Inventory API first')
      return
    }

    setLoadingDearSuppliers(true)
    setConfigError('')
    try {
      const response = await fetch('/api/settings/suppliers/dear')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch suppliers')
      }

      setDearSuppliers(data.suppliers || [])
    } catch (err: any) {
      setConfigError(err.message || 'Failed to fetch suppliers from Dear Inventory')
    } finally {
      setLoadingDearSuppliers(false)
    }
  }

  const handleAddSelectedSupplier = async () => {
    if (!selectedDearSupplier) {
      setError('Please select a supplier')
      return
    }

    const supplier = dearSuppliers.find(s => s.id === selectedDearSupplier)
    if (!supplier) {
      setError('Selected supplier not found')
      return
    }

    if (supplier.alreadyAdded) {
      setError('This supplier is already added')
      return
    }

    if (!supplier.email) {
      setError('Selected supplier has no email address')
      return
    }

    setAddingSelectedSupplier(true)
    setError('')
    try {
      const response = await fetch('/api/settings/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: supplier.name,
          email: supplier.email,
          dearSupplierId: supplier.id,
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to add supplier')
      }

      setSelectedDearSupplier('')
      await fetchSuppliers()
      // Reload Dear suppliers to update "alreadyAdded" status
      await handleLoadDearSuppliers()
    } catch (err: any) {
      setError(err.message || 'Failed to add supplier')
    } finally {
      setAddingSelectedSupplier(false)
    }
  }

  const fetchDearConfig = async () => {
    try {
      const response = await fetch('/api/settings/dear-inventory')
      const data = await response.json()
      if (data.config) {
        setDearConfig(data.config)
        setConfigAccountId(data.config.accountId)
        setConfigBaseUrl(data.config.baseUrl)
      }
    } catch (error) {
      console.error('Error fetching Dear Inventory config:', error)
    }
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!configAccountId || !configApplicationKey) {
      setConfigError('Account ID and Application Key are required')
      return
    }

    setSavingConfig(true)
    setConfigError('')
    try {
      const response = await fetch('/api/settings/dear-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: configAccountId,
          applicationKey: configApplicationKey,
          baseUrl: configBaseUrl,
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save configuration')
      }

      setConfigApplicationKey('') // Clear password field
      await fetchDearConfig()
      setConfigError('')
    } catch (err: any) {
      setConfigError(err.message || 'Failed to save configuration')
    } finally {
      setSavingConfig(false)
    }
  }

  const handleTestConnection = async () => {
    if (!configAccountId || !configApplicationKey) {
      setConfigError('Please enter Account ID and Application Key first')
      return
    }

    setTestingConnection(true)
    setConfigError('')
    try {
      const response = await fetch('/api/settings/dear-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: configAccountId,
          applicationKey: configApplicationKey,
          baseUrl: configBaseUrl,
        })
      })

      const data = await response.json()
      if (response.ok) {
        setConfigError('')
        alert('Connection successful! Configuration saved.')
        setConfigApplicationKey('')
        await fetchDearConfig()
      } else {
        throw new Error(data.message || 'Connection failed')
      }
    } catch (err: any) {
      setConfigError(err.message || 'Connection test failed')
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSyncSuppliers = async () => {
    if (!dearConfig) {
      setConfigError('Please configure Dear Inventory API first')
      return
    }

    setSyncing(true)
    setSyncResults(null)
    setConfigError('')
    try {
      const response = await fetch('/api/settings/suppliers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: syncStrategy,
          onlyActive: onlyActive,
        })
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync suppliers')
      }

      setSyncResults(data.results)
      await fetchSuppliers()
      await fetchDearConfig()
    } catch (err: any) {
      setConfigError(err.message || 'Failed to sync suppliers')
    } finally {
      setSyncing(false)
    }
  }

  const handleDeleteConfig = async () => {
    if (!confirm('Are you sure you want to remove Dear Inventory configuration?')) return

    try {
      const response = await fetch('/api/settings/dear-inventory', {
        method: 'DELETE'
      })

      if (response.ok) {
        setDearConfig(null)
        setConfigAccountId('')
        setConfigApplicationKey('')
        setConfigBaseUrl('https://inventory.dearsystems.com/ExternalApi/v2')
      }
    } catch (error) {
      console.error('Error deleting config:', error)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2 mb-6">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage global suppliers and Dear Inventory API configuration</p>
        </div>

        {/* Dear Inventory Configuration */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Dear Inventory (Cin7) API Configuration</h2>
            {dearConfig && (
              <button
                onClick={handleDeleteConfig}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Remove Configuration
              </button>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Connect to your Dear Inventory account to automatically sync products and suppliers.
          </p>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Account ID</label>
                <input
                  type="text"
                  value={configAccountId}
                  onChange={(e) => setConfigAccountId(e.target.value)}
                  className="input-field"
                  placeholder="Your Dear Inventory Account ID"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Application Key</label>
                <input
                  type="password"
                  value={configApplicationKey}
                  onChange={(e) => setConfigApplicationKey(e.target.value)}
                  className="input-field"
                  placeholder="Your Dear Inventory Application Key"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Base URL</label>
              <input
                type="text"
                value={configBaseUrl}
                onChange={(e) => setConfigBaseUrl(e.target.value)}
                className="input-field"
                placeholder="https://inventory.dearsystems.com/ExternalApi/v2"
              />
            </div>
            {dearConfig && (
              <div className="p-3 bg-blue-50 border-l-4 border-blue-400 rounded">
                <p className="text-sm text-blue-700">
                  <strong>Status:</strong> Connected
                  {dearConfig.lastSupplierSync && (
                    <span className="ml-4">
                      Last supplier sync: {new Date(dearConfig.lastSupplierSync).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            )}
            {configError && (
              <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
                <p className="text-sm text-red-700">{configError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection || savingConfig}
                className="btn-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {testingConnection ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="submit"
                disabled={savingConfig || testingConnection}
                className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {savingConfig ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Supplier Sync */}
        {dearConfig && (
          <div className="card p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Sync Suppliers from Dear Inventory</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Sync Strategy</label>
                <select
                  value={syncStrategy}
                  onChange={(e) => setSyncStrategy(e.target.value as 'merge' | 'replace' | 'supplement')}
                  className="input-field"
                >
                  <option value="merge">Merge (Recommended) - Keep manual, update existing, add new</option>
                  <option value="replace">Replace All - Delete all and import from Dear Inventory</option>
                  <option value="supplement">Supplement Only - Only add new suppliers</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="onlyActive"
                  checked={onlyActive}
                  onChange={(e) => setOnlyActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="onlyActive" className="text-sm text-gray-700">
                  Only sync active suppliers
                </label>
              </div>
              {syncResults && (
                <div className="p-3 bg-green-50 border-l-4 border-green-400 rounded">
                  <p className="text-sm text-green-700">
                    <strong>Sync Complete:</strong> Added {syncResults.added}, Updated {syncResults.updated}, Skipped {syncResults.skipped}
                    {syncResults.errors && syncResults.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-semibold">Errors ({syncResults.errors.length})</summary>
                        <ul className="mt-2 list-disc list-inside text-xs">
                          {syncResults.errors.slice(0, 5).map((err: string, idx: number) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </p>
                </div>
              )}
              <button
                onClick={handleSyncSuppliers}
                disabled={syncing}
                className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {syncing ? 'Syncing...' : 'Sync Suppliers from Dear Inventory'}
              </button>
            </div>
          </div>
        )}

        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Add New Supplier</h2>
            {suppliers.length > 0 && (
              <button
                onClick={handleDeleteAllSuppliers}
                className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1 border border-red-300 rounded hover:bg-red-50"
              >
                Delete All Suppliers
              </button>
            )}
          </div>
          <form onSubmit={handleAddSupplier} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier Name</label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="input-field"
                  placeholder="Enter supplier name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Supplier Email</label>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  className="input-field"
                  placeholder="supplier@example.com"
                  required
                />
              </div>
            </div>
            {error && (
              <div className="p-3 bg-red-50 border-l-4 border-red-400 rounded">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={adding}
              className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {adding ? 'Adding...' : '+ Add Supplier'}
            </button>
          </form>
        </div>

        {/* Add Individual Supplier from Dear Inventory */}
        {dearConfig && (
          <div className="card p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Add Supplier from Dear Inventory</h2>
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleLoadDearSuppliers}
                disabled={loadingDearSuppliers}
                className="btn-secondary disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loadingDearSuppliers ? 'Loading...' : 'Load Suppliers from Dear Inventory'}
              </button>

              {dearSuppliers.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Select Supplier to Add
                    </label>
                    <select
                      value={selectedDearSupplier}
                      onChange={(e) => setSelectedDearSupplier(e.target.value)}
                      className="input-field"
                    >
                      <option value="">-- Select a supplier --</option>
                      {dearSuppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id} disabled={supplier.alreadyAdded}>
                          {supplier.name} {supplier.email ? `(${supplier.email})` : '(No email)'} {supplier.alreadyAdded ? '✓ Already Added' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSelectedSupplier}
                    disabled={!selectedDearSupplier || addingSelectedSupplier}
                    className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {addingSelectedSupplier ? 'Adding...' : 'Add Selected Supplier'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SKU Exclusion Patterns */}
        <div className="card p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">SKU Exclusion Patterns</h2>
          <p className="text-sm text-gray-600 mb-4">
            Exclude products from RFQs based on SKU patterns. Use <code className="bg-gray-100 px-1 rounded">*</code> as a wildcard.
            <br />
            Examples: <code className="bg-gray-100 px-1 rounded">BT_W2F_*</code> excludes all SKUs starting with "BT_W2F_", 
            <code className="bg-gray-100 px-1 rounded">SYS_*</code> excludes all system SKUs.
          </p>
          
          <form onSubmit={handleAddExclusionPattern} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pattern (e.g., BT_W2F_*)
                </label>
                <input
                  type="text"
                  value={newPattern}
                  onChange={(e) => setNewPattern(e.target.value)}
                  className="input-field"
                  placeholder="BT_W2F_*"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newPatternDescription}
                  onChange={(e) => setNewPatternDescription(e.target.value)}
                  className="input-field"
                  placeholder="Exclude Bluetooth products"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addingPattern}
              className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {addingPattern ? 'Adding...' : '+ Add Exclusion Pattern'}
            </button>
          </form>

          {exclusionPatterns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Pattern</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {exclusionPatterns.map((pattern) => (
                    <tr key={pattern.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-900">{pattern.pattern}</td>
                      <td className="px-4 py-3 text-gray-600">{pattern.description || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteExclusionPattern(pattern.id)}
                          className="text-red-600 hover:text-red-700 font-medium text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No exclusion patterns added yet.</p>
          )}
        </div>

        {/* Category Exclusion Patterns */}
        <div className="card p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Category Exclusion Patterns</h2>
          <p className="text-sm text-gray-600 mb-4">
            Exclude products from RFQs based on categories from Dear Inventory. Select categories from the dropdown or enter a custom pattern with wildcards.
          </p>
          
          {dearConfig && (
            <div className="mb-4">
              <button
                type="button"
                onClick={handleLoadCategories}
                disabled={loadingCategories}
                className="btn-secondary disabled:bg-gray-400 disabled:cursor-not-allowed mb-4"
              >
                {loadingCategories ? 'Loading...' : 'Load Categories from Dear Inventory'}
              </button>
            </div>
          )}

          <form onSubmit={handleAddCategoryExclusionPattern} className="space-y-4 mb-6">
            {dearCategories.length > 0 ? (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Category to Exclude
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value)
                    setNewCategoryPattern('') // Clear manual input when selecting from dropdown
                  }}
                  className="input-field"
                >
                  <option value="">-- Select a category --</option>
                  {dearCategories.map((category) => (
                    <option key={category.id} value={category.name} disabled={category.isExcluded}>
                      {category.name} {category.isExcluded ? '✓ Already Excluded' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Or enter a custom pattern below</p>
              </div>
            ) : null}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {dearCategories.length > 0 ? 'Custom Pattern (Optional)' : 'Category Pattern'}
                </label>
                <input
                  type="text"
                  value={newCategoryPattern}
                  onChange={(e) => {
                    setNewCategoryPattern(e.target.value)
                    setSelectedCategory('') // Clear dropdown selection when typing manually
                  }}
                  className="input-field"
                  placeholder={dearCategories.length > 0 ? "Or enter custom pattern (e.g., Test*)" : "Enter category name or pattern (e.g., Test*)"}
                  disabled={!!selectedCategory}
                />
                {dearCategories.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Use wildcards like * for pattern matching</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newCategoryPatternDescription}
                  onChange={(e) => setNewCategoryPatternDescription(e.target.value)}
                  className="input-field"
                  placeholder="Exclude test categories"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={addingCategoryPattern || (!selectedCategory && !newCategoryPattern.trim())}
              className="btn-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {addingCategoryPattern ? 'Adding...' : '+ Add Exclusion Pattern'}
            </button>
          </form>

          {categoryExclusionPatterns.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Pattern</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categoryExclusionPatterns.map((pattern) => (
                    <tr key={pattern.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-900">{pattern.pattern}</td>
                      <td className="px-4 py-3 text-gray-600">{pattern.description || '-'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteCategoryExclusionPattern(pattern.id)}
                          className="text-red-600 hover:text-red-700 font-medium text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No exclusion patterns added yet.</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Global Suppliers</h2>
          {suppliers.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No suppliers added yet. Add one above to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Source</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{supplier.name}</td>
                      <td className="px-4 py-3 text-gray-600">{supplier.email}</td>
                      <td className="px-4 py-3">
                        {supplier.syncedFromDear ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Dear Inventory
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Manual
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          className="text-red-600 hover:text-red-700 font-medium text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

