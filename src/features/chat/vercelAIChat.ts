import { logger } from '@/lib/logger'
import { Message } from '../messages/messages'
import i18next from 'i18next'
import toastStore from '@/features/stores/toast'
import {
  isVercelLocalAIService,
  AIService,
  ReasoningEffort,
} from '@/features/constants/settings'
import settingsStore from '../stores/settings'
import { getSessionId } from '@/utils/sessionId'
import type { AIChatResponseStreamOptions } from './aiChatFactory'

// 推論/思考チャンクを通常テキストと区別するためのマーカー
// null byteプレフィックスはLLMテキスト出力に現れないため安全
export const THINKING_MARKER = '\x00THINK:'

type VercelChatRequestData = {
  messages: Message[]
  stream: boolean
  // custom-api用
  customApiUrl?: string
  customApiHeaders?: string
  customApiBody?: string
  customApiIncludeMimeType?: boolean
  threadId?: string
  // Vercel AI SDK用
  apiKey?: string
  aiService?: AIService
  model?: string
  localLlmUrl?: string
  azureEndpoint?: string
  useSearchGrounding?: boolean
  temperature?: number
  maxTokens?: number
  reasoningMode?: boolean
  reasoningEffort?: ReasoningEffort
  reasoningTokenBudget?: number
  customModel?: boolean
}

type ApiErrorCause = { errorCode?: string }

function getErrorCode(error: unknown): string {
  const cause =
    error instanceof Error ? (error.cause as ApiErrorCause | undefined) : null
  return cause?.errorCode || 'AIAPIError'
}

const getAIConfig = () => {
  const ss = settingsStore.getState()
  // AIServiceとして扱う（より広い型）
  const aiService = ss.selectAIService as AIService

  // APIキー名は条件分岐で取得
  const apiKey =
    typeof aiService === 'string' &&
    aiService !== 'dify' &&
    aiService !== 'custom-api'
      ? (ss[`${aiService}Key` as keyof typeof ss] as string)
      : ''

  return {
    aiApiKey: apiKey,
    selectAIService: aiService,
    selectAIModel: ss.selectAIModel,
    localLlmUrl: ss.localLlmUrl,
    azureEndpoint: ss.azureEndpoint,
    useSearchGrounding: ss.useSearchGrounding,
    temperature: ss.temperature,
    maxTokens: ss.maxTokens,
    reasoningMode: ss.reasoningMode,
    reasoningEffort: ss.reasoningEffort,
    reasoningTokenBudget: ss.reasoningTokenBudget,
    customModel: ss.customModel,
    customApiUrl: ss.customApiUrl,
    customApiHeaders: ss.customApiHeaders,
    customApiBody: ss.customApiBody,
    customApiStream: ss.customApiStream,
    includeSystemMessagesInCustomApi: ss.includeSystemMessagesInCustomApi,
    customApiIncludeMimeType: ss.customApiIncludeMimeType,
  }
}

function handleApiError(errorCode: string): string {
  const languageCode = settingsStore.getState().selectLanguage
  i18next.changeLanguage(languageCode)
  return i18next.t(`Errors.${errorCode || 'AIAPIError'}`)
}

// APIエンドポイントを決定する関数
function getApiEndpoint(aiService: string): string {
  // isVercelLocalAIServiceを使用してapiサービスかどうかを判定
  if (isVercelLocalAIService(aiService) && aiService === 'custom-api') {
    return '/api/ai/custom'
  }
  return '/api/ai/vercel'
}

export async function getVercelAIChatResponse(messages: Message[]) {
  const {
    aiApiKey,
    selectAIService,
    selectAIModel,
    localLlmUrl,
    azureEndpoint,
    useSearchGrounding,
    temperature,
    maxTokens,
    reasoningMode,
    reasoningEffort,
    reasoningTokenBudget,
    customModel,
    customApiUrl,
    customApiHeaders,
    customApiBody,
    customApiIncludeMimeType,
  } = getAIConfig()

  // APIエンドポイントを決定
  const apiEndpoint = getApiEndpoint(selectAIService)

  try {
    // 共通リクエストデータ
    const requestData: VercelChatRequestData = {
      messages,
      stream: false,
    }

    // サービスタイプに応じてリクエストデータを追加
    if (selectAIService === 'custom-api') {
      // カスタムAPI用データ
      const filteredMessages = getAIConfig().includeSystemMessagesInCustomApi
        ? messages
        : messages.filter((message) => message.role !== 'system')

      Object.assign(requestData, {
        customApiUrl,
        customApiHeaders,
        customApiBody,
        temperature,
        maxTokens,
        customApiIncludeMimeType,
        threadId: getSessionId(),
        messages: filteredMessages, // フィルタリングされたメッセージを使用
      })
    } else {
      // Vercel AI SDK用データ
      Object.assign(requestData, {
        apiKey: aiApiKey,
        aiService: selectAIService,
        model: selectAIModel,
        localLlmUrl,
        azureEndpoint,
        useSearchGrounding,
        temperature,
        maxTokens,
        reasoningMode,
        reasoningEffort,
        reasoningTokenBudget,
        customModel,
      })
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    })

    if (!response.ok) {
      const responseBody = await response.json()
      throw new Error(
        `API request to ${selectAIService} failed with status ${response.status} and body ${responseBody.error}`,
        { cause: { errorCode: responseBody.errorCode } }
      )
    }

    const data = await response.json()
    return { text: data.text }
  } catch (error) {
    logger.error(`Error fetching ${selectAIService} API response:`, error)
    return { text: handleApiError(getErrorCode(error)) }
  }
}

