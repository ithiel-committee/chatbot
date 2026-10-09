import React, { useRef, useEffect } from 'react'
import { MenuItem } from '@/types/navigationMenu'

interface ItemProps {
  item: MenuItem
  isFocused: boolean
  isEditing: boolean
  onValueChange: (direction: 'prev' | 'next') => void
  onTrigger: () => void
  onEndEdit: () => void
}

export const MenuControlItem: React.FC<ItemProps> = ({
  item,
  isFocused,
  isEditing,
  onValueChange,
  onTrigger,
  onEndEdit,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const isDisabled = item.disabled?.() ?? false

  useEffect(() => {
    if (isFocused && isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isFocused, isEditing])

  const val = item.getValue ? item.getValue() : null

  // 1. toggle
  if (item.type === 'toggle') {
    const isChecked = Boolean(val)
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={onTrigger}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition outline-none focus:outline-none focus-visible:outline-none ${
          isChecked
            ? 'bg-primary/20 border-primary text-primary font-bold'
            : 'bg-white/5 border-white/10 text-gray-400'
        }`}
      >
        <span className="text-xs">◀</span>
        <span className="text-sm min-w-[3rem] text-center">
          {isChecked ? 'ON' : 'OFF'}
        </span>
        <span className="text-xs">▶</span>
      </button>
    )
  }

  // 2. select
  if (item.type === 'select') {
    const selectedOption = item.options?.find((opt) => opt.value === val)
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onValueChange('prev')
          }}
          className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 outline-none focus:outline-none focus-visible:outline-none"
        >
          ◀
        </button>
        <span className="px-3 py-1 text-sm rounded bg-white/5 border border-white/10 min-w-[120px] text-center truncate">
          {selectedOption ? selectedOption.label : String(val ?? '')}
        </span>
        <button
          type="button"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onValueChange('next')
          }}
          className="p-1 text-gray-400 hover:text-white rounded hover:bg-white/10 outline-none focus:outline-none focus-visible:outline-none"
        >
          ▶
        </button>
      </div>
    )
  }

  // 3. slider
  if (item.type === 'slider') {
    const numVal = Number(val ?? item.min ?? 0)
    return (
      <div className="flex items-center gap-2 w-48">
        <button
          type="button"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onValueChange('prev')
          }}
          className="p-1 text-gray-400 hover:text-white outline-none focus:outline-none focus-visible:outline-none"
        >
          ◀
        </button>
        <input
          type="range"
          min={item.min ?? 0}
          max={item.max ?? 100}
          step={item.step ?? 1}
          value={numVal}
          disabled={isDisabled}
          onChange={(e) => item.setValue?.(Number(e.target.value))}
          className="w-full accent-primary h-1.5 rounded bg-white/10 outline-none focus:outline-none focus-visible:outline-none"
        />
        <button
          type="button"
          disabled={isDisabled}
          onClick={(e) => {
            e.stopPropagation()
            onValueChange('next')
          }}
          className="p-1 text-gray-400 hover:text-white outline-none focus:outline-none focus-visible:outline-none"
        >
          ▶
        </button>
        <span className="text-xs min-w-[3rem] text-right font-mono">
          {numVal}
          {item.unit ?? ''}
        </span>
      </div>
    )
  }

  // 4. text
  if (item.type === 'text') {
    return isEditing ? (
      <input
        ref={inputRef}
        type="text"
        value={String(val ?? '')}
        disabled={isDisabled}
        placeholder={item.placeholder}
        onChange={(e) => item.setValue?.(e.target.value)}
        onBlur={onEndEdit}
        className="px-2 py-1 text-sm bg-black/60 border border-primary rounded text-white outline-none focus:outline-none focus-visible:outline-none w-48"
      />
    ) : (
      <button
        type="button"
        disabled={isDisabled}
        onClick={onTrigger}
        className="px-3 py-1 text-sm bg-white/5 border border-white/10 rounded hover:border-primary/50 text-gray-300 w-48 truncate text-left outline-none focus:outline-none focus-visible:outline-none"
      >
        {val ? (
          String(val)
        ) : (
          <span className="text-gray-500">
            {item.placeholder || 'クリックして入力'}
          </span>
        )}
      </button>
    )
  }

  // 5. action
  if (item.type === 'action') {
    return (
      <button
        type="button"
        disabled={isDisabled}
        onClick={onTrigger}
        className="px-4 py-1.5 text-sm bg-primary/20 hover:bg-primary/30 border border-primary/50 rounded-lg text-primary font-medium outline-none focus:outline-none focus-visible:outline-none"
      >
        実行 (Enter)
      </button>
    )
  }

  return null
}
