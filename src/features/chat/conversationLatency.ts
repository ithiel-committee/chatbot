import { logger } from '@/lib/logger'

export const CONVERSATION_LATENCY_EVENT = 'aituberkit:conversation-latency'
export const CONVERSATION_LATENCY_SUMMARY_EVENT =
  'aituberkit:conversation-latency-summary'

export type ConversationLatencyStage =
  | 'input_received'
  | 'ai_request_started'
  | 'first_text'
  | 'first_speech_segment'
  | 'tts_request_started'
  | 'tts_ready'
  | 'first_audio_chunk'
  | 'playback_started'
  | 'response_complete'

export type ConversationLatencySnapshot = {
  sessionId: string
  startedAt: number
  marks: Partial<Record<ConversationLatencyStage, number>>
  elapsedMs: Partial<Record<ConversationLatencyStage, number>>
}

export type ConversationLatencyStageStats = {
  samples: number
  p50Ms: number
  p95Ms: number
}

export type ConversationLatencySummary = {
  sessions: number
  stages: Partial<
    Record<ConversationLatencyStage, ConversationLatencyStageStats>
  >
}

type ConversationLatencyTrace = {
  sessionId: string
  startedAt: number
  marks: Partial<Record<ConversationLatencyStage, number>>
}

const MAX_TRACES = 20
const traces = new Map<string, ConversationLatencyTrace>()

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now()

const toSnapshot = (
  trace: ConversationLatencyTrace
): ConversationLatencySnapshot => {
  const elapsedMs: ConversationLatencySnapshot['elapsedMs'] = {}
  for (const [stage, markedAt] of Object.entries(trace.marks)) {
    elapsedMs[stage as ConversationLatencyStage] =
      Math.round((markedAt - trace.startedAt) * 10) / 10
  }

  return {
    sessionId: trace.sessionId,
    startedAt: trace.startedAt,
    marks: { ...trace.marks },
    elapsedMs,
  }
}

const percentile = (sortedValues: number[], ratio: number) => {
  if (sortedValues.length === 0) return 0
  const index = Math.ceil(sortedValues.length * ratio) - 1
  return sortedValues[Math.max(0, index)]
}

export const getConversationLatencySummary = (): ConversationLatencySummary => {
  const valuesByStage = new Map<ConversationLatencyStage, number[]>()
  for (const trace of traces.values()) {
    const snapshot = toSnapshot(trace)
    for (const [stage, elapsedMs] of Object.entries(snapshot.elapsedMs)) {
      const typedStage = stage as ConversationLatencyStage
      const values = valuesByStage.get(typedStage) ?? []
      values.push(elapsedMs)
      valuesByStage.set(typedStage, values)
    }
  }

  const stages: ConversationLatencySummary['stages'] = {}
  for (const [stage, values] of valuesByStage) {
    const sortedValues = [...values].sort((left, right) => left - right)
    stages[stage] = {
      samples: sortedValues.length,
      p50Ms: percentile(sortedValues, 0.5),
      p95Ms: percentile(sortedValues, 0.95),
    }
  }
  return { sessions: traces.size, stages }
}

const emitSnapshot = (snapshot: ConversationLatencySnapshot) => {
  logger.log('[ConversationLatency]', snapshot)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ConversationLatencySnapshot>(CONVERSATION_LATENCY_EVENT, {
        detail: snapshot,
      })
    )
  }
}

const emitSummary = () => {
  const summary = getConversationLatencySummary()
  logger.log('[ConversationLatencySummary]', summary)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<ConversationLatencySummary>(
        CONVERSATION_LATENCY_SUMMARY_EVENT,
        { detail: summary }
      )
    )
  }
}

export const startConversationLatencyTrace = (
  sessionId: string,
  inputReceivedAt = now()
): ConversationLatencySnapshot => {
  const trace: ConversationLatencyTrace = {
    sessionId,
    startedAt: inputReceivedAt,
    marks: { input_received: inputReceivedAt },
  }
  traces.set(sessionId, trace)

  while (traces.size > MAX_TRACES) {
    const oldestSessionId = traces.keys().next().value
    if (!oldestSessionId) break
    traces.delete(oldestSessionId)
  }

  const snapshot = toSnapshot(trace)
  emitSnapshot(snapshot)
  return snapshot
}

/**
 * 同一ステージは最初の時刻だけを保持する。first token / first audio のような
 * 初回値を、後続チャンクで上書きしないための仕様。
 */
export const markConversationLatency = (
  sessionId: string,
  stage: Exclude<ConversationLatencyStage, 'input_received'>,
  markedAt = now()
): ConversationLatencySnapshot | null => {
  const trace = traces.get(sessionId)
  if (!trace) return null
  if (trace.marks[stage] !== undefined) return toSnapshot(trace)

  trace.marks[stage] = markedAt
  const snapshot = toSnapshot(trace)
  emitSnapshot(snapshot)
  if (stage === 'playback_started' || stage === 'response_complete') {
    emitSummary()
  }
  return snapshot
}

export const getConversationLatencySnapshot = (
  sessionId: string
): ConversationLatencySnapshot | null => {
  const trace = traces.get(sessionId)
  return trace ? toSnapshot(trace) : null
}

export const __resetConversationLatencyTraces = () => traces.clear()
