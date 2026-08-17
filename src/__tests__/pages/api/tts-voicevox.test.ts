/**
 * @jest-environment node
 */

const mockAxiosPost = jest.fn()
jest.mock('axios', () => ({
  post: (...args: unknown[]) => mockAxiosPost(...args),
}))

import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/tts-voicevox'

const originalEnv = { ...process.env }

function createMockReq(
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return {
    method: 'POST',
    body: {},
    headers: { host: 'localhost:3000' },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as NextApiRequest
}

function createMockRes() {
  const res = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, string>,
    _piped: null as unknown,
    status(code: number) {
      res._status = code
      return res
    },
    json(data: unknown) {
      res._json = data
      return res
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value
      return res
    },
    end: jest.fn(),
  }
  return res as unknown as NextApiResponse & {
    _status: number
    _json: unknown
    _headers: Record<string, string>
  }
}

describe('/api/tts-voicevox', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.VOICEVOX_SERVER_URL
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = originalEnv
  })

  it('should call audio_query and synthesis endpoints', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    const mockPipe = jest.fn()
    mockAxiosPost
      .mockResolvedValueOnce({
        data: { speedScale: 1, pitchScale: 0, intonationScale: 1 },
      })
      .mockResolvedValueOnce({
        data: { pipe: mockPipe },
      })

    const req = createMockReq({
      body: {
        text: 'こんにちは',
        speaker: 1,
        speed: 1.2,
        pitch: 0.1,
        intonation: 1.5,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    // First call: audio_query
    expect(mockAxiosPost.mock.calls[0][0]).toContain('/audio_query')
    expect(mockAxiosPost.mock.calls[0][0]).toContain('speaker=1')

    // Second call: synthesis with modified query data
    expect(mockAxiosPost.mock.calls[1][0]).toContain('/synthesis')
    const queryData = mockAxiosPost.mock.calls[1][1]
    expect(queryData.speedScale).toBe(1.2)
    expect(queryData.pitchScale).toBe(0.1)
    expect(queryData.intonationScale).toBe(1.5)
  })

  it('should set Content-Type to audio/wav', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    const mockPipe = jest.fn()
    mockAxiosPost
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { pipe: mockPipe } })

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._headers['Content-Type']).toBe('audio/wav')
  })

  it('should use allowlisted custom serverUrl when provided', async () => {
    process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS = 'http://custom:8080'
    const mockPipe = jest.fn()
    mockAxiosPost
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { pipe: mockPipe } })

    const req = createMockReq({
      body: {
        text: 'test',
        speaker: 1,
        speed: 1,
        pitch: 0,
        intonation: 1,
        serverUrl: 'http://custom:8080',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(mockAxiosPost.mock.calls[0][0]).toContain('http://custom:8080')
  })

  it('should reject non-allowlisted custom serverUrl', async () => {
    const req = createMockReq({
      body: {
        text: 'test',
        speaker: 1,
        speed: 1,
        pitch: 0,
        intonation: 1,
        serverUrl: 'http://custom:8080',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Server URL is not allowed' })
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should allow the default VOICEVOX URL from the local app by default', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    mockAxiosPost
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: Buffer.from([]) })

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(mockAxiosPost).toHaveBeenCalledTimes(2)
  })

  it('should allow Next.js synthesized forwarding headers for a local request', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    mockAxiosPost
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: Buffer.from([]) })

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
      headers: {
        host: 'localhost:3000',
        'x-forwarded-for': '127.0.0.1',
        'x-forwarded-host': 'localhost:3000',
        'x-forwarded-port': '3000',
        'x-forwarded-proto': 'http',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(mockAxiosPost).toHaveBeenCalledTimes(2)
  })

  it('should reject the default localhost VOICEVOX URL for a remote request', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
      headers: { host: 'aituberkit.example.com' },
      socket: { remoteAddress: '198.51.100.20' } as NextApiRequest['socket'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({
        errorCode: 'ServerSecretAccessDenied',
        feature: 'tts-voicevox',
      })
    )
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should not trust a localhost Host header from a remote request', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
      headers: { host: 'localhost:3000' },
      socket: { remoteAddress: '198.51.100.20' } as NextApiRequest['socket'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should reject a proxied remote request even when the proxy connection is loopback', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
      headers: {
        host: 'aituberkit.example.com',
        'x-forwarded-for': '198.51.100.20',
      },
      socket: { remoteAddress: '127.0.0.1' } as NextApiRequest['socket'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should reject a proxied request with an attacker-supplied localhost Host header', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
      headers: {
        host: 'localhost:3000',
        'x-forwarded-for': '198.51.100.20',
        'x-forwarded-host': 'localhost:3000',
      },
      socket: { remoteAddress: '127.0.0.1' } as NextApiRequest['socket'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should reject a proxied request with a non-loopback forwarded host', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
      headers: {
        host: 'localhost:3000',
        'x-forwarded-for': '127.0.0.1',
        'x-forwarded-host': 'aituberkit.example.com',
      },
      socket: { remoteAddress: '127.0.0.1' } as NextApiRequest['socket'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it.each([
    ['an empty forwarded address', { 'x-forwarded-for': '' }],
    [
      'an empty forwarded address token',
      { 'x-forwarded-for': '127.0.0.1, , ::1' },
    ],
    ['a malformed forwarded address', { 'x-forwarded-for': 'localhost' }],
    [
      'a deceptive loopback-prefixed address',
      { 'x-forwarded-for': '127.attacker.example' },
    ],
    [
      'an empty forwarded host token',
      {
        'x-forwarded-for': '127.0.0.1',
        'x-forwarded-host': 'localhost:3000,',
      },
    ],
    [
      'a malformed forwarded host',
      {
        'x-forwarded-for': '127.0.0.1',
        'x-forwarded-host': 'localhost:invalid-port',
      },
    ],
    [
      'a deceptive loopback-prefixed host',
      {
        'x-forwarded-for': '127.0.0.1',
        'x-forwarded-host': '127.attacker.example',
      },
    ],
  ])('should reject a proxied request with %s', async (_label, headers) => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
      headers: { host: 'localhost:3000', ...headers },
      socket: { remoteAddress: '127.0.0.1' } as NextApiRequest['socket'],
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should still require authentication in protected mode locally', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'protected'
    process.env.AITUBERKIT_SERVER_SECRET_TOKEN = 'test-token'

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should reject server-configured VOICEVOX URL by default', async () => {
    process.env.VOICEVOX_SERVER_URL = 'http://voicevox.internal:50021'
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({
        errorCode: 'ServerSecretAccessDenied',
        feature: 'tts-voicevox',
      })
    )
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should allow an explicitly provided localhost URL from the local app', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    mockAxiosPost
      .mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: Buffer.from([]) })

    const req = createMockReq({
      body: {
        text: 'test',
        speaker: 1,
        speed: 1,
        pitch: 0,
        intonation: 1,
        serverUrl: 'http://localhost:50021',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(mockAxiosPost).toHaveBeenCalledTimes(2)
  })

  it('should reject invalid serverUrl protocols', async () => {
    const req = createMockReq({
      body: {
        text: 'test',
        speaker: 1,
        speed: 1,
        pitch: 0,
        intonation: 1,
        serverUrl: 'file:///tmp/voicevox',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Invalid server URL protocol' })
    expect(mockAxiosPost).not.toHaveBeenCalled()
  })

  it('should return 500 on error', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    mockAxiosPost.mockRejectedValue(new Error('Connection refused'))

    const req = createMockReq({
      body: { text: 'test', speaker: 1, speed: 1, pitch: 0, intonation: 1 },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(500)
    expect(res._json).toEqual({ error: 'Internal Server Error' })
  })
})
