import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import type { PolicyGate } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'

interface RequestBody {
  message: string
  serverUrl?: string
  character: string
  batchSize: number
  speed: number
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  gate: PolicyGate
) {
  const { message, character, batchSize, speed } = req.body as RequestBody
  const serverUrl = gate.serverUrl!.raw.replace(/\/$/, '')

  if (
    typeof message !== 'string' ||
    message.length === 0 ||
    typeof character !== 'string' ||
    character.length === 0 ||
    typeof batchSize !== 'number' ||
    !Number.isFinite(batchSize) ||
    typeof speed !== 'number' ||
    !Number.isFinite(speed)
  ) {
    return res.status(400).json({ error: 'Invalid GSVI request body' })
  }

  try {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character,
        emotion: 'default',
        text: message,
        batch_size: batchSize,
        speed: speed.toString(),
        stream: true,
      }),
    })

    if (!response.ok) {
      return res.status(response.status).json({
        error: `GSVI API returned status ${response.status}`,
      })
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') || 'audio/wav'
    )
    res.setHeader('Content-Length', buffer.length)
    res.end(buffer)
  } catch (error) {
    logger.error('GSVI TTS request failed:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export default withAccessPolicy(routePolicies['/api/tts-gsvi'], handler)
