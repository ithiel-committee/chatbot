import { Talk } from './messages'
import { synthesizeVoiceApi } from './synthesizeVoiceApi'

export function synthesizeVoiceGeminiApi(
  talk: Talk,
  apiKey: string,
  voice: string,
  style: string
): Promise<ArrayBuffer> {
  return synthesizeVoiceApi(
    '/api/tts-gemini',
    { message: talk.message, apiKey, voice, style },
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
