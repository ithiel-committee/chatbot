import { logger } from '@/lib/logger'
import homeStore from '@/features/stores/home'
import { Message } from '@/features/messages/messages'
import { generateMessageId } from '@/utils/messageUtils'
import { SegmenterEvent, SpeechEvent } from './types'

import { DEFAULT_VOICE_WAIT_TIMEOUT_MS } from './constants'

export type UpsertMessageFn = (message: Message) => void

const defaultUpsert: UpsertMessageFn = (message) =>
  homeStore.getState().upsertMessage(message)

export type GateReleaseReason =
  | 'playback_started'
  | 'timeout'
  | 'code_block'
  | 'stream_error'
  | 'no_speech'
  | 'manual'

export type MessageLogWriterOptions = {
  /** 音声待機ゲートを有効にするか（trueの場合、releaseGateが呼ばれるかタイムアウトまでupsertを保留） */
  gated?: boolean
  /** ゲートの自動開放タイムアウト（ミリ秒）。デフォルト5000ms */
  gateTimeoutMs?: number
}

/**
 * ストリーミング応答（processAIResponse）用のchatLog書き込み。
 *
 * 現行挙動の踏襲（設計§5.1）:
 * - 最初のupsertは最初の非空テキストまたはthinkingチャンクで発生
 * - 中間upsertは非トリム、終端の最終upsertはトリム済み
 * - コードブロックはIDなしの `role: 'code'` メッセージとしてupsertし、
 *   以降のテキストは新しいメッセージIDで表示する
 * - 音声待機ゲート（gated）が有効な場合、最初の音声再生開始（または5秒タイムアウト）まで
 *   本文のupsertを保留して音声とテキストを同期させる
 */
export class MessageLogWriter {
  private currentMessageId: string | null = null
  private content = ''
  private thinking = ''
  private isGated: boolean
  private gateTimer: NodeJS.Timeout | null = null
  private gateStartTime: number
  private gatePromise: Promise<void> | null = null
  private gateResolve: (() => void) | null = null
  private hasLoggedBuffering = false

  constructor(
    private upsert: UpsertMessageFn = defaultUpsert,
    options: MessageLogWriterOptions = {}
  ) {
    this.isGated = Boolean(options.gated)
    this.gateStartTime = Date.now()
    const timeoutMs = options.gateTimeoutMs ?? DEFAULT_VOICE_WAIT_TIMEOUT_MS

    if (this.isGated) {
      this.gatePromise = new Promise((resolve) => {
        this.gateResolve = resolve
      })

      if (timeoutMs > 0) {
        this.gateTimer = setTimeout(() => {
          this.releaseGate('timeout')
        }, timeoutMs)
      }

      logger.log(
        `[VoiceGate] 🚪 音声待機ゲート有効化: timeout=${timeoutMs}ms (音声再生開始またはタイムアウトまでテキスト表示を保留します)`
      )
    }
  }

  get gated(): boolean {
    return this.isGated
  }

  /**
   * ゲートが開放されるまで待機する（ストリーム完了後も音声再生開始を待つ用）
   */
  async waitForGate(): Promise<void> {
    if (!this.isGated || !this.gatePromise) return
    logger.log('[VoiceGate] ⏳ LLMテキスト受信完了。音声再生開始を待機中...')
    await this.gatePromise
  }

  /**
   * 音声待機ゲートを開放し、保留されていたテキストを直ちにchatLogへ反映する。
   * 音声再生開始時・タイムアウト時・ストリーム終端・エラー時に呼ばれる。
   */
  releaseGate(reason: GateReleaseReason = 'manual'): void {
    if (!this.isGated) return
    this.isGated = false

    if (this.gateTimer) {
      clearTimeout(this.gateTimer)
      this.gateTimer = null
    }

    const elapsedMs = Date.now() - this.gateStartTime
    const reasonTextMap: Record<GateReleaseReason, string> = {
      playback_started: '音声再生開始',
      timeout: 'タイムアウト上限',
      code_block: 'コードブロック受信',
      stream_error: 'ストリームエラー',
      no_speech: '発話セグメントなし',
      manual: '手動開放',
    }

    const trigger = reasonTextMap[reason] ?? reason
    logger.log(
      `[VoiceGate] 🔓 ゲート開放 (トリガー: ${trigger}, 待機時間: ${elapsedMs}ms): テキストをチャットログに反映します`
    )

    if (this.gateResolve) {
      this.gateResolve()
      this.gateResolve = null
    }

    // ゲート開放時、これまでに保留されていたコンテンツがあれば直ちにupsert
    if (this.content && this.currentMessageId) {
      this.upsert({
        id: this.currentMessageId,
        role: 'assistant',
        content: this.content,
        ...(this.thinking && { thinking: this.thinking }),
      })
    }
  }

