import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'

const DEFAULT_MIME_TYPE = 'audio/webm'

// 音声文字起こしに最適な推奨モデル（高速・低コスト・マルチモーダル対応）
const DEFAULT_TRANSCRIBE_MODEL = 'gemini-2.0-flash'
const FALLBACK_TRANSCRIBE_MODEL = 'gemini-1.5-flash'

const PROMPT_JA =
  '以下の音声をそのまま文字起こししてください。認識したテキストのみを出力し、挨拶・解説・相槌などの余計な文章は一切含めないでください。音声に聞き取れる言葉がない場合は何も出力しないでください。'

const PROMPT_EN =
  'Transcribe the provided audio into text accurately. Output ONLY the transcription. Do not include any explanations or conversational responses. If there is no speech, output nothing.'

export const config = {
  api: {
    bodyParser: {
      // Next.js statically analyzes route config; the value must be a literal.
      sizeLimit: '25mb',
    },
  },
}

interface GeminiTranscribeRequest {
  audioBase64: string
  mimeType?: string
  googleKey?: string
  language?: string
}

/**
 * 指定モデルでGemini文字起こしを実行するヘルパー
 */
async function callGeminiTranscribe(
  genAI: GoogleGenerativeAI,
  modelName: string,
  base64Audio: string,
  mimeType: string,
  prompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: modelName })
  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType.split(';')[0], // e.g. "audio/webm;codecs=opus" -> "audio/webm"
      },
    },
    { text: prompt },
  ])
  return result.response.text()?.trim() || ''
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const {
      audioBase64,
      mimeType = DEFAULT_MIME_TYPE,
      googleKey,
      language,
    } = req.body as GeminiTranscribeRequest

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required' })
    }

    const apiKey =
      googleKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY

    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured' })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const primaryModel =
      process.env.GEMINI_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL

    const prompt = language === 'ja' || !language ? PROMPT_JA : PROMPT_EN
    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '')

    let responseText = ''
    try {
      responseText = await callGeminiTranscribe(
        genAI,
        primaryModel,
        cleanBase64,
        mimeType,
        prompt
      )
    } catch (primaryError) {
      const errorMessage =
        primaryError instanceof Error
          ? primaryError.message
          : String(primaryError)
      logger.warn(
        `Gemini transcribe with ${primaryModel} failed (${errorMessage}), falling back to ${FALLBACK_TRANSCRIBE_MODEL}`
      )

      responseText = await callGeminiTranscribe(
        genAI,
        FALLBACK_TRANSCRIBE_MODEL,
        cleanBase64,
        mimeType,
        prompt
      )
    }

    logger.log(
      'Gemini transcription successful, result length:',
      responseText.length
    )

    return res.status(200).json({ text: responseText })
  } catch (error) {
    logger.error('Gemini transcription API error:', error)
    return res.status(500).json({
      error: 'Failed to transcribe audio with Gemini',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

export default withAccessPolicy(
  routePolicies['/api/ai/gemini-transcribe'],
  handler
)
