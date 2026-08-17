import { SegmenterEvent } from './types'
import {
  extractEmotion,
  extractMotionTag,
  extractSentence,
} from './tagExtractors'

const CODE_DELIMITER = '```'
// 防御的な反復上限。push/flushは常に入力を消費して返る構造のため
// 原理的には到達しないが、正規表現の変更等による退行時のフリーズを防ぐ。
const MAX_ITERATIONS = 100000
const DEFAULT_COMMA_MIN_CHARS = 10

export type SpeechSegmenterOptions = {
  /** 読点より前の最小文字数。低遅延TTSでは5（読点込み6文字）を指定する。 */
  firstSpeechCommaMinChars?: number
}

const SHORT_FIRST_SEGMENT_VOICES = new Set([
  'voicevox',
  'aivis_speech',
  'google',
  'openai',
  'aivis_cloud_api',
])

/**
 * 一括合成に時間がかかるTTSは、最初の読点だけ短く区切って初回再生を前倒しする。
 * 2文目以降は通常の10文字閾値へ戻るため、細切れ化を最小限に抑える。
 */
export function getFirstSpeechCommaMinChars(voice: string): number {
  return SHORT_FIRST_SEGMENT_VOICES.has(voice) ? 5 : DEFAULT_COMMA_MIN_CHARS
}

/**
 * ストリーミングテキストを表示・発話・コードブロックの3種イベントへ
 * 逐次変換する状態機械。副作用を持たない。
 *
 * 仕様: docs/streaming-pipeline-design.md §4
 *
 * - 表示カーソル（displayHold）: pushごとに即時確定。保留されるのは
 *   コード区切りの可能性があるチャンク末尾のバッククォート断片のみ。
 * - 発話カーソル（speechBuffer）: 文の確定（extractSentence）を待つ。
 * - タグ持ち越し: 次のタグ・コードブロック境界・改行・flushまで持続する。
 */
export class SpeechSegmenter {
  private mode: 'text' | 'code' = 'text'
  private speechBuffer = ''
  private displayHold = ''
  private codeBuffer = ''
  private emotionTag = ''
  private motionTag = ''
  // 直近に明示的なタグが出現し、まだ文として発話されていない状態か
  // （正規化表示でのタグ重複防止用。types.tsのemotionTagExplicit参照）
  private tagExplicitPending = false
  // コードブロック開始直後の言語指定行（```js 等）の除去待ちフラグ
  private awaitingLangLine = false
  private hasEmittedSpeech = false
  private readonly firstSpeechCommaMinChars: number

  constructor(options: SpeechSegmenterOptions = {}) {
    this.firstSpeechCommaMinChars =
      options.firstSpeechCommaMinChars ?? DEFAULT_COMMA_MIN_CHARS
  }

  push(chunk: string): SegmenterEvent[] {
    const events: SegmenterEvent[] = []
    let work = chunk
    let iterations = 0
    while (work.length > 0 && iterations++ < MAX_ITERATIONS) {
      work =
        this.mode === 'text'
          ? this.consumeText(work, events)
          : this.consumeCode(work, events)
    }
    return events
  }

  flush(): SegmenterEvent[] {
    const events: SegmenterEvent[] = []
    if (this.mode === 'text') {
      // 保留していたバッククォート断片を通常テキストとして確定
      if (this.displayHold) {
        events.push({ kind: 'display', text: this.displayHold })
        this.speechBuffer += this.displayHold
        this.displayHold = ''
      }
      this.drainSentences(events, { force: true })
    } else {
      // ストリームがコードブロック内で終端した場合はコードとして確定（現行踏襲）
      this.emitCode(events, this.codeBuffer)
      this.codeBuffer = ''
      this.mode = 'text'
      this.awaitingLangLine = false
    }
    this.emotionTag = ''
    this.motionTag = ''
    this.tagExplicitPending = false
    return events
  }

