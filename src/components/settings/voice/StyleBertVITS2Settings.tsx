import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import { Link } from '../../link'
import { settingsControlClass } from '@/components/settings/formStyles'

interface StyleBertVITS2SettingsProps {
  stylebertvits2ServerUrl: string
  stylebertvits2ApiKey: string
  stylebertvits2ModelId: string
  stylebertvits2Style: string
  stylebertvits2SdpRatio: number
  stylebertvits2Length: number
}

export const StyleBertVITS2Settings = ({
  stylebertvits2ServerUrl,
  stylebertvits2ApiKey,
  stylebertvits2ModelId,
  stylebertvits2Style,
  stylebertvits2SdpRatio,
  stylebertvits2Length,
}: StyleBertVITS2SettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('StyleBertVITS2Info')}
        <br />
        <Link
          url="https://github.com/litagin02/Style-Bert-VITS2"
          label="https://github.com/litagin02/Style-Bert-VITS2"
        />
        <br />
        <br />
      </div>
      <div className="mt-4 font-bold">{t('StyleBeatVITS2ServerURL')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={stylebertvits2ServerUrl}
          onChange={(e) =>
            settingsStore.setState({
              stylebertvits2ServerUrl: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('StyleBeatVITS2ApiKey')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={stylebertvits2ApiKey}
          onChange={(e) =>
            settingsStore.setState({
              stylebertvits2ApiKey: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('StyleBeatVITS2ModelID')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.numeric}
          type="number"
          placeholder="..."
          value={stylebertvits2ModelId}
          onChange={(e) =>
            settingsStore.setState({
              stylebertvits2ModelId: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('StyleBeatVITS2Style')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.medium}
          type="text"
          placeholder="..."
          value={stylebertvits2Style}
          onChange={(e) =>
            settingsStore.setState({
              stylebertvits2Style: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">
        {t('StyleBeatVITS2SdpRatio')}: {stylebertvits2SdpRatio}
      </div>
      <input
        type="range"
        min={0.0}
        max={1.0}
        step={0.01}
        value={stylebertvits2SdpRatio}
        className="mt-2 mb-4 input-range"
        onChange={(e) => {
          settingsStore.setState({
            stylebertvits2SdpRatio: Number(e.target.value),
          })
        }}
      ></input>
      <div className="mt-4 font-bold">
        {t('StyleBeatVITS2Length')}: {stylebertvits2Length}
      </div>
      <input
        type="range"
        min={0.0}
        max={2.0}
        step={0.01}
        value={stylebertvits2Length}
        className="mt-2 mb-4 input-range"
        onChange={(e) => {
          settingsStore.setState({
            stylebertvits2Length: Number(e.target.value),
          })
        }}
      ></input>
    </>
  )
}
