import { renderHook, act } from '@testing-library/react'
import { useAutoHideUI } from '@/hooks/useAutoHideUI'

describe('useAutoHideUI', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT

  beforeEach(() => {
    jest.useFakeTimers()
    document.body.className = ''
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT
    }
    document.body.className = ''
  })

  it('環境変数が未設定の場合は無効（isEnabled: false, isIdle: false）', () => {
    delete process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT
    const { result } = renderHook(() => useAutoHideUI())

    expect(result.current.isEnabled).toBe(false)
    expect(result.current.isIdle).toBe(false)

    // 時間が経過してもアイドル状態にならない
    act(() => {
      jest.advanceTimersByTime(10000)
    })
    expect(result.current.isIdle).toBe(false)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)
  })

  it('指定秒数後に isIdle が true になり document.body に ui-autohide-idle クラスが付与される', () => {
    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = '3'
    const { result } = renderHook(() => useAutoHideUI())

    expect(result.current.isEnabled).toBe(true)
    expect(result.current.isIdle).toBe(false)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)

    // 2.9秒経過時点ではまだ false
    act(() => {
      jest.advanceTimersByTime(2900)
    })
    expect(result.current.isIdle).toBe(false)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)

    // 3秒経過で true
    act(() => {
      jest.advanceTimersByTime(100)
    })
    expect(result.current.isIdle).toBe(true)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(true)
  })

  it('マウス移動（mousemove）を検知すると isIdle が false にリセットされタイマーが再スタートする', () => {
    const { result } = renderHook(() => useAutoHideUI({ timeoutSec: 2 }))

    // 2秒経過でアイドル
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(result.current.isIdle).toBe(true)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(true)

    // マウス移動イベント発火
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })
    expect(result.current.isIdle).toBe(false)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)

    // さらに1秒後（合計1秒経過）はまだアイドルではない
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.isIdle).toBe(false)

    // さらに1秒後（リセットから2秒経過）で再びアイドル
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.isIdle).toBe(true)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(true)
  })

  it('キーボード入力（keydown）やタッチ（touchstart）でもリセットされる', () => {
    const { result } = renderHook(() => useAutoHideUI({ timeoutSec: 1 }))

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.isIdle).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    })
    expect(result.current.isIdle).toBe(false)

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(result.current.isIdle).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('touchstart'))
    })
    expect(result.current.isIdle).toBe(false)
  })

  it('disabled が true のときはアイドル状態にならず、すでにアイドル中なら解除される', () => {
    const { result, rerender } = renderHook(
      ({ disabled }) => useAutoHideUI({ timeoutSec: 2, disabled }),
      { initialProps: { disabled: false } }
    )

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(result.current.isIdle).toBe(true)

    // disabled を true に切り替え
    rerender({ disabled: true })
    expect(result.current.isIdle).toBe(false)
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)

    // 時間が経過してもアイドルにならない
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(result.current.isIdle).toBe(false)
  })

  it('アンマウント時に document.body のクラスが解除される', () => {
    const { unmount } = renderHook(() => useAutoHideUI({ timeoutSec: 1 }))

    act(() => {
      jest.advanceTimersByTime(1000)
    })
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(true)

    unmount()
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)
  })
})
