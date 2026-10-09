import { useState, useEffect, useCallback } from 'react'
import { MenuCategory, FocusedPane, MenuItem } from '@/types/navigationMenu'

interface UseMenuKeyboardNavProps {
  categories: MenuCategory[]
  isOpen: boolean
  onClose: () => void
}

export const useMenuKeyboardNav = ({
  categories,
  isOpen,
  onClose,
}: UseMenuKeyboardNavProps) => {
  const [focusedPane, setFocusedPane] = useState<FocusedPane>('category')
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [itemIndex, setItemIndex] = useState(0)
  const [isEditingText, setIsEditingText] = useState(false)
  const [, setRevision] = useState(0)

  const currentCategory = categories[categoryIndex]
  const currentItems = currentCategory?.items ?? []
  const currentItem: MenuItem | undefined = currentItems[itemIndex]

  // reset item index when category changes
  const selectCategory = useCallback((idx: number) => {
    setCategoryIndex(idx)
    setItemIndex(0)
  }, [])

  // process value adjustments and modifications
  const changeItemValue = useCallback(
    (item: MenuItem, direction: 'prev' | 'next') => {
      if (item.disabled?.() || !item.getValue || !item.setValue) return

      if (item.type === 'toggle') {
        item.setValue(!item.getValue())
      } else if (
        item.type === 'select' &&
        item.options &&
        item.options.length > 0
      ) {
        const currentVal = item.getValue()
        const curIdx = item.options.findIndex((opt) => opt.value === currentVal)
        const nextIdx =
          direction === 'next'
            ? (curIdx + 1) % item.options.length
            : (curIdx - 1 + item.options.length) % item.options.length
        item.setValue(item.options[nextIdx].value)
      } else if (item.type === 'slider') {
        const currentVal = Number(item.getValue() ?? 0)
        const step = item.step ?? 1
        const min = item.min ?? 0
        const max = item.max ?? 100
        let nextVal =
          direction === 'next' ? currentVal + step : currentVal - step
        nextVal = Math.max(min, Math.min(max, nextVal))
        // Adjust decimal precision
        const precision = step.toString().split('.')[1]?.length ?? 0
        item.setValue(Number(nextVal.toFixed(precision)))
      }
      setRevision((prev) => prev + 1)
    },
    []
  )

  // execute actions to confirm
  const triggerItemAction = useCallback(
    (item: MenuItem) => {
      if (item.disabled?.()) return

      if (item.type === 'toggle') {
        changeItemValue(item, 'next')
      } else if (item.type === 'action' && item.onAction) {
        item.onAction()
        setRevision((prev) => prev + 1)
      } else if (item.type === 'text') {
        setIsEditingText(true)
      }
    },
    [changeItemValue]
  )

  // keyboard event listener
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditingText) {
        if (e.key === 'Escape' || e.key === 'Enter') {
          setIsEditingText(false)
          e.preventDefault()
        }
        return
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'KeyW': {
          e.preventDefault()
          if (focusedPane === 'category') {
            setCategoryIndex((prev) =>
              prev > 0 ? prev - 1 : categories.length - 1
            )
            setItemIndex(0)
          } else {
            setItemIndex((prev) =>
              prev > 0 ? prev - 1 : currentItems.length - 1
            )
          }
          break
        }

        case 'ArrowDown':
        case 'KeyS': {
          e.preventDefault()
          if (focusedPane === 'category') {
            setCategoryIndex((prev) =>
              prev < categories.length - 1 ? prev + 1 : 0
            )
            setItemIndex(0)
          } else {
            setItemIndex((prev) =>
              prev < currentItems.length - 1 ? prev + 1 : 0
            )
          }
          break
        }

        case 'ArrowRight':
        case 'KeyD': {
          e.preventDefault()
          if (focusedPane === 'item' && currentItem) {
            changeItemValue(currentItem, 'next')
          }
          break
        }

        case 'ArrowLeft':
        case 'KeyA': {
          e.preventDefault()
          if (
            focusedPane === 'item' &&
            currentItem &&
            (currentItem.type === 'select' ||
              currentItem.type === 'slider' ||
              currentItem.type === 'toggle')
          ) {
            changeItemValue(currentItem, 'prev')
          }
          break
        }

        case 'Enter':
        case ' ': {
          e.preventDefault()
          if (focusedPane === 'category') {
            if (currentItems.length > 0) {
              setFocusedPane('item')
              setItemIndex(0)
            }
          } else if (currentItem) {
            triggerItemAction(currentItem)
          }
          break
        }

        case 'Escape':
        case 'Backspace': {
          e.preventDefault()
          if (focusedPane === 'item') {
            setFocusedPane('category')
          } else {
            onClose()
          }
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    isOpen,
    focusedPane,
    categoryIndex,
    itemIndex,
    isEditingText,
    categories,
    currentItems,
    currentItem,
    changeItemValue,
    triggerItemAction,
    onClose,
  ])

  return {
    focusedPane,
    setFocusedPane,
    categoryIndex,
    setCategoryIndex,
    itemIndex,
    setItemIndex,
    selectCategory,
    currentCategory,
    currentItems,
    currentItem,
    isEditingText,
    setIsEditingText,
    changeItemValue,
    triggerItemAction,
  }
}
