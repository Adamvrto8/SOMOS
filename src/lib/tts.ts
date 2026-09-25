// Spanish pronunciation via the browser's built-in speech synthesis (free, offline
// when the device has the voice installed).

const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : undefined

export const ttsSupported = Boolean(synth)

// Mexican first, then other Latin American voices, which sound closer than es-ES.
const PREFERRED_LANGS = ['es-mx', 'es-us', 'es-419']

const normalizeLang = (lang: string) => lang.toLowerCase().replace('_', '-')

let voice: SpeechSynthesisVoice | undefined

function pickVoice(): SpeechSynthesisVoice | undefined {
  const spanish = (synth?.getVoices() ?? []).filter((v) => normalizeLang(v.lang).startsWith('es'))
  const rank = (v: SpeechSynthesisVoice) => {
    const i = PREFERRED_LANGS.indexOf(normalizeLang(v.lang))
    // Lower is better; on-device voices win ties so speech works offline.
    return (i === -1 ? PREFERRED_LANGS.length : i) * 2 + (v.localService ? 0 : 1)
  }
  return spanish.sort((a, b) => rank(a) - rank(b))[0]
}

// Voices load asynchronously in most browsers.
synth?.addEventListener('voiceschanged', () => {
  voice = pickVoice()
})

export function speak(text: string) {
  if (!synth) return
  voice ??= pickVoice()
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = voice?.lang ?? 'es-MX'
  if (voice) utterance.voice = voice
  utterance.rate = 0.9
  synth.speak(utterance)
}
