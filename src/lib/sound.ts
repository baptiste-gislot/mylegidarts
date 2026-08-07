'use client'

// Bruitages (WebAudio synthétisé), annonceur vocal (synthèse vocale native)
// et signatures sonores des joueurs (MP3 déposés par la ligue). Fonctionne
// sur mobile comme sur desktop ; les navigateurs exigent un geste utilisateur
// avant de jouer du son, ce qui est toujours notre cas (les sons partent de
// clics sur le clavier de saisie).

const SOUND_KEY = 'mylegidarts-sons'

export function soundsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SOUND_KEY) !== 'off'
}

export function setSoundsEnabled(on: boolean): void {
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  if (!on) {
    stopSignature?.()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }
}

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !soundsEnabled()) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Impact de fléchette dans le sisal ; variantes bull (ping laiton) et raté (sourd). */
export function thock(kind: 'normal' | 'bull' | 'miss' = 'normal'): void {
  const ac = audio()
  if (!ac) return
  const t = ac.currentTime

  const dur = 0.09
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2
  }
  const source = ac.createBufferSource()
  source.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = kind === 'miss' ? 260 : 950
  const gain = ac.createGain()
  gain.gain.setValueAtTime(kind === 'miss' ? 0.3 : 0.5, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(ac.destination)
  source.start(t)

  if (kind === 'bull') {
    const osc = ac.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = 1320
    const ping = ac.createGain()
    ping.gain.setValueAtTime(0.12, t)
    ping.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.connect(ping)
    ping.connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  }
}

/** Petit arpège de victoire (180 ou record). */
export function fanfare(kind: 'perfect' | 'record'): void {
  const ac = audio()
  if (!ac) return
  const notes =
    kind === 'perfect'
      ? [523.25, 659.25, 783.99, 1046.5]
      : [392, 523.25, 659.25, 783.99, 1046.5]
  notes.forEach((frequency, i) => {
    const t = ac.currentTime + i * 0.11
    const osc = ac.createOscillator()
    osc.type = 'square'
    osc.frequency.value = frequency
    const gain = ac.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.3)
  })
}

/** Durée maximale d'une signature de joueur : au-delà, fondu puis coupure. */
const SIGNATURE_MAX_MS = 10_000

/** Coupe la signature en cours, s'il y en a une (résout sa promesse). */
let stopSignature: (() => void) | null = null

/**
 * Joue la signature MP3 d'un joueur (10 s max) et résout à la fin de la
 * lecture, pour enchaîner l'annonce vocale sans chevauchement. Une nouvelle
 * signature coupe la précédente. Résout immédiatement si le fichier ne charge
 * pas ou si la lecture est refusée : l'annonce qui suit ne doit jamais rester
 * bloquée. (Le respect du réglage « sons coupés » est à la charge de
 * l'appelant, pour que la pré-écoute depuis la page Joueurs reste audible.)
 */
export function playSignature(url: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  stopSignature?.()
  return new Promise((resolve) => {
    const audio = new Audio(url)
    let fade: ReturnType<typeof setInterval> | undefined
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (stopSignature === finish) stopSignature = null
      clearTimeout(cap)
      clearInterval(fade)
      audio.pause()
      resolve()
    }
    stopSignature = finish
    const cap = setTimeout(() => {
      // Fondu de sortie (~400 ms) pour les fichiers plus longs que le plafond.
      fade = setInterval(() => {
        audio.volume = Math.max(0, audio.volume - 0.1)
        if (audio.volume <= 0) finish()
      }, 40)
    }, SIGNATURE_MAX_MS)
    audio.addEventListener('ended', finish)
    audio.addEventListener('error', finish)
    void audio.play().catch(finish)
  })
}

/**
 * Voix préférées de l'annonceur, par ordre de priorité :
 * 1. La voix Piper du kiosque, reconnaissable à son nom de modèle
 *    (« fr_FR-upmc-medium »…) — sans ça, la préférence fr-BE ferait
 *    retomber l'annonceur sur l'espeak robotique de secours.
 * 2. L'accent belge (fr-BE, espeak) pour les appareils sans Piper.
 * 3. N'importe quelle voix française.
 */
const VOICE_PREFERENCES = ['fr-be', 'fr']

/** Voix Piper, une fois trouvée : elle ne change plus de la session. */
let piperVoice: SpeechSynthesisVoice | null = null

function pickVoice(): SpeechSynthesisVoice | null {
  if (piperVoice) return piperVoice
  const voices = window.speechSynthesis.getVoices()
  piperVoice = voices.find((v) => /^fr_[A-Z]{2}-/.test(v.name)) ?? null
  if (piperVoice) return piperVoice
  // Pas (encore) de Piper : voix de secours, jamais mémorisée — la liste peut
  // se compléter entre deux annonces, Piper doit pouvoir reprendre la main.
  for (const preference of VOICE_PREFERENCES) {
    // speech-dispatcher annonce parfois « fr_BE » avec un underscore.
    const voice = voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith(preference))
    if (voice) return voice
  }
  return null
}

let warmed = false

/**
 * Amorce la liste des voix, à appeler une fois au montage de l'app.
 *
 * Chromium ne connaît pas les voix de speech-dispatcher au démarrage : il les
 * découvre de façon asynchrone et signale la liste complète par
 * « voiceschanged ». Sur le kiosque fraîchement redémarré, la première annonce
 * arrive volontiers avant — sans amorçage, elle part sur la voix par défaut du
 * système (l'espeak robotique) au lieu de Piper.
 */
export function warmUpVoices(): void {
  if (typeof window === 'undefined' || warmed || !('speechSynthesis' in window)) return
  warmed = true
  pickVoice()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    pickVoice()
  })
}

/** Voix réellement utilisée par l'annonceur — diagnostic de la chaîne Piper. */
export function announcerVoice(): string | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return pickVoice()?.name ?? null
}

/**
 * Plafond de sécurité d'un énoncé : certains backends (speech-dispatcher)
 * n'émettent jamais « end ». Large marge sur le débit réel (~15 caractères
 * par seconde) pour ne pas couper la parole à l'annonceur.
 */
function speechCapMs(text: string): number {
  return 2_000 + text.length * 120
}

/**
 * L'annonceur : voix du navigateur, belge quand l'appareil en a une. Résout à
 * la fin de l'énoncé, pour enchaîner sans chevauchement (signature du joueur,
 * relais…) ; résout aussi tout seul au bout du plafond de sécurité, une suite
 * d'annonce ne doit jamais rester bloquée.
 */
export function say(text: string): Promise<void> {
  if (typeof window === 'undefined' || !soundsEnabled() || !('speechSynthesis' in window)) {
    return Promise.resolve()
  }
  const utterance = new SpeechSynthesisUtterance(text)
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  utterance.lang = voice?.lang ?? 'fr-FR'
  utterance.rate = 1.05
  utterance.pitch = 1.05
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(cap)
      resolve()
    }
    const cap = setTimeout(finish, speechCapMs(text))
    utterance.addEventListener('end', finish)
    utterance.addEventListener('error', finish)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  })
}
