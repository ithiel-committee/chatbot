import { logger } from '@/lib/logger'
import { NextApiRequest, NextApiResponse } from 'next'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'

// 感情表現を豊かにする追加指示を行うモデル、念の為リスト形式
const gpt4oEmotionalInstructionModels = ['gpt-4o']

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { message, voice, model, speed, apiKey, emotion } = req.body
  const stream = req.query.stream === 'true'
  const openaiKey =
    apiKey || process.env.OPENAI_TTS_KEY || process.env.OPENAI_API_KEY

  if (!message || !voice || !model || !openaiKey) {
    return res.status(400).json({ error: 'Missing required parameters' })
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
    const options: Record<string, unknown> = {
      model: model,
      voice: voice,
      speed: speed,
      input: message,
      ...(stream ? { response_format: 'pcm' } : {}),
    }

    if (gpt4oEmotionalInstructionModels.some((m) => model.includes(m))) {
      options.instructions = `Please speak "${message}" with rich emotional expression.`
    }

    const speechResponse = await fetch(
      'https://api.openai.com/v1/audio/speech',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
        ...(abortController ? { signal: abortController.signal } : {}),
      }
    )

    if (!speechResponse.ok) {
      const errorText = await speechResponse.text()
      logger.error('OpenAI TTS upstream error:', {
        status: speechResponse.status,
        body: errorText,
      })
      return res.status(500).json({
        error: 'Failed to generate speech',
        errorCode: 'OpenAITTSUpstreamError',
        status: speechResponse.status,
      })
    }

    if (stream) {
      if (!speechResponse.body) {
        return res.status(500).json({
          error: 'OpenAI TTS returned an empty stream',
          errorCode: 'OpenAITTSEmptyStream',
        })
      }

      reader = speechResponse.body.getReader()
      if (downstreamClosed) {
        await reader.cancel('downstream closed').catch(() => {})
        return
      }

      res.writeHead(200, {
        'Content-Type': 'audio/pcm',
        'Cache-Control': 'no-store, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Audio-Sample-Rate': '24000',
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
          logger.error('OpenAI TTS PCM stream failed:', error)
          res.end()
        }
        return
      }
      if (!downstreamClosed) res.end()
      return
    }

    const buffer = Buffer.from(await speechResponse.arrayBuffer())

    res.setHeader(
      'Content-Type',
      speechResponse.headers.get('content-type') || 'audio/mpeg'
    )
    res.send(buffer)
  } catch (error) {
    if (downstreamClosed) return
    logger.error('OpenAI TTS error:', error)
    if (res.headersSent) {
      if (!res.writableEnded) res.end()
      return
    }
    res.status(500).json({ error: 'Failed to generate speech' })
  } finally {
    if (stream) res.off('close', cancelUpstream)
    reader?.releaseLock()
  }
}

export default withAccessPolicy(routePolicies['/api/openAITTS'], handler)
