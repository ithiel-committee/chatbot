import { VoiceLanguage } from '@/features/constants/settings'

// 言語コードから音声認識用の言語コードに変換する関数
export const getVoiceLanguageCode = (selectLanguage: string): VoiceLanguage => {
  switch (selectLanguage) {
    case 'ja':
      return 'ja-JP'
    case 'en':
      return 'en-US'
    default:
      return 'ja-JP'
  }
}
