import { GeminiTtsPace } from '@/features/constants/geminiTts'
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
    { message: talk.message, apiKey, voice, style, pace },
    'Gemini TTS',
    {
      buildErrorMessage: async (res) => {
        const data = await res.json().catch(() => null)
        return typeof data?.error === 'string'
          ? data.error
          : `Gemini TTS: HTTP ${res.status}`
      },
    }
  )
}
