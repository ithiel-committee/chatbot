import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import { Link } from '../../link'
import { settingsControlClass } from '@/components/settings/formStyles'

interface GoogleTTSSettingsProps {
  googleTtsType: string
}

export const GoogleTTSSettings = ({
  googleTtsType,
}: GoogleTTSSettingsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('GoogleTTSInfo')}
        {t('AuthFileInstruction')}
        <br />
        <Link
          url="https://developers.google.com/workspace/guides/create-credentials?#create_credentials_for_a_service_account"
          label="https://developers.google.com/workspace/guides/create-credentials?#create_credentials_for_a_service_account"
        />
        <br />
        <br />
        {t('LanguageModelURL')}
        <br />
        <Link
          url="https://cloud.google.com/text-to-speech/docs/voices"
          label="https://cloud.google.com/text-to-speech/docs/voices"
        />
      </div>
      <div className="mt-4 font-bold">{t('LanguageChoice')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.medium}
          type="text"
          placeholder="..."
          value={googleTtsType}
          onChange={(e) =>
            settingsStore.setState({ googleTtsType: e.target.value })
          }
        />
      </div>
    </>
  )
}
