import { synthesizeVoiceGSVIApi } from '@/features/messages/synthesizeVoiceGSVI'
import type { Talk } from '@/features/messages/messages'

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('synthesizeVoiceGSVIApi', () => {
  const mockTalk: Talk = {
    emotion: 'neutral',
    message: 'Hello world',
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should send the configured server URL through the AITuberKit API', async () => {
    const mockBuffer = new ArrayBuffer(8)
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () =>
        Promise.resolve({
          arrayBuffer: () => Promise.resolve(mockBuffer),
        }),
    })

    await synthesizeVoiceGSVIApi(
      mockTalk,
      'http://localhost:5000/',
      'character-1',
      2,
      1.0
    )

    expect(mockFetch).toHaveBeenCalledWith('/api/tts-gsvi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello world',
        serverUrl: 'http://localhost:5000/',
        character: 'character-1',
        batchSize: 2,
        speed: 1,
      }),
    })
  })

  it('should return ArrayBuffer decoded from blob on success', async () => {
    const mockBuffer = new ArrayBuffer(16)
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () =>
        Promise.resolve({
          arrayBuffer: () => Promise.resolve(mockBuffer),
        }),
    })

    const result = await synthesizeVoiceGSVIApi(
      mockTalk,
      'http://localhost:5000',
      'character-1',
      2,
      1.0
    )

    expect(result).toBe(mockBuffer)
  })

  it('should throw with status code on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
    })

    await expect(
      synthesizeVoiceGSVIApi(
        mockTalk,
        'http://localhost:5000',
        'character-1',
        2,
        1.0
      )
    ).rejects.toThrow(
      'GSVIでエラーが発生しました: GSVI APIからの応答が異常です。ステータスコード: 404'
    )
  })

  it('should throw wrapped error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(
      synthesizeVoiceGSVIApi(
        mockTalk,
        'http://localhost:5000',
        'character-1',
        2,
        1.0
      )
    ).rejects.toThrow('GSVIでエラーが発生しました: Network error')
  })
})
