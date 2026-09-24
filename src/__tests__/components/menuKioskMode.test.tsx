/**
 * Menu Component - Kiosk Mode Tests
 *
 * デモ端末モード時のメニュー表示制御テスト
 */

import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Menu } from '@/components/menu'
import settingsStore from '@/features/stores/settings'
import menuStore from '@/features/stores/menu'
import homeStore from '@/features/stores/home'
import { getLatestAssistantMessage } from '@/utils/assistantMessageUtils'

// mock useKioskMode
const mockUseKioskMode = jest.fn(() => ({
  isKioskMode: false,
  isTemporaryUnlocked: false,
  canAccessSettings: true,
  maxInputLength: 200,
  validateInput: jest.fn(() => ({ valid: true })),
  temporaryUnlock: jest.fn(),
  lockAgain: jest.fn(),
}))

jest.mock('@/hooks/useKioskMode', () => ({
  useKioskMode: () => mockUseKioskMode(),
}))

// Mock stores
jest.mock('@/features/stores/settings', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  }),
}))

jest.mock('@/features/stores/menu', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  }),
}))

jest.mock('@/features/stores/home', () => {
  const getStateMock = jest.fn(() => ({
    chatLog: [],
    viewer: { loadVrm: jest.fn() },
    webcamStatus: false,
    captureStatus: false,
    backgroundImageUrl: '',
  }))
  const subscribeMock = jest.fn(() => jest.fn())
  const setStateMock = jest.fn()

  return {
    __esModule: true,
    default: Object.assign(jest.fn(), {
      getState: getStateMock,
      subscribe: subscribeMock,
      setState: setStateMock,
    }),
  }
})

jest.mock('@/features/stores/slide', () => ({
  __esModule: true,
  default: jest.fn(),
}))

jest.mock('@/features/stores/presentation', () => ({
  __esModule: true,
  default: jest.fn(),
}))

// mock i18n
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

// mock sub-components
jest.mock('@/components/settings', () => ({
  __esModule: true,
  default: () => <div data-testid="settings" />,
}))

jest.mock('@/components/DpadSettingsMenu', () => ({
  DpadSettingsMenu: () => <div data-testid="dpad-settings" />,
}))

jest.mock('@/components/assistantText', () => ({
  AssistantText: () => <div data-testid="assistant-text" />,
}))

jest.mock('@/components/chatLog', () => ({
  ChatLog: () => <div data-testid="chat-log" />,
}))

jest.mock('@/components/iconButton', () => ({
  IconButton: ({
    onClick,
    iconName,
    label,
    'data-testid': testId,
    ...props
  }: any) => (
    <button
      data-testid={testId || `icon-${iconName}`}
      onClick={onClick}
      {...props}
    >
      {label || iconName}
    </button>
  ),
}))

jest.mock('@/components/webcam', () => ({
  Webcam: () => <div data-testid="webcam" />,
}))

jest.mock('@/components/slides', () => ({
  __esModule: true,
  default: () => <div data-testid="slides" />,
}))

jest.mock('@/components/capture', () => ({
  __esModule: true,
  default: () => <div data-testid="capture" />,
}))

jest.mock('@/features/constants/aiModels', () => ({
  isMultiModalAvailable: jest.fn(() => false),
}))

jest.mock('@/utils/assistantMessageUtils', () => ({
  getLatestAssistantMessage: jest.fn(() => null),
}))

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

const mockSettingsStore = settingsStore as jest.MockedFunction<
  typeof settingsStore
>
const mockMenuStore = menuStore as jest.MockedFunction<typeof menuStore>

import slideStore from '@/features/stores/slide'
import presentationStore from '@/features/stores/presentation'
const mockSlideStore = slideStore as jest.MockedFunction<typeof slideStore>
const mockPresentationStore = presentationStore as jest.MockedFunction<
  typeof presentationStore
>
const mockGetLatestAssistantMessage =
  getLatestAssistantMessage as jest.MockedFunction<
    typeof getLatestAssistantMessage
  >

