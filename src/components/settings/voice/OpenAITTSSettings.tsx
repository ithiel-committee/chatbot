import { useTranslation } from 'react-i18next'

import { getOpenAITTSModels } from '@/features/constants/aiModels'
import { OpenAITTSModel, OpenAITTSVoice } from '@/features/constants/settings'
import settingsStore from '@/features/stores/settings'
import { settingsControlClass } from '@/components/settings/formStyles'

interface OpenAITTSSettingsProps {
  openaiAPIKey: string
  openaiTTSVoice: OpenAITTSVoice
  openaiTTSModel: OpenAITTSModel
  openaiTTSSpeed: number
}

export const OpenAITTSSettings = ({
  openaiAPIKey,
  openaiTTSVoice,
  openaiTTSModel,
  openaiTTSSpeed,
}: OpenAITTSSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('OpenAITTSInfo')}
      </div>
      <div className="mt-4 font-bold">{t('OpenAIAPIKeyLabel')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={openaiAPIKey}
          onChange={(e) =>
            settingsStore.setState({
              openaiKey: e.target.value,
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
          <option value="ash">ash</option>
          <option value="ballad">ballad</option>
          <option value="coral">coral</option>
          <option value="echo">echo</option>
          <option value="fable">fable</option>
          <option value="onyx">onyx</option>
          <option value="nova">nova</option>
          <option value="sage">sage</option>
          <option value="shimmer">shimmer</option>
        </select>
      </div>
      <div className="mt-4 font-bold">{t('OpenAITTSModel')}</div>
      <div className="mt-2">
        <select
          value={openaiTTSModel}
          onChange={(e) =>
            settingsStore.setState({
              openaiTTSModel: e.target.value as OpenAITTSModel,
            })
          }
          className={settingsControlClass.medium}
        >
          {getOpenAITTSModels().map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
      </div>
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
