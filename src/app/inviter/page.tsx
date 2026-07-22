'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'

/**
 * QR code d'installation, à afficher (ou imprimer) près de la cible :
 * scanner ouvre l'app, le bandeau d'installation fait le reste.
 */
export default function InviterPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [url, setUrl] = useState('')

  useEffect(() => {
    const appUrl = window.location.origin
    setUrl(appUrl)
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, appUrl, {
        width: 260,
        margin: 2,
        color: { dark: '#15120d', light: '#f0e8d6' },
      })
    }
  }, [])

  return (
    <div className="stack invite">
      <Link href="/joueurs" className="button-ghost">
        ← Joueurs
      </Link>
      <div className="invite__card">
        <h2 className="invite__title">Rejoignez la ligue</h2>
        <p className="invite__sub">
          Scannez pour ouvrir MyLegiDarts, puis ajoutez l’app à votre écran d’accueil.
        </p>
        <canvas ref={canvasRef} className="invite__qr" />
        {url && <p className="invite__url">{url}</p>}
      </div>
      <button type="button" className="button-ghost" onClick={() => window.print()}>
        Imprimer pour l’afficher près de la cible
      </button>
    </div>
  )
}
