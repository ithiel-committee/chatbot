import type { NextApiRequest, NextApiResponse } from 'next'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'
import { logger } from '@/lib/logger'

type Data = {
  audio?: Buffer
  error?: string
  errorCode?: string
}

function createWavHeader(dataLength: number) {
  const buffer = new ArrayBuffer(44)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')

  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 16000, true) // sample rate
  view.setUint32(28, 16000 * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample

  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  return buffer
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}

interface RequestBody {
  message: string
  voiceId?: string
  apiKey?: string
  language?: string
}

async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const body = req.body as RequestBody
  const message = body.message
  const voiceId = body.voiceId || process.env.ELEVENLABS_VOICE_ID
  const apiKey = body.apiKey || process.env.ELEVENLABS_API_KEY
  const language = body.language
  const stream = req.query.stream === 'true'

  if (!apiKey) {
    res.status(400).json({ error: 'Empty API Key', errorCode: 'EmptyAPIKey' })
    return
  }
  if (!voiceId) {
    res
      .status(400)
      .json({ error: 'Empty Voice ID', errorCode: 'EMPTY_PROPERTY' })
    return
  }

  const abortController = stream ? new AbortController() : null
  let downstreamClosed = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
  const cancelUpstream = () => {
    downstreamClosed = true
    abortController?.abort()
    void reader?.cancel('downstream closed').catch(() => {})
  }
  if (stream) res.once('close', cancelUpstream)

  try {
    const endpoint = stream
      ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_16000`
      : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=pcm_16000`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        accept: 'audio/pcm',
      },
      body: JSON.stringify({
        text: message,
        model_id: 'eleven_turbo_v2_5',
        language_code: language,
      }),
      ...(abortController ? { signal: abortController.signal } : {}),
    })

    if (!response.ok) {
      throw new Error(
        `ElevenLabs APIからの応答が異常です。ステータスコード: ${response.status}`
      )
    }

    if (stream) {
      if (!response.body) {
        throw new Error('ElevenLabs APIの音声ストリームが空です')
      }

      reader = response.body.getReader()
      if (downstreamClosed) {
        await reader.cancel('downstream closed').catch(() => {})
        return
      }

      res.writeHead(200, {
        'Content-Type': 'audio/pcm',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Audio-Sample-Rate': '16000',
      })
      res.flushHeaders?.()

      try {
        while (!downstreamClosed) {
          const { done, value } = await reader.read()
          if (done) break
          if (value?.byteLength) {
            const canContinue = res.write(Buffer.from(value))
            if (!canContinue && !downstreamClosed) {
              await new Promise<void>((resolve) => {
                const resume = () => {
                  res.off('drain', resume)
                  res.off('close', resume)
                  resolve()
                }
                res.once('drain', resume)
                res.once('close', resume)
              })
            }
          }
        }
      } catch (error) {
        if (!downstreamClosed) {
          logger.error('ElevenLabs PCM stream failed:', error)
          res.end()
        }
        return
      }
      if (!downstreamClosed) res.end()
      return
    }

    const arrayBuffer = await response.arrayBuffer()
    const wavHeader = createWavHeader(arrayBuffer.byteLength)
    const fullBuffer = Buffer.concat([
      Buffer.from(wavHeader),
      Buffer.from(arrayBuffer),
    ])

    res.writeHead(200, {
      'Content-Type': 'audio/wav',
      'Content-Length': fullBuffer.length,
    })
    res.end(fullBuffer)
  } catch (error) {
    if (downstreamClosed) return
    if (res.headersSent) {
      logger.error('ElevenLabs response failed after streaming started:', error)
      if (!res.writableEnded) res.end()
      return
    }
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) })
  } finally {
    if (stream) res.off('close', cancelUpstream)
    reader?.releaseLock()
  }
}

export default withAccessPolicy(routePolicies['/api/elevenLabs'], handler)
