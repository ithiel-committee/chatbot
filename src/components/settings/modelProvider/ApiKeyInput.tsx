import { useTranslation } from 'react-i18next'
import { Link } from '../../link'
import { settingsControlClass } from '@/components/settings/formStyles'

interface ApiKeyInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  linkUrl?: string
  linkLabel?: string
  description?: string
}

export const ApiKeyInput = ({
  label,
  value,
  onChange,
  placeholder = '...',
  linkUrl,
  linkLabel,
  description,
}: ApiKeyInputProps) => {
  const { t } = useTranslation()

  return (
    <div className="my-6">
      <div className="my-4 text-xl font-bold">{label}</div>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {description || t('APIKeyInstruction')}
        {linkUrl && linkLabel && (
          <>
            <br />
            <Link url={linkUrl} label={linkLabel} />
          </>
        )}
      </div>
      <input
        className={settingsControlClass.long}
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
