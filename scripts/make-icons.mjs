// Génère les icônes PWA (une cible de fléchettes) sans dépendance externe :
// rendu par pixel + encodage PNG à la main (zlib natif de Node).
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const INK = [0x15, 0x12, 0x0d, 255]
const BLACK = [0x23, 0x20, 0x1a, 255]
const CREAM = [0xec, 0xe3, 0xcd, 255]
const RED = [0xd8, 0x40, 0x2f, 255]
const GREEN = [0x3f, 0x8f, 0x5b, 255]
const WIRE = [0x0d, 0x0b, 0x08, 255]
const TRANSPARENT = [0, 0, 0, 0]

/** Couleur de la cible pour un point (dx, dy) normalisé par le rayon R. */
function boardColor(dx, dy, R, background) {
  const r = Math.hypot(dx, dy) / R
  if (r > 1.02) return background
  if (r > 1) return WIRE // fil extérieur

  if (r <= 0.07) return RED // bull (50)
  if (r <= 0.16) return GREEN // couronne du bull (25)

  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360 + 99) % 360
  const sector = Math.floor(angle / 18)
  const dark = sector % 2 === 0

  const ringColor = dark ? RED : GREEN
  const fieldColor = dark ? BLACK : CREAM

  if (r <= 0.42) return fieldColor
  if (r <= 0.5) return ringColor // anneau des triples
  if (r <= 0.9) return fieldColor
  return ringColor // anneau des doubles
}

function render(size, { boardRatio, background }) {
  const pixels = new Uint8Array(size * size * 4)
  const c = size / 2
  const R = size * boardRatio
  const SS = 2 // sur-échantillonnage 2×2 pour l'anticrénelage

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - c
          const py = y + (sy + 0.5) / SS - c
          const col = boardColor(px, py, R, background)
          acc = acc.map((v, i) => v + col[i])
        }
      }
      const offset = (y * size + x) * 4
      for (let i = 0; i < 4; i++) pixels[offset + i] = Math.round(acc[i] / (SS * SS))
    }
  }
  return pixels
}

// --- Encodage PNG minimal (RGBA 8 bits, filtre 0) ---

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let crc = n
  for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  chunk.write(type, 4, 'ascii')
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length)
  return chunk
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // profondeur
  ihdr[9] = 6 // couleur RGBA

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filtre "none"
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function writeIcon(relPath, size, options) {
  const file = join(root, relPath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, encodePng(size, render(size, options)))
  console.log(`✓ ${relPath} (${size}×${size})`)
}

writeIcon('public/icons/icon-192.png', 192, { boardRatio: 0.46, background: TRANSPARENT })
writeIcon('public/icons/icon-512.png', 512, { boardRatio: 0.46, background: TRANSPARENT })
writeIcon('public/icons/maskable-512.png', 512, { boardRatio: 0.36, background: INK })
writeIcon('src/app/icon.png', 192, { boardRatio: 0.46, background: TRANSPARENT })
writeIcon('src/app/apple-icon.png', 180, { boardRatio: 0.4, background: INK })
