import type { NextApiRequest, NextApiResponse } from 'next'
import {
  isAllowedConfiguredOrListedUrl,
  isHttpUrl,
} from '@/lib/api-services/serverUrlGuard'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import type { PolicyGate } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'

type Data = {
  audio?: Buffer
  error?: string
}

const getLanguageCode = (selectLanguage: string): string => {
  switch (selectLanguage) {
    case 'ja':
      return 'JP'
    case 'en':
      return 'EN'
    case 'zh-CN':
    case 'zh-TW':
      return 'ZH'
    default:
      return 'EN'
  }
}

interface RequestBody {
  message: string
  stylebertvits2ModelId: string
  stylebertvits2ServerUrl?: string
  stylebertvits2ApiKey?: string
  stylebertvits2Style: string
  stylebertvits2SdpRatio: string
  stylebertvits2Length: string
  selectLanguage: string
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
  gate: PolicyGate
) {
  const body = req.body as RequestBody // JSON.parse を削除
  const message = body.message
  const stylebertvits2ModelId = body.stylebertvits2ModelId
  const usesClientProvidedUrl = Boolean(body.stylebertvits2ServerUrl)
  const usesServerConfiguredUrl = !usesClientProvidedUrl
  const stylebertvits2ServerUrl =
    body.stylebertvits2ServerUrl || process.env.STYLEBERTVITS2_SERVER_URL
  const stylebertvits2ApiKey =
    body.stylebertvits2ApiKey ||
    (usesServerConfiguredUrl ? process.env.STYLEBERTVITS2_API_KEY : undefined)
  const usesServerSecret =
    (usesServerConfiguredUrl &&
      Boolean(process.env.STYLEBERTVITS2_SERVER_URL)) ||
    (usesServerConfiguredUrl &&
      !body.stylebertvits2ApiKey &&
      Boolean(process.env.STYLEBERTVITS2_API_KEY))
  const stylebertvits2Style = body.stylebertvits2Style
  const stylebertvits2SdpRatio = body.stylebertvits2SdpRatio
  const stylebertvits2Length = body.stylebertvits2Length
  const selectLanguage = getLanguageCode(body.selectLanguage)

  if (!stylebertvits2ServerUrl) {
    return res
      .status(400)
      .json({ error: 'Style-Bert-VITS2 server URL is required' })
  }

  let parsedUrl: URL
  let configuredUrl: URL | undefined
  try {
    parsedUrl = new URL(stylebertvits2ServerUrl)
    configuredUrl = process.env.STYLEBERTVITS2_SERVER_URL
      ? new URL(process.env.STYLEBERTVITS2_SERVER_URL)
      : undefined
  } catch {
    return res.status(400).json({ error: 'Invalid server URL' })
  }

  if (!isHttpUrl(parsedUrl)) {
    return res.status(400).json({ error: 'Invalid server URL protocol' })
  }

  const { isProtectedServerResource, isAllowedPublicUrl } =
    isAllowedConfiguredOrListedUrl(parsedUrl, configuredUrl)
  const isRunPodUrl = parsedUrl.origin === 'https://api.runpod.ai'

  if (
    usesClientProvidedUrl &&
    !isRunPodUrl &&
    !isProtectedServerResource &&
    !isAllowedPublicUrl
  ) {
    return res.status(400).json({ error: 'Server URL is not allowed' })
  }

  if (
    !gate.guardServerSecret(usesServerSecret || isProtectedServerResource, {
      allowLocalLoopbackUrl: parsedUrl,
    })
  ) {
    return
  }

  try {
    if (isRunPodUrl && !stylebertvits2ApiKey) {
      return res
        .status(400)
        .json({ error: 'Style-Bert-VITS2 API key is required' })
    }

    if (!isRunPodUrl) {
      const queryParams = new URLSearchParams({
        text: message,
        model_id: stylebertvits2ModelId,
        style: stylebertvits2Style,
        sdp_ratio: stylebertvits2SdpRatio,
        length: stylebertvits2Length,
        language: selectLanguage,
      })

      const voice = await fetch(
        `${stylebertvits2ServerUrl.replace(/\/$/, '')}/voice?${queryParams}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'audio/wav',
          },
        }
      )

      if (!voice.ok) {
        throw new Error(
          `サーバーからの応答が異常です。ステータスコード: ${voice.status}`
        )
      }

      const arrayBuffer = await voice.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length,
      })
      res.end(buffer)
    } else {
      const voice = await fetch(
        `${stylebertvits2ServerUrl.replace(/\/$/, '')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${stylebertvits2ApiKey}`,
          },
          body: JSON.stringify({
            input: {
              action: '/voice',
              model_id: stylebertvits2ModelId,
              text: message,
              style: stylebertvits2Style,
              sdp_ratio: stylebertvits2SdpRatio,
              length: stylebertvits2Length,
              language: selectLanguage,
            },
          }),
        }
      )

      if (!voice.ok) {
        throw new Error(
          `サーバーからの応答が異常です。ステータスコード: ${voice.status}`
        )
      }

      const voiceData: { output: { voice: string } } = await voice.json()
      const base64Audio = voiceData.output.voice
      const buffer = Buffer.from(base64Audio, 'base64')

      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': buffer.length,
      })
      res.end(buffer)
    }
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) })
  }
}

export default withAccessPolicy(routePolicies['/api/stylebertvits2'], handler)
