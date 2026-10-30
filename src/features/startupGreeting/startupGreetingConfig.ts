import { EmotionType } from '@/features/messages/messages'

export interface StartupGreetingConfig {
  enabled: boolean
  message: string
  audioPath: string
  emotion: EmotionType
}

export const DEFAULT_STARTUP_GREETING_MESSAGE =
  'こんにちは！ 中央大学国際情報学部（iTL）のイティエルです！ 何かお手伝いできることはありますか？'

export const DEFAULT_STARTUP_GREETING_AUDIO_PATH = '/ithiel/greeting.wav'

export const DEFAULT_STARTUP_GREETING_EMOTION: EmotionType = 'happy'

/**
 * 環境変数を元に、起動時挨拶が有効かどうかを判定する。
 * - NEXT_PUBLIC_STARTUP_GREETING_ENABLED が 'true' の場合: 有効
 * - NEXT_PUBLIC_STARTUP_GREETING_ENABLED が 'false' の場合: 無効
 * - 未設定時: NEXT_PUBLIC_CLUB === 'ithiel' または NEXT_PUBLIC_CHARACTER_NAME === 'イティエル' のとき自動有効
 */
export function isStartupGreetingEnabled(): boolean {
  const envEnabled = process.env.NEXT_PUBLIC_STARTUP_GREETING_ENABLED
  if (envEnabled === 'false') {
    return false
  }
  if (envEnabled === 'true') {
    return true
  }

  const club = process.env.NEXT_PUBLIC_CLUB
  const characterName = process.env.NEXT_PUBLIC_CHARACTER_NAME
  return club === 'ithiel' || characterName === 'イティエル'
}

/**
 * 起動時挨拶の設定を取得する。
 */
export function getStartupGreetingConfig(): StartupGreetingConfig {
  const enabled = isStartupGreetingEnabled()
  const message =
    process.env.NEXT_PUBLIC_STARTUP_GREETING_MESSAGE ||
    DEFAULT_STARTUP_GREETING_MESSAGE
  const audioPath =
    process.env.NEXT_PUBLIC_STARTUP_GREETING_AUDIO_PATH ||
    DEFAULT_STARTUP_GREETING_AUDIO_PATH
  const emotion = (process.env.NEXT_PUBLIC_STARTUP_GREETING_EMOTION ||
    DEFAULT_STARTUP_GREETING_EMOTION) as EmotionType

  return {
    enabled,
    message,
    audioPath,
    emotion,
  }
}
