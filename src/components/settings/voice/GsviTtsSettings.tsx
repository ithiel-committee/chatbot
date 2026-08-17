import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import { settingsControlClass } from '@/components/settings/formStyles'

interface GsviTtsSettingsProps {
  gsviTtsServerUrl: string
  gsviTtsModelId: string
  gsviTtsBatchSize: number
  gsviTtsSpeechRate: number
}

export const GsviTtsSettings = ({
  gsviTtsServerUrl,
  gsviTtsModelId,
  gsviTtsBatchSize,
  gsviTtsSpeechRate,
}: GsviTtsSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">{t('GSVITTSInfo')}</div>
      <div className="mt-4 font-bold">{t('GSVITTSServerUrl')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="http://127.0.0.1:5000/tts"
          value={gsviTtsServerUrl}
          onChange={(e) =>
            settingsStore.setState({
              gsviTtsServerUrl: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('GSVITTSModelID')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.medium}
          type="text"
          placeholder="..."
          value={gsviTtsModelId}
          onChange={(e) =>
            settingsStore.setState({ gsviTtsModelId: e.target.value })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('GSVITTSBatchSize')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.numeric}
          type="number"
          step="1"
          placeholder="..."
          value={gsviTtsBatchSize}
          onChange={(e) =>
            settingsStore.setState({
              gsviTtsBatchSize: parseFloat(e.target.value),
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('GSVITTSSpeechRate')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.numeric}
          type="number"
          step="0.1"
          placeholder="..."
          value={gsviTtsSpeechRate}
          onChange={(e) =>
            settingsStore.setState({
              gsviTtsSpeechRate: parseFloat(e.target.value),
            })
          }
        />
      </div>
    </>
  )
}
