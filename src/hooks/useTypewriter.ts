import { useState, useEffect, useRef, useCallback } from 'react'

export interface TypewriterOptions {
  /** 1文字あたりの表示間隔 (ms)。デフォルト: 30ms */
  speed?: number
  /** 句読点（、。！？!?…）後の追加待機時間 (ms)。デフォルト: 100ms */
  punctuationWait?: number
}

const PUNCTUATION_REGEX = /[、。！？!?…\n]/

/**
 * ノベルゲーム風のタイプライター（一文字ずつ表示）フック
 *
 * @param text 表示する全文
 * @param enabled タイプライター効果を有効にするか（falseの場合は即時全文表示）
 * @param options タイピング速度などのオプション
 */
export function useTypewriter(
  text: string,
  enabled: boolean = true,
  options: TypewriterOptions = {}
) {
  const { speed = 30, punctuationWait = 100 } = options
  const [displayedLength, setDisplayedLength] = useState(() =>
    enabled ? 0 : text.length
  )
  const lengthRef = useRef(displayedLength)
  lengthRef.current = displayedLength

  const textRef = useRef(text)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // クリック等で即座に全文表示するスキップ関数
  const skip = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setDisplayedLength(textRef.current.length)
  }, [])

  useEffect(() => {
    const prevText = textRef.current
    textRef.current = text

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!enabled || !text) {
      setDisplayedLength(text.length)
      return
    }

    let current = 0
    // ストリーミングなどで追記された場合、これまでの進行度を維持
    if (
      lengthRef.current > 0 &&
      text.startsWith(prevText.slice(0, lengthRef.current))
    ) {
      current = lengthRef.current
    } else {
      setDisplayedLength(0)
    }

    const tick = () => {
      current += 1
      setDisplayedLength(current)

      if (current < text.length) {
        const justTyped = text[current - 1]
        const delay = PUNCTUATION_REGEX.test(justTyped)
          ? speed + punctuationWait
          : speed
        timerRef.current = setTimeout(tick, delay)
      } else {
        timerRef.current = null
      }
    }

    if (current < text.length) {
      timerRef.current = setTimeout(tick, speed)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [text, enabled, speed, punctuationWait])

  const isTyping = enabled && text.length > 0 && displayedLength < text.length
  const displayedText = enabled ? text.slice(0, displayedLength) : text

  return {
    displayedText,
    isTyping,
    skip,
  }
}
