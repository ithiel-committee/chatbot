import React from 'react'
import { render, act } from '@testing-library/react'
import { Menu } from '@/components/menu'
import settingsStore from '@/features/stores/settings'
import { useKioskMode } from '@/hooks/useKioskMode'

// mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => {
      const translations: Record<string, string> = {
        Tools: 'ツール',
      }
      return translations[key] ?? defaultVal ?? key
    },
  }),
}))

jest.mock('@/hooks/useKioskMode', () => ({
  useKioskMode: jest.fn(),
}))

const mockUseKioskMode = useKioskMode as jest.MockedFunction<
  typeof useKioskMode
>

describe('Menu AutoHide UI', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT

  beforeEach(() => {
    jest.useFakeTimers()
    document.body.className = ''
    mockUseKioskMode.mockReturnValue({
      isKioskMode: false,
      isTemporaryUnlocked: false,
      canAccessSettings: true,
      maxInputLength: 200,
      validateInput: jest.fn(() => ({ valid: true })),
      temporaryUnlock: jest.fn(),
      lockAgain: jest.fn(),
    })

    settingsStore.setState({
      showControlPanel: true,
      chatLogMode: 'hidden',
      showAssistantText: false,
    })
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

  it('NEXT_PUBLIC_AUTOHIDE_TIMEOUT指定時、時間経過でフェードアウト用クラスが付与される', () => {
    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = '3'
    const { container } = render(<Menu />)

    const dockWrapper = container.querySelector('.autohide-ui-target')
    expect(dockWrapper).toBeInTheDocument()
    expect(dockWrapper).toHaveClass('opacity-100')
    expect(dockWrapper).not.toHaveClass('opacity-0')
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)

    // 3秒経過
    act(() => {
      jest.advanceTimersByTime(3000)
    })

    expect(dockWrapper).toHaveClass('opacity-0')
    expect(dockWrapper).toHaveClass('pointer-events-none')
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(true)

    // マウスを動かすと再表示
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'))
    })

    expect(dockWrapper).toHaveClass('opacity-100')
    expect(dockWrapper).not.toHaveClass('opacity-0')
    expect(document.body.classList.contains('ui-autohide-idle')).toBe(false)
  })
})
