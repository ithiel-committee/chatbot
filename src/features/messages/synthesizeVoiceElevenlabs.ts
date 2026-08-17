import { Talk } from './messages'
import { Language } from '@/features/constants/settings'
import { synthesizeVoiceApi } from './synthesizeVoiceApi'
import { logger } from '@/lib/logger'

export async function synthesizeVoiceElevenlabsApi(
  talk: Talk,
  apiKey: string,
  voiceId: string,
  language: Language
) {
  return synthesizeVoiceApi(
    '/api/elevenLabs',
    { message: talk.message, voiceId, apiKey, language },
    'ElevenLabs'
  )
}

export type ElevenLabsPcm16Stream = {
  stream: ReadableStream<Uint8Array>
  sampleRate: 16000
}

/**
 * ElevenLabsのraw PCM16レスポンスをバッファ化せず転送する。
 * VRMのストリーム再生に対応できない場合は従来APIを使用すること。
 */
export async function synthesizeVoiceElevenlabsStreamApi(
  talk: Talk,
  apiKey: string,
  voiceId: string,
  language: Language,
  onFirstChunk?: () => void
): Promise<ElevenLabsPcm16Stream> {
  const response = await fetch('/api/elevenLabs?stream=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: talk.message,
      voiceId,
      apiKey,
      language,
    }),
  })

  if (!response.ok) {
    throw new Error(
      `ElevenLabs APIからの応答が異常です。ステータスコード: ${response.status}`
    )
  }
  if (!response.body) {
    throw new Error('ElevenLabs APIの音声ストリームが空です')
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
            logger.warn('ElevenLabs first chunk observer failed:', error)
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

  return { stream: observedStream, sampleRate: 16000 }
}
