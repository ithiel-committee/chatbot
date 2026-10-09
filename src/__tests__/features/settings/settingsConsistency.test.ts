import { getSettingCategories } from '@/features/navigationMenu/settingCategories'
import { SETTINGS_SCHEMA } from '@/features/constants/settingsSchema'
import {
  isVoiceAdjustmentDisabled,
  isSpeechRecognitionSwitchDisabled,
  isSpeechTimeoutDisabled,
  isConversationContinuityDisabled,
  isIdleModeDisabled,
  isVoicevoxAdjustmentDisabled,
} from '@/features/stores/settingGuards'
import {
  setAIModelWithSync,
  setAIServiceWithSync,
  setYoutubeModeWithSync,
  sanitizeSettingsShortcut,
  setSafeKioskMode,
} from '@/features/stores/settingActions'
import { DEFAULT_SETTINGS_TOGGLE_SHORTCUT } from '@/utils/keyboardShortcut'
import settingsStore from '@/features/stores/settings'

const mockT = ((key: string, fallback?: string) => fallback || key) as any

describe('設定項目の従来設定・クイック設定間 整合性テスト', () => {
  beforeEach(() => {
    // ストアの初期状態リセット
    settingsStore.setState({
      selectAIService: 'openai',
      selectAIModel: 'gpt-4o',
      customModel: false,
      enableMultiModal: true,
      youtubeMode: false,
      youtubePlaying: false,
      realtimeAPIMode: false,
      audioMode: false,
      slideMode: false,
      externalLinkageMode: false,
      gameCommentaryEnabled: false,
      speechRecognitionMode: 'browser',
      initialSpeechTimeout: 5.0,
      selectVoice: 'voicevox',
      kioskModeEnabled: false,
      kioskPasscode: '1234',
    })
  })

  describe('1. 音声検出タイムアウト (initialSpeechTimeout)', () => {
    it('単位が「秒」であり、スケールが0〜60秒の範囲に統一されていること', () => {
      const categories = getSettingCategories(mockT)
      const voiceCat = categories.find((c) => c.id === 'voice')
      const timeoutItem = voiceCat?.items.find(
        (i) => i.id === 'initialSpeechTimeout'
      )

      expect(timeoutItem).toBeDefined()
      expect(timeoutItem?.unit).toBe('秒')
      expect(timeoutItem?.min).toBe(0)
      expect(timeoutItem?.max).toBe(60)
      expect(timeoutItem?.step).toBe(0.5)
      expect(SETTINGS_SCHEMA.initialSpeechTimeout.unit).toBe('秒')
    })
  })

  describe('2. 音声合成エンジンの「音声なし (none)」', () => {
    it('クイック設定およびスキーマの選択肢に none が含まれていること', () => {
      const categories = getSettingCategories(mockT)
      const voiceCat = categories.find((c) => c.id === 'voice')
      const selectVoiceItem = voiceCat?.items.find(
        (i) => i.id === 'selectVoice'
      )

      expect(selectVoiceItem).toBeDefined()
      const noneOption = selectVoiceItem?.options?.find(
        (o) => o.value === 'none'
      )
      expect(noneOption).toBeDefined()
      expect(SETTINGS_SCHEMA.voiceOptions.some((o) => o.value === 'none')).toBe(
        true
      )
    })
  })

  describe('3. 過去メッセージ件数 & 最大トークン数', () => {
    it('クイック設定のスライダーが適切な範囲に設定されていること', () => {
      const categories = getSettingCategories(mockT)
      const aiCat = categories.find((c) => c.id === 'ai')

      const maxPastMessagesItem = aiCat?.items.find(
        (i) => i.id === 'maxPastMessages'
      )
      expect(maxPastMessagesItem?.min).toBe(0)
      expect(maxPastMessagesItem?.max).toBe(50)

      const maxTokensItem = aiCat?.items.find((i) => i.id === 'maxTokens')
      expect(maxTokensItem?.min).toBe(100)
      expect(maxTokensItem?.max).toBeGreaterThanOrEqual(8192)
    })
  })

  describe('4. AIモデル変更時のマルチモーダル自動同期', () => {
    it('setAIModelWithSync により非マルチモーダルモデルへ変更したとき enableMultiModal が false になること', () => {
      settingsStore.setState({
        selectAIService: 'openai',
        selectAIModel: 'gpt-4o',
        enableMultiModal: true,
      })

      // gpt-3.5-turbo は非マルチモーダル
      setAIModelWithSync('gpt-3.5-turbo')
      expect(settingsStore.getState().selectAIModel).toBe('gpt-3.5-turbo')
      expect(settingsStore.getState().enableMultiModal).toBe(false)
    })

    it('setAIServiceWithSync によりサービス変更時にもマルチモーダル状態が同期されること', () => {
      setAIServiceWithSync('anthropic')
      expect(settingsStore.getState().selectAIService).toBe('anthropic')
      // anthropicのデフォルトモデル (claude-3-5-sonnet-latest) はマルチモーダル
      expect(settingsStore.getState().enableMultiModal).toBe(true)
    })
  })

  describe('5. YouTubeモード変更時の再生状態同期', () => {
    it('setYoutubeModeWithSync で OFF にした際、youtubePlaying も false にリセットされること', () => {
      settingsStore.setState({ youtubeMode: true, youtubePlaying: true })
      setYoutubeModeWithSync(false)

      expect(settingsStore.getState().youtubeMode).toBe(false)
      expect(settingsStore.getState().youtubePlaying).toBe(false)
    })
  })

  describe('6. 排他・無効化ガード関数とクイック設定の disabled 連携', () => {
    it('realtimeAPIMode が ON のとき、音声設定や音声認識が無効化されること', () => {
      settingsStore.setState({ realtimeAPIMode: true })
      const state = settingsStore.getState()

      expect(isVoiceAdjustmentDisabled(state)).toBe(true)
      expect(isSpeechRecognitionSwitchDisabled(state)).toBe(true)
      expect(isSpeechTimeoutDisabled(state)).toBe(true)

      const categories = getSettingCategories(mockT)
      const voiceCat = categories.find((c) => c.id === 'voice')
      const selectVoiceItem = voiceCat?.items.find(
        (i) => i.id === 'selectVoice'
      )
      expect(selectVoiceItem?.disabled?.()).toBe(true)
    })

    it('slideMode が ON のとき、会話継続モードが無効化されること', () => {
      settingsStore.setState({ slideMode: true })
      expect(isConversationContinuityDisabled(settingsStore.getState())).toBe(
        true
      )

      const categories = getSettingCategories(mockT)
      const featuresCat = categories.find((c) => c.id === 'features')
      const continuityItem = featuresCat?.items.find(
        (i) => i.id === 'conversationContinuityMode'
      )
      expect(continuityItem?.disabled?.()).toBe(true)
    })

    it('VOICEVOX以外のTTSエンジンが選ばれているとき、VOICEVOX専用設定が無効化されること', () => {
      settingsStore.setState({ selectVoice: 'openai' })
      expect(isVoicevoxAdjustmentDisabled(settingsStore.getState())).toBe(true)

      const categories = getSettingCategories(mockT)
      const voiceCat = categories.find((c) => c.id === 'voice')
      const speedItem = voiceCat?.items.find((i) => i.id === 'voicevoxSpeed')
      expect(speedItem?.disabled?.()).toBe(true)
    })
  })

  describe('7. ショートカットサニタイズ & キオスクモード安全性', () => {
    it('音声入力ショートカットと競合する場合、サニタイズ処理で弾かれること', () => {
      settingsStore.setState({
        voiceInputShortcut: 'Shift+Slash',
        settingsToggleShortcut: 'Shift+Backquote',
      })
      const result = sanitizeSettingsShortcut('Shift+Slash')
      expect(result).toBe('Shift+Backquote')
    })

    it('空文字が渡された場合はデフォルト値にフォールバックすること', () => {
      const result = sanitizeSettingsShortcut('   ')
      expect(result).toBe(DEFAULT_SETTINGS_TOGGLE_SHORTCUT)
    })

    it('パスコードが設定されていない場合、キオスクモードは有効化されないこと', () => {
      settingsStore.setState({ kioskPasscode: '' })
      window.alert = jest.fn()
      const success = setSafeKioskMode(true)
      expect(success).toBe(false)
      expect(settingsStore.getState().kioskModeEnabled).toBe(false)
    })
  })

  describe('8. キャラクター設定の従来設定完全移植', () => {
    it('従来設定の全キャラクター項目が D-pad の character カテゴリに網羅されていること', () => {
      const categories = getSettingCategories(mockT)
      const charCat = categories.find((c) => c.id === 'character')
      expect(charCat).toBeDefined()

      const expectedIds = [
        'characterName',
        'modelType',
        'selectedVrmPath',
        'openVrmPicker',
        'selectedLive2DPath',
        'selectedPNGTuberPath',
        'pngTuberSensitivity',
        'pngTuberChromaKeyEnabled',
        'pngTuberChromaKeyColor',
        'fixCharacterPosition',
        'unfixCharacterPosition',
        'resetCharacterPosition',
        'lightingIntensity',
        'thinkingPoseEnabled',
        'thinkingPoseId',
        'poseAdjustMode',
        'selectedPresetIndex',
        'systemPrompt',
      ]

      const itemIds = charCat?.items.map((i) => i.id) || []
      for (const id of expectedIds) {
        expect(itemIds).toContain(id)
      }
    })

    it('basic カテゴリに userDisplayName が配置されていること', () => {
      const categories = getSettingCategories(mockT)
      const basicCat = categories.find((c) => c.id === 'basic')
      const userDisplayNameItem = basicCat?.items.find(
        (i) => i.id === 'userDisplayName'
      )
      expect(userDisplayNameItem).toBeDefined()
    })

    it('modelType が live2d のとき、VRM系項目が無効化され Live2D系項目が有効化されること', () => {
      settingsStore.setState({ modelType: 'live2d' })
      const categories = getSettingCategories(mockT)
      const charCat = categories.find((c) => c.id === 'character')

      const vrmItem = charCat?.items.find((i) => i.id === 'selectedVrmPath')
      const live2dItem = charCat?.items.find(
        (i) => i.id === 'selectedLive2DPath'
      )

      expect(vrmItem?.disabled?.()).toBe(true)
      expect(live2dItem?.disabled?.()).toBe(false)
    })

    it('プリセット選択の変更で systemPrompt が連動更新されること', () => {
      settingsStore.setState({
        characterPreset2: 'プリセット2のプロンプト内容',
      })
      const categories = getSettingCategories(mockT)
      const charCat = categories.find((c) => c.id === 'character')
      const presetItem = charCat?.items.find(
        (i) => i.id === 'selectedPresetIndex'
      )

      presetItem?.setValue?.(1)
      expect(settingsStore.getState().selectedPresetIndex).toBe(1)
      expect(settingsStore.getState().systemPrompt).toBe(
        'プリセット2のプロンプト内容'
      )
    })
  })
})
