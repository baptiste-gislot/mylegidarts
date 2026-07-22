'use client'

// Bruitages (WebAudio synthétisé, aucun fichier audio) et annonceur vocal
// (synthèse vocale native). Fonctionne sur mobile comme sur desktop ; les
// navigateurs exigent un geste utilisateur avant de jouer du son, ce qui est
// toujours notre cas (les sons partent de clics sur le clavier de saisie).

const SOUND_KEY = 'mylegidarts-sons'

export function soundsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(SOUND_KEY) !== 'off'
}

export function setSoundsEnabled(on: boolean): void {
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
  if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel()
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

/** L'annonceur : voix française du navigateur/téléphone. */
export function say(text: string): void {
  if (typeof window === 'undefined' || !soundsEnabled() || !('speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'fr-FR'
  utterance.rate = 1.05
  utterance.pitch = 1.05
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.toLowerCase().startsWith('fr'))
  if (voice) utterance.voice = voice
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
