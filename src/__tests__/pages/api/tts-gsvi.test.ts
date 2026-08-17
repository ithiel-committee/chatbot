/**
 * @jest-environment node
 */

import handler from '@/pages/api/tts-gsvi'
import {
  createMockReq,
  createMockRes,
} from '@/__tests__/helpers/apiRouteTestUtils'

const originalEnv = { ...process.env }
const originalFetch = global.fetch

const requestBody = {
  message: 'hello',
  serverUrl: '',
  character: 'character-1',
  batchSize: 2,
  speed: 1,
}

function createLocalRequest() {
  return createMockReq({
    method: 'POST',
    body: { ...requestBody },
    headers: { host: 'localhost:3000' },
    socket: { remoteAddress: '127.0.0.1' } as never,
  })
}

describe('/api/tts-gsvi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    delete process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS
    delete process.env.GSVI_TTS_URL
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'audio/wav' },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }) as jest.Mock
  })

  afterAll(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it('proxies a same-machine GSVI request by default', async () => {
    const req = createLocalRequest()
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:5000/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character: 'character-1',
        emotion: 'default',
        text: 'hello',
        batch_size: 2,
        speed: '1',
        stream: true,
      }),
    })
    expect(res._headers['Content-Type']).toBe('audio/wav')
    expect(res._ended).toBe(true)
  })

  it('rejects a remote request to the local GSVI server by default', async () => {
    const req = createMockReq({
      method: 'POST',
      body: requestBody,
      headers: { host: 'aituberkit.example.com' },
      socket: { remoteAddress: '198.51.100.20' } as never,
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({
        errorCode: 'ServerSecretAccessDenied',
        feature: 'tts-gsvi',
      })
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects a non-allowlisted public GSVI URL', async () => {
    const req = createLocalRequest()
    req.body.serverUrl = 'https://gsvitts.example/tts'
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Server URL is not allowed' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('allows an allowlisted public GSVI URL', async () => {
    process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS =
      'https://gsvitts.example'
    const req = createLocalRequest()
    req.body.serverUrl = 'https://gsvitts.example/tts'
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://gsvitts.example/tts',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('relays an upstream error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    }) as jest.Mock
    const req = createLocalRequest()
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(503)
    expect(res._json).toEqual({ error: 'GSVI API returned status 503' })
  })

  it.each([
    ['message', { message: undefined }],
    ['character', { character: '' }],
    ['batchSize', { batchSize: Number.NaN }],
    ['speed', { speed: null }],
  ])('rejects an invalid %s before calling GSVI', async (_field, override) => {
    const req = createLocalRequest()
    req.body = { ...req.body, ...override }
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Invalid GSVI request body' })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
