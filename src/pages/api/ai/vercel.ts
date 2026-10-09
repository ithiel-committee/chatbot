import { logger } from '@/lib/logger'
import { Message } from '@/features/messages/messages'
import { NextApiRequest, NextApiResponse } from 'next'
import {
  VercelAIService,
  isVercelCloudAIService,
  isVercelLocalAIService,
} from '@/features/constants/settings'
import { modifyMessages } from '@/lib/api-services/utils'
import {
  createAIRegistry,
  streamAiText,
  generateAiText,
} from '@/lib/api-services/vercelAi'
import { buildReasoningProviderOptions } from '@/lib/api-services/providerOptionsBuilder'
import { googleSearchGroundingModels } from '@/features/constants/aiModels'
import { pipeResponse } from '@/utils/pipeResponse'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import type { PolicyGate } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'
import { guardLocalLlmUrl } from '@/lib/accessPolicy/guardLocalLlmUrl'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
  gate: PolicyGate
) {
  const startTime = Date.now()
  const {
    messages,
    apiKey,
    aiService,
    model,
    localLlmUrl,
    azureEndpoint,
    stream,
    useSearchGrounding,
    dynamicRetrievalThreshold,
    temperature = 1.0,
    maxTokens = 4096,
    reasoningMode = false,
    reasoningEffort = 'medium',
    reasoningTokenBudget = 8192,
    customModel = false,
  } = req.body

  logger.log(
    `[API /api/ai/vercel] 📨 リクエスト受信: service=${aiService}, model=${model}, stream=${Boolean(stream)}, messages=${messages?.length || 0}件`
  )

  // APIキーの取得と検証
  let aiApiKey = apiKey
  let usesServerSecret = false
  if (isVercelCloudAIService(aiService)) {
    if (!aiApiKey) {
      // 環境変数から[サービス名]_KEY または [サービス名]_API_KEY の形式でAPIキーを取得
      const servicePrefix = aiService.toUpperCase()
      aiApiKey =
        process.env[`${servicePrefix}_KEY`] ||
        process.env[`${servicePrefix}_API_KEY`] ||
        ''
      if (!aiApiKey && aiService === 'google') {
        aiApiKey =
          process.env.GEMINI_API_KEY ||
          process.env.GEMINI_KEY ||
          process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
          ''
      }
      usesServerSecret = Boolean(aiApiKey)
    }
    if (!aiApiKey) {
      return res
        .status(400)
        .json({ error: 'Empty API Key', errorCode: 'EmptyAPIKey' })
    }
    logger.log(
      `[API /api/ai/vercel] 🔑 APIキー: ${usesServerSecret ? 'サーバー環境変数 (.env)' : 'クライアント指定'}`
    )
  }

  if (!gate.guardServerSecret(usesServerSecret)) {
    return
  }

  // ローカルLLMのURL検証
  if (isVercelLocalAIService(aiService) && aiService !== 'custom-api') {
    if (!localLlmUrl) {
      return res.status(400).json({
        error: 'Empty Local LLM URL',
        errorCode: 'EmptyLocalLLMURL',
      })
    }
    if (!guardLocalLlmUrl(res, gate, localLlmUrl)) {
      return
    }
  }

  // Azureのエンドポイントとデプロイメント名の処理
  const azureEndpointValue =
    aiService === 'azure'
      ? azureEndpoint || process.env.AZURE_ENDPOINT || ''
      : ''
  const usesServerAzureEndpoint =
    aiService === 'azure' &&
    !azureEndpoint &&
    Boolean(process.env.AZURE_ENDPOINT)
  if (!gate.guardServerSecret(usesServerAzureEndpoint)) {
    return
  }

  let modifiedAzureEndpoint = azureEndpointValue.replace(
    /^https:\/\/|\.openai\.azure\.com.*$/g,
    ''
  )
  let modifiedAzureDeployment =
    azureEndpointValue.match(/\/deployments\/([^\/]+)/)?.[1] || ''
  let modifiedModel = aiService === 'azure' ? modifiedAzureDeployment : model

  // モデル名のバリデーション
  if (isVercelCloudAIService(aiService) && !modifiedModel) {
    return res.status(400).json({
      error: 'Invalid AI service or model',
      errorCode: 'AIInvalidProperty',
    })
  }

  try {
    // Provider Registryの作成
    const registry = createAIRegistry(aiService as VercelAIService, {
      apiKey: aiApiKey,
      baseURL: localLlmUrl,
      resourceName: modifiedAzureEndpoint,
    })

    if (!registry) {
      return res.status(400).json({
        error: 'Invalid AI service',
        errorCode: 'InvalidAIService',
      })
    }

    // メッセージの修正
    const modifiedMessages = modifyMessages(aiService, model, messages)

    // Google検索接地オプションの設定
    const isUseSearchGrounding =
      aiService === 'google' &&
      useSearchGrounding &&
      modifiedMessages.every((msg) => typeof msg.content === 'string')

    let options: Record<string, unknown> = {}
    if (isUseSearchGrounding) {
      options = {
        useSearchGrounding: true,
        ...(dynamicRetrievalThreshold !== undefined &&
          modifiedModel &&
          googleSearchGroundingModels.includes(
            modifiedModel as (typeof googleSearchGroundingModels)[number]
          ) && {
            dynamicRetrievalConfig: {
              dynamicThreshold: dynamicRetrievalThreshold,
            },
          }),
      }
    }

    // 推論モードのproviderOptionsを構築
    const providerOptions = buildReasoningProviderOptions(
      aiService,
      modifiedModel,
      reasoningMode,
      reasoningEffort,
      reasoningTokenBudget,
      customModel
    )

    logger.log(
      `[API /api/ai/vercel] 🤖 AI呼び出し開始 (${aiService}:${modifiedModel}) [reasoning: ${reasoningMode ? `${reasoningEffort || 'default'}` : 'off'}, search: ${Boolean(isUseSearchGrounding)}]...`
    )

    const callStartTime = Date.now()

    // ストリーミングレスポンスまたは一括レスポンスの生成
    let response: Response
    if (stream) {
      response = await streamAiText({
        model: modifiedModel,
        registry,
        service: aiService as VercelAIService,
        messages: modifiedMessages,
        temperature,
        maxTokens,
        options,
        providerOptions,
      })
    } else {
      response = await generateAiText({
        model: modifiedModel,
        registry,
        service: aiService as VercelAIService,
        messages: modifiedMessages,
        temperature,
        maxTokens,
        providerOptions,
      })
    }

    const aiCallElapsed = Date.now() - callStartTime
    const totalElapsed = Date.now() - startTime
    logger.log(
      `[API /api/ai/vercel] ⚡ AI応答ストリーム確立 (AI呼び出し所要: ${(aiCallElapsed / 1000).toFixed(2)}秒 / ${aiCallElapsed}ms, リクエスト総計: ${(totalElapsed / 1000).toFixed(2)}秒)`
    )

    return pipeResponse(response, res)
  } catch (error) {
    const elapsed = Date.now() - startTime
    logger.error(
      `[API /api/ai/vercel] ❌ エラー (${(elapsed / 1000).toFixed(2)}秒 / ${elapsed}ms):`,
      error
    )

    return res.status(500).json({
      error: 'Unexpected Error',
      errorCode: 'AIAPIError',
    })
  }
}

export default withAccessPolicy(routePolicies['/api/ai/vercel'], handler)
