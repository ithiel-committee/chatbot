import settingsStore from '@/features/stores/settings'
import { logger } from '@/lib/logger'

export const DATETIME_PROMPT_HEADER_JA = '【現在の日時情報】'
export const DATETIME_PROMPT_HEADER_EN = '[Current Date and Time]'

/**
 * システムプロンプトへの日時注入が有効化されているかどうかを判定
 * env または settingsStore のフラグが true の場合に有効
 */
export function isDateTimeInjectionEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPT === 'true') {
    return true
  }
  try {
    return settingsStore.getState()?.injectDateTimeToSystemPrompt === true
  } catch {
    return false
  }
}

/**
 * 指定された日時のフォーマット済みプロンプト文を生成
 */
export function buildCurrentDateTimePrompt(
  date: Date = new Date(),
  language: string = 'ja',
  timeZone: string = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Tokyo'
): string {
  try {
    const isEn = language === 'en'
    const formatter = new Intl.DateTimeFormat(isEn ? 'en-US' : 'ja-JP', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const formatted = formatter.format(date)

    if (isEn) {
      return (
        `${DATETIME_PROMPT_HEADER_EN}\n` +
        `Current Date & Time: ${formatted} (${timeZone})\n` +
        'Please prioritize this real-world date and time when answering questions about the current date, time, day of the week, or season.'
      )
    }

    return (
      `${DATETIME_PROMPT_HEADER_JA}\n` +
      `現在の日時: ${formatted} (${timeZone})\n` +
      '設定資料内に他の日付（イベント日程等）が記載されていても、現実は上記の日時です。今日の日付や曜日、現在時刻、季節・時間帯に関する質問には、必ず上記の日時を基準として回答してください。'
    )
  } catch {
    const iso = date.toISOString()
    return `[Current Time: ${iso} (UTC)]`
  }
}

/**
 * システムプロンプトに現在日時情報を付加
 * フラグが無効な場合、または既に日時情報が含まれている場合は既存のプロンプトをそのまま返す
 */
export function appendCurrentDateTimeToPrompt(
  systemPrompt: string = '',
  date: Date = new Date(),
  language: string = 'ja',
  timeZone: string = process.env.NEXT_PUBLIC_TIMEZONE || 'Asia/Tokyo'
): string {
  if (!isDateTimeInjectionEnabled()) {
    return systemPrompt
  }

  // 既に注入済みの場合は重複付加を防止
  if (
    systemPrompt.includes(DATETIME_PROMPT_HEADER_JA) ||
    systemPrompt.includes(DATETIME_PROMPT_HEADER_EN)
  ) {
    return systemPrompt
  }

  const dateTimePrompt = buildCurrentDateTimePrompt(date, language, timeZone)
  logger.log(`[DateTimePrompt] 🕒 現在日時をシステムプロンプトに注入しました`)
  if (!systemPrompt.trim()) {
    return dateTimePrompt
  }

  return `${systemPrompt}\n\n${dateTimePrompt}`
}
