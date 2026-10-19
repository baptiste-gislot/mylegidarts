import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MyLegiDarts',
    short_name: 'MyLegiDarts',
    description:
      'Leaderboard de fléchettes : 4 volées de 3 fléchettes, le meilleur score fait la loi.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1230',
    theme_color: '#0b1230',
    lang: 'fr',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
