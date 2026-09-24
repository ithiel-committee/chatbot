import React from 'react'
import { render } from '@testing-library/react'
import { MessageInput } from '@/components/messageInput'
import settingsStore from '@/features/stores/settings'

jest.mock('@/features/stores/home', () => ({
  __esModule: true,
  default: jest.fn((selector) =>
    selector({
      chatProcessing: false,
      modalImage: '',
    })
  ),
}))

jest.mock('@/features/stores/settings', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    setState: jest.fn(),
    getState: jest.fn(() => ({})),
  }),
}))

jest.mock('@/features/stores/slide', () => ({
  __esModule: true,
  default: jest.fn((selector) => selector({ isPlaying: false })),
}))

jest.mock('@/hooks/useKioskMode', () => ({
  useKioskMode: () => ({
    isKioskMode: false,
    validateInput: () => ({ valid: true }),
    maxInputLength: undefined,
  }),
}))

jest.mock('@/components/iconButton', () => ({
  IconButton: (props: any) => (
    <button
      className={props.className}
      disabled={props.disabled}
      onClick={props.onClick}
      data-testid={props['data-testid']}
    />
  ),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => React.createElement('img', props),
}))

const mockSettingsStore = settingsStore as jest.MockedFunction<
  typeof settingsStore
> & {
  setState: jest.Mock
  getState: jest.Mock
}

const defaultProps = {
  userMessage: '',
  isMicRecording: false,
  onChangeUserMessage: jest.fn(),
  onClickSendButton: jest.fn(),
  onClickMicButton: jest.fn(),
  onClickStopButton: jest.fn(),
  isSpeaking: false,
  silenceTimeoutRemaining: null,
  continuousMicListeningMode: false,
  onToggleContinuousMode: jest.fn(),
}

describe('MessageInput Layout & Positioning', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })),
    })
  })

  it('positions on the right side and matches ChatLog vertical centering and width when chatLogPosition is left', () => {
    mockSettingsStore.mockImplementation((selector) => {
      const state = {
        selectAIService: 'openai',
        selectAIModel: 'gpt-4o',
        imageDisplayPosition: 'input',
        enableMultiModal: true,
        customModel: '',
        realtimeAPIMode: false,
        showSilenceProgressBar: false,
        chatLogWidth: 420,
        chatLogPosition: 'left',
        chatLogEdgeOffset: null,
      }
      return selector(state as any)
    })

    const { container } = render(<MessageInput {...defaultProps} />)
    const capsule = container.querySelector(
      '.aurora-glass-capsule'
    ) as HTMLElement

    expect(capsule).toBeInTheDocument()
    expect(capsule.className).toContain('top-[94px]')
    expect(capsule.className).toContain('bottom-[94px]')
    expect(capsule.className).toContain('right-3')
    expect(capsule.style.width).toBe('420px')
  })

  it('positions on the left side when chatLogPosition is right with custom edge offset', () => {
    mockSettingsStore.mockImplementation((selector) => {
      const state = {
        selectAIService: 'openai',
        selectAIModel: 'gpt-4o',
        imageDisplayPosition: 'input',
        enableMultiModal: true,
        customModel: '',
        realtimeAPIMode: false,
        showSilenceProgressBar: false,
        chatLogWidth: 450,
        chatLogPosition: 'right',
        chatLogEdgeOffset: 24,
      }
      return selector(state as any)
    })

    const { container } = render(<MessageInput {...defaultProps} />)
    const capsule = container.querySelector(
      '.aurora-glass-capsule'
    ) as HTMLElement

    expect(capsule).toBeInTheDocument()
    expect(capsule.className).toContain('top-[94px]')
    expect(capsule.className).toContain('bottom-[94px]')
    expect(capsule.style.left).toBe('24px')
    expect(capsule.style.width).toBe('450px')
  })

  it('has vertical layout with input filling the top area and buttons aligned at the bottom', () => {
    mockSettingsStore.mockImplementation((selector) => {
      const state = {
        selectAIService: 'openai',
        selectAIModel: 'gpt-4o',
        imageDisplayPosition: 'input',
        enableMultiModal: true,
        customModel: '',
        realtimeAPIMode: false,
        showSilenceProgressBar: false,
        chatLogWidth: 400,
        chatLogPosition: 'left',
        chatLogEdgeOffset: null,
      }
      return selector(state as any)
    })

    const { container, getByTestId } = render(
      <MessageInput {...defaultProps} />
    )
    const capsule = container.querySelector('.aurora-glass-capsule')
    expect(capsule?.className).toContain('flex-col')
    expect(capsule?.className).toContain('justify-between')

    const textarea = getByTestId('chat-message-input')
    expect(textarea).toBeInTheDocument()

    const buttonGroup = container.querySelector(
      'button[data-testid="chat-send-button"]'
    )
    expect(buttonGroup).toBeInTheDocument()
  })
})
