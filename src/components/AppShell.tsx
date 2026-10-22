'use client'

import { useEffect, useState } from 'react'
import { LeagueProvider } from '@/lib/LeagueProvider'
import { announcerVoice, warmUpVoices } from '@/lib/sound'
import { DialogProvider } from './Dialog'
import { IdleWatcher } from './IdleScreen'
import { InstallBanner } from './InstallBanner'
import { SoundToggle } from './SoundToggle'
import { TabBar } from './TabBar'
import { ToastProvider } from './Toaster'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [voice, setVoice] = useState<string | null>(null)

  useEffect(() => {
    // La liste des voix de Chromium se peuple après coup : on l'amorce tout de
    // suite pour que la première annonce ait déjà Piper sous la main.
    warmUpVoices()
    const refresh = () => setVoice(announcerVoice())
    refresh()
    window.speechSynthesis?.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', refresh)
  }, [])

  return (
    <ToastProvider>
      <DialogProvider>
        <LeagueProvider>
          <div className="app">
            <header className="masthead">
              <h1 className="masthead__title">
                <span>MyLegi</span>
                <span>Darts</span>
              </h1>
              <p className="masthead__tagline">Mes fléchettes juridiques</p>
              <SoundToggle voice={voice} />
            </header>

            <InstallBanner />

            <main className="content">{children}</main>

            <TabBar />
          </div>
          <IdleWatcher />
        </LeagueProvider>
      </DialogProvider>
    </ToastProvider>
  )
}
