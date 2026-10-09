import { logger } from '@/lib/logger'
import i18n from 'i18next'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { Link } from './link'
import { isLanguageSupported } from '@/features/constants/settings'

export const Introduction = () => {
  const showIntroduction = homeStore((s) => s.showIntroduction)
  const selectLanguage = settingsStore((s) => s.selectLanguage)

  const [displayIntroduction, setDisplayIntroduction] = useState(false)
  const [opened, setOpened] = useState(true)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const { t } = useTranslation()

  useEffect(() => {
    setDisplayIntroduction(homeStore.getState().showIntroduction)
  }, [showIntroduction])

  const updateLanguage = useCallback(() => {
    logger.log('i18n.language', i18n.language)

    let languageCode = i18n.language

    settingsStore.setState({
      selectLanguage: isLanguageSupported(languageCode) ? languageCode : 'ja',
    })
  }, [])

  const handleClose = useCallback(() => {
    setOpened(false)
    updateLanguage()

    // only update showIntroduction if "don't show again" is checked
    if (dontShowAgain) {
      homeStore.setState({
        showIntroduction: false,
      })
    }
  }, [dontShowAgain, updateLanguage])

  useEffect(() => {
    if (!displayIntroduction || !opened) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [displayIntroduction, opened, handleClose])

  return displayIntroduction && opened ? (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-3 font-sans backdrop-blur-md sm:p-6">
      <div className="aurora-glass-panel relative mx-auto flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] p-5 text-[var(--aurora-text-strong)] shadow-2xl sm:p-6">
        {/* scrollable content area */}
        <div className="scroll-hidden flex-1 space-y-6 overflow-y-auto text-[14px] leading-relaxed text-[var(--aurora-text-medium)]">
          <div className="border-b border-white/10 pb-2 text-lg font-bold text-[var(--aurora-text-strong)] sm:text-2xl">
            {t('AboutAITuberKit', 'AITuberKitについて')}
          </div>

          <div className="leading-relaxed">
            {process.env.NEXT_PUBLIC_ABOUT_DESCRIPTION ? (
              process.env.NEXT_PUBLIC_ABOUT_DESCRIPTION
            ) : (
              <Trans i18nKey="AboutThisApplicationDescription2" />
            )}
          </div>

          <div>
            <div className="mb-3 text-base font-bold text-[var(--aurora-text-strong)] sm:text-lg">
              {t('TechnologyIntroduction')}
            </div>
            <div className="leading-relaxed">
              <Trans
                i18nKey="TechnologyIntroductionDescription1"
                components={{
                  b: <b className="text-[var(--aurora-text-strong)]" />,
                }}
              />
              <Link
                url={'https://github.com/pixiv/ChatVRM'}
                label={t('TechnologyIntroductionLink1')}
              />
              {t('TechnologyIntroductionDescription2')}
            </div>
            <div className="my-4 leading-relaxed">
              {t('TechnologyIntroductionDescription3')}
              <Link
                url={'https://github.com/pixiv/three-vrm'}
                label={'@pixiv/three-vrm'}
              />
              {t('TechnologyIntroductionDescription4')}
              <Link
                url={
                  'https://openai.com/blog/introducing-chatgpt-and-whisper-apis'
                }
                label={'OpenAI API'}
              />
              {t('TechnologyIntroductionDescription5')}
              <Link url={'https://voicevox.hiroshiba.jp/'} label={'VOICEVOX'} />
              {t('TechnologyIntroductionDescription6')}
              <Link
                url={'https://docs.aituberkit.com/'}
                label={t('TechnologyIntroductionLink2')}
              />
              {t('TechnologyIntroductionDescription7')}
            </div>
            <div className="my-4 leading-relaxed">
              {t('SourceCodeDescription1')}
              <br />
              {t('RepositoryURL')}
              <span> </span>
              <Link
                url={'https://github.com/tegnike/aituber-kit'}
                label={'https://github.com/tegnike/aituber-kit'}
              />
            </div>
            <div className="my-2">{t('SourceCodeDescription2')}</div>

            {selectLanguage === 'ja' && (
              <div className="mt-4 text-xs text-[var(--aurora-text-muted)]">
                <p>{t('LanguageCanBeSelectedFromSettings')}</p>
              </div>
            )}
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-[var(--aurora-text-medium)] transition-colors hover:text-[var(--aurora-text-strong)]">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => {
                  setDontShowAgain(e.target.checked)
                }}
                className="h-4 w-4 cursor-pointer rounded accent-primary"
              />
              <span>{t('DontShowIntroductionNextTime')}</span>
            </label>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="w-full rounded-full bg-primary px-6 py-3 text-center font-bold text-white transition duration-200 hover:bg-primary-hover active:bg-primary-press focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              {t('StartWithEnter', 'Enterキーを押して始める')}
            </button>
          </div>

          {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
            <div className="rounded-[16px] border border-secondary/30 bg-secondary/10 p-4 text-sm text-[var(--aurora-text-medium)]">
              <p className="mb-1 font-bold">{t('DemoModeAppNotice')}</p>
              <p className="mb-2">{t('DemoModeLimitedFeaturesNotice')}</p>
              <p className="font-bold text-secondary">
                ⚠ {t('DemoModeLogNotice')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null
}