describe('Menu - Kiosk Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetLatestAssistantMessage.mockReturnValue('')

    // default settings store mock
    mockSettingsStore.mockImplementation((selector) => {
      const state = {
        selectAIService: 'openai',
        selectAIModel: 'gpt-4',
        enableMultiModal: false,
        customModel: false,
        youtubeMode: false,
        youtubePlaying: false,
        slideMode: false,
        showControlPanel: true,
        showAssistantText: true,
        chatLogMode: 'assistant',
      }
      return selector(state as any)
    })

    // default menu store mock
    mockMenuStore.mockImplementation((selector) => {
      const state = {
        slideVisible: false,
        showWebcam: false,
        showCapture: false,
      }
      return selector(state as any)
    })

    // default home store mock
    ;(homeStore as any).mockImplementation((selector: any) => {
      const state = { chatLog: [] }
      return selector(state as any)
    })

    // default slide store mock
    mockSlideStore.mockImplementation((selector) => {
      const state = {
        isPlaying: false,
        selectedSlideDocs: null,
      }
      return selector(state as any)
    })

    mockPresentationStore.mockImplementation((selector) =>
      selector({ document: null } as any)
    )

    mockUseKioskMode.mockReturnValue({
      isKioskMode: false,
      isTemporaryUnlocked: false,
      canAccessSettings: true,
      maxInputLength: 200,
      validateInput: jest.fn(() => ({ valid: true })),
      temporaryUnlock: jest.fn(),
      lockAgain: jest.fn(),
    })
  })

  describe('control panel and tools menu visibility', () => {
    it('should show tools toggle button when control panel is visible', () => {
      const { container } = render(<Menu />)
      const toolsButton = screen.getByTestId('main-tools-toggle-button')
      expect(toolsButton).toBeInTheDocument()
    })

    it('should show settings button inside tools menu when kiosk mode is off', () => {
      mockUseKioskMode.mockReturnValue({
        isKioskMode: false,
        isTemporaryUnlocked: false,
        canAccessSettings: true,
        maxInputLength: 200,
        validateInput: jest.fn(() => ({ valid: true })),
        temporaryUnlock: jest.fn(),
        lockAgain: jest.fn(),
      })

      render(<Menu />)
      fireEvent.click(screen.getByTestId('main-tools-toggle-button'))
      const settingsButton = screen.getByTestId('open-settings-button')
      expect(settingsButton).toBeInTheDocument()
    })

    it('should hide settings button inside tools menu when settings access is disabled', () => {
      mockUseKioskMode.mockReturnValue({
        isKioskMode: false,
        isTemporaryUnlocked: false,
        canAccessSettings: false,
        maxInputLength: 200,
        validateInput: jest.fn(() => ({ valid: true })),
        temporaryUnlock: jest.fn(),
        lockAgain: jest.fn(),
      })

      render(<Menu />)
      fireEvent.click(screen.getByTestId('main-tools-toggle-button'))
      expect(screen.queryByTestId('open-settings-button')).toBeNull()
    })

    it('should show settings button inside tools menu when kiosk mode is on but temporarily unlocked', () => {
      mockUseKioskMode.mockReturnValue({
        isKioskMode: true,
        isTemporaryUnlocked: true,
        canAccessSettings: true,
        maxInputLength: 200,
        validateInput: jest.fn(() => ({ valid: true })),
        temporaryUnlock: jest.fn(),
        lockAgain: jest.fn(),
      })

      render(<Menu />)
      fireEvent.click(screen.getByTestId('main-tools-toggle-button'))
      expect(screen.getByTestId('open-settings-button')).toBeInTheDocument()
    })
  })

  describe('control panel with kiosk mode', () => {
    it('should hide entire control panel in kiosk mode when showControlPanel is true', () => {
      mockUseKioskMode.mockReturnValue({
        isKioskMode: true,
        isTemporaryUnlocked: false,
        canAccessSettings: false,
        maxInputLength: 200,
        validateInput: jest.fn(() => ({ valid: true })),
        temporaryUnlock: jest.fn(),
        lockAgain: jest.fn(),
      })

      mockSettingsStore.mockImplementation((selector) => {
        const state = {
          selectAIService: 'openai',
          selectAIModel: 'gpt-4',
          enableMultiModal: false,
          customModel: false,
          youtubeMode: false,
          youtubePlaying: false,
          slideMode: false,
          showControlPanel: true,
          showAssistantText: true,
          chatLogMode: 'assistant',
        }
        return selector(state as any)
      })

      render(<Menu />)
      expect(screen.queryByTestId('main-tools-toggle-button')).toBeNull()
    })
  })

  describe('keyboard navigation in tools menu', () => {
    it('toggles tools menu with Shift+Cmd+K (or Shift+Ctrl+K)', () => {
      render(<Menu />)

      // open with shortcut
      fireEvent.keyDown(window, {
        key: 'K',
        code: 'KeyK',
        metaKey: true,
        shiftKey: true,
      })
      expect(screen.getByTestId('main-tools-menu')).toBeInTheDocument()

      // close with shortcut
      fireEvent.keyDown(window, {
        key: 'K',
        code: 'KeyK',
        metaKey: true,
        shiftKey: true,
      })
      expect(screen.queryByTestId('main-tools-menu')).toBeNull()
    })

    it('navigates items with ArrowDown / ArrowUp, executes with Enter, and closes with Backspace', () => {
      render(<Menu />)

      // open menu
      fireEvent.click(screen.getByTestId('main-tools-toggle-button'))
      expect(screen.getByTestId('main-tools-menu')).toBeInTheDocument()

      // navigate down and up
      fireEvent.keyDown(window, { key: 'ArrowDown' })
      fireEvent.keyDown(window, { key: 'ArrowUp' })

      // press Enter on settings (first item) -> opens settings menu
      fireEvent.keyDown(window, { key: 'Enter' })
      expect(screen.getByTestId('dpad-settings')).toBeInTheDocument()
    })

    it('closes tools menu with Backspace', () => {
      render(<Menu />)

      fireEvent.click(screen.getByTestId('main-tools-toggle-button'))
      expect(screen.getByTestId('main-tools-menu')).toBeInTheDocument()

      fireEvent.keyDown(window, { key: 'Backspace' })
      expect(screen.queryByTestId('main-tools-menu')).toBeNull()
    })
  })

  describe('settings keyboard shortcut', () => {
    it('toggles settings with the configured shortcut only', () => {
      mockUseKioskMode.mockReturnValue({
        isKioskMode: false,
        isTemporaryUnlocked: false,
        canAccessSettings: true,
        maxInputLength: 200,
        validateInput: jest.fn(() => ({ valid: true })),
        temporaryUnlock: jest.fn(),
        lockAgain: jest.fn(),
      })
      mockSettingsStore.mockImplementation((selector) => {
        const state = {
          selectAIService: 'openai',
          selectAIModel: 'gpt-4',
          enableMultiModal: false,
          customModel: false,
          youtubeMode: false,
          youtubePlaying: false,
          slideMode: false,
          showControlPanel: true,
          showAssistantText: true,
          chatLogMode: 'assistant',
          settingsToggleShortcut: 'Control+KeyK',
        }
        return selector(state as any)
      })

      render(<Menu />)

      fireEvent.keyDown(window, { key: '.', code: 'Period', ctrlKey: true })
      expect(screen.queryByTestId('dpad-settings')).toBeNull()

      fireEvent.keyDown(window, { key: 'k', code: 'KeyK', ctrlKey: true })
      expect(screen.getByTestId('dpad-settings')).toBeTruthy()
    })
  })

  it('スライド表示中は通常のAI回答テキストを表示しない', () => {
    mockSettingsStore.mockImplementation((selector) =>
      selector({
        selectAIService: 'openai',
        selectAIModel: 'gpt-4',
        enableMultiModal: false,
        customModel: false,
        youtubeMode: false,
        youtubePlaying: false,
        slideMode: true,
        showControlPanel: true,
        showAssistantText: true,
      } as any)
    )
    mockMenuStore.mockImplementation((selector) =>
      selector({
        slideVisible: true,
        showWebcam: false,
        showCapture: false,
      } as any)
    )
    mockGetLatestAssistantMessage.mockReturnValue({
      role: 'assistant',
      content: '質問への回答です。',
    } as any)

    const { queryByTestId } = render(<Menu />)
    expect(queryByTestId('assistant-text')).not.toBeInTheDocument()
  })

  it('外部プレゼンを隠した会話中は新しいAI回答を自動表示する', async () => {
    let chatLog: any[] = []
    let chatLogMode = 'hidden'
    mockUseKioskMode.mockReturnValue({
      isKioskMode: false,
      isTemporaryUnlocked: false,
      canAccessSettings: true,
      maxInputLength: 200,
      validateInput: jest.fn(() => ({ valid: true })),
      temporaryUnlock: jest.fn(),
      lockAgain: jest.fn(),
    })
    mockSettingsStore.mockImplementation((selector) =>
      selector({
        selectAIService: 'openai',
        selectAIModel: 'gpt-4',
        enableMultiModal: false,
        customModel: false,
        youtubeMode: false,
        youtubePlaying: false,
        slideMode: true,
        showControlPanel: true,
        showAssistantText: true,
        chatLogMode,
      } as any)
    )
    ;(settingsStore.setState as jest.Mock).mockImplementation((update) => {
      if (update.chatLogMode) chatLogMode = update.chatLogMode
    })
    mockMenuStore.mockImplementation((selector) =>
      selector({
        slideVisible: false,
        showWebcam: false,
        showCapture: false,
      } as any)
    )
    mockPresentationStore.mockImplementation((selector) =>
      selector({ document: { presentationId: 'morning-show' } } as any)
    )
    ;(homeStore as any).mockImplementation((selector: any) =>
      selector({ chatLog } as any)
    )

    const view = render(<Menu />)
    expect(view.queryByTestId('assistant-text')).not.toBeInTheDocument()

    chatLog = [
      { id: 'answer-1', role: 'assistant', content: '新しい回答です。' },
    ]
    mockGetLatestAssistantMessage.mockReturnValue('新しい回答です。')
    const onHomeStoreChange = (homeStore as any).subscribe.mock.calls.at(-1)[0]
    act(() => onHomeStoreChange({ chatLog }, { chatLog: [] }))

    await waitFor(() =>
      expect(settingsStore.setState).toHaveBeenCalledWith({
        chatLogMode: 'assistant',
      })
    )
    view.rerender(<Menu />)

    await waitFor(() =>
      expect(view.getByTestId('assistant-text')).toBeInTheDocument()
    )
  })
})
