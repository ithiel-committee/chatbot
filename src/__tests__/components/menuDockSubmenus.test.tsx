import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Menu } from '@/components/menu'
import settingsStore from '@/features/stores/settings'
import menuStore from '@/features/stores/menu'
import homeStore from '@/features/stores/home'
import slideStore from '@/features/stores/slide'
import presentationStore from '@/features/stores/presentation'
import useImagesStore from '@/features/stores/images'
import toastStore from '@/features/stores/toast'
import { useKioskMode } from '@/hooks/useKioskMode'

// mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => {
      const translations: Record<string, string> = {
        Tools: 'ツール',
        Settings: '設定',
        Presets: 'プリセット',
        LayerOrderShort: 'レイヤー順序',
        LayerOrder: 'レイヤー順序（最大5つ）',
        CharacterSettingsPrompt: 'キャラクターのプロンプト',
        BottomLayer: '最背面',
        TopLayer: '最前面',
        ScreenShare: '画面共有',
        Camera: 'カメラ',
        'Toasts.PresetSwitching':
          'プリセット「{{presetName}}」に切り替えました',
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

describe('Menu - Dock Integration of Presets and Layer Order', () => {
  beforeEach(() => {
    jest.clearAllMocks()

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
      characterPreset1: 'Preset 1 Prompt',
      characterPreset2: 'Preset 2 Prompt',
      characterPreset3: 'Preset 3 Prompt',
      characterPreset4: 'Preset 4 Prompt',
      characterPreset5: 'Preset 5 Prompt',
      customPresetName1: 'Preset One',
      customPresetName2: 'Preset Two',
      customPresetName3: 'Preset Three',
      customPresetName4: 'Preset Four',
      customPresetName5: 'Preset Five',
      selectedPresetIndex: 0,
      systemPrompt: 'Preset 1 Prompt',
      selectAIService: 'openai',
      selectAIModel: 'gpt-4o',
      enableMultiModal: false,
      customModel: false,
      youtubeMode: false,
      youtubePlaying: false,
      slideMode: false,
      showAssistantText: false,
      chatLogMode: 'assistant',
    })

    menuStore.setState({
      slideVisible: false,
      showWebcam: false,
      showCapture: false,
    })

    homeStore.setState({
      chatLog: [],
    })

    useImagesStore.setState({
      placedImages: [
        {
          id: 'img1',
          filename: 'image1.png',
          path: '/path/1.png',
          x: 10,
          y: 20,
          scale: 1,
          layer: 1,
          size: { width: 100, height: 100 },
          visible: true,
        },
      ],
      characterLayerPosition: 0,
    })
  })

  it('renders presets and layers items in tools menu below settings', () => {
    render(<Menu />)

    // open tools menu
    fireEvent.click(screen.getByTestId('main-tools-toggle-button'))
    expect(screen.getByTestId('main-tools-menu')).toBeInTheDocument()

    // check that settings, presets, and layers are all present
    expect(screen.getByTestId('open-settings-button')).toBeInTheDocument()
    expect(screen.getByTestId('presets-menu-button')).toBeInTheDocument()
    expect(screen.getByTestId('layers-menu-button')).toBeInTheDocument()
  })

  it('opens preset submenu on clicking presets button and allows selecting a preset', () => {
    render(<Menu />)

    // open tools menu
    fireEvent.click(screen.getByTestId('main-tools-toggle-button'))

    // click presets button
    fireEvent.click(screen.getByTestId('presets-menu-button'))

    // preset submenu should be rendered
    expect(screen.getByTestId('preset-submenu')).toBeInTheDocument()
    expect(screen.getByText('Preset One')).toBeInTheDocument()
    expect(screen.getByText('Preset Two')).toBeInTheDocument()

    // click preset two
    fireEvent.click(screen.getByTestId('preset-item-1'))

    // preset should be updated in store
    expect(settingsStore.getState().selectedPresetIndex).toBe(1)
    expect(settingsStore.getState().systemPrompt).toBe('Preset 2 Prompt')

    // submenu should be closed after selection
    expect(screen.queryByTestId('preset-submenu')).toBeNull()
  })

  it('opens layer order submenu on clicking layers button', () => {
    render(<Menu />)

    // open tools menu
    fireEvent.click(screen.getByTestId('main-tools-toggle-button'))

    // click layers button
    fireEvent.click(screen.getByTestId('layers-menu-button'))

    // layer order submenu should be rendered
    expect(screen.getByTestId('layer-order-submenu')).toBeInTheDocument()
    expect(screen.getByTestId('layer-item-0')).toBeInTheDocument()
    expect(screen.getByTestId('layer-item-1')).toBeInTheDocument()
  })

  it('navigates to presets and opens submenu via keyboard, then selects preset with Enter', () => {
    render(<Menu />)

    // open tools menu
    fireEvent.click(screen.getByTestId('main-tools-toggle-button'))

    // move focus down to presets (index 1)
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    // open submenu with ArrowRight
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('preset-submenu')).toBeInTheDocument()

    // navigate to preset index 2 (down from index 0)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    // press enter to select preset index 2
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(settingsStore.getState().selectedPresetIndex).toBe(2)
    expect(settingsStore.getState().systemPrompt).toBe('Preset 3 Prompt')
    expect(screen.queryByTestId('preset-submenu')).toBeNull()
  })

  it('closes submenu with ArrowLeft and returns to main tools menu', () => {
    render(<Menu />)

    // open tools menu
    fireEvent.click(screen.getByTestId('main-tools-toggle-button'))

    // move to presets and open
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByTestId('preset-submenu')).toBeInTheDocument()

    // press arrow left to close submenu
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.queryByTestId('preset-submenu')).toBeNull()
    expect(screen.getByTestId('main-tools-menu')).toBeInTheDocument()
  })

  it('reorders layers with Shift+ArrowDown / Shift+ArrowUp in layer order submenu', () => {
    render(<Menu />)

    // open tools menu
    fireEvent.click(screen.getByTestId('main-tools-toggle-button'))

    // navigate to layers item (index 2: settings -> presets -> layers)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })

    // open layers submenu with Enter
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByTestId('layer-order-submenu')).toBeInTheDocument()

    const initialOrder = useImagesStore.getState().getAllLayerItems()
    expect(initialOrder[0].id).toBe('img1')
    expect(initialOrder[1].type).toBe('character')

    // reorder with shift + arrow down (moves img1 from index 0 to 1)
    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true })

    const reordered = useImagesStore.getState().getAllLayerItems()
    expect(reordered[0].type).toBe('character')
    expect(reordered[1].id).toBe('img1')

    // press esc to close submenu and return to main tools menu
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByTestId('layer-order-submenu')).toBeNull()
    expect(screen.getByTestId('main-tools-menu')).toBeInTheDocument()
  })
})
