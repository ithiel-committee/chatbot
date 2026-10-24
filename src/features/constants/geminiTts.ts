export const GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts'
export const DEFAULT_GEMINI_TTS_VOICE = 'voice_gkzvygsq8i5b'

// Pace is a qualitative style hint, not an exact playback-rate multiplier.
export const GEMINI_TTS_PACES = [
  'slow',
  'slightly-slow',
  'default',
  'slightly-fast',
  'fast',
] as const
export type GeminiTtsPace = (typeof GEMINI_TTS_PACES)[number]

// https://ai.google.dev/gemini-api/docs/speech-generation#pacing-and-pauses
export const GEMINI_TTS_PACE_STYLES: Record<GeminiTtsPace, string> = {
  slow: 'speaking slowly',
  'slightly-slow': 'speaking slightly slowly',
  default: '',
  'slightly-fast': 'speaking slightly faster',
  fast: 'speaking rapidly',
}
