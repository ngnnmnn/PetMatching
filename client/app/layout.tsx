import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { CartProvider } from '@/context/CartContext'
import Chatbot from '@/components/Chatbot'
import RouteGuard from '@/components/auth/RouteGuard'

const _geist = Geist({ subsets: ['latin'] })
const _geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PetMatch - Tìm Bạn Đời Cho Thú Cưng',
  description: 'Nền tảng ghép đôi thú cưng hàng đầu Việt Nam',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="vi" className="bg-background" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <CartProvider>
          <RouteGuard>
            {children}
          </RouteGuard>
        </CartProvider>
        <Chatbot />
        <Toaster richColors position="bottom-center" closeButton />
        {process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true' && <Analytics />}
      </body>
    </html>
  )
}
