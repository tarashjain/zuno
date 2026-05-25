import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from './providers'
import Navbar from '@/components/ui/Navbar'

export const metadata: Metadata = {
  title: 'Zuno — Party Game Hub',
  description: 'Your universal party game scorekeeper',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
