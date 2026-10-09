import { MenuCategory } from '@/types/navigationMenu'
import settingsStore, { ChatLogMode } from '@/features/stores/settings'
import menuStore from '@/features/stores/menu'
import { languageOptions } from '@/components/settings/languageOptions'
import { AI_SERVICES, AIService, AIVoice } from '@/features/constants/settings'
import { defaultModels } from '@/features/constants/aiModels'
import { SETTINGS_SCHEMA } from '@/features/constants/settingsSchema'
import {
  getVrmOptions,
  getLive2DOptions,
  getPNGTuberOptions,
} from '@/features/constants/modelCatalog'
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
  uploadAndLoadVRM,
  loadSelectedModelWithSync,
  handleCharacterPositionAction,
  setLightingIntensityWithSync,
  selectCharacterPresetWithSync,
  sanitizeSettingsShortcut,
  setSafeKioskMode,
} from '@/features/stores/settingActions'
import type { TFunction } from 'i18next'
import i18n from 'i18next'

export const getSettingCategories = (
  t: TFunction,
  options?: { onOpenAdvanced?: () => void }
): MenuCategory[] => {
  return [
    // ----------------------------------------------------
    // 1. basic settings / display settings
    // ----------------------------------------------------
    {
      id: 'basic',
      label: t('SettingsDisplaySettings', '基本・表示'),
      items: [
        {
          id: 'language',
          label: t('Language', '言語'),
          type: 'select',
          getValue: () => settingsStore.getState().selectLanguage,
          setValue: (val) => {
            settingsStore.setState({ selectLanguage: val })
            i18n.changeLanguage(val)
          },
          options: languageOptions.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })),
        },
        {
          id: 'userDisplayName',
          label: t('UserDisplayName', 'ユーザー表示名'),
          type: 'text',
          placeholder: 'あなたの呼び名',
          getValue: () => settingsStore.getState().userDisplayName,
          setValue: (val) => settingsStore.setState({ userDisplayName: val }),
        },
        {
          id: 'showMouseCursor',
          label: t('ShowMouseCursor', 'マウスカーソルを表示する'),
          type: 'toggle',
          getValue: () => settingsStore.getState().showMouseCursor,
          setValue: (val) => settingsStore.setState({ showMouseCursor: val }),
        },
        {
          id: 'screenOrientation',
          label: t('ScreenOrientation', '画面の向き・反転'),
          type: 'select',
          getValue: () => settingsStore.getState().screenOrientation,
          setValue: (val) =>
            settingsStore.setState({ screenOrientation: val as any }),
          options: SETTINGS_SCHEMA.screenOrientationOptions.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })),
        },
        {
          id: 'showAssistantText',
          label: t('AssistantText', '字幕テキスト表示'),
          type: 'toggle',
          getValue: () => settingsStore.getState().showAssistantText,
          setValue: (val) => settingsStore.setState({ showAssistantText: val }),
        },
        {
          id: 'chatLogMode',
          label: t('ChatLogMode', '会話ログ表示モード'),
          type: 'select',
          getValue: () => settingsStore.getState().chatLogMode,
          setValue: (val) =>
            settingsStore.setState({ chatLogMode: val as ChatLogMode }),
          options: SETTINGS_SCHEMA.chatLogModeOptions.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })),
        },
        {
          id: 'showControlPanel',
          label: t('ControlPanel', 'コントロールパネル表示'),
          type: 'toggle',
          getValue: () => settingsStore.getState().showControlPanel,
          setValue: (val) => settingsStore.setState({ showControlPanel: val }),
        },
        {
          id: 'useVideoAsBackground',
          label: t('VideoBackground', '動画背景を使用'),
          type: 'toggle',
          getValue: () => settingsStore.getState().useVideoAsBackground,
          setValue: (val) =>
            settingsStore.setState({ useVideoAsBackground: val }),
        },
        {
          id: 'settingsToggleShortcut',
          label: t('SettingsShortcut', '設定画面ショートカット'),
          type: 'text',
          placeholder: '例: Shift+Slash',
          getValue: () => settingsStore.getState().settingsToggleShortcut,
          setValue: (val) =>
            settingsStore.setState({
              settingsToggleShortcut: sanitizeSettingsShortcut(val),
            }),
        },
      ],
    },

    // ----------------------------------------------------
    // 2. ai / chat model settings
    // ----------------------------------------------------
    {
      id: 'ai',
      label: t('AISettings', 'AI・モデル'),
      items: [
        {
          id: 'selectAIService',
          label: t('AIService', 'AIプロバイダー'),
          type: 'select',
          getValue: () => settingsStore.getState().selectAIService,
          setValue: (val) => setAIServiceWithSync(val as AIService),
          options: AI_SERVICES.map((srv) => ({ label: srv, value: srv })),
        },
        {
          id: 'selectAIModel',
          label: t('AIModel', 'モデル名'),
          type: 'text',
          placeholder: '例: gpt-4o',
          getValue: () => settingsStore.getState().selectAIModel,
          setValue: (val) => setAIModelWithSync(val),
        },
        {
          id: 'customModel',
          label: t('UseCustomModel', 'カスタムモデルを使用'),
          type: 'toggle',
          getValue: () => settingsStore.getState().customModel,
          setValue: (val) => settingsStore.setState({ customModel: val }),
        },
        {
          id: 'currentApiKey',
          label: t('APIKey', '現在のAIサービスのAPIキー'),
          type: 'text',
          placeholder: 'sk-...',
          disabled: () => {
            const srv = settingsStore.getState().selectAIService
            return ['lmstudio', 'ollama', 'custom-api'].includes(srv)
          },
          getValue: () => {
            const st = settingsStore.getState()
            const srv = st.selectAIService
            const keyMap: Record<string, string> = {
              openai: st.openaiKey,
              anthropic: st.anthropicKey,
              google: st.googleKey,
              azure: st.azureKey,
              groq: st.groqKey,
              dify: st.difyKey,
              openrouter: st.openrouterKey,
            }
            return keyMap[srv] || ''
          },
          setValue: (val) => {
            const srv = settingsStore.getState().selectAIService
            const keyFieldMap: Record<string, string> = {
              openai: 'openaiKey',
              anthropic: 'anthropicKey',
              google: 'googleKey',
              azure: 'azureKey',
              groq: 'groqKey',
              dify: 'difyKey',
              openrouter: 'openrouterKey',
            }
            const field = keyFieldMap[srv]
            if (field) {
              settingsStore.setState({ [field]: val } as any)
            }
          },
        },
        {
          id: 'maxTokens',
          label: t('MaxTokens', '最大トークン数'),
          type: 'slider',
          min: SETTINGS_SCHEMA.maxTokens.min,
          max: SETTINGS_SCHEMA.maxTokens.max,
          step: SETTINGS_SCHEMA.maxTokens.step,
          getValue: () => settingsStore.getState().maxTokens,
          setValue: (val) => settingsStore.setState({ maxTokens: val }),
        },
        {
          id: 'maxPastMessages',
          label: t('MaxPastMessages', '過去メッセージ参照件数'),
          type: 'slider',
          min: SETTINGS_SCHEMA.maxPastMessages.min,
          max: SETTINGS_SCHEMA.maxPastMessages.max,
          step: SETTINGS_SCHEMA.maxPastMessages.step,
          getValue: () => settingsStore.getState().maxPastMessages,
          setValue: (val) => settingsStore.setState({ maxPastMessages: val }),
        },
        {
          id: 'systemPrompt',
          label: t('SystemPrompt', 'システムプロンプト'),
          type: 'text',
          placeholder: 'キャラクターの性格・設定を入力',
          getValue: () => settingsStore.getState().systemPrompt,
          setValue: (val) => settingsStore.setState({ systemPrompt: val }),
        },
        {
          id: 'realtimeAPIMode',
          label: t('RealtimeAPIMode', 'OpenAI Realtime API モード'),
          type: 'toggle',
          getValue: () => settingsStore.getState().realtimeAPIMode,
          setValue: (val) => settingsStore.setState({ realtimeAPIMode: val }),
        },
        {
          id: 'audioMode',
          label: t('AudioMode', '音声会話モード (Audio Mode)'),
          type: 'toggle',
          getValue: () => settingsStore.getState().audioMode,
          setValue: (val) => settingsStore.setState({ audioMode: val }),
        },
      ],
    },

    // ----------------------------------------------------
    // 3. voice & voice input
    // ----------------------------------------------------
    {
      id: 'voice',
      label: t('VoiceSettings', '音声・入力'),
      items: [
        {
          id: 'selectVoice',
          label: t('TTSEngine', '音声合成エンジン'),
          type: 'select',
          disabled: () => isVoiceAdjustmentDisabled(settingsStore.getState()),
          getValue: () => settingsStore.getState().selectVoice,
          setValue: (val) =>
            settingsStore.setState({ selectVoice: val as AIVoice }),
          options: SETTINGS_SCHEMA.voiceOptions.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })),
        },
        {
          id: 'voicevoxSpeaker',
          label: t('VoicevoxSpeaker', 'VOICEVOX 話者ID'),
          type: 'text',
          placeholder: '例: 3 (ずんだもん)',
          getValue: () => settingsStore.getState().voicevoxSpeaker,
          setValue: (val) => settingsStore.setState({ voicevoxSpeaker: val }),
          disabled: () =>
            isVoicevoxAdjustmentDisabled(settingsStore.getState()),
        },
        {
          id: 'voicevoxSpeed',
          label: t('VoicevoxSpeed', 'VOICEVOX 話速 (Speed)'),
          type: 'slider',
          min: 0.5,
          max: 2.0,
          step: 0.1,
          getValue: () => settingsStore.getState().voicevoxSpeed,
          setValue: (val) => settingsStore.setState({ voicevoxSpeed: val }),
          disabled: () =>
            isVoicevoxAdjustmentDisabled(settingsStore.getState()),
        },
        {
          id: 'voicevoxPitch',
          label: t('VoicevoxPitch', 'VOICEVOX 音高 (Pitch)'),
          type: 'slider',
          min: -0.15,
          max: 0.15,
          step: 0.01,
          getValue: () => settingsStore.getState().voicevoxPitch,
          setValue: (val) => settingsStore.setState({ voicevoxPitch: val }),
          disabled: () =>
            isVoicevoxAdjustmentDisabled(settingsStore.getState()),
        },
        {
          id: 'speechRecognitionMode',
          label: t('STTMode', '音声認識モード'),
          type: 'select',
          disabled: () =>
            isSpeechRecognitionSwitchDisabled(settingsStore.getState()),
          getValue: () => settingsStore.getState().speechRecognitionMode,
          setValue: (val) =>
            settingsStore.setState({ speechRecognitionMode: val as any }),
          options: SETTINGS_SCHEMA.speechRecognitionModeOptions.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })),
        },
        {
          id: 'initialSpeechTimeout',
          label: t('InitialSpeechTimeout', '音声検出タイムアウト (秒)'),
          type: 'slider',
          min: SETTINGS_SCHEMA.initialSpeechTimeout.min,
          max: SETTINGS_SCHEMA.initialSpeechTimeout.max,
          step: SETTINGS_SCHEMA.initialSpeechTimeout.step,
          unit: SETTINGS_SCHEMA.initialSpeechTimeout.unit,
          disabled: () => isSpeechTimeoutDisabled(settingsStore.getState()),
          getValue: () => settingsStore.getState().initialSpeechTimeout,
          setValue: (val) =>
            settingsStore.setState({ initialSpeechTimeout: val }),
        },
      ],
    },

    // ----------------------------------------------------
    // 4. character settings (従来設定の完全移植版)
    // ----------------------------------------------------
    {
      id: 'character',
      label: t('CharacterSettings', 'キャラクター'),
      items: [
        {
          id: 'characterName',
          label: t('CharacterName', 'キャラクター名'),
          type: 'text',
          placeholder: 'キャラクターの名前',
          getValue: () => settingsStore.getState().characterName,
          setValue: (val) => settingsStore.setState({ characterName: val }),
        },
        {
          id: 'modelType',
          label: t('ModelType', 'モデルタイプ'),
          type: 'select',
          getValue: () => settingsStore.getState().modelType,
          setValue: (val) => settingsStore.setState({ modelType: val as any }),
          options: SETTINGS_SCHEMA.modelTypeOptions.map((opt) => ({
            label: opt.label,
            value: opt.value,
          })),
        },
        // VRMモデル選択
        {
          id: 'selectedVrmPath',
          label: t('SelectVRM', 'VRMモデル選択'),
          type: 'select',
          disabled: () => settingsStore.getState().modelType !== 'vrm',
          getValue: () => settingsStore.getState().selectedVrmPath,
          setValue: (val) => loadSelectedModelWithSync('vrm', val),
          options: getVrmOptions(settingsStore.getState().selectedVrmPath),
        },
        {
          id: 'openVrmPicker',
          label: t('LoadVRM', 'VRMファイルを選択 (アップロード)'),
          type: 'action',
          disabled: () => settingsStore.getState().modelType !== 'vrm',
          onAction: () => {
            if (typeof document === 'undefined') return
            const fileInput = document.createElement('input')
            fileInput.type = 'file'
            fileInput.accept = '.vrm'
            fileInput.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) {
                uploadAndLoadVRM(file)
              }
            }
            fileInput.click()
          },
        },
        // Live2Dモデル選択
        {
          id: 'selectedLive2DPath',
          label: t('SelectLive2D', 'Live2Dモデル選択'),
          type: 'select',
          disabled: () => settingsStore.getState().modelType !== 'live2d',
          getValue: () => settingsStore.getState().selectedLive2DPath,
          setValue: (val) => loadSelectedModelWithSync('live2d', val),
          options: getLive2DOptions(settingsStore.getState().selectedLive2DPath),
        },
        // PNGTuberモデル選択
        {
          id: 'selectedPNGTuberPath',
          label: t('SelectPNGTuber', 'PNGTuberモデル選択'),
          type: 'select',
          disabled: () => settingsStore.getState().modelType !== 'pngtuber',
          getValue: () => settingsStore.getState().selectedPNGTuberPath,
          setValue: (val) => loadSelectedModelWithSync('pngtuber', val),
          options: getPNGTuberOptions(
            settingsStore.getState().selectedPNGTuberPath
          ),
        },
        {
          id: 'pngTuberSensitivity',
          label: t('PNGTuberSensitivity', 'PNGTuber 音声感度'),
          type: 'slider',
          min: 0,
          max: 100,
          step: 1,
          disabled: () => settingsStore.getState().modelType !== 'pngtuber',
          getValue: () => settingsStore.getState().pngTuberSensitivity,
          setValue: (val) =>
            settingsStore.setState({ pngTuberSensitivity: val }),
        },
        {
          id: 'pngTuberChromaKeyEnabled',
          label: t('PNGTuberChromaKey', 'PNGTuber クロマキー'),
          type: 'toggle',
          disabled: () => settingsStore.getState().modelType !== 'pngtuber',
          getValue: () => settingsStore.getState().pngTuberChromaKeyEnabled,
          setValue: (val) =>
            settingsStore.setState({ pngTuberChromaKeyEnabled: val }),
        },
        {
          id: 'pngTuberChromaKeyColor',
          label: t('PNGTuberChromaKeyColor', 'クロマキー色 (Hex)'),
          type: 'text',
          placeholder: '#00ff00',
          disabled: () => {
            const s = settingsStore.getState()
            return s.modelType !== 'pngtuber' || !s.pngTuberChromaKeyEnabled
          },
          getValue: () => settingsStore.getState().pngTuberChromaKeyColor,
          setValue: (val) =>
            settingsStore.setState({ pngTuberChromaKeyColor: val }),
        },
        // キャラクター位置操作
        {
          id: 'fixCharacterPosition',
          label: t('FixPosition', '位置を固定する'),
          description: '現在のカメラ・モデルの位置を固定します',
          type: 'action',
          disabled: () => settingsStore.getState().modelType === 'pngtuber',
          onAction: () => handleCharacterPositionAction('fix'),
        },
        {
          id: 'unfixCharacterPosition',
          label: t('UnfixPosition', '位置固定を解除する'),
          description: 'カメラ・モデルの操作・移動を可能にします',
          type: 'action',
          disabled: () => settingsStore.getState().modelType === 'pngtuber',
          onAction: () => handleCharacterPositionAction('unfix'),
        },
        {
          id: 'resetCharacterPosition',
          label: t('ResetPosition', '位置をリセットする'),
          description: 'カメラ・モデルの位置をデフォルトに戻します',
          type: 'action',
          disabled: () => settingsStore.getState().modelType === 'pngtuber',
          onAction: () => handleCharacterPositionAction('reset'),
        },
        // VRMライティング強度
        {
          id: 'lightingIntensity',
          label: t('LightingIntensity', 'VRM ライティング強度'),
          type: 'slider',
          min: 0.1,
          max: 3.0,
          step: 0.1,
          disabled: () => settingsStore.getState().modelType !== 'vrm',
          getValue: () => settingsStore.getState().lightingIntensity,
          setValue: (val) => setLightingIntensityWithSync(val),
        },
        // 思考時ポーズ
        {
          id: 'thinkingPoseEnabled',
          label: t('ThinkingPose', '思考時ポーズ'),
          type: 'toggle',
          disabled: () => settingsStore.getState().modelType !== 'vrm',
          getValue: () => settingsStore.getState().thinkingPoseEnabled,
          setValue: (val) =>
            settingsStore.setState({ thinkingPoseEnabled: val }),
        },
        {
          id: 'thinkingPoseId',
          label: t('ThinkingPoseSelect', '思考時ポーズの種類'),
          type: 'select',
          disabled: () => {
            const s = settingsStore.getState()
            return s.modelType !== 'vrm' || !s.thinkingPoseEnabled
          },
          getValue: () => settingsStore.getState().thinkingPoseId,
          setValue: (val) => settingsStore.setState({ thinkingPoseId: val }),
          options: (settingsStore.getState().poseConfigs || []).map((pose) => ({
            label: pose.id,
            value: pose.id,
          })),
        },
        {
          id: 'poseAdjustMode',
          label: t('PoseAdjustMode', 'ポーズ調整モード'),
          type: 'toggle',
          disabled: () => settingsStore.getState().modelType !== 'vrm',
          getValue: () => settingsStore.getState().poseAdjustMode,
          setValue: (val) => settingsStore.setState({ poseAdjustMode: val }),
        },
        // プロンプト & プリセット
        {
          id: 'selectedPresetIndex',
          label: t('CharacterPreset', 'キャラクタープリセット選択'),
          type: 'select',
          getValue: () => settingsStore.getState().selectedPresetIndex,
          setValue: (val) => selectCharacterPresetWithSync(Number(val)),
          options: [0, 1, 2, 3, 4].map((idx) => {
            const state = settingsStore.getState()
            const names = [
              state.customPresetName1,
              state.customPresetName2,
              state.customPresetName3,
              state.customPresetName4,
              state.customPresetName5,
            ]
            return {
              label: names[idx] || `プリセット ${idx + 1}`,
              value: idx,
            }
          }),
        },
        {
          id: 'systemPrompt',
          label: t('CharacterSystemPrompt', 'システムプロンプト'),
          type: 'text',
          placeholder: 'キャラクターの性格・設定を入力',
          getValue: () => settingsStore.getState().systemPrompt,
          setValue: (val) => settingsStore.setState({ systemPrompt: val }),
        },
      ],
    },

    // ----------------------------------------------------
    // 5. streaming / continuity
    // ----------------------------------------------------
    {
      id: 'features',
      label: t('Features', '配信・連携設定'),
      items: [
        {
          id: 'youtubeMode',
          label: t('YoutubeMode', 'YouTube連携モード'),
          type: 'toggle',
          getValue: () => settingsStore.getState().youtubeMode,
          setValue: (val) => setYoutubeModeWithSync(val),
        },
        {
          id: 'youtubeLiveId',
          label: t('YoutubeLiveId', 'YouTube ライブID'),
          type: 'text',
          placeholder: '動画URLまたはID',
          getValue: () => settingsStore.getState().youtubeLiveId,
          setValue: (val) => settingsStore.setState({ youtubeLiveId: val }),
          disabled: () => !settingsStore.getState().youtubeMode,
        },
        {
          id: 'conversationContinuityMode',
          label: t('ContinuityMode', '会話継続モード'),
          type: 'toggle',
          disabled: () =>
            isConversationContinuityDisabled(settingsStore.getState()),
          getValue: () => settingsStore.getState().conversationContinuityMode,
          setValue: (val) =>
            settingsStore.setState({ conversationContinuityMode: val }),
        },
        {
          id: 'gameCommentaryEnabled',
          label: t('GameCommentary', 'ゲーム実況モード'),
          type: 'toggle',
          getValue: () => settingsStore.getState().gameCommentaryEnabled,
          setValue: (val) =>
            settingsStore.setState({ gameCommentaryEnabled: val }),
        },
        {
          id: 'slideMode',
          label: t('SlideMode', 'スライドプレゼン機能'),
          type: 'toggle',
          getValue: () => settingsStore.getState().slideMode,
          setValue: (val) => settingsStore.setState({ slideMode: val }),
        },
      ],
    },

    // ----------------------------------------------------
    // 6. automation / system
    // ----------------------------------------------------
    {
      id: 'system',
      label: t('System', '自動化・システム設定'),
      items: [
        {
          id: 'presenceDetectionEnabled',
          label: t('PresenceDetection', '人感検知モード (カメラ)'),
          type: 'toggle',
          getValue: () => settingsStore.getState().presenceDetectionEnabled,
          setValue: (val) =>
            settingsStore.setState({ presenceDetectionEnabled: val }),
        },
        {
          id: 'idleModeEnabled',
          label: t('IdleMode', 'アイドル自動発話モード'),
          type: 'toggle',
          disabled: () => isIdleModeDisabled(settingsStore.getState()),
          getValue: () => settingsStore.getState().idleModeEnabled,
          setValue: (val) => settingsStore.setState({ idleModeEnabled: val }),
        },
        {
          id: 'idleInterval',
          label: t('IdleInterval', 'アイドル発話間隔 (秒)'),
          type: 'slider',
          min: SETTINGS_SCHEMA.idleInterval.min,
          max: SETTINGS_SCHEMA.idleInterval.max,
          step: SETTINGS_SCHEMA.idleInterval.step,
          unit: SETTINGS_SCHEMA.idleInterval.unit,
          getValue: () => settingsStore.getState().idleInterval,
          setValue: (val) => settingsStore.setState({ idleInterval: val }),
          disabled: () => {
            const s = settingsStore.getState()
            return isIdleModeDisabled(s) || !s.idleModeEnabled
          },
        },
        {
          id: 'kioskModeEnabled',
          label: t('KioskMode', 'デモ端末 (キオスク) モード'),
          type: 'toggle',
          getValue: () => settingsStore.getState().kioskModeEnabled,
          setValue: (val) => setSafeKioskMode(val),
        },
        ...(options?.onOpenAdvanced
          ? [
              {
                id: 'openAdvancedSettings',
                label: t('OpenAdvancedSettings', '従来の詳細設定画面を開く'),
                description: 'すべての詳細設定タブを含むモーダルを表示します',
                type: 'action' as const,
                onAction: options.onOpenAdvanced,
              },
            ]
          : []),
        {
          id: 'resetSettings',
          label: t('ResetSettings', '全設定をデフォルトに初期化'),
          type: 'action',
          onAction: () => {
            if (window.confirm('すべての設定を初期化してもよろしいですか？')) {
              settingsStore.persist.clearStorage()
              window.location.reload()
            }
          },
        },
      ],
    },
  ]
}
