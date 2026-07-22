import { SerwistProvider } from '@serwist/turbopack/react'
import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, IBM_Plex_Sans } from 'next/font/google'
import { AppShell } from '@/components/AppShell'
import './globals.css'

const display = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

const body = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
  themeColor: '#15120D',
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
