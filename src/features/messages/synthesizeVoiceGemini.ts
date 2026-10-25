import {
  DEFAULT_GEMINI_TTS_VOICE,
  GeminiTtsPace,
} from '@/features/constants/geminiTts'
import { Talk } from './messages'
import { synthesizeVoiceApi } from './synthesizeVoiceApi'

export function synthesizeVoiceGeminiApi(
  talk: Talk,
  apiKey: string,
  voice: string,
  style: string,
  pace: GeminiTtsPace = 'default'
): Promise<ArrayBuffer> {
  return synthesizeVoiceApi(
    '/api/tts-gemini',
    {
      message: talk.message,
      apiKey,
      voice: voice.trim() || DEFAULT_GEMINI_TTS_VOICE,
      style,
      pace,
    },
    'Gemini TTS',
    {
      buildErrorMessage: async (res) => {
        const data = await res.json().catch(() => null)
        if (typeof data?.error === 'string') {
          return typeof data?.details === 'string'
            ? `${data.error} (${data.details})`
            : data.error
        }
        return `Gemini TTS: HTTP ${res.status}`
      },
    }
  )
}
