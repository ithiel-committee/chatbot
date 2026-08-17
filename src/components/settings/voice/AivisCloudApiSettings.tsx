import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import { Link } from '../../link'
import { settingsControlClass } from '@/components/settings/formStyles'

interface AivisCloudApiSettingsProps {
  aivisCloudApiKey: string
  aivisCloudModelUuid: string
  aivisCloudUseStyleName: boolean
  aivisCloudStyleName: string
  aivisCloudStyleId: number
  aivisCloudSpeed: number
  aivisCloudPitch: number
  aivisCloudTempoDynamics: number
  aivisCloudIntonationScale: number
  aivisCloudPrePhonemeLength: number
  aivisCloudPostPhonemeLength: number
}

export const AivisCloudApiSettings = ({
  aivisCloudApiKey,
  aivisCloudModelUuid,
  aivisCloudUseStyleName,
  aivisCloudStyleName,
  aivisCloudStyleId,
  aivisCloudSpeed,
  aivisCloudPitch,
  aivisCloudTempoDynamics,
  aivisCloudIntonationScale,
  aivisCloudPrePhonemeLength,
  aivisCloudPostPhonemeLength,
}: AivisCloudApiSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('AivisCloudAPIInfo')}
        <br />
        <Link
          url="https://hub.aivis-project.com/cloud-api/"
          label={t('AivisCloudAPIDashboard')}
        />
      </div>
      <div className="mt-4 font-bold">{t('APIKey')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="password"
          placeholder="Aivis Cloud API Key"
          value={aivisCloudApiKey}
          onChange={(e) =>
            settingsStore.setState({
              aivisCloudApiKey: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('ModelUUID')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.medium}
          type="text"
          placeholder="a59cb814-..."
          value={aivisCloudModelUuid}
          onChange={(e) =>
            settingsStore.setState({
              aivisCloudModelUuid: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 p-4 border rounded-lg bg-gray-50">
        <label className="flex items-center space-x-2 mb-4">
          <input
            type="checkbox"
            checked={aivisCloudUseStyleName}
            onChange={(e) =>
              settingsStore.setState({
                aivisCloudUseStyleName: e.target.checked,
              })
            }
            className="w-4 h-4"
          />
          <span className="font-medium">{t('UseStyleName')}</span>
        </label>
        <div className="text-sm text-gray-600 mb-4">
          {t('StyleSelectionDescription')}
        </div>

        {aivisCloudUseStyleName ? (
          <>
            <div className="font-bold">{t('StyleName')}</div>
            <div className="mt-2">
              <input
                className={settingsControlClass.compact}
                type="text"
                maxLength={20}
                placeholder={t('StyleNamePlaceholder')}
                value={aivisCloudStyleName}
                onChange={(e) =>
                  settingsStore.setState({
                    aivisCloudStyleName: e.target.value,
                  })
                }
              />
            </div>
          </>
        ) : (
          <>
            <div className="font-bold">{t('StyleID')}</div>
            <div className="mt-2">
              <input
                className={settingsControlClass.numeric}
                type="number"
                min="0"
                max="31"
                value={aivisCloudStyleId}
                onChange={(e) =>
                  settingsStore.setState({
                    aivisCloudStyleId: Number(e.target.value),
                  })
                }
              />
            </div>
          </>
        )}
      </div>
      <div className="mt-6 font-bold">
        <div className="select-none">
          {t('SpeechSpeed')}: {aivisCloudSpeed}
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.01}
          value={aivisCloudSpeed}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisCloudSpeed: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('Pitch')}: {aivisCloudPitch}
        </div>
        <input
          type="range"
          min={-1.0}
          max={1.0}
          step={0.01}
          value={aivisCloudPitch}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisCloudPitch: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('TempoDynamics')}: {aivisCloudTempoDynamics}
        </div>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.01}
          value={aivisCloudTempoDynamics}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisCloudTempoDynamics: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('EmotionalIntensity')}: {aivisCloudIntonationScale}
        </div>
        <input
          type="range"
          min={0.0}
          max={2.0}
          step={0.01}
          value={aivisCloudIntonationScale}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisCloudIntonationScale: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('PreSilenceDuration')}: {aivisCloudPrePhonemeLength}{' '}
        </div>
        <input
          type="range"
          min={0.0}
          max={1.0}
          step={0.01}
          value={aivisCloudPrePhonemeLength}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisCloudPrePhonemeLength: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('PostSilenceDuration')}: {aivisCloudPostPhonemeLength}{' '}
        </div>
        <input
          type="range"
          min={0.0}
          max={1.0}
          step={0.01}
          value={aivisCloudPostPhonemeLength}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisCloudPostPhonemeLength: Number(e.target.value),
            })
          }}
        />
      </div>
    </>
  )
}
