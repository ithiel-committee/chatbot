import { logger } from '@/lib/logger'
import React, { useCallback, useRef, useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import settingsStore, { type ChatLogMode } from '@/features/stores/settings'
import slideStore from '@/features/stores/slide'
import presentationStore from '@/features/stores/presentation'
import { AssistantText } from './assistantText'
import { ChatLog } from './chatLog'
import { IconButton } from './iconButton'
import Settings from './settings'
import { Webcam } from './webcam'
import Slides from './slides'
import Capture from './capture'
import { DpadSettingsMenu } from './DpadSettingsMenu'
import { PresetSubmenu } from './dock/PresetSubmenu'
import { LayerOrderSubmenu } from './dock/LayerOrderSubmenu'
import useImagesStore from '@/features/stores/images'
import toastStore from '@/features/stores/toast'
import { isMultiModalAvailable } from '@/features/constants/aiModels'
import { AIService } from '@/features/constants/settings'
import { getLatestAssistantMessage } from '@/utils/assistantMessageUtils'
import { useKioskMode } from '@/hooks/useKioskMode'
import {
  DEFAULT_SETTINGS_TOGGLE_SHORTCUT,
  hasCommandModifier,
  isEditableKeyboardTarget,
  matchesKeyboardShortcut,
} from '@/utils/keyboardShortcut'

// custom hook to detect mobile devices
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    // function to detect mobile devices
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth <= 768 ||
          /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      )
    }

    // detect at first render and when window size changes
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

