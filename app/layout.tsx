import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Zuno — Party Game Hub',
  description: 'Your universal party game scorekeeper',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
