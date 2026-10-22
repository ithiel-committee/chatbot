/**
 * 実行環境がElectronデスクトップアプリかどうかを判定するユーティリティ
 */
export const isElectronEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false
  return (
    Boolean((window as any).isElectron) || /electron/i.test(navigator.userAgent)
  )
}
