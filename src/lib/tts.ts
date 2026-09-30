import { useSyncExternalStore } from 'react'

// Spanish pronunciation via the browser's built-in speech synthesis (free, offline
// when the device has the voice installed).

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined

export const ttsSupported = Boolean(synth)

const VOICE_KEY = 'somos-voice'

// Mexican first, then other Latin American voices, which sound closer than es-ES.
const PREFERRED_LANGS = ['es-mx', 'es-us', 'es-419']

const normalizeLang = (lang: string) => lang.toLowerCase().replace('_', '-')

function rank(voice: SpeechSynthesisVoice) {
  const i = PREFERRED_LANGS.indexOf(normalizeLang(voice.lang))
  // Lower is better; on-device voices win ties so speech works offline.
  return (i === -1 ? PREFERRED_LANGS.length : i) * 2 + (voice.localService ? 0 : 1)
}

function readVoicePref(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY)
  } catch {
    return null
  }
}

export interface VoiceState {
  voices: SpeechSynthesisVoice[] // Spanish voices, best first
  preferredURI: string | null // user's choice; null = automatic
}

// Immutable snapshot for useSyncExternalStore.
let state: VoiceState = { voices: [], preferredURI: readVoicePref() }
const listeners = new Set<() => void>()

function setState(next: Partial<VoiceState>) {
  state = { ...state, ...next }
  listeners.forEach((notify) => notify())
}

function refreshVoices() {
  const spanish = (synth?.getVoices() ?? []).filter((v) => normalizeLang(v.lang).startsWith('es'))
  setState({ voices: spanish.sort((a, b) => rank(a) - rank(b)) })
}

// Voices load asynchronously in most browsers.
refreshVoices()
synth?.addEventListener('voiceschanged', refreshVoices)

/** The voice used for speaking: the user's choice if installed, else the best Spanish one. */
export function activeVoice(): SpeechSynthesisVoice | undefined {
  return state.voices.find((v) => v.voiceURI === state.preferredURI) ?? state.voices[0]
}

export function setPreferredVoice(uri: string | null) {
  try {
    if (uri) localStorage.setItem(VOICE_KEY, uri)
    else localStorage.removeItem(VOICE_KEY)
  } catch {
    // Choice just won't survive a reload.
  }
  setState({ preferredURI: uri })
}

function subscribe(notify: () => void) {
  listeners.add(notify)
  return () => {
    listeners.delete(notify)
  }
}

export function useVoices(): VoiceState {
  return useSyncExternalStore(subscribe, () => state)
}

/** 🐢 in Diktát. */
export const SLOW_RATE = 0.6

export function speak(text: string, { rate = 0.9 }: { rate?: number } = {}) {
  if (!synth) return
  if (state.voices.length === 0) refreshVoices()
  const voice = activeVoice()
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = voice?.lang ?? 'es-MX'
  if (voice) utterance.voice = voice
  utterance.rate = rate
  synth.speak(utterance)
}

/** Silences the phone before the microphone opens, so the recognizer doesn't hear it. */
export function stopSpeaking() {
  synth?.cancel()
}