export async function getVercelAIChatResponseStream(
  messages: Message[],
  options: AIChatResponseStreamOptions = {}
): Promise<ReadableStream<string>> {
  const {
    aiApiKey,
    selectAIService,
    selectAIModel,
    localLlmUrl,
    azureEndpoint,
    useSearchGrounding,
    temperature,
    maxTokens,
    reasoningMode,
    reasoningEffort,
    reasoningTokenBudget,
    customModel,
    customApiUrl,
    customApiHeaders,
    customApiBody,
    customApiIncludeMimeType,
  } = getAIConfig()

  // APIエンドポイントを決定
  const apiEndpoint = getApiEndpoint(selectAIService)

  // 共通リクエストデータ
  const requestData: VercelChatRequestData = {
    messages,
    stream: true,
  }

  // サービスタイプに応じてリクエストデータを追加
  if (selectAIService === 'custom-api') {
    // カスタムAPI用データ
    const filteredMessages = getAIConfig().includeSystemMessagesInCustomApi
      ? messages
      : messages.filter((message) => message.role !== 'system')

    Object.assign(requestData, {
      customApiUrl,
      customApiHeaders,
      customApiBody,
      temperature,
      maxTokens,
      customApiIncludeMimeType,
      threadId: getSessionId(),
      messages: filteredMessages, // フィルタリングされたメッセージを使用
    })
  } else {
    // Vercel AI SDK用データ
    Object.assign(requestData, {
      apiKey: aiApiKey,
      aiService: selectAIService,
      model: selectAIModel,
      localLlmUrl,
      azureEndpoint,
      useSearchGrounding,
      temperature,
      maxTokens,
      reasoningMode,
      reasoningEffort,
      reasoningTokenBudget,
      customModel,
    })
  }

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestData),
  }
  if (options.signal) {
    fetchOptions.signal = options.signal
  }

  const response = await fetch(apiEndpoint, fetchOptions)

  const contentType = response.headers.get('content-type') || ''
  const isPlainTextStream = contentType.includes('text/plain')

  try {
    if (!response.ok) {
      const responseBody = await response.json()
      throw new Error(
        `API request to ${selectAIService} failed with status ${response.status} and body ${responseBody.error}`,
        { cause: { errorCode: responseBody.errorCode } }
      )
    }

    return new ReadableStream({
      async start(controller) {
        if (!response.body) {
          throw new Error(
            `API response from ${selectAIService} is empty, status ${response.status}`,
            { cause: { errorCode: 'AIAPIError' } }
          )
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const decodedChunk = decoder.decode(value, { stream: true })

            if (isPlainTextStream) {
              if (decodedChunk) {
                controller.enqueue(decodedChunk)
              }
              continue
            }

            buffer += decodedChunk
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              // AI SDK UI Message Stream Protocol (SSE JSON形式)
              // https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
              //
              // 主なイベントタイプ:
              // - start, finish, abort: メッセージ制御
              // - text-start, text-delta, text-end: テキストコンテンツ
              // - reasoning-start, reasoning-delta, reasoning-end: 推論コンテンツ
              // - tool-input-start, tool-input-delta, tool-input-available: ツール入力
              // - tool-output-available: ツール出力
              // - source-url, source-document, file: ソース参照
              // - start-step, finish-step: ステップ制御
              // - error: エラー
              // - data-*: カスタムデータ
              if (line.startsWith('data:')) {
                const content = line.substring(5).trim()
                if (content === '[DONE]') continue

                try {
                  const data = JSON.parse(content)

                  if (data.type === 'text-delta' && data.delta) {
                    controller.enqueue(data.delta)
                  } else if (data.type === 'reasoning-delta' && data.delta) {
                    controller.enqueue(THINKING_MARKER + data.delta)
                  } else if (
                    (data.type === 'tool-input-start' && data.toolName) ||
                    ((data.type === 'tool-call-input-streaming-start' ||
                      data.type === 'tool-call') &&
                      data.payload?.toolName)
                  ) {
                    const toolName = data.toolName || data.payload?.toolName
                    logger.log(`Tool called: ${toolName}`)
                    const message = i18next.t('Toasts.UsingTool', {
                      toolName,
                    })
                    toastStore.getState().addToast({
                      message,
                      type: 'tool',
                      tag: `vercel-tool-info-${toolName}`,
                      duration: 3000,
                    })
                  } else if (data.type === 'error') {
                    logger.error(
                      `Error fetching ${selectAIService} API response:`,
                      data.errorText || data
                    )
                    toastStore.getState().addToast({
                      message: data.errorText || 'Unknown error',
                      type: 'error',
                      tag: 'vercel-api-error',
                    })
                  }
                  // その他のイベント（start, finish, text-start, text-end等）は無視
                } catch (error) {
                  logger.error('Error parsing SSE JSON:', error)
                }
              } else if (line.trim() !== '') {
                // Ollamaなど、JSONLフォーマットのストリーミングデータに対応
                try {
                  const data = JSON.parse(line)
                  if (data.message?.content) {
                    controller.enqueue(data.message.content)
                  }
                } catch (error) {
                  logger.error('Error parsing JSONL:', error, line)
                }
              }
            }
          }

          if (isPlainTextStream && buffer) {
            controller.enqueue(buffer)
          }
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }

          logger.error(`Error fetching ${selectAIService} API response:`, error)

          const errorMessage = handleApiError('AIAPIError')
          toastStore.getState().addToast({
            message: errorMessage,
            type: 'error',
            tag: 'vercel-api-error',
          })
        } finally {
          controller.close()
          reader.releaseLock()
        }
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    const errorMessage = handleApiError(getErrorCode(error))
    toastStore.getState().addToast({
      message: errorMessage,
      type: 'error',
      tag: 'vercel-api-error',
    })
    throw error
  }
}
