import { useTranslation } from 'react-i18next'

import { OpenAITTSVoice } from '@/features/constants/settings'
import settingsStore from '@/features/stores/settings'
import { settingsControlClass } from '@/components/settings/formStyles'

interface AzureTTSSettingsProps {
  azureTTSKey: string
  azureTTSEndpoint: string
  openaiTTSVoice: OpenAITTSVoice
  openaiTTSSpeed: number
}

export const AzureTTSSettings = ({
  azureTTSKey,
  azureTTSEndpoint,
  openaiTTSVoice,
  openaiTTSSpeed,
}: AzureTTSSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('AzureTTSInfo')}
      </div>
      <div className="mt-4 font-bold">{t('AzureAPIKeyLabel')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={azureTTSKey}
          onChange={(e) =>
            settingsStore.setState({
              azureTTSKey: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('AzureEndpoint')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={azureTTSEndpoint}
          onChange={(e) =>
            settingsStore.setState({
              azureTTSEndpoint: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('OpenAITTSVoice')}</div>
      <div className="mt-2">
        <select
          value={openaiTTSVoice}
          onChange={(e) =>
            settingsStore.setState({
              openaiTTSVoice: e.target.value as OpenAITTSVoice,
            })
          }
          className={settingsControlClass.compact}
        >
          <option value="alloy">alloy</option>
          <option value="echo">echo</option>
          <option value="fable">fable</option>
          <option value="onyx">onyx</option>
          <option value="nova">nova</option>
          <option value="shimmer">shimmer</option>
        </select>
      </div>
      <div className="mt-4 font-bold">{t('OpenAITTSModel')}</div>
      <div className="mt-4 font-bold">
        {t('OpenAITTSSpeed')}: {openaiTTSSpeed}
      </div>
      <input
        type="range"
        min={0.25}
        max={4.0}
        step={0.01}
        value={openaiTTSSpeed}
        className="mt-2 mb-4 input-range"
        onChange={(e) => {
          settingsStore.setState({
            openaiTTSSpeed: Number(e.target.value),
          })
        }}
      />
    </>
  )
}
