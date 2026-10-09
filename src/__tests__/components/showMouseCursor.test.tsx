import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    use: jest.fn().mockReturnThis(),
    init: jest.fn().mockReturnThis(),
    changeLanguage: jest.fn(),
  },
  use: jest.fn().mockReturnThis(),
  init: jest.fn().mockReturnThis(),
  changeLanguage: jest.fn(),
}))

const mockT = jest.fn((key: string, defaultVal?: string) => defaultVal ?? key)
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

// mock fetch for background list
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([]),
  })
) as jest.Mock

import settingsStore from '@/features/stores/settings'
import Based from '@/components/settings/based'
import AppInitializer from '@/components/appInitializer'
import { DpadSettingsMenu } from '@/components/DpadSettingsMenu'

describe('Mouse Cursor Visibility Setting', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    settingsStore.setState({
      showMouseCursor: true,
      selectLanguage: 'ja',
    })
    document.body.className = ''
  })

  test('default value in settingsStore is true', () => {
    expect(settingsStore.getState().showMouseCursor).toBe(true)
  })

  test('renders ShowMouseCursor toggle in based settings and switches value', async () => {
    await act(async () => {
      render(<Based />)
    })

    expect(screen.getByText('ShowMouseCursor')).toBeInTheDocument()

    // find the toggle button associated with ShowMouseCursor
    const toggleContainer = screen.getByText('ShowMouseCursor').parentElement
    const toggleButton = toggleContainer?.querySelector('button')
    expect(toggleButton).toBeInTheDocument()

    // click toggle to turn OFF
    if (toggleButton) {
      await act(async () => {
        fireEvent.click(toggleButton)
      })
      expect(settingsStore.getState().showMouseCursor).toBe(false)

      // click toggle to turn ON again
      await act(async () => {
        fireEvent.click(toggleButton)
      })
      expect(settingsStore.getState().showMouseCursor).toBe(true)
    }
  })

  test('renders ShowMouseCursor in DpadSettingsMenu under basic category and toggles value', async () => {
    render(<DpadSettingsMenu onClose={jest.fn()} />)

    // first category is "基本・表示", click to enter
    const categoryButton = screen.getByText('基本・表示')
    expect(categoryButton).toBeInTheDocument()
    fireEvent.click(categoryButton)

    // find "マウスカーソルを表示する" item
    const itemLabel = screen.getByText('マウスカーソルを表示する')
    expect(itemLabel).toBeInTheDocument()

    const itemRow = itemLabel.closest('[id^="setting-item-"]')
    const toggleButton = itemRow?.querySelector('button')
    expect(toggleButton).toBeInTheDocument()

    // toggle OFF
    if (toggleButton) {
      act(() => {
        fireEvent.click(toggleButton)
      })
      expect(settingsStore.getState().showMouseCursor).toBe(false)

      // toggle ON
      act(() => {
        fireEvent.click(toggleButton)
      })
      expect(settingsStore.getState().showMouseCursor).toBe(true)
    }
  })

  test('AppInitializer toggles hide-mouse-cursor class on document.body', () => {
    render(<AppInitializer />)

    // initial state: showMouseCursor = true => no hide-mouse-cursor class
    expect(document.body.classList.contains('hide-mouse-cursor')).toBe(false)

    // set showMouseCursor = false
    act(() => {
      settingsStore.setState({ showMouseCursor: false })
    })
    expect(document.body.classList.contains('hide-mouse-cursor')).toBe(true)

    // set showMouseCursor = true
    act(() => {
      settingsStore.setState({ showMouseCursor: true })
    })
    expect(document.body.classList.contains('hide-mouse-cursor')).toBe(false)
  })
})
