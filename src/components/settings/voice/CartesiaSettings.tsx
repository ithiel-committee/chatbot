import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import { Link } from '../../link'
import { settingsControlClass } from '@/components/settings/formStyles'

interface CartesiaSettingsProps {
  cartesiaApiKey: string
  cartesiaVoiceId: string
}

export const CartesiaSettings = ({
  cartesiaApiKey,
  cartesiaVoiceId,
}: CartesiaSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('CartesiaInfo')}
        <br />
        <Link
          url="https://docs.cartesia.ai/api-reference/tts/bytes"
          label="https://docs.cartesia.ai/api-reference/tts/bytes"
        />
        <br />
      </div>
      <div className="mt-4 font-bold">{t('CartesiaApiKey')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="..."
          value={cartesiaApiKey}
          onChange={(e) =>
            settingsStore.setState({
              cartesiaApiKey: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('CartesiaVoiceId')}</div>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('CartesiaVoiceIdInfo')}
        <br />
        <Link
          url="https://docs.cartesia.ai/api-reference/voices/list"
          label="https://docs.cartesia.ai/api-reference/voices/list"
        />
        <br />
      </div>
      <div className="mt-2">
        <input
          className={settingsControlClass.medium}
          type="text"
          placeholder="..."
          value={cartesiaVoiceId}
          onChange={(e) =>
            settingsStore.setState({
              cartesiaVoiceId: e.target.value,
            })
          }
        />
      </div>
    </>
  )
}
