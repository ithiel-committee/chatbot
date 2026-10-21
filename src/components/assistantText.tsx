import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { EMOTIONS } from '@/features/messages/messages'

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const emotionPattern = new RegExp(
  `\\[(${EMOTIONS.map(escapeRegExp).join('|')})\\]`,
  'gi'
)

export const AssistantText = ({ message }: { message: string }) => {
  const characterName = settingsStore((s) => s.characterName)
  const userDisplayName = settingsStore((s) => s.userDisplayName) || 'あなた'
  const showCharacterName = settingsStore((s) => s.showCharacterName)
  const assistantTextStyle = settingsStore((s) => s.assistantTextStyle)
  const showPresetQuestions = settingsStore((s) => s.showPresetQuestions)
  const presetQuestions = settingsStore((s) => s.presetQuestions)

  const chatLog = homeStore((s) => s.chatLog)
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const isSpeaking = homeStore((s) => s.isSpeaking)

  // Check if preset questions should be shown AND there are actual questions
  const shouldShowPresetQuestions =
    showPresetQuestions && presetQuestions.length > 0
  const sanitizedAssistantMessage = message
    .replace(emotionPattern, '')
    .replace(/\[motion:[^\]]*\]/gi, '')

  const showInputForm = settingsStore((s) => s.showInputForm)

  // ノベルゲーム風UIの表示判定と内容
  // 入力フォームが有効な場合は、MessageInput側で一体型ノベルウィンドウを描画するため重複を避ける
  if (assistantTextStyle === 'novel') {
    if (showInputForm) {
      return null
    }

    const lastMessage = chatLog.length > 0 ? chatLog[chatLog.length - 1] : null

    // 最新メッセージがユーザーかアシスタントかを判定
    let isUser = false
    let speakerName = characterName
    let displayText = sanitizedAssistantMessage

    if (lastMessage?.role === 'user') {
      isUser = true
      speakerName = userDisplayName
      if (typeof lastMessage.content === 'string') {
        displayText = lastMessage.content
      } else if (Array.isArray(lastMessage.content)) {
        const textPart = lastMessage.content.find((c) => c.type === 'text')
        displayText = textPart ? textPart.text : ''
      }
    } else if (lastMessage?.role === 'assistant') {
      isUser = false
      speakerName = characterName
      if (!displayText && typeof lastMessage.content === 'string') {
        displayText = lastMessage.content
          .replace(emotionPattern, '')
          .replace(/\[motion:[^\]]*\]/gi, '')
      }
    }

    if (!displayText && !chatProcessing) {
      return null
    }

    return (
      <div
        className={`pointer-events-none absolute bottom-0 left-1/2 z-10 flex w-[94vw] max-w-[840px] -translate-x-1/2 justify-center px-2 ${
          shouldShowPresetQuestions
            ? 'mb-[86px] sm:mb-[104px]'
            : 'mb-3 sm:mb-6'
        }`}
      >
        <div className="animate-aurora-bubble-in pointer-events-auto relative w-full rounded-[22px] border border-white/20 bg-slate-950/85 px-6 pb-4 pt-5 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl sm:px-8 sm:pb-5 sm:pt-6">
          {/* 光沢ハイライトライン */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-[22px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />

          {/* 発話者ネームプレート（左上に配置） */}
          {showCharacterName && (
            <div
              className={`absolute -top-3.5 left-6 flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-bold tracking-wider shadow-md sm:left-8 ${
                isUser
                  ? 'border border-white/20 bg-gradient-to-r from-slate-700 to-slate-800 text-slate-100 shadow-black/40'
                  : 'border border-white/30 bg-gradient-to-r from-primary to-primary-hover text-white shadow-[0_2px_10px_var(--color-primary-disabled)]'
              }`}
            >
              <span className="text-[11px] opacity-80">
                {isUser ? '💬' : '✨'}
              </span>
              <span>{speakerName}</span>
            </div>
          )}

          {/* メッセージ本文表示エリア */}
          <div className="scroll-hidden min-h-[3.6rem] max-h-[140px] overflow-y-auto pt-1 sm:min-h-[4.4rem]">
            {displayText ? (
              <p className="text-[15px] font-medium leading-[1.8] text-[var(--aurora-text-strong)] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)] sm:text-[17px]">
                {displayText}
              </p>
            ) : chatProcessing ? (
              <div className="flex items-center gap-2 text-sm text-[var(--aurora-text-muted)]">
                <span className="italic">{characterName}が考え中</span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-75" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-150" />
                </span>
              </div>
            ) : null}
          </div>

          {/* 右下のADV待機 / 発話インジケーター */}
          <div className="absolute bottom-2.5 right-4 flex items-center gap-1.5 sm:bottom-3 sm:right-6">
            {chatProcessing && !isSpeaking ? (
              <div className="flex items-center gap-1 text-[11px] text-white/50">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-75" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary delay-150" />
              </div>
            ) : isSpeaking ? (
              <div className="flex items-center gap-0.5 text-xs text-primary animate-pulse">
                <span className="h-2 w-0.5 rounded-full bg-primary" />
                <span className="h-3 w-0.5 rounded-full bg-primary" />
                <span className="h-2 w-0.5 rounded-full bg-primary" />
              </div>
            ) : (
              <span className="animate-bounce select-none text-[11px] font-bold text-primary">
                ▼
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (assistantTextStyle === 'borderless') {
    return (
      <div
        className={`aurora-scrim pointer-events-none absolute bottom-0 left-0 z-10 w-full px-4 pt-16 ${shouldShowPresetQuestions ? 'pb-[150px] sm:pb-[182px]' : 'pb-[86px] sm:pb-[104px]'}`}
      >
        <div className="animate-aurora-bubble-in mx-auto flex w-full max-w-[760px] flex-col items-center gap-1.5">
          {showCharacterName && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/65">
              {characterName}
            </span>
          )}
          <p className="line-clamp-4 text-center text-base font-medium leading-[1.7] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] sm:text-lg">
            {sanitizedAssistantMessage}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`absolute bottom-0 left-1/2 z-10 flex w-full max-w-[680px] -translate-x-1/2 justify-center px-3 ${shouldShowPresetQuestions ? 'mb-[150px] sm:mb-[182px]' : 'mb-[86px] sm:mb-[104px]'}`}
    >
      <div className="animate-aurora-bubble-in aurora-glass-bubble flex w-full flex-col items-start gap-1.5 rounded-[20px] px-[22px] pb-4 pt-3.5">
        {showCharacterName && (
          <span className="rounded-full bg-primary px-2.5 py-[3px] text-[11px] font-bold tracking-[0.06em] text-white">
            {characterName}
          </span>
        )}
        <div className="line-clamp-4 text-base font-medium leading-[1.75] text-[var(--aurora-text-strong)]">
          {sanitizedAssistantMessage}
        </div>
      </div>
    </div>
  )
}

