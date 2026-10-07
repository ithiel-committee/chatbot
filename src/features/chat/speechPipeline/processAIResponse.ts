import { logger } from '@/lib/logger'
import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'
import { Message } from '@/features/messages/messages'
import { SpeakQueue } from '@/features/messages/speakQueue'
import { saveMessageToMemory } from '@/features/memory/memoryStoreSync'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { generateMessageId } from '@/utils/messageUtils'
import { getFirstSpeechCommaMinChars, SpeechSegmenter } from './speechSegmenter'
import { MessageLogWriter } from './messageLogWriter'
import { createSpeechDispatcher } from './speechDispatcher'
import { consumeStream } from './consumeStream'
import {
  markConversationLatency,
  startConversationLatencyTrace,
} from '../conversationLatency'

export type ProcessAIResponseOptions = {
  inputReceivedAt?: number
}

/**
 * AIからの応答ストリームを処理する。
 *
 * 表示（chatLog）・発話（SpeakQueue）・記憶（IndexedDB）の各副作用は
 * writer / dispatcher / 本関数末尾に分離されており、本関数は
 * オーケストレーションのみを行う（設計ドキュメント docs/streaming-pipeline-design.md）。
 */
export const processAIResponse = async (
  messages: Message[],
  options: ProcessAIResponseOptions = {}
) => {
  const sessionId = generateMessageId()
  startConversationLatencyTrace(sessionId, options.inputReceivedAt)
  markConversationLatency(sessionId, 'ai_request_started')
  homeStore.setState({ chatProcessing: true })
  const thinkingPose = applyThinkingPose()

  const lastUserMsg = messages.filter((m) => m.role === 'user').slice(-1)[0]
  const userContent =
    typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : ''
  const settings = settingsStore.getState()
  logger.log(
    `[Chat] 📨 メッセージ送信: "${userContent.slice(0, 50)}${userContent.length > 50 ? '...' : ''}" | service: ${settings.selectAIService}, model: ${settings.selectAIModel}`
  )

  let stream
  try {
    stream = await getAIChatResponseStream(messages)
  } catch (e) {
    logger.error('[Chat] ❌ AI応答ストリーム取得エラー:', e)
    thinkingPose.reset()
    homeStore.setState({ chatProcessing: false })
    markConversationLatency(sessionId, 'response_complete')
    return null
  }

  if (stream == null) {
    logger.warn('[Chat] ⚠️ 応答ストリームが空でした')
    thinkingPose.reset()
    homeStore.setState({ chatProcessing: false })
    markConversationLatency(sessionId, 'response_complete')
    return null
  }

  logger.log('[Chat] 🌊 応答ストリームの処理を開始します')

  const writer = new MessageLogWriter()
  const dispatcher = createSpeechDispatcher(sessionId)

  const { failed } = await consumeStream(
    stream.getReader(),
    new SpeechSegmenter({
      firstSpeechCommaMinChars: getFirstSpeechCommaMinChars(
        settingsStore.getState().selectVoice
      ),
    }),
    {
      onThinking: (chunk) => writer.appendThinking(chunk),
      onTextChunk: () => markConversationLatency(sessionId, 'first_text'),
      onEvent: (event) => {
        if (event.kind === 'display') {
          writer.appendDisplay(event.text)
        } else if (event.kind === 'code') {
          writer.appendCodeBlock(event.content)
        } else {
          markConversationLatency(sessionId, 'first_speech_segment')
          dispatcher.dispatch(event)
        }
      },
    }
  )

  if (failed || !dispatcher.anyDispatched) {
    thinkingPose.reset()
  }
  homeStore.setState({ chatProcessing: false })
  markConversationLatency(sessionId, 'response_complete')
  logger.log(
    `[Chat] 🏁 応答ストリーム終了 (セッション: ${sessionId.slice(0, 8)})`
  )

  const finalContent = writer.finalize()
  if (finalContent) {
    // IndexedDBにアシスタントメッセージを保存
    saveMessageToMemory({ role: 'assistant', content: finalContent }).catch(
      () => {}
    )
  }

  // 停止で発話が打ち切られた場合、キューの排水では発火しなくなった
  // 完了コールバック・表情リセットを引き継ぐ（設計§5.4）
  if (dispatcher.disabled) {
    await SpeakQueue.finalizeIfIdle()
  }
  return finalContent || null
}

// 思考中ポーズの適用（VRMのみ）。reset() は冪等。
const applyThinkingPose = () => {
  const ss = settingsStore.getState()
  const enabled = ss.thinkingPoseEnabled && ss.modelType === 'vrm'

  if (enabled) {
    const poseConfig = ss.poseConfigs?.find((p) => p.id === ss.thinkingPoseId)
    const model = homeStore.getState().viewer.model
    if (poseConfig && model) {
      void model.poseManager
        .applyPose(model, ss.thinkingPoseId, poseConfig)
        .catch((e: unknown) =>
          logger.error('Failed to apply thinking pose:', e)
        )
    }
  }

  return {
    reset: () => {
      if (!enabled) return
      const model = homeStore.getState().viewer.model
      if (model?.poseManager.isActive) {
        model.poseManager.resetToIdle(model)
      }
    },
  }
}
