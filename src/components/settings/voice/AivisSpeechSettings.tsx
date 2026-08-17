import { logger } from '@/lib/logger'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import settingsStore from '@/features/stores/settings'
import { useRestrictedMode } from '@/hooks/useRestrictedMode'
import { Link } from '../../link'
import { getSpeakerUpdateErrorMessage } from './speakerUpdateError'
import {
  settingsActionWidth,
  settingsControlClass,
} from '@/components/settings/formStyles'

interface AivisSpeechSettingsProps {
  selectVoice: string
  aivisSpeechServerUrl: string
  aivisSpeechSpeaker: string
  aivisSpeechSpeed: number
  aivisSpeechPitch: number
  aivisSpeechTempoDynamics: number
  aivisSpeechIntonationScale: number
  aivisSpeechPrePhonemeLength: number
  aivisSpeechPostPhonemeLength: number
}

export const AivisSpeechSettings = ({
  selectVoice,
  aivisSpeechServerUrl,
  aivisSpeechSpeaker,
  aivisSpeechSpeed,
  aivisSpeechPitch,
  aivisSpeechTempoDynamics,
  aivisSpeechIntonationScale,
  aivisSpeechPrePhonemeLength,
  aivisSpeechPostPhonemeLength,
}: AivisSpeechSettingsProps) => {
  const { t } = useTranslation()
  const { isRestrictedMode } = useRestrictedMode()
  const [speakers_aivis, setSpeakers_aivis] = useState<Array<any>>([])
  const [isUpdatingSpeakers, setIsUpdatingSpeakers] = useState<boolean>(false)
  const [speakersUpdateError, setSpeakersUpdateError] = useState<string>('')

  // AIVISの話者一覧を取得する関数
  const fetchAivisSpeakers = async () => {
    try {
      const response = await fetch('/speakers_aivis.json')
      const data = await response.json()
      setSpeakers_aivis(data)
    } catch (error) {
      logger.error('Failed to fetch AIVIS speakers:', error)
    }
  }

  // コンポーネントマウント時またはAIVIS選択時に話者一覧を取得
  useEffect(() => {
    if (selectVoice === 'aivis_speech') {
      fetchAivisSpeakers()
    }
  }, [selectVoice])

  return (
    <>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('AivisSpeechInfo')}
        <br />
        <Link
          url="https://aivis-project.com/"
          label="https://aivis-project.com/"
        />
      </div>
      <div className="mt-4 font-bold">{t('AivisSpeechServerUrl')}</div>
      <div className="mt-2">
        <input
          className={settingsControlClass.long}
          type="text"
          placeholder="http://localhost:10101"
          value={aivisSpeechServerUrl}
          onChange={(e) =>
            settingsStore.setState({
              aivisSpeechServerUrl: e.target.value,
            })
          }
        />
      </div>
      <div className="mt-4 font-bold">{t('AivisSpeechSpeaker')}</div>
      <div className="space-y-3">
        <select
          value={aivisSpeechSpeaker}
          onChange={(e) =>
            settingsStore.setState({
              aivisSpeechSpeaker: e.target.value,
            })
          }
          className={settingsControlClass.medium}
        >
          <option value="">{t('Select')}</option>
          {speakers_aivis.map((speaker) => (
            <option key={speaker.id} value={speaker.id}>
              {speaker.speaker}
            </option>
          ))}
        </select>

        <button
          onClick={async () => {
            setIsUpdatingSpeakers(true)
            setSpeakersUpdateError('')
            try {
              const response = await fetch(
                '/api/update-aivis-speakers?serverUrl=' +
                  encodeURIComponent(aivisSpeechServerUrl),
                { method: 'POST' }
              )
              if (response.ok) {
                const updatedSpeakersResponse = await fetch(
                  `/speakers_aivis.json?ts=${Date.now()}`
                )
                const updatedSpeakers = await updatedSpeakersResponse.json()
                setSpeakers_aivis(updatedSpeakers)
              } else {
                setSpeakersUpdateError(
                  await getSpeakerUpdateErrorMessage(response)
                )
              }
            } catch (error) {
              setSpeakersUpdateError(t('NetworkError'))
            } finally {
              setIsUpdatingSpeakers(false)
            }
          }}
          disabled={isUpdatingSpeakers || isRestrictedMode}
          className={`${settingsActionWidth} flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-theme transition-colors duration-200 hover:bg-primary-hover active:bg-primary-press disabled:cursor-not-allowed disabled:bg-primary-disabled`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isUpdatingSpeakers ? t('Updating') : t('UpdateSpeakerList')}
        </button>
        {speakersUpdateError && (
          <div className="mt-2 text-red-600 text-sm">{speakersUpdateError}</div>
        )}
      </div>
      <div className="mt-6 font-bold">
        <div className="select-none">
          {t('SpeechSpeed')}: {aivisSpeechSpeed}
        </div>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.01}
          value={aivisSpeechSpeed}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisSpeechSpeed: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('Pitch')}: {aivisSpeechPitch}
        </div>
        <input
          type="range"
          min={-0.15}
          max={0.15}
          step={0.01}
          value={aivisSpeechPitch}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisSpeechPitch: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('TempoDynamics')}: {aivisSpeechTempoDynamics}
        </div>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.01}
          value={aivisSpeechTempoDynamics}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisSpeechTempoDynamics: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('AivisSpeechIntonationScale')}: {aivisSpeechIntonationScale}
        </div>
        <input
          type="range"
          min={0.0}
          max={2.0}
          step={0.01}
          value={aivisSpeechIntonationScale}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisSpeechIntonationScale: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('PreSilenceDuration')}: {aivisSpeechPrePhonemeLength}{' '}
        </div>
        <input
          type="range"
          min={0.0}
          max={1.0}
          step={0.01}
          value={aivisSpeechPrePhonemeLength}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisSpeechPrePhonemeLength: Number(e.target.value),
            })
          }}
        />
        <div className="select-none">
          {t('PostSilenceDuration')}: {aivisSpeechPostPhonemeLength}{' '}
        </div>
        <input
          type="range"
          min={0.0}
          max={1.0}
          step={0.01}
          value={aivisSpeechPostPhonemeLength}
          className="mt-2 mb-4 input-range"
          onChange={(e) => {
            settingsStore.setState({
              aivisSpeechPostPhonemeLength: Number(e.target.value),
            })
          }}
        />
      </div>
    </>
  )
}
