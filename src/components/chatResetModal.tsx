import { useCallback, useEffect, useState } from 'react'
import homeStore from '@/features/stores/home'
import { resetSessionId } from '@/utils/sessionId'

interface ChatResetModalProps {
  onReset?: () => void
}

export const ChatResetModal = ({ onReset }: ChatResetModalProps = {}) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleReset = useCallback(() => {
    homeStore.setState({ chatLog: [] })
    resetSessionId()
    if (typeof window !== 'undefined') {
      try {
        const key = 'aitube-kit-home'
        const raw = window.localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.state) {
            parsed.state.chatLog = []
            window.localStorage.setItem(key, JSON.stringify(parsed))
          }
        }
      } catch {
        // ignore
      }

      if (onReset) {
        onReset()
      } else {
        window.location.reload()
      }
    }
  }, [onReset])

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey
      const isShift = event.shiftKey
      const isXKey =
        event.key === 'x' || event.key === 'X' || event.code === 'KeyX'

      if (isCmdOrCtrl && isShift && isXKey) {
        event.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Backspace' ||
        event.key === 'Escape' ||
        event.key === 'Esc'
      ) {
        event.preventDefault()
        handleClose()
      } else if (event.key === 'Enter') {
        event.preventDefault()
        handleReset()
      }
    }

    window.addEventListener('keydown', handleModalKeyDown)
    return () => window.removeEventListener('keydown', handleModalKeyDown)
  }, [isOpen, handleClose, handleReset])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 font-sans backdrop-blur-md sm:p-6"
    >
      <div className="aurora-glass-panel relative mx-auto flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-[24px] p-5 text-[var(--aurora-text-strong)] shadow-2xl sm:p-6">
        <div className="scroll-hidden flex-1 space-y-6 overflow-y-auto text-[14px] leading-relaxed text-[var(--aurora-text-medium)]">
          <div className="border-b border-white/10 pb-2 text-lg font-bold text-[var(--aurora-text-strong)] sm:text-2xl">
            会話履歴をリセットしますか？
          </div>

          <div className="leading-relaxed text-[var(--aurora-text-medium)]">
            Backspace/⌫キー、またはEscapeキーを押すと、このメッセージを消して、リセットをキャンセルできます。
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleReset}
              className="w-full rounded-full bg-primary px-6 py-3 text-center font-bold text-white transition duration-200 hover:bg-primary-hover active:bg-primary-press focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Enterキーを押してリセットする
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
