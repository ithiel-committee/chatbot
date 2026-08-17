import {
  synthesizeVoiceElevenlabsApi,
  synthesizeVoiceElevenlabsStreamApi,
} from '@/features/messages/synthesizeVoiceElevenlabs'
import type { Talk } from '@/features/messages/messages'

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('synthesizeVoiceElevenlabsApi', () => {
  const mockTalk: Talk = {
    emotion: 'neutral',
    message: 'Hello world',
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should send correct request to /api/elevenLabs', async () => {
    const mockBuffer = new ArrayBuffer(8)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer),
    })

    await synthesizeVoiceElevenlabsApi(mockTalk, 'key', 'voice-id', 'ja')

    expect(mockFetch).toHaveBeenCalledWith('/api/elevenLabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello world',
        voiceId: 'voice-id',
        apiKey: 'key',
        language: 'ja',
      }),
    })
  })

  it('should return ArrayBuffer on success', async () => {
    const mockBuffer = new ArrayBuffer(16)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer),
    })

    const result = await synthesizeVoiceElevenlabsApi(
      mockTalk,
      'key',
      'voice-id',
      'ja'
    )

    expect(result).toBe(mockBuffer)
  })

  it('should throw with status code on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
    })

    await expect(
      synthesizeVoiceElevenlabsApi(mockTalk, 'key', 'voice-id', 'ja')
    ).rejects.toThrow(
      'ElevenLabsでエラーが発生しました: ElevenLabs APIからの応答が異常です。ステータスコード: 429'
    )
  })

  it('should throw wrapped error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(
      synthesizeVoiceElevenlabsApi(mockTalk, 'key', 'voice-id', 'ja')
    ).rejects.toThrow('ElevenLabsでエラーが発生しました: Network error')
  })

  it('should throw generic error for non-Error exceptions', async () => {
    mockFetch.mockRejectedValue('string error')

    await expect(
      synthesizeVoiceElevenlabsApi(mockTalk, 'key', 'voice-id', 'ja')
    ).rejects.toThrow('ElevenLabsで不明なエラーが発生しました')
  })

  it('should expose PCM16 chunks without buffering the full response', async () => {
    const onFirstChunk = jest.fn()
    const firstChunk = new Uint8Array([1, 2, 3, 4])
    const secondChunk = new Uint8Array([5, 6])
    mockFetch.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(firstChunk)
          controller.enqueue(secondChunk)
          controller.close()
        },
      }),
    })

    const result = await synthesizeVoiceElevenlabsStreamApi(
      mockTalk,
      'key',
      'voice-id',
      'ja',
      onFirstChunk
    )
    const reader = result.stream.getReader()

    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: firstChunk,
    })
    await expect(reader.read()).resolves.toEqual({
      done: false,
      value: secondChunk,
    })
    expect(result.sampleRate).toBe(16000)
    expect(onFirstChunk).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/elevenLabs?stream=true',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('should continue streaming when the first chunk observer throws', async () => {
    const chunk = new Uint8Array([1, 2])
    mockFetch.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(chunk)
          controller.close()
        },
      }),
    })

    const result = await synthesizeVoiceElevenlabsStreamApi(
      mockTalk,
      'key',
      'voice-id',
      'ja',
      () => {
        throw new Error('observer failed')
      }
    )

    await expect(result.stream.getReader().read()).resolves.toEqual({
      done: false,
      value: chunk,
    })
  })

  it('should reject an empty streaming response body', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: null })

    await expect(
      synthesizeVoiceElevenlabsStreamApi(mockTalk, 'key', 'voice-id', 'ja')
    ).rejects.toThrow('ElevenLabs APIの音声ストリームが空です')
  })
})
