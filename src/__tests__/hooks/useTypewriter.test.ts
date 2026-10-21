import { renderHook, act } from '@testing-library/react'
import { useTypewriter } from '@/hooks/useTypewriter'

describe('useTypewriter', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('immediately returns full text when enabled is false', () => {
    const { result } = renderHook(() => useTypewriter('こんにちは', false))

    expect(result.current.displayedText).toBe('こんにちは')
    expect(result.current.isTyping).toBe(false)
  })

  it('types characters one by one when enabled is true', () => {
    const { result } = renderHook(() =>
      useTypewriter('こんにちは', true, { speed: 30, punctuationWait: 100 })
    )

    // 初期状態は0文字
    expect(result.current.displayedText).toBe('')
    expect(result.current.isTyping).toBe(true)

    // 30ms 経過で1文字目「こ」
    act(() => {
      jest.advanceTimersByTime(30)
    })
    expect(result.current.displayedText).toBe('こ')

    // さらに 30ms 経過で2文字目「ん」
    act(() => {
      jest.advanceTimersByTime(30)
    })
    expect(result.current.displayedText).toBe('こん')

    // 残り文字すべてタイピング完了まで進める (30ms * 3 = 90ms)
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current.displayedText).toBe('こんにちは')
    expect(result.current.isTyping).toBe(false)
  })

  it('skips immediately to full text when skip is called', () => {
    const { result } = renderHook(() =>
      useTypewriter('長いメッセージです。', true, { speed: 30 })
    )

    expect(result.current.displayedText).toBe('')
    expect(result.current.isTyping).toBe(true)

    // スキップを実行
    act(() => {
      result.current.skip()
    })

    expect(result.current.displayedText).toBe('長いメッセージです。')
    expect(result.current.isTyping).toBe(false)
  })

  it('pauses longer on punctuation', () => {
    const { result } = renderHook(() =>
      useTypewriter('あ！い', true, { speed: 30, punctuationWait: 100 })
    )

    act(() => {
      jest.advanceTimersByTime(30)
    })
    expect(result.current.displayedText).toBe('あ')

    // ！ が出た後、通常30ms + 句読点100ms = 130ms 必要
    act(() => {
      jest.advanceTimersByTime(30)
    })
    expect(result.current.displayedText).toBe('あ！')

    // 50ms進めてもまだ「い」は出ない
    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(result.current.displayedText).toBe('あ！')

    // さらに 90ms (合計140ms) 進めると「い」が出る
    act(() => {
      jest.advanceTimersByTime(90)
    })
    expect(result.current.displayedText).toBe('あ！い')
    expect(result.current.isTyping).toBe(false)
  })
})