export const Menu = () => {
  const selectAIService = settingsStore((s) => s.selectAIService)
  const selectAIModel = settingsStore((s) => s.selectAIModel)
  const enableMultiModal = settingsStore((s) => s.enableMultiModal)
  const customModel = settingsStore((s) => s.customModel)
  const youtubeMode = settingsStore((s) => s.youtubeMode)
  const youtubePlaying = settingsStore((s) => s.youtubePlaying)
  const gameCommentaryEnabled = settingsStore((s) => s.gameCommentaryEnabled)
  const gameCommentaryPlaying = settingsStore((s) => s.gameCommentaryPlaying)
  const slideMode = settingsStore((s) => s.slideMode)
  const slideVisible = menuStore((s) => s.slideVisible)
  const thumbnailVisible = menuStore((s) => s.thumbnailVisible)
  const presentationDocument = presentationStore((s) => s.document)
  const chatLog = homeStore((s) => s.chatLog)
  const showWebcam = menuStore((s) => s.showWebcam)
  const showControlPanel = settingsStore((s) => s.showControlPanel)
  const showCapture = menuStore((s) => s.showCapture)
  const slidePlaying = slideStore((s) => s.isPlaying)
  const showAssistantText = settingsStore((s) => s.showAssistantText)
  const settingsToggleShortcut =
    settingsStore((s) => s.settingsToggleShortcut) ||
    DEFAULT_SETTINGS_TOGGLE_SHORTCUT

  // kiosk mode related
  const { isKioskMode, isTemporaryUnlocked, canAccessSettings } = useKioskMode()

  // In kiosk mode, hide control panel (except when temporarily unlocked)
  const effectiveShowControlPanel =
    showControlPanel && (!isKioskMode || isTemporaryUnlocked)

  const [showSimpleSettings, setShowSimpleSettings] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  // Auto close when access to settings is deprived in kiosk mode
  useEffect(() => {
    if (!canAccessSettings) {
      setShowSimpleSettings(false)
      setShowAdvancedSettings(false)
    }
  }, [canAccessSettings])
  // display chat log
  const chatLogMode = settingsStore((s) => s.chatLogMode)
  const CHAT_LOG_MODE = {
    HIDDEN: 'hidden',
    ASSISTANT: 'assistant',
    CHAT_LOG: 'chat-log',
  } as const satisfies Record<string, ChatLogMode>
  const [showToolMenu, setShowToolMenu] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)

  // state for long tap
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null)
  const [touchEndTime, setTouchEndTime] = useState<number | null>(null)

  // detect mobile devices
  const isMobile = useIsMobile()

  const selectedSlideDocs = slideStore((state) => state.selectedSlideDocs)
  const { t } = useTranslation()

  const [markdownContent, setMarkdownContent] = useState('')

  // long tap processing function
  const handleTouchStart = () => {
    // In kiosk mode, disable long tap when access to settings is disabled
    if (!canAccessSettings) return
    setTouchStartTime(Date.now())
  }

  const handleTouchEnd = () => {
    // in kiosk mode, disable long tap when access to settings is disabled
    if (!canAccessSettings) return
    setTouchEndTime(Date.now())
    if (touchStartTime && Date.now() - touchStartTime >= 800) {
      // long tap is judged when held for 800ms or more
      setShowSimpleSettings(true)
    }
    setTouchStartTime(null)
  }

  const handleTouchCancel = () => {
    setTouchStartTime(null)
  }

  useEffect(() => {
    if (!selectedSlideDocs) return

    fetch(`/slides/${selectedSlideDocs}/slides.md`)
      .then((response) => response.text())
      .then((text) => setMarkdownContent(text))
      .catch((error) =>
        logger.error('Failed to fetch markdown content:', error)
      )
  }, [selectedSlideDocs])

  const latestAssistantMessage = getLatestAssistantMessage(chatLog)

  // hide presentation in opening and curtain call
  // to prevent old responses from being displayed just by hiding slides
  // only new responses are displayed
  useEffect(
    () =>
      homeStore.subscribe((state, previousState) => {
        if (state.chatLog.length <= previousState.chatLog.length) return
        if (
          state.chatLog.at(-1)?.role === 'assistant' &&
          slideMode &&
          !slideVisible &&
          presentationDocument
        ) {
          if (chatLogMode === CHAT_LOG_MODE.HIDDEN) {
            settingsStore.setState({ chatLogMode: CHAT_LOG_MODE.ASSISTANT })
          }
        }
      }),
    [
      CHAT_LOG_MODE.ASSISTANT,
      CHAT_LOG_MODE.HIDDEN,
      chatLogMode,
      presentationDocument,
      slideMode,
      slideVisible,
    ]
  )

  const handleChangeVrmFile = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files) return

      const file = files[0]
      if (!file) return

      const file_type = file.name.split('.').pop()

      if (file_type === 'vrm') {
        const blob = new Blob([file], { type: 'application/octet-stream' })
        const url = window.URL.createObjectURL(blob)

        const hs = homeStore.getState()
        hs.viewer.loadVrm(url)
      }

      event.target.value = ''
    },
    []
  )

  useEffect(() => {
    logger.log('onChangeWebcamStatus')
    homeStore.setState({ webcamStatus: showWebcam })

    if (showWebcam) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then(() => {
          setShowPermissionModal(false)
        })
        .catch(() => {
          setShowPermissionModal(true)
          homeStore.setState({ webcamStatus: false })
          menuStore.setState({ showWebcam: false })
        })
    }
  }, [showWebcam])

  useEffect(() => {
    logger.log('onChangeCaptureStatus')
    homeStore.setState({ captureStatus: showCapture })
  }, [showCapture])

  useEffect(() => {
    if (!youtubePlaying) {
      settingsStore.setState({
        youtubeContinuationCount: 0,
        youtubeNoCommentCount: 0,
        youtubeSleepMode: false,
      })
    }
  }, [youtubePlaying])

  const toggleGameCommentary = useCallback(() => {
    const nextPlaying = !gameCommentaryPlaying
    settingsStore.setState({ gameCommentaryPlaying: nextPlaying })
    if (nextPlaying) {
      // when starting: automatically display capture if not already displayed
      if (!showCapture) {
        menuStore.setState({ showCapture: true, showWebcam: false })
        homeStore.setState({ webcamStatus: false })
      }
    }
  }, [gameCommentaryPlaying, showCapture])

  const toggleCapture = useCallback(() => {
    menuStore.setState(({ showCapture }) => ({ showCapture: !showCapture }))
    menuStore.setState({ showWebcam: false }) // when displaying capture, hide webcam
    if (!showCapture) {
      homeStore.setState({ webcamStatus: false }) // ensure webcam status is false when enabling capture
    }
  }, [showCapture])

  const toggleWebcam = useCallback(() => {
    menuStore.setState(({ showWebcam }) => ({ showWebcam: !showWebcam }))
    menuStore.setState({ showCapture: false }) // when displaying webcam, hide capture
    if (!showWebcam) {
      homeStore.setState({ captureStatus: false }) // ensure capture status is false when enabling webcam
    }
  }, [showWebcam])

  const [focusedIndex, setFocusedIndex] = useState(0)
  const [activeSubmenu, setActiveSubmenu] = useState<
    'presets' | 'layers' | null
  >(null)
  const [menuFocusZone, setMenuFocusZone] = useState<'main' | 'submenu'>('main')
  const [submenuFocusedIndex, setSubmenuFocusedIndex] = useState(0)

  const handleSelectImage = useCallback(() => {
    const input = document.getElementById(
      'menu-image-file-input'
    ) as HTMLInputElement | null
    input?.click()
    setActiveSubmenu(null)
  }, [])

  // tool menu items
  const toolMenuItems = useMemo(() => {
    const items: Array<{
      id: string
      iconName: any
      label: string
      active?: boolean
      disabled?: boolean
      hasSubmenu?: boolean
      onClick: () => void
      'data-testid'?: string
      'aria-pressed'?: boolean
      'aria-expanded'?: boolean
    }> = []

    // 1. settings button
    if (canAccessSettings) {
      items.push({
        id: 'settings',
        iconName: '24/Settings',
        label: t('Settings'),
        onClick: () => {
          setShowSimpleSettings(true)
          setShowToolMenu(false)
          setActiveSubmenu(null)
          setMenuFocusZone('main')
        },
        'data-testid': 'open-settings-button',
      })
    }

    // 2. presets button (設定の直下)
    items.push({
      id: 'presets',
      iconName: 'presets',
      label: t('Presets'),
      active: activeSubmenu === 'presets',
      hasSubmenu: true,
      onClick: () => {
        if (activeSubmenu === 'presets') {
          setActiveSubmenu(null)
          setMenuFocusZone('main')
        } else {
          setActiveSubmenu('presets')
          setMenuFocusZone('submenu')
          setSubmenuFocusedIndex(
            settingsStore.getState().selectedPresetIndex ?? 0
          )
        }
      },
      'aria-expanded': activeSubmenu === 'presets',
      'data-testid': 'presets-menu-button',
    })

    // 3. layer order button (プリセットの直下)
    items.push({
      id: 'layers',
      iconName: 'layers',
      label: t('LayerOrderShort', 'レイヤー順序'),
      active: activeSubmenu === 'layers',
      hasSubmenu: true,
      onClick: () => {
        if (activeSubmenu === 'layers') {
          setActiveSubmenu(null)
          setMenuFocusZone('main')
        } else {
          setActiveSubmenu('layers')
          setMenuFocusZone('submenu')
          setSubmenuFocusedIndex(0)
        }
      },
      'aria-expanded': activeSubmenu === 'layers',
      'data-testid': 'layers-menu-button',
    })

    // 4. screen share
    items.push({
      id: 'capture',
      iconName: 'screen-share',
      label: showCapture
        ? (t('StopScreenShare', 'Stop screen sharing') as string)
        : t('ScreenShare'),
      active: showCapture,
      onClick: () => {
        toggleCapture()
        setActiveSubmenu(null)
      },
      'data-testid': 'capture-toggle-button',
    })

    // 5. camera
    items.push({
      id: 'webcam',
      iconName: '24/Camera',
      label: t('Camera'),
      active: showWebcam,
      onClick: () => {
        toggleWebcam()
        setActiveSubmenu(null)
      },
      'data-testid': 'webcam-toggle-button',
    })

    // 6. image select (multi modal)
    if (
      isMultiModalAvailable(
        selectAIService as AIService,
        selectAIModel,
        enableMultiModal,
        customModel
      )
    ) {
      items.push({
        id: 'image-select',
        iconName: '24/AddImage',
        label: t('SelectImage'),
        onClick: handleSelectImage,
        'data-testid': 'image-select-button',
      })
    }

    // 7. youtube
    if (youtubeMode) {
      items.push({
        id: 'youtube',
        iconName: youtubePlaying ? '24/PauseAlt' : '24/Video',
        label: youtubePlaying ? t('PauseYoutube') : t('StartYoutube'),
        active: youtubePlaying,
        onClick: () => {
          settingsStore.setState({
            youtubePlaying: !youtubePlaying,
          })
          setActiveSubmenu(null)
        },
        'aria-pressed': youtubePlaying,
        'data-testid': 'youtube-play-toggle-button',
      })
    }

    // 8. game commentary (jikkyo)
    if (gameCommentaryEnabled) {
      items.push({
        id: 'game-commentary',
        iconName: gameCommentaryPlaying ? '24/PauseAlt' : 'game-controller',
        label: gameCommentaryPlaying
          ? t('PauseGameCommentary')
          : t('StartGameCommentary'),
        active: gameCommentaryPlaying,
        onClick: () => {
          toggleGameCommentary()
          setActiveSubmenu(null)
        },
        'aria-pressed': gameCommentaryPlaying,
        'data-testid': 'game-commentary-play-toggle-button',
      })
    }

    // 9. slide
    if (slideMode) {
      items.push({
        id: 'slide',
        iconName: '24/FrameEffect',
        label: slideVisible ? t('HideSlide') : t('ShowSlide'),
        active: slideVisible,
        disabled: slidePlaying,
        onClick: () => {
          menuStore.setState({
            slideVisible: !slideVisible,
            thumbnailVisible: false,
          })
          setActiveSubmenu(null)
        },
        'aria-pressed': slideVisible,
        'data-testid': 'slide-visibility-toggle-button',
      })
    }

    return items
  }, [
    canAccessSettings,
    t,
    activeSubmenu,
    showCapture,
    toggleCapture,
    showWebcam,
    toggleWebcam,
    selectAIService,
    selectAIModel,
    enableMultiModal,
    customModel,
    youtubeMode,
    youtubePlaying,
    gameCommentaryEnabled,
    gameCommentaryPlaying,
    toggleGameCommentary,
    slideMode,
    slideVisible,
    slidePlaying,
  ])

  // reset focus and submenus when the tool menu opens/closes
  useEffect(() => {
    if (showToolMenu) {
      setFocusedIndex(0)
      setActiveSubmenu(null)
      setMenuFocusZone('main')
    } else {
      setActiveSubmenu(null)
      setMenuFocusZone('main')
    }
  }, [showToolMenu])

  // adjust focusedIndex
  useEffect(() => {
    if (focusedIndex >= toolMenuItems.length && toolMenuItems.length > 0) {
      setFocusedIndex(toolMenuItems.length - 1)
    }
  }, [focusedIndex, toolMenuItems.length])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 1. Shift+Cmd+K (Win: Shift+Ctrl+K)
      if (!event.repeat && matchesKeyboardShortcut(event, 'Mod+Shift+KeyK')) {
        if (
          isEditableKeyboardTarget(event.target) &&
          !hasCommandModifier('Mod+Shift+KeyK')
        ) {
          return
        }
        event.preventDefault()
        setShowToolMenu((prev) => !prev)
        return
      }

      // 2. keyboard control
      if (showToolMenu) {
        if (menuFocusZone === 'main') {
          if (toolMenuItems.length > 0) {
            if (event.key === 'ArrowDown' || event.key === 'KeyS') {
              event.preventDefault()
              setFocusedIndex((prev) => (prev + 1) % toolMenuItems.length)
              return
            }
            if (event.key === 'ArrowUp' || event.key === 'KeyW') {
              event.preventDefault()
              setFocusedIndex(
                (prev) =>
                  (prev - 1 + toolMenuItems.length) % toolMenuItems.length
              )
              return
            }
            if (event.key === 'ArrowRight' || event.key === 'KeyD') {
              const currentItem = toolMenuItems[focusedIndex]
              if (currentItem?.id === 'presets') {
                event.preventDefault()
                setActiveSubmenu('presets')
                setMenuFocusZone('submenu')
                setSubmenuFocusedIndex(
                  settingsStore.getState().selectedPresetIndex ?? 0
                )
                return
              }
              if (currentItem?.id === 'layers') {
                event.preventDefault()
                setActiveSubmenu('layers')
                setMenuFocusZone('submenu')
                setSubmenuFocusedIndex(0)
                return
              }
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              const item = toolMenuItems[focusedIndex]
              if (item && !item.disabled) {
                if (item.id === 'presets') {
                  setActiveSubmenu('presets')
                  setMenuFocusZone('submenu')
                  setSubmenuFocusedIndex(
                    settingsStore.getState().selectedPresetIndex ?? 0
                  )
                } else if (item.id === 'layers') {
                  setActiveSubmenu('layers')
                  setMenuFocusZone('submenu')
                  setSubmenuFocusedIndex(0)
                } else {
                  item.onClick()
                }
              }
              return
            }
            if (event.key === 'Backspace' || event.key === 'Escape') {
              event.preventDefault()
              if (activeSubmenu) {
                setActiveSubmenu(null)
              } else {
                setShowToolMenu(false)
              }
              return
            }
          }
        } else if (menuFocusZone === 'submenu') {
          if (activeSubmenu === 'presets') {
            const presetCount = 5
            if (event.key === 'ArrowDown' || event.key === 'KeyS') {
              event.preventDefault()
              setSubmenuFocusedIndex((prev) => (prev + 1) % presetCount)
              return
            }
            if (event.key === 'ArrowUp' || event.key === 'KeyW') {
              event.preventDefault()
              setSubmenuFocusedIndex(
                (prev) => (prev - 1 + presetCount) % presetCount
              )
              return
            }
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              const store = settingsStore.getState()
              const presets = [
                {
                  value: store.characterPreset1,
                  name: store.customPresetName1,
                },
                {
                  value: store.characterPreset2,
                  name: store.customPresetName2,
                },
                {
                  value: store.characterPreset3,
                  name: store.customPresetName3,
                },
                {
                  value: store.characterPreset4,
                  name: store.customPresetName4,
                },
                {
                  value: store.characterPreset5,
                  name: store.customPresetName5,
                },
              ]
              const target = presets[submenuFocusedIndex]
              if (target) {
                settingsStore.setState({
                  systemPrompt: target.value,
                  selectedPresetIndex: submenuFocusedIndex,
                })
                toastStore.getState().addToast({
                  message: t('Toasts.PresetSwitching', {
                    presetName: target.name,
                  }),
                  type: 'info',
                  tag: 'character-preset-switching',
                })
              }
              setActiveSubmenu(null)
              setMenuFocusZone('main')
              return
            }
            if (
              event.key === 'ArrowLeft' ||
              event.key === 'KeyA' ||
              event.key === 'Backspace' ||
              event.key === 'Escape'
            ) {
              event.preventDefault()
              setActiveSubmenu(null)
              setMenuFocusZone('main')
              return
            }
          } else if (activeSubmenu === 'layers') {
            const { getAllLayerItems, reorderAllLayers } =
              useImagesStore.getState()
            const items = getAllLayerItems()
            const count = items.length

            if (count > 0) {
              if (event.key === 'ArrowDown' || event.key === 'KeyS') {
                if (event.shiftKey || event.altKey) {
                  event.preventDefault()
                  if (submenuFocusedIndex < count - 1) {
                    reorderAllLayers(
                      submenuFocusedIndex,
                      submenuFocusedIndex + 1
                    )
                    setSubmenuFocusedIndex((prev) => prev + 1)
                  }
                  return
                }
                event.preventDefault()
                setSubmenuFocusedIndex((prev) => (prev + 1) % count)
                return
              }
              if (event.key === 'ArrowUp' || event.key === 'KeyW') {
                if (event.shiftKey || event.altKey) {
                  event.preventDefault()
                  if (submenuFocusedIndex > 0) {
                    reorderAllLayers(
                      submenuFocusedIndex,
                      submenuFocusedIndex - 1
                    )
                    setSubmenuFocusedIndex((prev) => prev - 1)
                  }
                  return
                }
                event.preventDefault()
                setSubmenuFocusedIndex((prev) => (prev - 1 + count) % count)
                return
              }
            }

            if (
              event.key === 'ArrowLeft' ||
              event.key === 'KeyA' ||
              event.key === 'Backspace' ||
              event.key === 'Escape'
            ) {
              event.preventDefault()
              setActiveSubmenu(null)
              setMenuFocusZone('main')
              return
            }
          }
        }
      }

      // 3. settings shortcut
      if (
        !event.repeat &&
        matchesKeyboardShortcut(event, settingsToggleShortcut)
      ) {
        // disable shortcuts when settings are not accessible for kiosk mode,
        if (!canAccessSettings) return
        if (
          isEditableKeyboardTarget(event.target) &&
          !hasCommandModifier(settingsToggleShortcut) &&
          event.key.length === 1
        ) {
          return
        }
        event.preventDefault()
        setShowSimpleSettings((prevState) => !prevState)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    activeSubmenu,
    canAccessSettings,
    focusedIndex,
    menuFocusZone,
    settingsToggleShortcut,
    showToolMenu,
    submenuFocusedIndex,
    t,
    toolMenuItems,
  ])

  return (
    <>
      {/* invisible area for long tap (when control panel is hidden on mobile) */}
      {isMobile === true && !effectiveShowControlPanel && (
        <div
          className="absolute top-0 left-0 z-30 w-20 h-20"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <div className="w-full h-full opacity-0"></div>
        </div>
      )}

      <div className="absolute z-30 m-3 sm:m-6">
        {effectiveShowControlPanel && (
          <div className="relative mb-10" style={{ width: 'max-content' }}>
            <div className="aurora-glass-dock grid grid-flow-col gap-0.5 rounded-[18px] p-1.5">
              <div>
                <IconButton
                  iconName={showToolMenu ? '24/Close' : '24/Menu'}
                  label={t('Tools')}
                  labelClassName="hidden sm:block"
                  isProcessing={false}
                  onClick={() => setShowToolMenu((prev) => !prev)}
                  aria-label={t('Tools')}
                  aria-expanded={showToolMenu}
                  data-testid="main-tools-toggle-button"
                  backgroundColor="bg-transparent hover:bg-black/5 active:bg-black/10 disabled:bg-transparent"
                  iconColor="text-text1"
                  className="!rounded-[13px] transition-colors duration-200 outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
                />
              </div>
            </div>
            {showToolMenu && (
              <div className="absolute left-0 top-full z-30 mt-2 flex items-start gap-2">
                <div
                  className="aurora-glass-popover grid w-max min-w-[180px] max-w-[calc(100vw-24px)] gap-0.5 rounded-[18px] p-2 sm:min-w-[220px]"
                  data-testid="main-tools-menu"
                >
                  {toolMenuItems.map((item, idx) => (
                    <ToolMenuButton
                      key={item.id}
                      iconName={item.iconName}
                      label={item.label}
                      active={item.active}
                      hasSubmenu={item.hasSubmenu}
                      isFocused={
                        menuFocusZone === 'main' && focusedIndex === idx
                      }
                      disabled={item.disabled}
                      onClick={item.onClick}
                      onMouseEnter={() => {
                        setFocusedIndex(idx)
                        setMenuFocusZone('main')
                      }}
                      aria-pressed={item['aria-pressed']}
                      aria-expanded={item['aria-expanded']}
                      data-testid={item['data-testid']}
                    />
                  ))}
                  <input
                    id="menu-image-file-input"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        const reader = new FileReader()
                        reader.onload = (e) => {
                          const imageUrl = e.target?.result as string
                          homeStore.setState({ modalImage: imageUrl })
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                  />
                </div>
                {/* submenu */}
                {activeSubmenu === 'presets' && (
                  <PresetSubmenu
                    isFocused={menuFocusZone === 'submenu'}
                    focusedIndex={submenuFocusedIndex}
                    onHoverPreset={(idx) => {
                      setSubmenuFocusedIndex(idx)
                      setMenuFocusZone('submenu')
                    }}
                    onClose={() => {
                      setActiveSubmenu(null)
                      setMenuFocusZone('main')
                    }}
                  />
                )}
                {activeSubmenu === 'layers' && (
                  <LayerOrderSubmenu
                    isFocused={menuFocusZone === 'submenu'}
                    focusedIndex={submenuFocusedIndex}
                    onHoverItem={(idx) => {
                      setSubmenuFocusedIndex(idx)
                      setMenuFocusZone('submenu')
                    }}
                    onMoveUp={(idx) => {
                      setSubmenuFocusedIndex(Math.max(0, idx - 1))
                    }}
                    onMoveDown={(idx) => {
                      const len = useImagesStore
                        .getState()
                        .getAllLayerItems().length
                      setSubmenuFocusedIndex(Math.min(len - 1, idx + 1))
                    }}
                    onClose={() => {
                      setActiveSubmenu(null)
                      setMenuFocusZone('main')
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="relative">
        {slideMode &&
          (slideVisible || thumbnailVisible || presentationDocument) && (
            <Slides
              markdown={markdownContent}
              visible={slideVisible || thumbnailVisible}
              thumbnailVisible={thumbnailVisible}
            />
          )}
      </div>
      {chatLogMode === CHAT_LOG_MODE.CHAT_LOG && <ChatLog />}
      {showSimpleSettings && (
        <DpadSettingsMenu
          onClose={() => setShowSimpleSettings(false)}
          onOpenAdvanced={() => {
            setShowSimpleSettings(false)
            setShowAdvancedSettings(true)
          }}
        />
      )}
      {showAdvancedSettings && canAccessSettings && (
        <Settings onClickClose={() => setShowAdvancedSettings(false)} />
      )}
      {chatLogMode === CHAT_LOG_MODE.ASSISTANT &&
        latestAssistantMessage &&
        (!slideMode || !slideVisible) &&
        showAssistantText && <AssistantText message={latestAssistantMessage} />}
      {showWebcam && navigator.mediaDevices && <Webcam />}
      {showCapture && <Capture />}
      {showPermissionModal && (
        <div className="modal">
          <div className="modal-content">
            <p>{t('Errors.CameraPermissionMessage')}</p>
            <button onClick={() => setShowPermissionModal(false)}>
              {t('Close')}
            </button>
          </div>
        </div>
      )}
      <input
        type="file"
        className="hidden"
        accept=".vrm"
        ref={(fileInput) => {
          if (!fileInput) {
            menuStore.setState({ fileInput: null })
            return
          }

          menuStore.setState({ fileInput })
        }}
        onChange={handleChangeVrmFile}
      />
    </>
  )
}

const ToolMenuButton = ({
  active = false,
  isFocused = false,
  hasSubmenu = false,
  iconName,
  label,
  ...rest
}: Omit<
  React.ComponentProps<typeof IconButton>,
  'backgroundColor' | 'iconColor' | 'isProcessing' | 'label'
> & {
  active?: boolean
  isFocused?: boolean
  hasSubmenu?: boolean
  label: string
}) => {
  const isHighlighted = isFocused || active
  return (
    <div className="relative flex items-center w-full">
      <IconButton
        {...rest}
        aria-label={rest['aria-label'] ?? label}
        iconName={iconName}
        label={label}
        isProcessing={false}
        backgroundColor={
          isHighlighted
            ? 'bg-primary hover:bg-primary-hover active:bg-primary-press disabled:bg-primary-disabled disabled:cursor-not-allowed'
            : 'bg-transparent hover:bg-white/5 active:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50'
        }
        iconColor={isHighlighted ? 'text-theme' : 'text-text1'}
        className={`w-full !justify-start !rounded-xl transition-all duration-150 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 border ${
          isFocused
            ? 'border-white/30 shadow-md font-bold'
            : 'border-transparent'
        } ${rest.className ?? ''}`}
      />
      {hasSubmenu && (
        <span
          className={`absolute right-3 pointer-events-none text-xs transition-transform duration-150 ${
            active ? 'translate-x-0.5' : 'opacity-60'
          } ${isHighlighted ? 'text-theme' : 'text-text1'}`}
          aria-hidden="true"
        >
          ▶
        </span>
      )}
    </div>
  )
}