  appendThinking(chunk: string) {
    this.thinking += chunk
    if (this.currentMessageId === null) {
      this.currentMessageId = generateMessageId()
    }
    this.upsert({
      id: this.currentMessageId,
      role: 'assistant',
      content: this.isGated ? '' : this.content || '',
      thinking: this.thinking,
    })
  }

  appendDisplay(text: string) {
    if (!text) return
    if (this.currentMessageId === null) {
      this.currentMessageId = generateMessageId()
    }
    this.content += text

    // ゲートが閉まっている間は upsert を保留（バッファへの蓄積のみ行う）
    if (this.isGated) {
      if (!this.hasLoggedBuffering) {
        this.hasLoggedBuffering = true
        logger.log(
          `[VoiceGate] ⏳ テキスト保留中: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}" (音声再生開始を待機中)`
        )
      }
      return
    }

    this.upsert({
      id: this.currentMessageId,
      role: 'assistant',
      content: this.content,
      ...(this.thinking && { thinking: this.thinking }),
    })
  }

  appendCodeBlock(content: string) {
    // コードブロック到着時はゲートを開放
    this.releaseGate('code_block')
    if (content.trim()) {
      this.upsert({ role: 'code', content })
    }
    // コードブロック境界で新しいアシスタントメッセージを開始（D3の修正）
    this.currentMessageId = generateMessageId()
    this.content = ''
  }

  /** 終端処理。記憶保存に使う最終メッセージ内容（トリム済み）を返す */
  finalize(): string {
    if (this.isGated) {
      this.releaseGate('manual')
    }
    const trimmed = this.content.trim()
    if (trimmed) {
      this.upsert({
        id: this.currentMessageId ?? generateMessageId(),
        role: 'assistant',
        content: trimmed,
        ...(this.thinking && { thinking: this.thinking }),
      })
    }
    return trimmed
  }
}

/**
 * 完成テキスト（speakMessageHandler）用のchatLog書き込み。
 *
 * 現行のspeakMessageHandlerは表示を生テキストではなく
 * `${emotionTag} ${sentence}` のスペース結合（モーションタグは表示から除外）で
 * 再構成するため、その形式を保存する（設計§5.1 / レビューM4）。
 */
export class NormalizedMessageLogWriter {
  private currentMessageId = generateMessageId()
  private accumulated = ''

  constructor(private upsert: UpsertMessageFn = defaultUpsert) {}

  handleEvent(event: SegmenterEvent) {
    if (event.kind === 'speech') {
      this.appendSpeech(event)
    } else if (event.kind === 'code') {
      this.appendCodeBlock(event.content)
    }
    // displayイベントは使用しない（speechイベントから正規化形式を再構成する）
  }

  private appendSpeech(event: SpeechEvent) {
    // 持ち越し（C4）による暗黙タグは表示に含めない。タグが文頭に
    // 明示的に現れた文のみプレフィックスする（旧speakMessageHandlerと同形式）
    const showTag = event.emotionTag && event.emotionTagExplicit
    const aiText = showTag ? `${event.emotionTag} ${event.text}` : event.text
    this.accumulated += aiText + ' '
  }

  private appendCodeBlock(content: string) {
    this.flushAccumulated()
    if (content.trim()) {
      this.upsert({
        id: generateMessageId(),
        role: 'code',
        content,
      })
    }
    this.currentMessageId = generateMessageId()
  }

  finalize() {
    this.flushAccumulated()
  }

  private flushAccumulated() {
    const trimmed = this.accumulated.trim()
    if (trimmed) {
      this.upsert({
        id: this.currentMessageId,
        role: 'assistant',
        content: trimmed,
      })
      this.accumulated = ''
    }
  }
}
