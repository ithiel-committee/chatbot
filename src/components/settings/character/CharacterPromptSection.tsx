import { useTranslation } from 'react-i18next'

import settingsStore, { SettingsState } from '@/features/stores/settings'
import toastStore from '@/features/stores/toast'
import { settingsControlClass } from '@/components/settings/formStyles'

// Character型の定義
type Character = Pick<
  SettingsState,
  | 'characterName'
  | 'showAssistantText'
  | 'showCharacterName'
  | 'systemPrompt'
  | 'characterPreset1'
  | 'characterPreset2'
  | 'characterPreset3'
  | 'characterPreset4'
  | 'characterPreset5'
  | 'customPresetName1'
  | 'customPresetName2'
  | 'customPresetName3'
  | 'customPresetName4'
  | 'customPresetName5'
  | 'selectedPresetIndex'
  | 'selectedVrmPath'
  | 'selectedLive2DPath'
>

interface CharacterPromptSectionProps {
  selectAIService: SettingsState['selectAIService']
  systemPrompt: string
  characterPreset1: string
  characterPreset2: string
  characterPreset3: string
  characterPreset4: string
  characterPreset5: string
  customPresetName1: string
  customPresetName2: string
  customPresetName3: string
  customPresetName4: string
  customPresetName5: string
  selectedPresetIndex: number
}

export const CharacterPromptSection = ({
  selectAIService,
  systemPrompt,
  characterPreset1,
  characterPreset2,
  characterPreset3,
  characterPreset4,
  characterPreset5,
  customPresetName1,
  customPresetName2,
  customPresetName3,
  customPresetName4,
  customPresetName5,
  selectedPresetIndex,
}: CharacterPromptSectionProps) => {
  const { t } = useTranslation()

  const characterPresets = [
    {
      key: 'characterPreset1',
      value: characterPreset1,
    },
    {
      key: 'characterPreset2',
      value: characterPreset2,
    },
    {
      key: 'characterPreset3',
      value: characterPreset3,
    },
    {
      key: 'characterPreset4',
      value: characterPreset4,
    },
    {
      key: 'characterPreset5',
      value: characterPreset5,
    },
  ]

  const customPresetNames = [
    customPresetName1,
    customPresetName2,
    customPresetName3,
    customPresetName4,
    customPresetName5,
  ]

  return (
    <>
      <div className="border-t border-gray-300 pt-6 my-6 mb-2">
        <div className="my-4 text-xl font-bold">
          {t('CharacterSettingsPrompt')}
        </div>
        {selectAIService === 'dify' ? (
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('DifyInstruction')}
          </div>
        ) : (
          <div className="my-2 text-sm whitespace-pre-wrap">
            {t('CharacterSettingsInfo')}
          </div>
        )}
      </div>
      <div className="my-2 text-sm whitespace-pre-wrap">
        {t('CharacterpresetInfo')}
      </div>
      <div className="my-6 mb-2">
        <div className="flex flex-wrap gap-2 mb-4" role="tablist">
          {characterPresets.map(({ key, value }, index) => {
            const customName = customPresetNames[index]
            const isSelected = selectedPresetIndex === index

            return (
              <button
                key={key}
                onClick={() => {
                  // プリセット選択時に内容を表示し、systemPromptも更新
                  settingsStore.setState({
                    selectedPresetIndex: index,
                    systemPrompt: value,
                  })

                  toastStore.getState().addToast({
                    message: t('Toasts.PresetSwitching', {
                      presetName: customName,
                    }),
                    type: 'info',
                    tag: `character-preset-switching`,
                  })
                }}
                role="tab"
                aria-selected={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    settingsStore.setState({
                      selectedPresetIndex: index,
                      systemPrompt: value,
                    })

                    toastStore.getState().addToast({
                      message: t('Toasts.PresetSwitching', {
                        presetName: customName,
                      }),
                      type: 'info',
                      tag: `character-preset-switching`,
                    })
                  }
                }}
                className={`rounded-md border px-4 py-2 text-sm shadow-sm transition ${
                  isSelected
                    ? 'border-primary bg-primary text-theme'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-primary/60 hover:bg-white-hover'
                }`}
              >
                {customName}
              </button>
            )
          })}
        </div>

        {characterPresets.map(({ key }, index) => {
          const customNameKey =
            `customPresetName${index + 1}` as keyof Character
          const customName = customPresetNames[index]
          const isSelected = selectedPresetIndex === index

          if (!isSelected) return null

          return (
            <div key={key} className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => {
                    settingsStore.setState({
                      [customNameKey]: e.target.value,
                    })
                  }}
                  aria-label={t('PresetNameLabel', {
                    defaultValue: 'Preset Name',
                  })}
                  className={`${settingsControlClass.medium} border border-gray-300 text-sm`}
                  placeholder={t(`Characterpreset${index + 1}`)}
                />
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => {
                  const newValue = e.target.value
                  // システムプロンプトとプリセットの内容を同時に更新
                  settingsStore.setState({
                    systemPrompt: newValue,
                    [key]: newValue,
                  })
                }}
                aria-label={t('SystemPromptLabel', {
                  defaultValue: 'System Prompt',
                })}
                className="px-3 py-2 bg-white border border-gray-300 rounded-md w-full h-64 text-sm"
              />
            </div>
          )
        })}
      </div>
    </>
  )
}
