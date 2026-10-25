/**
 * 音声再生開始を待ってテキスト表示を同期させるデフォルトの最大待機時間（ミリ秒）
 */
export const DEFAULT_VOICE_WAIT_TIMEOUT_MS = 5000

/**
 * 環境変数から音声待機タイムアウト時間（ミリ秒）を取得する
 * - 未設定または不正値の場合は DEFAULT_VOICE_WAIT_TIMEOUT_MS (5000ms)
 * - 0以下の場合はゲート無効（即時表示）
 */
export const getVoiceWaitTimeoutMs = (): number => {
  const envVal = process.env.NEXT_PUBLIC_VOICE_WAIT_TIMEOUT_MS
  if (envVal !== undefined && envVal !== '') {
    const parsed = Number(envVal)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed
    }
  }
  return DEFAULT_VOICE_WAIT_TIMEOUT_MS
}
