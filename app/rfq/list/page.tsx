'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface RFQ {
  id: string
  name: string
  createdAt: string
  itemCount: number
  supplierCount: number
}

export default function RFQList() {
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRFQs()
  }, [])

  const fetchRFQs = async () => {
    try {
      const response = await fetch('/api/rfq/list')
      const data = await response.json()
      setRfqs(data)
    } catch (error) {
      console.error('Error fetching RFQs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen p-8">Loading...</div>
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">RFQ List</h1>
          <Link
            href="/rfq/create"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create New RFQ
          </Link>
        </div>

        {rfqs.length === 0 ? (
          <p className="text-gray-500">No RFQs found. Create one to get started.</p>
        ) : (
          <div className="grid gap-4">
            {rfqs.map((rfq) => (
              <Link
                key={rfq.id}
                href={`/rfq/${rfq.id}`}
                className="block p-6 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold mb-2">{rfq.name}</h2>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(rfq.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      {rfq.itemCount} items • {rfq.supplierCount} suppliers
                    </p>
                  </div>
                  <span className="text-blue-600">View →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

