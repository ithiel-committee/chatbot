import { useTranslation } from 'react-i18next'

import {
  PRESET_A,
  PRESET_B,
  PRESET_C,
  PRESET_D,
} from '@/features/constants/koeiroParam'
import settingsStore, { SettingsState } from '@/features/stores/settings'
import { Link } from '../../link'
import { TextButton } from '../../textButton'
import { settingsControlClass } from '@/components/settings/formStyles'

interface KoeiromapSettingsProps {
  koeiromapKey: string
  koeiroParam: SettingsState['koeiroParam']
}

export const KoeiromapSettings = ({
  koeiromapKey,
  koeiroParam,
}: KoeiromapSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('KoeiromapInfo')}
        <br />
        <Link
          url="https://koemotion.rinna.co.jp"
          label="https://koemotion.rinna.co.jp"
        />
      </div>
      <div className="mt-4 font-bold">{t('APIKey')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={koeiromapKey}
          onChange={(e) =>
            settingsStore.setState({ koeiromapKey: e.target.value })
          }
        />
      </div>

      <div className="mt-4 font-bold">{t('Preset')}</div>
      <div className="my-2 grid grid-cols-2 gap-[8px]">
        <TextButton
          onClick={() =>
            settingsStore.setState({
              koeiroParam: {
                speakerX: PRESET_A.speakerX,
                speakerY: PRESET_A.speakerY,
              },
            })
          }
        >
          {t('Cute')}
        </TextButton>
        <TextButton
          onClick={() =>
            settingsStore.setState({
              koeiroParam: {
                speakerX: PRESET_B.speakerX,
                speakerY: PRESET_B.speakerY,
              },
            })
          }
        >
          {t('Energetic')}
        </TextButton>
        <TextButton
          onClick={() =>
            settingsStore.setState({
              koeiroParam: {
                speakerX: PRESET_C.speakerX,
                speakerY: PRESET_C.speakerY,
              },
            })
          }
        >
          {t('Cool')}
        </TextButton>
        <TextButton
          onClick={() =>
            settingsStore.setState({
              koeiroParam: {
                speakerX: PRESET_D.speakerX,
                speakerY: PRESET_D.speakerY,
              },
            })
          }
        >
          {t('Mature')}
        </TextButton>
      </div>
      <div className="mt-6">
        <div className="select-none">x : {koeiroParam.speakerX}</div>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.001}
          value={koeiroParam.speakerX}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              koeiroParam: {
                speakerX: Number(e.target.value),
                speakerY: koeiroParam.speakerY,
              },
            })
          }}
        ></input>
        <div className="select-none">y : {koeiroParam.speakerY}</div>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.001}
          value={koeiroParam.speakerY}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              koeiroParam: {
                speakerX: koeiroParam.speakerX,
                speakerY: Number(e.target.value),
              },
            })
          }}
        ></input>
      </div>
    </>
  )
}
