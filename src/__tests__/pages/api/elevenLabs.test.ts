/**
 * @jest-environment node
 */

import handler from '@/pages/api/elevenLabs'
import {
  createMockReq,
  createMockRes,
  mockServerSecretGuard,
} from '../../helpers/apiRouteTestUtils'

const originalEnv = { ...process.env }
const originalFetch = global.fetch

describe('/api/elevenLabs', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_VOICE_ID
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    global.fetch = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it('should respond 400 json when API key is missing (B1 regression)', async () => {
    const req = createMockReq({ body: { message: 'hello', voiceId: 'v1' } })
    const res = createMockRes()

    await handler(req, res)

    // new Response を return するとレスポンスが送信されずハングする（B1）
    expect(res._ended).toBe(true)
    expect(res._status).toBe(400)
    expect(res._json).toEqual({
      error: 'Empty API Key',
      errorCode: 'EmptyAPIKey',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should respond 400 json when voice ID is missing (B1 regression)', async () => {
    const req = createMockReq({ body: { message: 'hello', apiKey: 'key' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res._ended).toBe(true)
    expect(res._status).toBe(400)
    expect(res._json).toEqual({
      error: 'Empty Voice ID',
      errorCode: 'EMPTY_PROPERTY',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should synthesize audio with client-provided credentials', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    })

    const req = createMockReq({
      body: { message: 'hello', apiKey: 'key', voiceId: 'v1', language: 'ja' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/v1?output_format=pcm_16000',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'xi-api-key': 'key' }),
      })
    )
    expect(res._status).toBe(200)
    expect(res._headers['Content-Type']).toBe('audio/wav')
    // PCMデータにWAVヘッダー（44バイト）が付与される
    expect(res._headers['Content-Length']).toBe(44 + 16)
    expect(res._ended).toBe(true)
  })

  it('should forward raw PCM chunks in streaming mode', async () => {
    const firstChunk = new Uint8Array([1, 2, 3, 4])
    const secondChunk = new Uint8Array([5, 6])
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(firstChunk)
          controller.enqueue(secondChunk)
          controller.close()
        },
      }),
    })

    const req = createMockReq({
      query: { stream: 'true' },
      body: { message: 'hello', apiKey: 'key', voiceId: 'v1' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/text-to-speech/v1/stream?output_format=pcm_16000',
      expect.any(Object)
    )
    expect(res._status).toBe(200)
    expect(res._headers['Content-Type']).toBe('audio/pcm')
    expect(res._headers['X-Accel-Buffering']).toBe('no')
    expect(res._headers['Content-Length']).toBeUndefined()
    expect(res._writes).toHaveLength(2)
    expect(res._ended).toBe(true)
  })

  it('should wait for drain before reading the next PCM chunk', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]))
          controller.enqueue(new Uint8Array([3, 4]))
          controller.close()
        },
      }),
    })
    const req = createMockReq({
      query: { stream: 'true' },
      body: { message: 'hello', apiKey: 'key', voiceId: 'v1' },
    })
    const res = createMockRes()
    let notifyFirstWrite!: () => void
    const firstWrite = new Promise<void>((resolve) => {
      notifyFirstWrite = resolve
    })
    jest
      .spyOn(res, 'write')
      .mockImplementationOnce((chunk) => {
        res._writeChunks.push(chunk)
        notifyFirstWrite()
        return false
      })
      .mockImplementationOnce((chunk) => {
        res._writeChunks.push(chunk)
        return true
      })

    const handling = handler(req, res)
    await firstWrite

    expect(res.write).toHaveBeenCalledTimes(1)

    res._emit('drain')
    await handling

    expect(res.write).toHaveBeenCalledTimes(2)
    expect(res._ended).toBe(true)
  })

  it('should cancel the upstream stream when the client disconnects', async () => {
    const cancel = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2]))
        },
        cancel,
      }),
    })
    const req = createMockReq({
      query: { stream: 'true' },
      body: { message: 'hello', apiKey: 'key', voiceId: 'v1' },
    })
    const res = createMockRes()
    jest.spyOn(res, 'write').mockImplementation((chunk) => {
      res._writeChunks.push(chunk)
      res._emit('close')
      return true
    })

    await handler(req, res)
    await Promise.resolve()

    expect(cancel).toHaveBeenCalledWith('downstream closed')
  })

  it('should abort the upstream request when the client disconnects before headers', async () => {
    let signal!: AbortSignal
    let notifyFetchStarted!: () => void
    const fetchStarted = new Promise<void>((resolve) => {
      notifyFetchStarted = resolve
    })
    ;(global.fetch as jest.Mock).mockImplementation(
      (_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal
        notifyFetchStarted()
        return new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
      }
    )
    const req = createMockReq({
      query: { stream: 'true' },
      body: { message: 'hello', apiKey: 'key', voiceId: 'v1' },
    })
    const res = createMockRes()

    const handling = handler(req, res)
    await fetchStarted
    res._emit('close')
    await handling

    expect(signal.aborted).toBe(true)
    expect(res._json).toBeNull()
  })

  it('should end an already-started response when upstream reading fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        pull() {
          throw new Error('stream failed')
        },
      }),
    })
    const req = createMockReq({
      query: { stream: 'true' },
      body: { message: 'hello', apiKey: 'key', voiceId: 'v1' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(res._json).toBeNull()
    expect(res._ended).toBe(true)
  })

  it('should reject server env key usage when guard mode is not configured', async () => {
    process.env.ELEVENLABS_API_KEY = 'server-key'
    process.env.ELEVENLABS_VOICE_ID = 'server-voice'

    const req = createMockReq({ body: { message: 'hello' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({
        errorCode: 'ServerSecretAccessDenied',
        feature: 'elevenLabs',
      })
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('should allow server env key usage from same-origin request in demo mode', async () => {
    const { headers } = mockServerSecretGuard('demo')
    process.env.ELEVENLABS_API_KEY = 'server-key'
    process.env.ELEVENLABS_VOICE_ID = 'server-voice'
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16),
    })

    const req = createMockReq({ body: { message: 'hello' }, headers })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(res._headers['Content-Type']).toBe('audio/wav')
  })

  it('should respond 500 on upstream error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 502 })

    const req = createMockReq({
      body: { message: 'hello', apiKey: 'key', voiceId: 'v1' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(500)
    expect(res._json).toEqual(
      expect.objectContaining({ error: expect.any(String) })
    )
  })
})