  /** textモード: 作業領域を消費し、残余（codeモードで処理すべき分）を返す */
  private consumeText(work: string, events: SegmenterEvent[]): string {
    const combined = this.displayHold + work
    this.displayHold = ''

    const delimiterIndex = combined.indexOf(CODE_DELIMITER)
    if (delimiterIndex !== -1) {
      const before = combined.slice(0, delimiterIndex)
      if (before) {
        events.push({ kind: 'display', text: before })
        this.speechBuffer += before
      }
      // コードブロック直前の未確定文は発話として強制確定する（D2の修正）
      this.drainSentences(events, { force: true })
      this.mode = 'code'
      this.codeBuffer = ''
      this.awaitingLangLine = true
      return combined.slice(delimiterIndex + CODE_DELIMITER.length)
    }

    // チャンク末尾のバッククォート断片はコード区切りの可能性があるため保留（D5の修正）
    const holdMatch = combined.match(/`{1,2}$/)
    const holdLength = holdMatch ? holdMatch[0].length : 0
    const displayText = holdLength ? combined.slice(0, -holdLength) : combined
    this.displayHold = holdLength ? combined.slice(-holdLength) : ''

    if (displayText) {
      events.push({ kind: 'display', text: displayText })
      this.speechBuffer += displayText
      this.drainSentences(events)
    }
    return ''
  }

  /** codeモード: 作業領域を消費し、残余（textモードで処理すべき分）を返す */
  private consumeCode(work: string, events: SegmenterEvent[]): string {
    this.codeBuffer += work

    if (this.awaitingLangLine) {
      // 言語指定行は改行到着まで保留して除去する（チャンク割れ非依存 / C9）
      const langMatch = this.codeBuffer.match(/^ *(\w+)? *\n/)
      if (langMatch) {
        this.codeBuffer = this.codeBuffer.slice(langMatch[0].length)
        this.awaitingLangLine = false
      } else if (/^ *(\w*)? *$/.test(this.codeBuffer)) {
        // まだ言語指定行の可能性がある（改行未到着）→ 次のpushを待つ
        return ''
      } else {
        this.awaitingLangLine = false
      }
    }

    const delimiterIndex = this.codeBuffer.indexOf(CODE_DELIMITER)
    if (delimiterIndex === -1) {
      // 閉じ区切りの部分列を含めcodeBufferごと次のpushを待つ
      return ''
    }

    this.emitCode(events, this.codeBuffer.slice(0, delimiterIndex))
    const rest = this.codeBuffer
      .slice(delimiterIndex + CODE_DELIMITER.length)
      .trimStart()
    this.codeBuffer = ''
    this.mode = 'text'
    this.awaitingLangLine = false
    // コードブロック境界でタグ持ち越しをリセット（現行踏襲）
    this.emotionTag = ''
    this.motionTag = ''
    this.tagExplicitPending = false
    return rest
  }

  private emitCode(events: SegmenterEvent[], content: string) {
    if (content.trim()) {
      events.push({ kind: 'code', content })
    }
  }

  private drainSentences(
    events: SegmenterEvent[],
    { force = false }: { force?: boolean } = {}
  ) {
    let iterations = 0
    while (this.speechBuffer.length > 0 && iterations++ < MAX_ITERATIONS) {
      const { emotionTag, remainingText: afterEmotion } = extractEmotion(
        this.speechBuffer
      )
      if (emotionTag) {
        this.emotionTag = emotionTag
        this.tagExplicitPending = true
      }
      const { motionTag, remainingText: afterMotion } =
        extractMotionTag(afterEmotion)
      if (motionTag) this.motionTag = motionTag

      const { sentence, remainingText: afterSentence } = extractSentence(
        afterMotion,
        {
          commaMinChars: this.hasEmittedSpeech
            ? DEFAULT_COMMA_MIN_CHARS
            : this.firstSpeechCommaMinChars,
        }
      )

      if (sentence) {
        this.emitSpeech(events, sentence)
        // 改行を跨いだらタグ持ち越しをリセット（設計§4）。
        // extractSentenceは残余をtrimStartするため、文末とtrim済み区間の
        // 双方から改行の通過を判定する。
        const trimmedGap = afterMotion.slice(
          sentence.length,
          afterMotion.length - afterSentence.length
        )
        if (sentence.endsWith('\n') || trimmedGap.includes('\n')) {
          this.emotionTag = ''
          this.motionTag = ''
        }
        this.speechBuffer = afterSentence
        continue
      }

      if (force) {
        // flush時・コード境界: 文として未確定の残余も発話として確定
        if (afterMotion) {
          this.emitSpeech(events, afterMotion)
        }
        this.speechBuffer = ''
      }
      break
    }
  }

  private emitSpeech(events: SegmenterEvent[], text: string) {
    events.push({
      kind: 'speech',
      text,
      emotionTag: this.emotionTag,
      motionTag: this.motionTag || undefined,
      emotionTagExplicit: this.tagExplicitPending,
    })
    this.tagExplicitPending = false
    this.hasEmittedSpeech = true
  }
}
