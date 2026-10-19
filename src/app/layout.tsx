import { SerwistProvider } from '@serwist/turbopack/react'
import type { Metadata, Viewport } from 'next'
import { Archivo, Big_Shoulders } from 'next/font/google'
import { AppShell } from '@/components/AppShell'
import './globals.css'

// Lettrage de stade pour les titres et les scores, grotesque sobre pour le reste.
const display = Big_Shoulders({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-display',
})

const body = Archivo({
  subsets: ['latin'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  applicationName: 'MyLegiDarts',
  title: {
    default: 'MyLegiDarts',
    template: '%s · MyLegiDarts',
  },
  description:
    'Leaderboard de fléchettes : 4 volées de 3 fléchettes, le meilleur score fait la loi.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MyLegiDarts',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0B1230',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${display.variable} ${body.variable}`}>
      <body>
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === 'development'}>
          <AppShell>{children}</AppShell>
        </SerwistProvider>
      </body>
    </html>
  )
}
