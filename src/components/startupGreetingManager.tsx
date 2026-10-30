import { useEffect, useRef } from 'react'
import homeStore from '@/features/stores/home'
import { speakCharacter } from '@/features/messages/speakCharacter'
import { Talk } from '@/features/messages/messages'
import { getCharacterRenderer } from '@/features/messages/characterRenderer'
import { buildUrl } from '@/utils/buildUrl'
import { logger } from '@/lib/logger'
import { getStartupGreetingConfig } from '@/features/startupGreeting/startupGreetingConfig'

const SESSION_STORAGE_KEY = 'ithiel_startup_greeting_spoken'
const MODEL_WAIT_INTERVAL_MS = 200
const MODEL_WAIT_TIMEOUT_MS = 15000

export const StartupGreetingManager = () => {
  const hasTriggeredRef = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const config = getStartupGreetingConfig()
    if (!config.enabled) return

    // 同一タブセッション内ですでに発話済みの場合はスキップ
    if (sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true') {
      return
    }

    if (hasTriggeredRef.current) return
    hasTriggeredRef.current = true

    let timeoutTimer: NodeJS.Timeout | null = null
    let pollTimer: NodeJS.Timeout | null = null

    const executeGreeting = async () => {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, 'true')

        let audioBuffer: ArrayBuffer | undefined
        try {
          const res = await fetch(buildUrl(config.audioPath))
          if (res.ok) {
            audioBuffer = await res.arrayBuffer()
          } else {
            logger.warn(
              `Startup greeting audio file not found at ${config.audioPath} (status: ${res.status}). Falling back to TTS.`
            )
          }
        } catch (fetchError) {
          logger.warn(
            'Failed to fetch startup greeting audio buffer, falling back to TTS:',
            fetchError
          )
        }

        // チャットログにassistantメッセージを追加
        homeStore.getState().upsertMessage({
          role: 'assistant',
          content: config.message,
        })

        const sessionId = `startup-${Date.now()}`
        const talk: Talk = {
          message: config.message,
          emotion: config.emotion,
          ...(audioBuffer ? { buffer: audioBuffer } : {}),
        }

        logger.log(
          `[StartupGreeting] 発話開始: message="${config.message.slice(0, 30)}..." hasBuffer=${!!audioBuffer}`
        )

        speakCharacter(sessionId, talk)
      } catch (error) {
        logger.error('Failed to execute startup greeting:', error)
      }
    }

    const startTime = Date.now()
    pollTimer = setInterval(() => {
      const renderer = getCharacterRenderer()
      const isTimeout = Date.now() - startTime >= MODEL_WAIT_TIMEOUT_MS

      // レンダラーが準備完了、またはタイムアウトしたら発話を実行
      if (renderer !== null || isTimeout) {
        if (pollTimer) clearInterval(pollTimer)
        if (timeoutTimer) clearTimeout(timeoutTimer)
        void executeGreeting()
      }
    }, MODEL_WAIT_INTERVAL_MS)

    return () => {
      if (pollTimer) clearInterval(pollTimer)
      if (timeoutTimer) clearTimeout(timeoutTimer)
    }
  }, [])

  return null
}

export default StartupGreetingManager
