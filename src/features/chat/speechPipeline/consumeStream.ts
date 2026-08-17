import { logger } from '@/lib/logger'
import { THINKING_MARKER } from '@/features/chat/vercelAIChat'
import { SpeechSegmenter } from './speechSegmenter'
import { SegmenterEvent } from './types'

export type StreamConsumerHandlers = {
  onThinking: (chunk: string) => void
  onTextChunk?: (chunk: string) => void
  onEvent: (event: SegmenterEvent) => void
}

/**
 * AI応答ストリームを読み取り、THINKINGチャンクとテキストチャンクへ分類して
 * SpeechSegmenterに流し、確定したイベントをハンドラーへ配る。
 *
 * 停止（stopAll等）後もストリームは最後まで読み、chatLogを完成させる。
 * 発話の抑止はdispatcher側のガードで行う（設計§5.3）。
 */
export const consumeStream = async (
  reader: ReadableStreamDefaultReader<string>,
  segmenter: SpeechSegmenter,
  handlers: StreamConsumerHandlers
): Promise<{ failed: boolean }> => {
  let failed = false
  try {
    while (true) {
      const { done, value } = await reader.read()

      if (value) {
        if (value.startsWith(THINKING_MARKER)) {
          handlers.onThinking(value.substring(THINKING_MARKER.length))
        } else {
          handlers.onTextChunk?.(value)
          for (const event of segmenter.push(value)) {
            handlers.onEvent(event)
          }
        }
      }

      if (done) {
        for (const event of segmenter.flush()) {
          handlers.onEvent(event)
        }
        break
      }
    }
  } catch (e) {
    failed = true
    logger.error('Error processing AI response stream:', e)
  } finally {
    reader.releaseLock()
  }
  return { failed }
}
