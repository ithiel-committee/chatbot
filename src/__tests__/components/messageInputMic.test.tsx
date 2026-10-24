import React from 'react'
import { render, fireEvent } from '@testing-library/react'
import { MessageInput } from '@/components/messageInput'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'

jest.mock('@/features/stores/home', () => ({
  __esModule: true,
  default: Object.assign(
    jest.fn((selector) =>
      selector({
        chatProcessing: false,
        modalImage: '',
      })
    ),
    {
      getState: jest.fn(() => ({
        chatProcessing: false,
        modalImage: '',
      })),
      setState: jest.fn(),
    }
  ),
}))

jest.mock('@/features/stores/settings', () => ({
  __esModule: true,
  default: Object.assign(
    jest.fn((selector) =>
      selector({
        selectAIService: 'openai',
        selectAIModel: 'gpt-4o',
        imageDisplayPosition: 'input',
        enableMultiModal: true,
        customModel: '',
        realtimeAPIMode: false,
        showSilenceProgressBar: false,
        chatLogWidth: 400,
        chatLogPosition: 'right',
        chatLogEdgeOffset: null,
      })
    ),
    {
      setState: jest.fn(),
      getState: jest.fn(() => ({})),
    }
  ),
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
      data-testid={props['data-testid'] || `icon-button-${props.iconName}`}
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

const mockHomeStore = homeStore as unknown as jest.MockedFunction<
  typeof homeStore
>

describe('MessageInput Microphone Button Behavior', () => {
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
    mockHomeStore.mockImplementation((selector) =>
      selector({
        chatProcessing: false,
        modalImage: '',
      })
    )
  })

  it('allows clicking mic button when isSpeaking is true and calls onClickStopButton before onClickMicButton', () => {
    const onClickMicButton = jest.fn()
    const onClickStopButton = jest.fn()

    const { getByTestId } = render(
      <MessageInput
        {...defaultProps}
        isSpeaking={true}
        onClickMicButton={onClickMicButton}
        onClickStopButton={onClickStopButton}
      />
    )

    const micButton = getByTestId('icon-button-24/Microphone')
    expect(micButton).not.toBeDisabled()

    fireEvent.click(micButton)

    expect(onClickStopButton).toHaveBeenCalledTimes(1)
    expect(onClickMicButton).toHaveBeenCalledTimes(1)
  })

  it('allows clicking mic button when chatProcessing is true and calls onClickStopButton', () => {
    mockHomeStore.mockImplementation((selector) =>
      selector({
        chatProcessing: true,
        modalImage: '',
      })
    )

    const onClickMicButton = jest.fn()
    const onClickStopButton = jest.fn()

    const { getByTestId } = render(
      <MessageInput
        {...defaultProps}
        onClickMicButton={onClickMicButton}
        onClickStopButton={onClickStopButton}
      />
    )

    const micButton = getByTestId('icon-button-24/Microphone')
    expect(micButton).not.toBeDisabled()

    fireEvent.click(micButton)

    expect(onClickStopButton).toHaveBeenCalledTimes(1)
    expect(onClickMicButton).toHaveBeenCalledTimes(1)
  })

  it('does not call onClickStopButton when clicking mic button in idle state', () => {
    const onClickMicButton = jest.fn()
    const onClickStopButton = jest.fn()

    const { getByTestId } = render(
      <MessageInput
        {...defaultProps}
        isSpeaking={false}
        onClickMicButton={onClickMicButton}
        onClickStopButton={onClickStopButton}
      />
    )

    const micButton = getByTestId('icon-button-24/Microphone')
    expect(micButton).not.toBeDisabled()

    fireEvent.click(micButton)

    expect(onClickStopButton).not.toHaveBeenCalled()
    expect(onClickMicButton).toHaveBeenCalledTimes(1)
  })

  it('disables mic button when continuousMicListeningMode is true', () => {
    const { getByTestId } = render(
      <MessageInput {...defaultProps} continuousMicListeningMode={true} />
    )

    const micButton = getByTestId('icon-button-24/Close')
    expect(micButton).toBeDisabled()
  })
})
