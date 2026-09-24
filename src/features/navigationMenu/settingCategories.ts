import { MenuCategory } from '@/types/navigationMenu'
import settingsStore, { ChatLogMode } from '@/features/stores/settings'
import menuStore from '@/features/stores/menu'
import { languageOptions } from '@/components/settings/languageOptions'
import { AI_SERVICES, AIService, AIVoice } from '@/features/constants/settings'
import { defaultModels } from '@/features/constants/aiModels'
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
          options: [
            { label: '通常 (Normal)', value: 'normal' },
            { label: '左右反転 (Horizontal Flip)', value: 'flip-h' },
            { label: '上下反転 (Vertical Flip)', value: 'flip-v' },
            { label: '上下左右反転 (180° Rotate)', value: 'flip-hv' },
          ],
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
          options: [
            { label: '非表示 (hidden)', value: 'hidden' },
            { label: 'アシスタントのみ (assistant)', value: 'assistant' },
            { label: 'チャットログ (chat-log)', value: 'chat-log' },
          ],
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
            settingsStore.setState({ settingsToggleShortcut: val }),
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
          setValue: (val) => {
            const service = val as AIService
            settingsStore.setState({
              selectAIService: service,
              selectAIModel: defaultModels[service] || '',
            })
          },
          options: AI_SERVICES.map((srv) => ({ label: srv, value: srv })),
        },
        {
          id: 'selectAIModel',
          label: t('AIModel', 'モデル名'),
          type: 'text',
          placeholder: '例: gpt-5.6-sol',
          getValue: () => settingsStore.getState().selectAIModel,
          setValue: (val) => settingsStore.setState({ selectAIModel: val }),
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
              cohere: st.cohereKey,
              mistralai: st.mistralaiKey,
              perplexity: st.perplexityKey,
              fireworks: st.fireworksKey,
              deepseek: st.deepseekKey,
              openrouter: st.openrouterKey,
              xai: st.xaiKey,
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
              cohere: 'cohereKey',
              mistralai: 'mistralaiKey',
              perplexity: 'perplexityKey',
              fireworks: 'fireworksKey',
              deepseek: 'deepseekKey',
              openrouter: 'openrouterKey',
              xai: 'xaiKey',
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
          min: 100,
          max: 4096,
          step: 50,
          getValue: () => settingsStore.getState().maxTokens,
          setValue: (val) => settingsStore.setState({ maxTokens: val }),
        },
        {
          id: 'maxPastMessages',
          label: t('MaxPastMessages', '過去メッセージ参照件数'),
          type: 'slider',
          min: 0,
          max: 30,
          step: 1,
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
          getValue: () => settingsStore.getState().selectVoice,
          setValue: (val) =>
            settingsStore.setState({ selectVoice: val as AIVoice }),
          options: [
            { label: 'VOICEVOX', value: 'voicevox' },
            { label: 'AivisSpeech', value: 'aivis_speech' },
            { label: 'Aivis Cloud API', value: 'aivis_cloud_api' },
            { label: 'Google TTS', value: 'google' },
            { label: 'OpenAI TTS', value: 'openai' },
            { label: 'Azure OpenAI TTS', value: 'azure' },
            { label: 'ElevenLabs', value: 'elevenlabs' },
            { label: 'Cartesia', value: 'cartesia' },
            { label: 'Style-Bert-VITS2', value: 'stylebertvits2' },
            { label: 'Koeiromap', value: 'koeiromap' },
          ],
        },
        {
          id: 'voicevoxSpeaker',
          label: t('VoicevoxSpeaker', 'VOICEVOX 話者ID'),
          type: 'text',
          placeholder: '例: 3 (ずんだもん)',
          getValue: () => settingsStore.getState().voicevoxSpeaker,
          setValue: (val) => settingsStore.setState({ voicevoxSpeaker: val }),
          disabled: () => settingsStore.getState().selectVoice !== 'voicevox',
        },
        {
          id: 'voicevoxSpeed',
          label: t('VoiceSpeed', '話速 (Speed)'),
          type: 'slider',
          min: 0.5,
          max: 2.0,
          step: 0.1,
          getValue: () => settingsStore.getState().voicevoxSpeed,
          setValue: (val) => settingsStore.setState({ voicevoxSpeed: val }),
        },
        {
          id: 'voicevoxPitch',
          label: t('VoicePitch', '音高 (Pitch)'),
          type: 'slider',
          min: -0.15,
          max: 0.15,
          step: 0.01,
          getValue: () => settingsStore.getState().voicevoxPitch,
          setValue: (val) => settingsStore.setState({ voicevoxPitch: val }),
        },
        {
          id: 'speechRecognitionMode',
          label: t('STTMode', '音声認識モード'),
          type: 'select',
          getValue: () => settingsStore.getState().speechRecognitionMode,
          setValue: (val) =>
            settingsStore.setState({ speechRecognitionMode: val as any }),
          options: [
            { label: 'ブラウザ標準 (Web Speech API)', value: 'browser' },
            { label: 'OpenAI Whisper API', value: 'whisper' },
            {
              label: 'リアルタイム文字起こし (Live Transcription)',
              value: 'live-transcription',
            },
          ],
        },
        {
          id: 'initialSpeechTimeout',
          label: t('SpeechTimeout', '音声検出タイムアウト (ms)'),
          type: 'slider',
          min: 1000,
          max: 10000,
          step: 500,
          unit: 'ms',
          getValue: () => settingsStore.getState().initialSpeechTimeout,
          setValue: (val) =>
            settingsStore.setState({ initialSpeechTimeout: val }),
        },
      ],
    },

    // ----------------------------------------------------
    // 4. character settings
    // ----------------------------------------------------
    {
      id: 'character',
      label: t('CharacterSettings', 'キャラクター'),
      items: [
        {
          id: 'modelType',
          label: t('ModelType', 'モデルタイプ'),
          type: 'select',
          getValue: () => settingsStore.getState().modelType,
          setValue: (val) => settingsStore.setState({ modelType: val as any }),
          options: [
            { label: 'VRM (3D)', value: 'vrm' },
            { label: 'Live2D (2D)', value: 'live2d' },
            { label: 'PNGTuber', value: 'pngtuber' },
          ],
        },
        {
          id: 'characterName',
          label: t('CharacterName', 'キャラクター名'),
          type: 'text',
          placeholder: 'キャラクターの名前',
          getValue: () => settingsStore.getState().characterName,
          setValue: (val) => settingsStore.setState({ characterName: val }),
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
          id: 'openVrmPicker',
          label: t('LoadVRM', 'VRMファイルを選択'),
          type: 'action',
          onAction: () => {
            const input = menuStore.getState().fileInput
            if (input) input.click()
          },
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
          setValue: (val) => settingsStore.setState({ youtubeMode: val }),
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
          getValue: () => settingsStore.getState().idleModeEnabled,
          setValue: (val) => settingsStore.setState({ idleModeEnabled: val }),
        },
        {
          id: 'idleInterval',
          label: t('IdleInterval', 'アイドル発話間隔 (秒)'),
          type: 'slider',
          min: 10,
          max: 300,
          step: 5,
          unit: '秒',
          getValue: () => settingsStore.getState().idleInterval,
          setValue: (val) => settingsStore.setState({ idleInterval: val }),
          disabled: () => !settingsStore.getState().idleModeEnabled,
        },
        {
          id: 'kioskModeEnabled',
          label: t('KioskMode', 'デモ端末 (キオスク) モード'),
          type: 'toggle',
          getValue: () => settingsStore.getState().kioskModeEnabled,
          setValue: (val) => settingsStore.setState({ kioskModeEnabled: val }),
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
