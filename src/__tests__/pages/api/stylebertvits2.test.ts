/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/stylebertvits2'

const originalEnv = { ...process.env }
const originalFetch = global.fetch

function createMockReq(
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return {
    method: 'POST',
    body: {},
    ...overrides,
  } as NextApiRequest
}

function createMockRes() {
  const res = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, string | number>,
    status(code: number) {
      res._status = code
      return res
    },
    json(data: unknown) {
      res._json = data
      return res
    },
    writeHead(code: number, headers: Record<string, string | number>) {
      res._status = code
      res._headers = headers
      return res
    },
    end: jest.fn(),
  }
  return res as unknown as NextApiResponse & {
    _status: number
    _json: unknown
    _headers: Record<string, string | number>
  }
}

const runpodRequestBody = {
  message: 'hello',
  stylebertvits2ServerUrl: 'https://api.runpod.ai/v2/endpoint/runsync',
  stylebertvits2ModelId: '0',
  stylebertvits2Style: 'Neutral',
  stylebertvits2SdpRatio: '0.2',
  stylebertvits2Length: '1.0',
  selectLanguage: 'ja',
}

describe('/api/stylebertvits2', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    global.fetch = jest.fn()
  })

  afterEach(() => {
    process.env = originalEnv
    global.fetch = originalFetch
  })

  it('does not use the server API key with a client-provided RunPod URL', async () => {
    process.env.STYLEBERTVITS2_API_KEY = 'server-stylebert-key'
    const req = createMockReq({
      body: runpodRequestBody,
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({
      error: 'Style-Bert-VITS2 API key is required',
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('uses the client API key with a client-provided RunPod URL', async () => {
    process.env.STYLEBERTVITS2_API_KEY = 'server-stylebert-key'
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        output: {
          voice: Buffer.from('audio').toString('base64'),
        },
      }),
    })
    const req = createMockReq({
      body: {
        ...runpodRequestBody,
        stylebertvits2ApiKey: 'client-stylebert-key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.runpod.ai/v2/endpoint/runsync',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer client-stylebert-key',
        }),
      })
    )
  })

  it('does not treat URLs containing the RunPod host in the path as RunPod URLs', async () => {
    const req = createMockReq({
      body: {
        ...runpodRequestBody,
        stylebertvits2ServerUrl: 'https://evil.example/https://api.runpod.ai',
        stylebertvits2ApiKey: 'client-stylebert-key',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Server URL is not allowed' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects non-allowlisted client-provided Style-Bert-VITS2 URLs', async () => {
    const req = createMockReq({
      body: {
        ...runpodRequestBody,
        stylebertvits2ServerUrl: 'https://stylebert.example',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Server URL is not allowed' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('uses allowlisted client-provided Style-Bert-VITS2 URLs', async () => {
    process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS =
      'https://stylebert.example'
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('audio').buffer,
    })
    const req = createMockReq({
      body: {
        ...runpodRequestBody,
        stylebertvits2ServerUrl: 'https://stylebert.example',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://stylebert.example/voice?'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('allows a same-machine local Style-Bert-VITS2 URL by default', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('audio').buffer,
    })
    const req = createMockReq({
      body: {
        ...runpodRequestBody,
        stylebertvits2ServerUrl: 'http://[::ffff:127.0.0.1]:5000',
      },
      headers: { host: 'localhost:3000' },
      socket: { remoteAddress: '127.0.0.1' } as never,
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('http://[::ffff:127.0.0.1]:5000/voice?'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('rejects a remote request to a local Style-Bert-VITS2 URL by default', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    const req = createMockReq({
      body: {
        ...runpodRequestBody,
        stylebertvits2ServerUrl: 'http://127.0.0.1:5000',
      },
      headers: { host: 'aituberkit.example.com' },
      socket: { remoteAddress: '198.51.100.20' } as never,
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({
        errorCode: 'ServerSecretAccessDenied',
        feature: 'stylebertvits2',
      })
    )
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
