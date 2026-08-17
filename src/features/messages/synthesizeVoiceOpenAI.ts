import { Talk } from './messages'
import { Language } from '@/features/constants/settings'
import { synthesizeVoiceApi } from './synthesizeVoiceApi'
import { logger } from '@/lib/logger'

export async function synthesizeVoiceOpenAIApi(
  talk: Talk,
  apiKey: string,
  voice: string,
  model: string,
  speed: number
) {
  return synthesizeVoiceApi(
    '/api/openAITTS',
    {
      message: talk.message,
      voice: voice,
      model: model,
      speed: speed,
      apiKey: apiKey,
    },
    'OpenAI TTS',
    {
      buildErrorMessage: (res) =>
        `OpenAI APIからの応答が異常です。ステータスコード: ${res.status}`,
    }
  )
}

export type OpenAIPcm16Stream = {
  stream: ReadableStream<Uint8Array>
  sampleRate: 24000
}

/** OpenAI Speech APIの24kHz raw PCMをバッファ化せず再生側へ渡す。 */
export async function synthesizeVoiceOpenAIStreamApi(
  talk: Talk,
  apiKey: string,
  voice: string,
  model: string,
  speed: number,
  onFirstChunk?: () => void
): Promise<OpenAIPcm16Stream> {
  const response = await fetch('/api/openAITTS?stream=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: talk.message,
      voice,
      model,
      speed,
      apiKey,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `OpenAI APIからの応答が異常です。ステータスコード: ${response.status}`
    )
  }
  if (!response.body) {
    throw new Error('OpenAI TTSの音声ストリームが空です')
  }

  const upstreamReader = response.body.getReader()
  let firstChunkReceived = false
  const observedStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read()
        if (done) {
          controller.close()
          return
        }
        if (!firstChunkReceived && value.byteLength > 0) {
          firstChunkReceived = true
          try {
            onFirstChunk?.()
          } catch (error) {
            logger.warn('OpenAI TTS first chunk observer failed:', error)
          }
        }
        controller.enqueue(value)
      } catch (error) {
        controller.error(error)
      }
    },
    async cancel(reason) {
      await upstreamReader.cancel(reason)
    },
  })

  return { stream: observedStream, sampleRate: 24000 }
}
