import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import {
  GEMINI_TTS_MODEL,
  GEMINI_TTS_PACES,
  GeminiTtsPace,
} from '@/features/constants/geminiTts'
import { settingsControlClass } from '@/components/settings/formStyles'

export const GeminiTTSSettings = () => {
  const { t } = useTranslation()
  const apiKey = settingsStore((s) => s.geminiTtsApiKey)
  const voice = settingsStore((s) => s.geminiTtsVoice)
  const style = settingsStore((s) => s.geminiTtsStyle)
  const pace = settingsStore((s) => s.geminiTtsPace)

  return (
    <>
      <p className="my-2 text-sm whitespace-pre-wrap">{t('GeminiTTSInfo')}</p>
      <p className="my-2 text-sm">{GEMINI_TTS_MODEL}</p>
      <label className="block mt-4 font-bold" htmlFor="gemini-tts-key">
        {t('GeminiTTSAPIKey')}
      </label>
      <input
        id="gemini-tts-key"
        type="password"
        autoComplete="off"
        className={`${settingsControlClass.long} mt-2 max-w-full`}
        value={apiKey}
        onChange={(e) =>
          settingsStore.setState({ geminiTtsApiKey: e.target.value })
        }
        aria-describedby="gemini-tts-key-help"
      />
      <p id="gemini-tts-key-help" className="mt-2 text-sm">
        {t('GeminiTTSAPIKeyHelp')}
      </p>
      <label className="block mt-4 font-bold" htmlFor="gemini-tts-voice">
        {t('GeminiTTSVoice')}
      </label>
      <input
        id="gemini-tts-voice"
        type="text"
        className={`${settingsControlClass.medium} mt-2`}
        value={voice}
        onChange={(e) =>
          settingsStore.setState({ geminiTtsVoice: e.target.value })
        }
        aria-describedby="gemini-tts-voice-help"
      />
      <p id="gemini-tts-voice-help" className="mt-2 text-sm">
        {t('GeminiTTSVoiceHelp')}
      </p>
      <label className="block mt-4 font-bold" htmlFor="gemini-tts-pace">
        {t('GeminiTTSPace')}
      </label>
      <select
        id="gemini-tts-pace"
        className={`${settingsControlClass.medium} mt-2 max-w-full`}
        value={pace}
        onChange={(e) =>
          settingsStore.setState({
            geminiTtsPace: e.target.value as GeminiTtsPace,
          })
        }
        aria-describedby="gemini-tts-pace-help"
      >
        {GEMINI_TTS_PACES.map((pace) => (
          <option key={pace} value={pace}>
            {t(`GeminiTTSPace_${pace}`)}
          </option>
        ))}
      </select>
      <p id="gemini-tts-pace-help" className="mt-2 text-sm">
        {t('GeminiTTSPaceHelp')}
      </p>
      <label className="block mt-4 font-bold" htmlFor="gemini-tts-style">
        {t('GeminiTTSStyle')}
      </label>
      <textarea
        id="gemini-tts-style"
        rows={3}
        className={`${settingsControlClass.full} mt-2`}
        value={style}
        onChange={(e) =>
          settingsStore.setState({ geminiTtsStyle: e.target.value })
        }
        aria-describedby="gemini-tts-style-help"
      />
      <p id="gemini-tts-style-help" className="mt-2 text-sm">
        {t('GeminiTTSStyleHelp')}
      </p>
    </>
  )
}
