import type { SettingsState } from './settings'

/**
 * 設定画面の各項目が無効（disabled）になる条件を一元管理するガード関数
 * 従来設定コンポーネントおよびクイック設定（settingCategories）で共通参照
 */

// 音声合成関連が無効化される条件（Realtime APIまたはAudio Mode有効時）
export const isVoiceAdjustmentDisabled = (state: SettingsState): boolean =>
  state.realtimeAPIMode || state.audioMode

// 音声認識方式の切り替えが無効化される条件
export const isSpeechRecognitionSwitchDisabled = (
  state: SettingsState
): boolean => state.realtimeAPIMode || state.audioMode

// 音声タイムアウトが無効化される条件（Whisper使用時やRealtime API時）
export const isSpeechTimeoutDisabled = (state: SettingsState): boolean =>
  state.realtimeAPIMode || state.speechRecognitionMode === 'whisper'

// 会話継続モードが無効化される条件
export const isConversationContinuityDisabled = (
  state: SettingsState
): boolean =>
  state.slideMode ||
  state.externalLinkageMode ||
  state.selectAIService === 'dify'

// アイドル自動発話が無効化される条件
export const isIdleModeDisabled = (state: SettingsState): boolean =>
  state.realtimeAPIMode ||
  state.audioMode ||
  state.externalLinkageMode ||
  state.slideMode ||
  state.gameCommentaryEnabled

// VOICEVOX専用調整項目（話速・音高など）が無効化される条件
export const isVoicevoxAdjustmentDisabled = (state: SettingsState): boolean =>
  isVoiceAdjustmentDisabled(state) || state.selectVoice !== 'voicevox'
