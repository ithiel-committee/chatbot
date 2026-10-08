import { AIVoice, AIService } from './settings'

export interface NumberRangeConfig {
  min: number
  max: number
  step: number
  default: number
  unit?: string
}

export interface SelectOption<T = string> {
  label: string
  value: T
  description?: string
}

/**
 * 設定項目のメタデータ（SSOT: 単一情報源）
 * 従来設定・クイック設定・かんたん設定で共通参照される範囲や選択肢の定義
 */
export const SETTINGS_SCHEMA = {
  // 音声検出タイムアウト（秒）
  initialSpeechTimeout: {
    min: 0,
    max: 60,
    step: 0.5,
    default: 5.0,
    unit: '秒',
  } satisfies NumberRangeConfig,

  // 過去メッセージ参照件数
  maxPastMessages: {
    min: 0,
    max: 50, // スライダーの推奨最大値
    systemMax: 9999, // 数値入力の上限
    step: 1,
    default: 10,
  },

  // 最大トークン数
  maxTokens: {
    min: 100,
    max: 16384,
    step: 50,
    default: 1000,
  } satisfies NumberRangeConfig,

  // アイドル発話間隔（秒）
  idleInterval: {
    min: 10,
    max: 300,
    step: 5,
    default: 30,
    unit: '秒',
  } satisfies NumberRangeConfig,

  // 音声合成エンジン選択肢（'none' を含む完全版）
  voiceOptions: [
    { label: '音声なし (none)', value: 'none' },
    { label: 'VOICEVOX', value: 'voicevox' },
    { label: 'AivisSpeech', value: 'aivis_speech' },
    { label: 'Aivis Cloud API', value: 'aivis_cloud_api' },
    { label: 'Google TTS', value: 'google' },
    { label: 'OpenAI TTS', value: 'openai' },
    { label: 'Style-Bert-VITS2', value: 'stylebertvits2' },
    { label: 'Koeiromap', value: 'koeiromap' },
  ] as const satisfies readonly SelectOption<AIVoice>[],

  // 画面の向き・反転選択肢
  screenOrientationOptions: [
    { label: '通常 (Normal)', value: 'normal' },
    { label: '左右反転 (Horizontal Flip)', value: 'flip-h' },
    { label: '上下反転 (Vertical Flip)', value: 'flip-v' },
    { label: '上下左右反転 (180° Rotate)', value: 'flip-hv' },
  ] as const,

  // 会話ログ表示モード
  chatLogModeOptions: [
    { label: '非表示 (hidden)', value: 'hidden' },
    { label: 'アシスタントのみ (assistant)', value: 'assistant' },
    { label: 'チャットログ (chat-log)', value: 'chat-log' },
  ] as const,

  // 音声認識モード
  speechRecognitionModeOptions: [
    { label: 'ブラウザ標準 (Web Speech API)', value: 'browser' },
    { label: 'OpenAI Whisper API', value: 'whisper' },
    {
      label: 'リアルタイム文字起こし (Live Transcription)',
      value: 'live-transcription',
    },
  ] as const,

  // キャラクターモデルタイプ
  modelTypeOptions: [
    { label: 'VRM (3D)', value: 'vrm' },
    { label: 'Live2D (2D)', value: 'live2d' },
    { label: '動くPNGTuber', value: 'pngtuber' },
  ] as const,
} as const
