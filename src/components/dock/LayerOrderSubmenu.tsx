import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd'
import useImagesStore from '@/features/stores/images'

interface LayerOrderSubmenuProps {
  isFocused: boolean
  focusedIndex: number
  onHoverItem: (index: number) => void
  onMoveUp?: (index: number) => void
  onMoveDown?: (index: number) => void
  onClose: () => void
}

export const LayerOrderSubmenu: React.FC<LayerOrderSubmenuProps> = ({
  isFocused,
  focusedIndex,
  onHoverItem,
  onMoveUp,
  onMoveDown,
  onClose,
}) => {
  const { t } = useTranslation()
  const { reorderAllLayers, getAllLayerItems } = useImagesStore()
  const layerItems = getAllLayerItems()

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return
    }

    const startIndex = result.source.index
    const endIndex = result.destination.index

    if (startIndex !== endIndex) {
      reorderAllLayers(startIndex, endIndex)
    }
  }

  const handleMoveUpItem = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (index > 0) {
      reorderAllLayers(index, index - 1)
      if (onMoveUp) onMoveUp(index)
    }
  }

  const handleMoveDownItem = (e: React.MouseEvent, index: number) => {
    e.stopPropagation()
    if (index < layerItems.length - 1) {
      reorderAllLayers(index, index + 1)
      if (onMoveDown) onMoveDown(index)
    }
  }

  return (
    <div
      className="aurora-glass-popover z-30 w-80 shrink-0 rounded-[18px] p-3 text-theme-default max-h-[calc(100vh-100px)] overflow-y-auto"
      data-testid="layer-order-submenu"
      role="menu"
      aria-label={t('LayerOrder')}
    >
      <div className="mb-2.5 px-2 text-xs font-bold uppercase tracking-wider text-text-primary">
        {t('LayerOrder')}
      </div>

      {layerItems.length <= 1 ? (
        <div className="py-6 text-center text-xs text-text-primary/70">
          {t('NoPlacedImages')}
        </div>
      ) : (
        <div>
          {/* frontmost label */}
          <div className="mb-2 border-b border-dashed border-primary/20 py-1 text-center text-xs text-text-primary/80 font-medium">
            {t('BottomLayer')}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="dock-layer-order">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-1.5"
                >
                  {layerItems.map((item, index) => {
                    const isItemFocused = isFocused && focusedIndex === index

                    return (
                      <Draggable
                        key={item.id}
                        draggableId={item.id}
                        index={index}
                        isDragDisabled={false}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            onMouseEnter={() => onHoverItem(index)}
                            data-testid={`layer-item-${index}`}
                            className={`flex items-center space-x-2 rounded-xl border p-2 text-xs transition-all duration-150 outline-none ${
                              snapshot.isDragging
                                ? 'border-primary bg-primary/20 shadow-lg scale-[1.02]'
                                : isItemFocused
                                  ? 'border-primary bg-primary/15 shadow-sm ring-1 ring-primary/30'
                                  : item.type === 'character'
                                    ? 'border-primary/20 bg-primary/5 hover:bg-primary/10'
                                    : 'border-primary/15 bg-[color-mix(in_srgb,var(--color-text-base)_90%,transparent)] hover:bg-primary/5'
                            }`}
                          >
                            {/* drag handle */}
                            <div
                              {...provided.dragHandleProps}
                              className="flex-shrink-0 cursor-grab text-text-primary active:cursor-grabbing p-0.5 hover:text-primary transition-colors"
                              title={t(
                                'DragToReorderLayers',
                                'ドラッグして順序を変更'
                              )}
                            >
                              <svg
                                className="w-3.5 h-3.5"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                {item.type === 'character' ? (
                                  <path d="M10 2L3 7v11c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V7l-7-5z" />
                                ) : (
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                )}
                              </svg>
                            </div>

                            {/* thumbnail */}
                            <div
                              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg overflow-hidden ${
                                item.type === 'character'
                                  ? 'bg-primary text-theme'
                                  : 'bg-white/80'
                              }`}
                            >
                              {item.type === 'character' ? (
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                </svg>
                              ) : (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                  src={item.path}
                                  alt={item.filename}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>

                            {/* name and order */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold truncate text-text1">
                                  {item.type === 'character'
                                    ? t('CharacterLayer')
                                    : item.filename}
                                </p>
                                <span className="text-[11px] opacity-70 ml-1 font-mono">
                                  #{index + 1}
                                </span>
                              </div>
                            </div>

                            {/* up and down sorting button for keyboard/click */}
                            <div className="flex flex-col space-y-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={index === 0}
                                onClick={(e) => handleMoveUpItem(e, index)}
                                className="h-4 w-4 flex items-center justify-center rounded bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="上へ移動"
                                aria-label={`${item.filename || 'item'} を上へ移動`}
                              >
                                <svg
                                  className="w-2.5 h-2.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2.5"
                                >
                                  <polyline points="18 15 12 9 6 15" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={index === layerItems.length - 1}
                                onClick={(e) => handleMoveDownItem(e, index)}
                                className="h-4 w-4 flex items-center justify-center rounded bg-primary/10 hover:bg-primary/20 text-primary disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                title="下へ移動"
                                aria-label={`${item.filename || 'item'} を下へ移動`}
                              >
                                <svg
                                  className="w-2.5 h-2.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth="2.5"
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* bottommost label */}
          <div className="mt-2 border-t border-dashed border-primary/20 py-1 text-center text-xs text-text-primary/80 font-medium">
            {t('TopLayer')}
          </div>

          <div className="mt-2 text-[10px] text-text-primary/60 text-center">
            {t('LayerKeyboardHelp', 'Shift + ↑/↓ で選択レイヤーを移動')}
          </div>
        </div>
      )}
    </div>
  )
}
