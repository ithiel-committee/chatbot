/**
 * @jest-environment node
 */

import handler from '@/pages/api/openAITTS'
import { createMockReq, createMockRes } from '../../helpers/apiRouteTestUtils'

const originalFetch = global.fetch

describe('/api/openAITTS', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  it('should return 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(405)
    expect(res._json).toEqual({ error: 'Method not allowed' })
  })

  it('should return 400 when message is missing', async () => {
    const req = createMockReq({
      body: { voice: 'alloy', model: 'tts-1', apiKey: 'key' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Missing required parameters' })
  })

  it('should return 400 when voice is missing', async () => {
    const req = createMockReq({
      body: { message: 'hello', model: 'tts-1', apiKey: 'key' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
  })

  it('should return 400 when model is missing', async () => {
    const req = createMockReq({
      body: { message: 'hello', voice: 'alloy', apiKey: 'key' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
  })

  it('should return 400 when apiKey is missing and no env vars set', async () => {
    const originalTtsKey = process.env.OPENAI_TTS_KEY
    const originalApiKey = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_TTS_KEY
    delete process.env.OPENAI_API_KEY

    const req = createMockReq({
      body: { message: 'hello', voice: 'alloy', model: 'tts-1' },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)

    process.env.OPENAI_TTS_KEY = originalTtsKey
    process.env.OPENAI_API_KEY = originalApiKey
  })

  it('should return audio buffer on success', async () => {
    const fakeBuffer = Buffer.from('fake-audio')
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(fakeBuffer, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      })
    )

    const req = createMockReq({
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1.0,
        apiKey: 'test-key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._headers['Content-Type']).toBe('audio/mpeg')
    expect(res._body).toBeTruthy()
  })

  it('should proxy raw PCM chunks in streaming mode', async () => {
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3, 4]))
        controller.close()
      },
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(upstream, {
        status: 200,
        headers: { 'content-type': 'audio/pcm' },
      })
    )

    const req = createMockReq({
      query: { stream: 'true' },
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1,
        apiKey: 'key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    const requestBody = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    expect(requestBody.response_format).toBe('pcm')
    expect(res._headers['Content-Type']).toBe('audio/pcm')
    expect(res._headers['X-Audio-Sample-Rate']).toBe('24000')
    expect(Buffer.concat(res._writeChunks as Buffer[])).toEqual(
      Buffer.from([1, 2, 3, 4])
    )
  })

  it('should wait for drain before reading the next PCM chunk', async () => {
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
        controller.enqueue(new Uint8Array([3, 4]))
        controller.close()
      },
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(upstream, { status: 200 })
    )
    const req = createMockReq({
      query: { stream: 'true' },
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1,
        apiKey: 'key',
      },
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

  it('should cancel the upstream PCM stream when the client disconnects', async () => {
    const cancel = jest.fn()
    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
      },
      cancel,
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(upstream, { status: 200 })
    )
    const req = createMockReq({
      query: { stream: 'true' },
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1,
        apiKey: 'key',
      },
    })
    const res = createMockRes()
    jest.spyOn(res, 'write').mockImplementation((chunk) => {
      res._writeChunks.push(chunk)
      res._emit('close')
      return true
    })

    await handler(req, res)
    await Promise.resolve()

    expect(cancel).toHaveBeenCalledTimes(1)
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
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1,
        apiKey: 'key',
      },
    })
    const res = createMockRes()

    const handling = handler(req, res)
    await fetchStarted
    res._emit('close')
    await handling

    expect(signal.aborted).toBe(true)
    expect(res._json).toBeNull()
  })

  it('should end an already-started PCM response when upstream reading fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const upstream = new ReadableStream<Uint8Array>({
      pull() {
        throw new Error('stream failed')
      },
    })
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(upstream, { status: 200 })
    )
    const req = createMockReq({
      query: { stream: 'true' },
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1,
        apiKey: 'key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(res._json).toBeNull()
    expect(res._ended).toBe(true)
  })

  it('should add emotional instructions for gpt-4o model', async () => {
    const fakeBuffer = Buffer.from('audio')
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(fakeBuffer, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      })
    )

    const req = createMockReq({
      body: {
        message: 'I am happy',
        voice: 'alloy',
        model: 'gpt-4o-audio',
        speed: 1.0,
        apiKey: 'key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    const callArgs = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    expect(callArgs.instructions).toContain('rich emotional expression')
  })

  it('should not add instructions for non-gpt-4o models', async () => {
    const fakeBuffer = Buffer.from('audio')
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(fakeBuffer, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg' },
      })
    )

    const req = createMockReq({
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1.0,
        apiKey: 'key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    const callArgs = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body
    )
    expect(callArgs.instructions).toBeUndefined()
  })

  it('should return 500 on OpenAI API error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'API error' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    )
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    const req = createMockReq({
      body: {
        message: 'hello',
        voice: 'alloy',
        model: 'tts-1',
        speed: 1.0,
        apiKey: 'key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(500)
    expect(res._json).toEqual({
      error: 'Failed to generate speech',
      errorCode: 'OpenAITTSUpstreamError',
      status: 401,
    })
    consoleErrorSpy.mockRestore()
  })
})
