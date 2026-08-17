import { Talk } from './messages'
import { Language, VoiceLanguage } from '@/features/constants/settings'
import { synthesizeVoiceApi } from './synthesizeVoiceApi'

export async function synthesizeVoiceGoogleApi(
  talk: Talk,
  googleTtsType: string,
  selectLanguage: Language
) {
  const googleTtsTypeByLang = getGoogleTtsType(googleTtsType, selectLanguage)
  const languageCode = getVoiceLanguageCode(selectLanguage)

  return synthesizeVoiceApi(
    '/api/tts-google',
    { message: talk.message, ttsType: googleTtsTypeByLang, languageCode },
    'Google Text-to-Speech',
    {
      parseResponse: async (res) => {
        const data = await res.json()

        // Base64文字列をデコードしてArrayBufferに変換
        const binaryStr = atob(data.audio)
        const uint8Array = new Uint8Array(binaryStr.length)
        for (let i = 0; i < binaryStr.length; i++) {
          uint8Array[i] = binaryStr.charCodeAt(i)
        }
        return uint8Array.buffer as ArrayBuffer
      },
    }
  )
}

function getGoogleTtsType(
  googleTtsType: string,
  selectLanguage: Language
): string {
  if (googleTtsType && googleTtsType.trim()) return googleTtsType

  switch (selectLanguage) {
    case 'ja':
      return 'ja-JP-Standard-B'
    case 'en':
      return 'en-US-Neural2-F'
    default:
      return 'en-US-Neural2-F'
  }
}

function getVoiceLanguageCode(selectLanguage: Language): VoiceLanguage {
  switch (selectLanguage) {
    case 'ja':
      return 'ja-JP'
    case 'en':
      return 'en-US'
    default:
      return 'en-US'
  }
}
