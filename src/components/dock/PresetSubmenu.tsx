import React from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import toastStore from '@/features/stores/toast'

interface PresetSubmenuProps {
  isFocused: boolean
  focusedIndex: number
  onHoverPreset: (index: number) => void
  onSelectPreset?: (index: number) => void
  onClose: () => void
}

export const PresetSubmenu: React.FC<PresetSubmenuProps> = ({
  isFocused,
  focusedIndex,
  onHoverPreset,
  onSelectPreset,
  onClose,
}) => {
  const { t } = useTranslation()
  const store = settingsStore()
  const selectedPresetIndex = store.selectedPresetIndex

  const characterPresets = [
    {
      key: 'characterPreset1',
      value: store.characterPreset1,
      customName: store.customPresetName1,
    },
    {
      key: 'characterPreset2',
      value: store.characterPreset2,
      customName: store.customPresetName2,
    },
    {
      key: 'characterPreset3',
      value: store.characterPreset3,
      customName: store.customPresetName3,
    },
    {
      key: 'characterPreset4',
      value: store.characterPreset4,
      customName: store.customPresetName4,
    },
    {
      key: 'characterPreset5',
      value: store.characterPreset5,
      customName: store.customPresetName5,
    },
  ]

  const handleSelectPreset = (
    value: string,
    customName: string,
    index: number
  ) => {
    settingsStore.setState({
      systemPrompt: value,
      selectedPresetIndex: index,
    })

    toastStore.getState().addToast({
      message: t('Toasts.PresetSwitching', {
        presetName: customName,
      }),
      type: 'info',
      tag: 'character-preset-switching',
    })

    if (onSelectPreset) {
      onSelectPreset(index)
    }
    onClose()
  }

  return (
    <div
      className="aurora-glass-popover z-30 w-72 shrink-0 rounded-[18px] p-3 text-theme-default max-h-[calc(100vh-100px)] overflow-y-auto"
      data-testid="preset-submenu"
      role="menu"
      aria-label={t('Presets')}
    >
      <div className="mb-2.5 px-2 text-xs font-bold uppercase tracking-wider text-text-primary">
        {t('CharacterSettingsPrompt')}
      </div>
      <div className="space-y-1">
        {characterPresets.map(({ key, value, customName }, index) => {
          const isSelected = selectedPresetIndex === index
          const isItemFocused = isFocused && focusedIndex === index

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelectPreset(value, customName, index)}
              onMouseEnter={() => onHoverPreset(index)}
              role="menuitem"
              tabIndex={0}
              aria-current={isSelected ? 'true' : 'false'}
              data-testid={`preset-item-${index}`}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-all duration-150 outline-none focus:outline-none focus-visible:outline-none border ${
                isSelected
                  ? 'bg-primary text-theme shadow-md border-white/20'
                  : isItemFocused
                    ? 'bg-primary/15 text-primary border-primary/40 shadow-sm'
                    : 'text-text1 hover:bg-primary/10 hover:text-primary border-transparent'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">
                  {isSelected && <span className="mr-1.5">▶</span>}
                  {customName}
                </span>
                {isSelected && (
                  <span className="text-xs opacity-80 shrink-0 ml-2 font-normal">
                    {t('CurrentPreset', '選択中')}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
