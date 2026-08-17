import {
  __resetConversationLatencyTraces,
  CONVERSATION_LATENCY_EVENT,
  CONVERSATION_LATENCY_SUMMARY_EVENT,
  getConversationLatencySummary,
  getConversationLatencySnapshot,
  markConversationLatency,
  startConversationLatencyTrace,
  type ConversationLatencySnapshot,
  type ConversationLatencySummary,
} from '@/features/chat/conversationLatency'

describe('conversationLatency', () => {
  beforeEach(() => {
    __resetConversationLatencyTraces()
  })

  it('keeps first marks and reports elapsed milliseconds', () => {
    startConversationLatencyTrace('session-1', 100)
    markConversationLatency('session-1', 'first_text', 180)
    markConversationLatency('session-1', 'first_text', 250)
    markConversationLatency('session-1', 'playback_started', 420)

    expect(getConversationLatencySnapshot('session-1')?.elapsedMs).toEqual({
      input_received: 0,
      first_text: 80,
      playback_started: 320,
    })
  })

  it('emits browser events for live diagnostics', () => {
    const snapshots: ConversationLatencySnapshot[] = []
    const listener = (event: Event) => {
      snapshots.push((event as CustomEvent<ConversationLatencySnapshot>).detail)
    }
    window.addEventListener(CONVERSATION_LATENCY_EVENT, listener)

    startConversationLatencyTrace('session-2', 10)
    markConversationLatency('session-2', 'tts_request_started', 25)

    window.removeEventListener(CONVERSATION_LATENCY_EVENT, listener)
    expect(snapshots).toHaveLength(2)
    expect(snapshots.at(-1)?.elapsedMs.tts_request_started).toBe(15)
  })

  it('ignores marks for unknown sessions', () => {
    expect(markConversationLatency('missing', 'first_text', 10)).toBeNull()
  })

  it('calculates rolling P50 and P95 values', () => {
    const summaries: ConversationLatencySummary[] = []
    const listener = (event: Event) => {
      summaries.push((event as CustomEvent<ConversationLatencySummary>).detail)
    }
    window.addEventListener(CONVERSATION_LATENCY_SUMMARY_EVENT, listener)

    for (let index = 1; index <= 20; index++) {
      startConversationLatencyTrace(`session-${index}`, 0)
      markConversationLatency(
        `session-${index}`,
        'playback_started',
        index * 10
      )
    }

    window.removeEventListener(CONVERSATION_LATENCY_SUMMARY_EVENT, listener)
    const stats = getConversationLatencySummary().stages.playback_started
    expect(stats).toEqual({ samples: 20, p50Ms: 100, p95Ms: 190 })
    expect(summaries).toHaveLength(20)
  })
})
