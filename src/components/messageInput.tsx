import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import slideStore from '@/features/stores/slide'
import { isMultiModalAvailable } from '@/features/constants/aiModels'
import { IconButton } from './iconButton'
import { useKioskMode } from '@/hooks/useKioskMode'

// file validation settings
const FILE_VALIDATION = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ],
  maxImageDimensions: { width: 4096, height: 4096 },
} as const

type Props = {
  focusOnMount?: boolean
  userMessage: string
  isMicRecording: boolean
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void
  onClickSendButton: (event: React.MouseEvent<HTMLButtonElement>) => void
  onClickMicButton: (event: React.MouseEvent<HTMLButtonElement>) => void
  onClickStopButton: (event: React.MouseEvent<HTMLButtonElement>) => void
  isSpeaking: boolean
  silenceTimeoutRemaining: number | null
  continuousMicListeningMode: boolean
  onToggleContinuousMode: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export const MessageInput = ({
  focusOnMount = true,
  userMessage,
  isMicRecording,
  onChangeUserMessage,
  onClickMicButton,
  onClickSendButton,
  onClickStopButton,
  isSpeaking,
  silenceTimeoutRemaining,
  continuousMicListeningMode,
}: Props) => {
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const slidePlaying = slideStore((s) => s.isPlaying)
  const modalImage = homeStore((s) => s.modalImage)
  const selectAIService = settingsStore((s) => s.selectAIService)
  const selectAIModel = settingsStore((s) => s.selectAIModel)
  const imageDisplayPosition = settingsStore((s) => s.imageDisplayPosition)
  const enableMultiModal = settingsStore((s) => s.enableMultiModal)
  const customModel = settingsStore((s) => s.customModel)
  const [rows, setRows] = useState(1)
  const [loadingDots, setLoadingDots] = useState('')
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [fileError, setFileError] = useState<string>('')
  const [showImageActions, setShowImageActions] = useState(false)
  const [inputValidationError, setInputValidationError] = useState<string>('')
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // mount focus is an initialization contract; later prop changes must not
  // retrigger the chat-processing effect or clear an in-progress draft.
  const focusOnMountRef = useRef(focusOnMount)
  const previousChatProcessingRef = useRef<boolean | null>(null)
  const realtimeAPIMode = settingsStore((s) => s.realtimeAPIMode)
  const showSilenceProgressBar = settingsStore((s) => s.showSilenceProgressBar)
  const chatLogWidth = settingsStore((s) => s.chatLogWidth)
  const chatLogPosition = settingsStore((s) => s.chatLogPosition)
  const chatLogEdgeOffset = settingsStore((s) => s.chatLogEdgeOffset)
  const assistantTextStyle = settingsStore((s) => s.assistantTextStyle)
  const characterName = settingsStore((s) => s.characterName)
  const userDisplayName = settingsStore((s) => s.userDisplayName) || 'あなた'
  const showCharacterName = settingsStore((s) => s.showCharacterName)
  const showPresetQuestions = settingsStore((s) => s.showPresetQuestions)
  const presetQuestions = settingsStore((s) => s.presetQuestions)
  const chatLog = homeStore((s) => s.chatLog)

  const isRightAligned = chatLogPosition === 'right'
  const isInputRightAligned = !isRightAligned

  const defaultOffsetClasses = isInputRightAligned
    ? 'right-3 sm:right-6'
    : 'left-3 sm:left-6'

  const { t } = useTranslation()

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)')
    setIsSmallScreen(!mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsSmallScreen(!e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // kiosk mode input validation
  const { isKioskMode, validateInput, maxInputLength } = useKioskMode()

  // multimodal correspondence check
  const isMultiModalSupported = isMultiModalAvailable(
    selectAIService,
    selectAIModel,
    enableMultiModal,
    customModel
  )

  // icon display condition
  const showIconDisplay = modalImage && imageDisplayPosition === 'icon'

  useEffect(() => {
    const previousChatProcessing = previousChatProcessingRef.current
    previousChatProcessingRef.current = chatProcessing

    if (chatProcessing) {
      const interval = setInterval(() => {
        setLoadingDots((prev) => {
          if (prev === '...') return ''
          return prev + '.'
        })
      }, 200)

      return () => clearInterval(interval)
    }

    if (textareaRef.current) {
      textareaRef.current.value = ''
      const isTouchDevice = () => {
        if (typeof window === 'undefined') return false
        return (
          navigator.maxTouchPoints > 0 ||
          // @ts-expect-error: msMaxTouchPoints is IE-specific
          navigator.msMaxTouchPoints > 0
        )
      }
      const isInitialMount = previousChatProcessing === null
      const hasCompletedProcessing = previousChatProcessing === true

      if (
        !isTouchDevice() &&
        ((isInitialMount && focusOnMountRef.current) || hasCompletedProcessing)
      ) {
        textareaRef.current.focus({ preventScroll: true })
      }
    }
  }, [chatProcessing])

  // calculate the appropriate number of rows based on the text content
  const calculateRows = useCallback((text: string): number => {
    const MIN_ROWS = 1
    const MAX_ROWS = 5
    const CHARS_PER_LINE = 50
    const lines = text.split('\n')

    // calculate the appropriate number of rows based on the text content
    // simple implementation uses the number of newline characters + 1
    const baseRows = Math.max(MIN_ROWS, lines.length)

    // if there are long lines, consider additional lines (rough calculation)
    const extraRows = lines.reduce((acc, line) => {
      const lineRows = Math.ceil(line.length / CHARS_PER_LINE)
      return acc + Math.max(0, lineRows - 1)
    }, 0)

    return Math.min(MAX_ROWS, baseRows + extraRows)
  }, [])

  // adjust line count in response to userMessage changes
  useEffect(() => {
    const newRows = calculateRows(userMessage)
    setRows(newRows)
  }, [userMessage, calculateRows])

  // common delayed line count update process
  const updateRowsWithDelay = useCallback(
    (target: HTMLTextAreaElement) => {
      setTimeout(() => {
        const newRows = calculateRows(target.value)
        setRows(newRows)
      }, 0)
    },
    [calculateRows]
  )

  // text area contetns change process
  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value
    const newRows = calculateRows(newText)
    setRows(newRows)
    onChangeUserMessage(event)
  }

  // file validation function
  const validateFile = useCallback(
    (file: File): { isValid: boolean; error?: string } => {
      // file size check
      if (file.size > FILE_VALIDATION.maxSizeBytes) {
        return {
          isValid: false,
          error: t('FileSizeError', {
            maxSize: Math.round(FILE_VALIDATION.maxSizeBytes / (1024 * 1024)),
          }),
        }
      }

      // file type check
      if (!FILE_VALIDATION.allowedTypes.includes(file.type as any)) {
        return {
          isValid: false,
          error: t('FileTypeError'),
        }
      }

      return { isValid: true }
    },
    [t]
  )

  // check image dimensions function
  const validateImageDimensions = useCallback(
    (imageElement: HTMLImageElement): boolean => {
      return (
        imageElement.naturalWidth <= FILE_VALIDATION.maxImageDimensions.width &&
        imageElement.naturalHeight <= FILE_VALIDATION.maxImageDimensions.height
      )
    },
    []
  )

  // image processing function
  const processImageFile = useCallback(
    async (file: File): Promise<void> => {
      setFileError('')

      const validation = validateFile(file)
      if (!validation.isValid) {
        setFileError(validation.error || 'Unknown error')
        return
      }

      try {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64Image = e.target?.result as string

          // image dimension check (optional)
          const img = document.createElement('img')
          img.onload = () => {
            if (!validateImageDimensions(img)) {
              setFileError(
                t('ImageDimensionError', {
                  maxWidth: FILE_VALIDATION.maxImageDimensions.width,
                  maxHeight: FILE_VALIDATION.maxImageDimensions.height,
                })
              )
              return
            }
            homeStore.setState({ modalImage: base64Image })
          }
          img.onerror = () => {
            setFileError(t('ImageLoadError'))
          }
          img.src = base64Image
        }
        reader.onerror = () => {
          setFileError(t('FileReadError'))
        }
        reader.readAsDataURL(file)
      } catch (error) {
        setFileError(t('FileProcessError'))
      }
    },
    [validateFile, validateImageDimensions, t]
  )

  // image deletion function
  const handleRemoveImage = useCallback(() => {
    homeStore.setState({ modalImage: '' })
    setFileError('')
  }, [])

  // clipboard image pasting process
  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!isMultiModalSupported) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
        return
      }

      const clipboardData = event.clipboardData
      if (!clipboardData) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
        return
      }

      const items = clipboardData.items
      let hasImage = false

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await processImageFile(file)
            hasImage = true
          }
          break
        }
      }

      // execute normal paste processing only when there is no image
      if (!hasImage) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
      }
    },
    [isMultiModalSupported, processImageFile, updateRowsWithDelay]
  )

  // drag & drop
  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!isMultiModalSupported) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [isMultiModalSupported]
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      if (!isMultiModalSupported) {
        return
      }
      event.preventDefault()
      event.stopPropagation()

      const files = event.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          await processImageFile(file)
        } else {
          setFileError(t('FileTypeError'))
        }
      }
    },
    [isMultiModalSupported, processImageFile, t]
  )

  // validate input and handle send with kiosk mode restrictions
  const handleValidatedSend = useCallback(
    (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent) => {
      if (userMessage.trim() === '') return false

      // validate input in kiosk mode
      if (isKioskMode) {
        const validation = validateInput(userMessage)
        if (!validation.valid) {
          setInputValidationError(validation.reason || t('Kiosk.InputInvalid'))
          return false
        }
      }

      // clear any previous validation errors
      setInputValidationError('')
      return true
    },
    [userMessage, isKioskMode, validateInput, t]
  )

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      // exclude IME converting character, ignore IME toggle by backquote key
      !event.nativeEvent.isComposing &&
      event.code !== 'Backquote' &&
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()
      if (userMessage.trim() !== '') {
        // validate before sending
        if (
          handleValidatedSend(
            event as unknown as React.MouseEvent<HTMLButtonElement>
          )
        ) {
          onClickSendButton(
            event as unknown as React.MouseEvent<HTMLButtonElement>
          )
          setRows(1)
        }
      }
    } else if (event.key === 'Enter' && event.shiftKey) {
      // in case of Shift + Enter, rows automatically calculates by calculateRows, so no need to increase rows manually
      updateRowsWithDelay(event.target as HTMLTextAreaElement)
    } else if (
      event.key === 'Backspace' &&
      rows > 1 &&
      userMessage.slice(-1) === '\n'
    ) {
      // in case of Backspace, rows automatically calculates by calculateRows, so no need to decrease rows manually
      updateRowsWithDelay(event.target as HTMLTextAreaElement)
    }
  }

  // handle send button click with validation
  const handleSendClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (handleValidatedSend(event)) {
        onClickSendButton(event)
      }
    },
    [handleValidatedSend, onClickSendButton]
  )

  const handleMicClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClickMicButton(event)
  }

  // image paste button
  const attachInputRef = useRef<HTMLInputElement>(null)

  const handleAttachClick = useCallback(() => {
    attachInputRef.current?.click()
  }, [])

  const handleAttachChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        await processImageFile(file)
      }
      event.target.value = ''
    },
    [processImageFile]
  )

  // C案: ノベルゲーム風UI（下部ダイアログ内に会話テキスト表示と入力欄を一体化）
  if (assistantTextStyle === 'novel') {
    const emotionPattern =
      /\[(neutral|happy|angry|sad|relaxed|surprised)\]/gi
    const lastMessage =
      chatLog.length > 0 ? chatLog[chatLog.length - 1] : null

    let isUserSpeaking = false
    let speakerName = characterName
    let novelDisplayText = ''

    if (lastMessage) {
      if (lastMessage.role === 'user') {
        isUserSpeaking = true
        speakerName = userDisplayName
        if (typeof lastMessage.content === 'string') {
          novelDisplayText = lastMessage.content
        } else if (Array.isArray(lastMessage.content)) {
          const tPart = lastMessage.content.find((c) => c.type === 'text')
          novelDisplayText = tPart ? tPart.text : ''
        }
      } else if (lastMessage.role === 'assistant') {
        isUserSpeaking = false
        speakerName = characterName
        if (typeof lastMessage.content === 'string') {
          novelDisplayText = lastMessage.content
            .replace(emotionPattern, '')
            .replace(/\[motion:[^\]]*\]/gi, '')
        }
      }
    }

    const shouldShowPresetQuestions =
      showPresetQuestions && presetQuestions.length > 0

    return (
      <>
        {showPermissionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="theme-surface-elevated max-w-[calc(100vw-2rem)] rounded-xl border p-4 text-theme-default shadow-xl sm:max-w-md sm:p-6">
              <h3 className="mb-4 text-lg font-bold sm:text-xl">
                {t('MicrophonePermission')}
              </h3>
              <p className="mb-4">{t('MicrophonePermissionMessage')}</p>
              <button
                className="rounded-lg bg-secondary px-4 py-2 font-bold text-theme transition-colors hover:bg-secondary-hover"
                onClick={() => setShowPermissionModal(false)}
              >
                {t('Close')}
              </button>
            </div>
          </div>
        )}

        <div
          className="animate-aurora-bubble-in fixed bottom-3 left-1/2 z-20 w-[94vw] max-w-[840px] -translate-x-1/2 rounded-[24px] border border-white/20 bg-slate-950/85 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:bottom-6 sm:p-5"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* 光沢ハイライトライン */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[24px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* 発話者ネームプレート（左上に配置） */}
          {showCharacterName && (
            <div
              className={`absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold tracking-wider shadow-md sm:left-8 ${
                isUserSpeaking
                  ? 'border border-white/20 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-100 shadow-black/40'
                  : 'border border-white/30 bg-gradient-to-r from-primary to-primary-hover text-white shadow-[0_2px_10px_var(--color-primary-disabled)]'
              }`}
            >
              <span className="text-[11px] opacity-80">
                {isUserSpeaking ? '💬' : '✨'}
              </span>
              <span>{speakerName}</span>
            </div>
          )}

          {/* 上段: 会話メッセージテキスト */}
          <div className="scroll-hidden relative mb-2.5 min-h-[2.8rem] max-h-[88px] overflow-y-auto px-1 pt-1 sm:min-h-[3.4rem] sm:max-h-[100px]">
            {novelDisplayText ? (
              <p className="text-[15px] font-medium leading-[1.75] text-[var(--aurora-text-strong)] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)] sm:text-[16px]">
                {novelDisplayText}
              </p>
            ) : chatProcessing ? (
              <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-muted)]">
                <span className="italic">{characterName}が考え中</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-75" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-150" />
                </span>
              </div>
            ) : (
              <p className="text-sm italic text-[var(--aurora-text-muted)]">
                {t('EnterYourQuestion', '聞きたいことを話しかけてみてね')}
              </p>
            )}

            {/* 右下のADV送り/待機マーク */}
            <div className="absolute bottom-0 right-1 flex items-center gap-1.5">
              {chatProcessing && !isSpeaking ? (
                <div className="flex items-center gap-1 text-[11px] text-white/50">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-75" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-150" />
                </div>
              ) : isSpeaking ? (
                <div className="flex items-center gap-0.5 text-xs text-primary animate-pulse">
                  <span className="h-2 w-0.5 rounded-full bg-primary" />
                  <span className="h-3 w-0.5 rounded-full bg-primary" />
                  <span className="h-2 w-0.5 rounded-full bg-primary" />
                </div>
              ) : (
                <span className="animate-bounce select-none text-[10px] font-bold text-primary">
                  ▼
                </span>
              )}
            </div>
          </div>

          {/* 区切り線 */}
          <div className="mb-2 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          {/* 無音タイムアウトバー（マイク録音時） */}
          {isMicRecording && showSilenceProgressBar && (
            <div className="aurora-glass-bubble mb-2 h-1.5 w-full shrink-0 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-secondary transition-all duration-200 ease-linear"
                style={{
                  width:
                    silenceTimeoutRemaining !== null
                      ? `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((settingsStore.getState().noSpeechTimeout * 1000 -
                              silenceTimeoutRemaining -
                              300) /
                              (settingsStore.getState().noSpeechTimeout * 1000 -
                                600)) *
                              100
                          )
                        )}%`
                      : '0%',
                }}
              />
            </div>
          )}

          {/* エラー表示 */}
          {fileError && (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50/90 p-1.5 text-xs font-medium text-red-700">
              {fileError}
            </div>
          )}
          {inputValidationError && (
            <div className="mb-2 rounded-xl border border-red-200 bg-red-50/90 p-1.5 text-xs font-medium text-red-700">
              {inputValidationError}
            </div>
          )}

          {/* 下段: 一体化された入力バー */}
          <div className="flex items-center gap-2">
            {/* 画像添付 */}
            {isMultiModalSupported && (
              <div className="shrink-0">
                <input
                  ref={attachInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAttachChange}
                />
                <button
                  type="button"
                  title={t('AttachImage')}
                  aria-label={t('AttachImage')}
                  onClick={handleAttachClick}
                  disabled={chatProcessing || slidePlaying || realtimeAPIMode}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--aurora-text-subtle)] transition-colors hover:bg-white/10 disabled:opacity-40"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            )}

            {/* 一行テキスト入力欄 */}
            <div className="relative min-h-0 flex-1">
              <textarea
                ref={textareaRef}
                data-testid="chat-message-input"
                placeholder={
                  chatProcessing
                    ? `${t('AnswerGenerating')}${loadingDots}`
                    : continuousMicListeningMode && isMicRecording
                      ? t('ListeningContinuously')
                      : isMultiModalSupported && !isSmallScreen
                        ? `${t('EnterYourQuestion')} (${t('PasteImageSupported') || 'Paste image supported'})`
                        : t('EnterYourQuestion')
                }
                onChange={handleTextChange}
                onPaste={handlePaste}
                onKeyDown={handleKeyPress}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                disabled={chatProcessing || slidePlaying || realtimeAPIMode}
                className="scroll-hidden block h-9 w-full resize-none rounded-full bg-white/10 px-4 py-1.5 text-[14px] font-medium text-[var(--aurora-text-strong)] outline-none transition-all placeholder:text-[var(--aurora-text-muted)] focus:bg-white/15 disabled:opacity-60"
                value={userMessage}
                rows={1}
                maxLength={maxInputLength}
                style={{
                  lineHeight: '1.4',
                  whiteSpace: 'pre-wrap',
                }}
              />
            </div>

            {/* ボタン群: マイク、送信、停止 */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <IconButton
                iconName={
                  continuousMicListeningMode ? '24/Close' : '24/Microphone'
                }
                backgroundColor={
                  continuousMicListeningMode
                    ? isMicRecording
                      ? 'bg-green-500 text-theme'
                      : 'bg-green-600 text-theme'
                    : isMicRecording
                      ? 'bg-secondary text-theme'
                      : 'bg-[var(--aurora-control-bg)] hover:bg-[var(--aurora-control-bg-hover)] disabled:bg-[var(--aurora-control-bg-disabled)]'
                }
                iconColor={
                  continuousMicListeningMode || isMicRecording
                    ? 'text-theme'
                    : 'text-[var(--aurora-icon)]'
                }
                isProcessing={isMicRecording}
                isProcessingIcon={
                  continuousMicListeningMode ? '24/Microphone' : '24/PauseAlt'
                }
                disabled={
                  continuousMicListeningMode || chatProcessing || isSpeaking
                }
                onClick={handleMicClick}
                className={`!h-9 !min-h-9 !w-9 !min-w-9 !rounded-full !p-1.5 ring-0 transition-colors duration-200 focus:outline-none ${
                  isMicRecording && !continuousMicListeningMode
                    ? 'animate-[aurora-mic-pulse_1.5s_ease-out_infinite]'
                    : ''
                }`}
              />

              <IconButton
                iconName="24/Send"
                className="!h-9 !min-h-9 !w-9 !min-w-9 !rounded-full !p-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.2)] ring-0 transition duration-200 hover:brightness-110 focus:outline-none disabled:shadow-none"
                isProcessing={chatProcessing}
                disabled={chatProcessing || !userMessage || realtimeAPIMode}
                onClick={handleSendClick}
                data-testid="chat-send-button"
              />

              <IconButton
                iconName="stop"
                backgroundColor="bg-[var(--aurora-control-bg)] hover:bg-[var(--aurora-control-bg-hover)]"
                className="!h-9 !min-h-9 !w-9 !min-w-9 !rounded-full !p-1.5 ring-0 transition-colors duration-200 focus:outline-none"
                onClick={onClickStopButton}
                isProcessing={false}
                data-testid="chat-stop-button"
              />
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="theme-surface-elevated max-w-[calc(100vw-2rem)] rounded-xl border p-4 text-theme-default shadow-xl sm:max-w-md sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4">
              {t('MicrophonePermission')}
            </h3>
            <p className="mb-4">{t('MicrophonePermissionMessage')}</p>
            <button
              className="rounded-lg bg-secondary px-4 py-2 font-bold text-theme transition-colors hover:bg-secondary-hover"
              onClick={() => setShowPermissionModal(false)}
            >
              {t('Close')}
            </button>
          </div>
        </div>
      )}
      <div
        className={`aurora-glass-capsule absolute bottom-[94px] top-[94px] z-20 flex max-w-[calc(100vw-40px)] flex-col justify-between overflow-hidden rounded-[22px] p-3 text-theme-default sm:p-4 ${
          chatLogEdgeOffset == null ? defaultOffsetClasses : ''
        }`}
        style={{
          width: `${chatLogWidth}px`,
          ...(chatLogEdgeOffset != null
            ? isInputRightAligned
              ? { right: `${chatLogEdgeOffset}px` }
              : { left: `${chatLogEdgeOffset}px` }
            : {}),
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* progress bar - show/hide based on settings */}
          {isMicRecording && showSilenceProgressBar && (
            <div className="aurora-glass-bubble mb-2 h-2 w-full shrink-0 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-secondary transition-all duration-200 ease-linear"
                style={{
                  // progress bar width calculation - first and last 0.3 sec is not displayed
                  width:
                    silenceTimeoutRemaining !== null
                      ? `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((settingsStore.getState().noSpeechTimeout * 1000 -
                              silenceTimeoutRemaining -
                              300) /
                              (settingsStore.getState().noSpeechTimeout * 1000 -
                                600)) *
                              100
                          )
                        )}%`
                      : '0%',
                }}
              ></div>
            </div>
          )}
          {/* showing error message */}
          {fileError && (
            <div className="mb-2 shrink-0 rounded-2xl border border-red-200 bg-red-50/90 p-2 text-sm font-medium text-red-700 shadow-sm">
              {fileError}
            </div>
          )}
          {/* input validation error (Kiosk mode) */}
          {inputValidationError && (
            <div className="mb-2 shrink-0 rounded-2xl border border-red-200 bg-red-50/90 p-2 text-sm font-medium text-red-700 shadow-sm">
              {inputValidationError}
            </div>
          )}
          {/* image preview - only when image display setting is input */}
          {modalImage && imageDisplayPosition === 'input' && (
            <div
              className="aurora-glass-bubble relative mb-2 shrink-0 rounded-[20px] p-2"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <button
                onClick={handleRemoveImage}
                className="theme-surface-control absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border text-sm font-medium text-secondary shadow-sm transition-colors hover:text-secondary-hover"
              >
                ×
              </button>
              <Image
                src={modalImage}
                alt="Pasted image"
                width={0}
                height={0}
                sizes="100vw"
                unoptimized
                className="h-auto max-h-32 w-auto max-w-full rounded-xl object-contain"
              />
            </div>
          )}

          <div className="relative min-h-0 flex-1">
            {/* image attachment indicator - only when icon display setting is enabled */}
            {showIconDisplay && (
              <div className="absolute left-1 top-[15px] z-10 flex h-4 w-4 items-center justify-center">
                <div
                  className="relative flex h-4 w-4 cursor-pointer items-center justify-center"
                  onMouseEnter={() => setShowImageActions(true)}
                  onMouseLeave={() => setShowImageActions(false)}
                  onFocus={() => setShowImageActions(true)}
                  onBlur={() => setShowImageActions(false)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setShowImageActions(true)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={t('RemoveImage')}
                >
                  <svg
                    className="block h-4 w-4 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                  {showImageActions && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage()
                        setShowImageActions(false)
                      }}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-theme transition-colors hover:bg-red-600"
                      title={t('RemoveImage')}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
            <textarea
              ref={textareaRef}
              data-testid="chat-message-input"
              placeholder={
                chatProcessing
                  ? `${t('AnswerGenerating')}${loadingDots}`
                  : continuousMicListeningMode && isMicRecording
                    ? t('ListeningContinuously')
                    : isMultiModalSupported && !isSmallScreen
                      ? `${t('EnterYourQuestion')} (${t('PasteImageSupported') || 'Paste image supported'})`
                      : t('EnterYourQuestion')
              }
              onChange={handleTextChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyPress}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              disabled={chatProcessing || slidePlaying || realtimeAPIMode}
              className="scroll-hidden block h-full w-full resize-none bg-transparent text-[15px] font-bold text-[var(--aurora-text-strong)] outline-none transition-all duration-200 placeholder:text-[var(--aurora-text-muted)] disabled:opacity-60 overflow-y-auto"
              value={userMessage}
              rows={rows}
              maxLength={maxInputLength}
              style={{
                lineHeight: '1.5',
                padding: showIconDisplay ? '12px 8px 12px 28px' : '12px 8px',
                whiteSpace: 'pre-wrap',
              }}
            ></textarea>
          </div>
        </div>

        <div className="mt-2 flex shrink-0 items-center justify-between gap-1.5 pt-2 sm:gap-2">
          <div>
            {isMultiModalSupported && (
              <div className="flex-shrink-0">
                <input
                  ref={attachInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  className="hidden"
                  onChange={handleAttachChange}
                />
                <button
                  type="button"
                  title={t('AttachImage')}
                  aria-label={t('AttachImage')}
                  onClick={handleAttachClick}
                  disabled={chatProcessing || slidePlaying || realtimeAPIMode}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--aurora-text-subtle)] transition-colors hover:bg-black/5 disabled:opacity-40"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 gap-1.5 sm:gap-2">
            <IconButton
              iconName={
                continuousMicListeningMode ? '24/Close' : '24/Microphone'
              }
              backgroundColor={
                continuousMicListeningMode
                  ? isMicRecording
                    ? 'bg-green-500 text-theme'
                    : 'bg-green-600 text-theme'
                  : isMicRecording
                    ? 'bg-secondary text-theme'
                    : 'bg-[var(--aurora-control-bg)] hover:bg-[var(--aurora-control-bg-hover)] disabled:bg-[var(--aurora-control-bg-disabled)]'
              }
              iconColor={
                continuousMicListeningMode || isMicRecording
                  ? 'text-theme'
                  : 'text-[var(--aurora-icon)]'
              }
              isProcessing={isMicRecording}
              isProcessingIcon={
                continuousMicListeningMode ? '24/Microphone' : '24/PauseAlt'
              }
              disabled={
                continuousMicListeningMode || chatProcessing || isSpeaking
              }
              onClick={handleMicClick}
              className={`!h-10 !min-h-10 !w-10 !min-w-10 !rounded-full !p-2 sm:!h-[46px] sm:!min-h-[46px] sm:!w-[46px] sm:!min-w-[46px] ring-0 transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${
                isMicRecording && !continuousMicListeningMode
                  ? 'animate-[aurora-mic-pulse_1.5s_ease-out_infinite]'
                  : ''
              }`}
            />

            <IconButton
              iconName="24/Send"
              className="!h-10 !min-h-10 !w-10 !min-w-10 !rounded-full !p-2 sm:!h-[46px] sm:!min-h-[46px] sm:!w-[46px] sm:!min-w-[46px] shadow-[0_4px_14px_rgba(0,0,0,0.18)] ring-0 transition duration-200 hover:brightness-110 focus:outline-none focus-visible:outline-none focus-visible:ring-0 disabled:shadow-none"
              isProcessing={chatProcessing}
              disabled={chatProcessing || !userMessage || realtimeAPIMode}
              onClick={handleSendClick}
              data-testid="chat-send-button"
            />

            <IconButton
              iconName="stop"
              backgroundColor="bg-[var(--aurora-control-bg)] hover:bg-[var(--aurora-control-bg-hover)]"
              className="!h-10 !min-h-10 !w-10 !min-w-10 !rounded-full !p-2 sm:!h-[46px] sm:!min-h-[46px] sm:!w-[46px] sm:!min-w-[46px] ring-0 transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
              onClick={onClickStopButton}
              isProcessing={false}
              data-testid="chat-stop-button"
            />
          </div>
        </div>
      </div>
    </>
  )
}
