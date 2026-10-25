/**
 * 環境変数 NEXT_PUBLIC_AUTOHIDE_TIMEOUT からUI自動非表示までの秒数を取得する。
 * 未設定、空文字、0以下、または不正な数値の場合は 0（無効）を返す。
 */
export const getAutoHideTimeoutSec = (): number => {
  const envVal = process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT
  if (!envVal) return 0
  const parsed = Number(envVal)
  if (isNaN(parsed) || parsed <= 0) return 0
  return parsed
}
