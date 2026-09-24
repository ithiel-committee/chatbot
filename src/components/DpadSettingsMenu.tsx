import React, { useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useMenuKeyboardNav } from '@/hooks/useMenuKeyboardNav'
import { MenuControlItem } from './MenuControlItems'
import { getSettingCategories } from '@/features/navigationMenu/settingCategories'

interface DpadSettingsMenuProps {
  onClose: () => void
  onOpenAdvanced?: () => void
}

export const DpadSettingsMenu: React.FC<DpadSettingsMenuProps> = ({
  onClose,
  onOpenAdvanced,
}) => {
  const { t } = useTranslation()
  const categories = useMemo(
    () => getSettingCategories(t, { onOpenAdvanced }),
    [t, onOpenAdvanced]
  )

  const {
    focusedPane,
    setFocusedPane,
    categoryIndex,
    setCategoryIndex,
    itemIndex,
    setItemIndex,
    currentCategory,
    currentItems,
    isEditingText,
    setIsEditingText,
    changeItemValue,
    triggerItemAction,
  } = useMenuKeyboardNav({
    categories,
    isOpen: true,
    onClose,
  })

  // scroll into view when selection changes
  useEffect(() => {
    if (focusedPane === 'category') {
      const el = document.getElementById(`category-item-${categoryIndex}`)
      if (typeof el?.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    } else {
      const el = document.getElementById(`setting-item-${itemIndex}`)
      if (typeof el?.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedPane, categoryIndex, itemIndex])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-lg h-[500px] aurora-glass-panel flex flex-col overflow-hidden text-[var(--aurora-text-strong)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-center px-6 py-4 border-b border-white/10 bg-white/5">
          <h2 className="text-xl font-bold tracking-wide">
            {focusedPane === 'category'
              ? t('Settings', '設定メニュー')
              : currentCategory?.label}
          </h2>
        </div>
        {/* main area (1 pane) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {focusedPane === 'category' ? (
            // category list
            <div className="space-y-2">
              {categories.map((cat, idx) => {
                const isSelected = categoryIndex === idx
                return (
                  <button
                    key={cat.id}
                    id={`category-item-${idx}`}
                    type="button"
                    onClick={() => {
                      setCategoryIndex(idx)
                      setFocusedPane('item')
                      setItemIndex(0)
                    }}
                    onMouseEnter={() => {
                      setCategoryIndex(idx)
                    }}
                    className={`w-full text-left px-5 py-4 rounded-xl flex items-center justify-between transition text-base font-medium outline-none focus:outline-none focus-visible:outline-none border ${
                      isSelected
                        ? 'bg-primary text-theme font-bold shadow-md border-white/30'
                        : 'aurora-glass-capsule hover:bg-[var(--aurora-control-bg-hover)] border-transparent'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className="text-sm opacity-60">▶</span>
                  </button>
                )
              })}
            </div>
          ) : (
            // item list
            <div className="space-y-2">
              {currentItems.map((item, idx) => {
                const isSelected = itemIndex === idx
                const isDisabled = item.disabled?.() ?? false
                return (
                  <div
                    key={item.id}
                    id={`setting-item-${idx}`}
                    onClick={() => {
                      setItemIndex(idx)
                    }}
                    onMouseEnter={() => {
                      setItemIndex(idx)
                    }}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl transition cursor-pointer gap-3 outline-none focus:outline-none focus-visible:outline-none border ${
                      isSelected
                        ? 'bg-[var(--aurora-control-bg-hover)] border-white/25 shadow-sm'
                        : 'aurora-glass-capsule hover:bg-[var(--aurora-control-bg-hover)] border-transparent'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">
                        {item.label}
                      </div>
                      {item.description && (
                        <div className="text-xs text-[var(--aurora-text-muted)] truncate mt-0.5">
                          {item.description}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 w-full sm:w-auto flex justify-end">
                      <MenuControlItem
                        item={item}
                        isFocused={isSelected}
                        isEditing={isSelected && isEditingText}
                        onValueChange={(direction) =>
                          changeItemValue(item, direction)
                        }
                        onTrigger={() => triggerItemAction(item)}
                        onEndEdit={() => setIsEditingText(false)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {/* footer: operation helper bar */}
        <div className="px-4 py-3 border-t border-white/10 bg-black/20 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[var(--aurora-text-muted)]">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
              ↑↓
            </kbd>{' '}
            選択
          </span>
          {focusedPane === 'item' && (
            <span className="flex items-center gap-1.5">
              <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
                ←→
              </kbd>{' '}
              変更
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
              Enter
            </kbd>{' '}
            決定
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white border border-white/20">
              Backspace/⌫
            </kbd>{' '}
            {focusedPane === 'item' ? '戻る' : '閉じる'}
          </span>
        </div>
      </div>
    </div>
  )
}
