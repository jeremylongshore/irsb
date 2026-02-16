import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'IRSB Protocol - The Accountability Layer for Intent-Based Transactions',
    template: '%s | IRSB Protocol',
  },
  description: 'What happens when the solver fails? IRSB adds receipts, bonds, and disputes to intent-based systems. The missing accountability layer for ERC-7683.',
  keywords: ['IRSB', 'Intent Solver', 'Ethereum', 'ERC-7683', 'DeFi', 'Cross-chain', 'Blockchain', 'Accountability', 'Solver Bonds', 'Intent Receipts'],
  authors: [{ name: 'Intent Solutions', url: 'https://intentsolutions.io' }],
  creator: 'Intent Solutions',
  publisher: 'Intent Solutions',
  metadataBase: new URL('https://irsb-protocol.web.app'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://irsb-protocol.web.app',
    siteName: 'IRSB Protocol',
    title: 'IRSB Protocol - The Accountability Layer for Intent-Based Transactions',
    description: 'What happens when the solver fails? IRSB adds receipts, bonds, and disputes to intent-based systems. The missing accountability layer for ERC-7683.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'IRSB Protocol - The Credit Score Layer for Intent Solvers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IRSB Protocol - The Accountability Layer for Intent-Based Transactions',
    description: 'What happens when the solver fails? IRSB adds receipts, bonds, and disputes. The missing layer for ERC-7683.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-900 overflow-x-hidden`}>
        <Navigation />
        {children}
        <Footer />
      </body>
    </html>
  )
}
