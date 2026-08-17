import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import { Link } from '../../link'
import { settingsControlClass } from '@/components/settings/formStyles'

interface ElevenLabsSettingsProps {
  elevenlabsApiKey: string
  elevenlabsVoiceId: string
}

export const ElevenLabsSettings = ({
  elevenlabsApiKey,
  elevenlabsVoiceId,
}: ElevenLabsSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('ElevenLabsInfo')}
        <br />
        <Link
          url="https://elevenlabs.io/api"
          label="https://elevenlabs.io/api"
        />
        <br />
      </div>
      <div className="mt-4 font-bold">{t('ElevenLabsApiKey')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={elevenlabsApiKey}
          onChange={(e) =>
            settingsStore.setState({
              elevenlabsApiKey: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('ElevenLabsVoiceId')}</div>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('ElevenLabsVoiceIdInfo')}
        <br />
        <Link
          url="https://api.elevenlabs.io/v1/voices"
          label="https://api.elevenlabs.io/v1/voices"
        />
        <br />
      </div>
      <div className="mt-2">
        <input
          className={settingsControlClass.medium}
          type="text"
          placeholder="..."
          value={elevenlabsVoiceId}
          onChange={(e) =>
            settingsStore.setState({
              elevenlabsVoiceId: e.target.value,
            })
          }
        />
      </div>
    </>
  )
}
