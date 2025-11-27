import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RFQ Management System',
  description: 'Request for Quotation management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

