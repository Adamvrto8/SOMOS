// Speech recognition for Vyslovovanie: Chrome's built-in SpeechRecognition (free, Mexican
// Spanish). Chrome sends the audio to Google, so it needs internet.

export type SpeechError = 'denied' | 'offline' | 'no-speech' | 'aborted' | 'failed'

export const SPEECH_ERRORS: Record<SpeechError, string> = {
  denied: 'Mikrofón je zablokovaný. Povoľ ho v Nastaveniach Androidu → Aplikácie → SOMOS → Povolenia.',
  offline: 'Rozpoznávanie reči potrebuje internet.',
  'no-speech': 'Nič som nepočul. Skús to znova.',
  aborted: 'Nahrávanie sa prerušilo. Skús to znova.',
  failed: 'Nepodarilo sa. Skús to znova.',
}

export class SpeechFailure extends Error {
  code: SpeechError
  constructor(code: SpeechError) {
    super(code)
    this.code = code
  }
}

/** Maps the recognizer's `error` event value to what the UI distinguishes. */
export function speechErrorCode(error: string): SpeechError {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied'
    case 'network':
      return 'offline'
    case 'no-speech':
    case 'audio-capture':
      return 'no-speech'
    case 'aborted':
      return 'aborted'
    default:
      return 'failed'
  }
}

// TypeScript's DOM library has no types for the Web Speech recognizer.
interface RecognitionAlternative {
  transcript: string
}
interface RecognitionResultList {
  length: number
  [index: number]: { length: number; [index: number]: RecognitionAlternative }
}
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((event: { results: RecognitionResultList }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = new () => Recognition

const speechWindow =
  typeof window === 'undefined'
    ? undefined
    : (window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor })
const Recognizer = speechWindow?.SpeechRecognition ?? speechWindow?.webkitSpeechRecognition

export const speechSupported = Boolean(Recognizer)

export interface Recording {
  /** The recognizer's guesses for what was said, best first; rejects with SpeechFailure. */
  result: Promise<string[]>
  /** Stop listening and recognize what was said so far. */
  stop: () => void
  /** Stop and throw the recording away (leaving the task). */
  abort: () => void
}

/** One recording; ends by itself when the learner stops talking. */
export function startRecording(): Recording {
  if (!Recognizer) return { result: Promise.reject(new SpeechFailure('failed')), stop() {}, abort() {} }
  if (!navigator.onLine) return { result: Promise.reject(new SpeechFailure('offline')), stop() {}, abort() {} }

  const recognition = new Recognizer()
  recognition.lang = 'es-MX'
  recognition.interimResults = false
  recognition.maxAlternatives = 3
  recognition.continuous = false

  const result = new Promise<string[]>((resolve, reject) => {
    let alternatives: string[] = []
    let failure: SpeechFailure | undefined
    recognition.onresult = ({ results }) => {
      const last = results[results.length - 1]
      alternatives = Array.from({ length: last.length }, (_, i) => last[i].transcript.trim()).filter(Boolean)
    }
    recognition.onerror = ({ error }) => {
      failure = new SpeechFailure(speechErrorCode(error))
    }
    recognition.onend = () => {
      if (alternatives.length > 0) resolve(alternatives)
      else reject(failure ?? new SpeechFailure('no-speech'))
    }
    try {
      recognition.start()
    } catch {
      reject(new SpeechFailure('failed'))
    }
  })

  return { result, stop: () => recognition.stop(), abort: () => recognition.abort() }
}
