import { z } from 'zod'
import { logger } from '@/lib/logger'
import {
  GEMINI_TTS_MODEL,
  GEMINI_TTS_PACES,
  GEMINI_TTS_PACE_STYLES,
} from '@/features/constants/geminiTts'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'

const requestSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  voice: z.string().trim().min(1).max(200),
  style: z.string().trim().max(4000).optional().default(''),
  pace: z.enum(GEMINI_TTS_PACES).optional().default('default'),
  apiKey: z.string().trim().max(512).optional(),
})

const interactionSchema = z.object({
  steps: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(
          z.object({
            type: z.string(),
            data: z.string().optional(),
          })
        )
        .optional(),
    })
  ),
})

export default withAccessPolicy(
  routePolicies['/api/tts-gemini'],
  async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const parsed = requestSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error:
          '読み上げ本文・声ID・演技指示・APIキーの形式を確認してください。',
      })
    }
    const { message, voice, style: actingStyle, pace, apiKey } = parsed.data
    const style = [actingStyle, GEMINI_TTS_PACE_STYLES[pace]]
      .filter(Boolean)
      .join(', ')
    const key =
      apiKey ||
      process.env.GEMINI_TTS_API_KEY?.trim() ||
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim()
    if (!key) {
      return res
        .status(400)
        .json({ error: 'Gemini APIキーを設定してください。' })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)
    const onClose = () => {
      if (!res.writableEnded) controller.abort()
    }
    res.once('close', onClose)
    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/interactions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: GEMINI_TTS_MODEL,
            input: [
              {
                type: 'user_input',
                content: [
                  {
                    type: 'text',
                    text: message,
                    ...(style
                      ? { annotations: [{ type: 'speech_metadata', style }] }
                      : {}),
                  },
                ],
              },
            ],
            response_format: {
              type: 'audio',
              mime_type: 'audio/wav',
              sample_rate: 24000,
            },
            generation_config: { speech_config: [{ voice }] },
          }),
        }
      )
      if (!response.ok) {
        // Do not return/log upstream bodies: they can contain text or credentials.
        const status = response.status === 429 ? 429 : 502
        const error =
          response.status === 429
            ? 'Gemini TTSの利用上限に達しました。時間をおいて再試行してください。'
            : response.status === 401 || response.status === 403
              ? 'Gemini APIキーと、声を保存したプロジェクトへのアクセス権を確認してください。'
              : 'Gemini TTSの生成に失敗しました。声IDとAPIの利用状況を確認してください。'
        return res.status(status).json({ error })
      }

      const interaction = interactionSchema.safeParse(await response.json())
      const audio = interaction.success
        ? interaction.data.steps
            .filter((step) => step.type === 'model_output')
            .flatMap((step) => step.content || [])
            .filter((content) => content.type === 'audio')
        : []
      if (audio.length > 1) {
        logger.error('[Gemini TTS] Multiple audio blocks are not supported', {
          blockCount: audio.length,
        })
        return res.status(502).json({
          error:
            'Gemini TTSから複数の音声ブロックが返りました。文章を短くして再試行してください。',
        })
      }
      const data = audio[0]?.data
      if (!data) {
        return res
          .status(502)
          .json({ error: 'Gemini TTSから音声が返りませんでした。' })
      }
      const wav = Buffer.from(data, 'base64')
      // Gemini 3.8 returns a WAV container, not headerless PCM.
      if (
        wav.length <= 44 ||
        wav.toString('ascii', 0, 4) !== 'RIFF' ||
        wav.toString('ascii', 8, 12) !== 'WAVE'
      ) {
        return res
          .status(502)
          .json({ error: 'Gemini TTSの音声形式が不正です。' })
      }
      res.setHeader('Content-Type', 'audio/wav')
      return res.status(200).send(wav)
    } catch {
      if (res.destroyed) return
      return res.status(controller.signal.aborted ? 504 : 502).json({
        error: controller.signal.aborted
          ? 'Gemini TTSがタイムアウトしました。時間をおいて再試行してください。'
          : 'Gemini TTSへの接続または音声の取得に失敗しました。',
      })
    } finally {
      clearTimeout(timeout)
      res.off('close', onClose)
    }
  }
)
