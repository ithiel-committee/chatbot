import { useCallback, useEffect, useRef, useState } from 'react'
import { getAutoHideTimeoutSec } from '@/utils/autoHideConfig'

export interface UseAutoHideUIOptions {
  /** メニューやモーダルが開いている等で自動非表示を一時停止するかどうか */
  disabled?: boolean
  /** タイムアウト秒数（テストや個別指定用。未指定時は環境変数から取得） */
  timeoutSec?: number
}

export interface UseAutoHideUIReturn {
  /** 現在非アクティブ（アイドル）状態かどうか */
  isIdle: boolean
  /** 自動非表示機能が有効かどうか（秒数が0より大きい場合true） */
  isEnabled: boolean
}

/**
 * useAutoHideUI
 *
 * マウスカーソル等の操作が停止してから指定秒数後に
 * 左上のツールボタンや Next.js DevTools ボタンをフェードアウトさせるためのフック。
 * ユーザーアクティビティ（マウス移動、キー押下、タッチ等）を検知すると即座に再表示される。
 */
export const useAutoHideUI = (
  options: UseAutoHideUIOptions = {}
): UseAutoHideUIReturn => {
  const { disabled = false, timeoutSec: overrideTimeoutSec } = options

  const configuredTimeoutSec =
    overrideTimeoutSec !== undefined
      ? overrideTimeoutSec
      : getAutoHideTimeoutSec()
  const isEnabled = configuredTimeoutSec > 0

  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    clearTimer()
    if (!isEnabled || disabled) return

    timerRef.current = setTimeout(() => {
      setIsIdle(true)
      timerRef.current = null
    }, configuredTimeoutSec * 1000)
  }, [clearTimer, configuredTimeoutSec, disabled, isEnabled])

  // ユーザーアクティビティ検知時のハンドラー
  const handleActivity = useCallback(() => {
    // アイドル状態なら復帰（すでにfalseならReactが自動スキップ）
    setIsIdle(false)
    // タイマーをリセットして再スタート
    startTimer()
  }, [startTimer])

  // disabled 変更時や isEnabled 変更時の処理
  useEffect(() => {
    if (!isEnabled || disabled) {
      clearTimer()
      setIsIdle(false)
      return
    }

    // 有効化されたらタイマーを開始
    startTimer()

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'pointermove',
      'mousedown',
      'keydown',
      'touchstart',
      'wheel',
    ]

    const listenerOptions = { passive: true }

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, listenerOptions)
    })

    return () => {
      clearTimer()
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [clearTimer, disabled, handleActivity, isEnabled, startTimer])

  // document.body へのクラス同期
  useEffect(() => {
    if (typeof document === 'undefined') return

    if (isIdle) {
      document.body.classList.add('ui-autohide-idle')
    } else {
      document.body.classList.remove('ui-autohide-idle')
    }

    return () => {
      document.body.classList.remove('ui-autohide-idle')
    }
  }, [isIdle])

  return { isIdle, isEnabled }
}
