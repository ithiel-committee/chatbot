/**
 * @jest-environment node
 */

const mockWriteFile = jest.fn()
jest.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

const mockIsRestrictedMode = jest.fn(() => false)
jest.mock('@/utils/restrictedMode', () => ({
  isRestrictedMode: () => mockIsRestrictedMode(),
  createRestrictedModeErrorResponse: (feature: string) => ({
    error: 'feature_disabled_in_restricted_mode',
    message: `The feature "${feature}" is disabled in restricted mode.`,
  }),
}))

import { createMocks } from 'node-mocks-http'
import handler from '@/pages/api/update-aivis-speakers'

const originalEnv = { ...process.env }

function createLocalMocks() {
  const mocks = createMocks({
    method: 'POST',
    headers: { host: 'localhost:3000' },
  })
  Object.defineProperty(mocks.req.socket, 'remoteAddress', {
    value: '127.0.0.1',
  })
  return mocks
}

describe('/api/update-aivis-speakers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.AIVIS_SPEECH_SERVER_URL
    mockIsRestrictedMode.mockReturnValue(false)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          name: 'Speaker',
          speaker_uuid: 'speaker-id',
          styles: [{ name: 'Normal', id: 1, type: 'talk' }],
        },
      ],
    }) as jest.Mock
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('updates the dynamic speaker file from a same-machine AivisSpeech by default', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    const { req, res } = createLocalMocks()

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:10101/speakers')
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('rejects speaker file updates from remote requests by default', async () => {
    delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
    const { req, res } = createMocks({
      method: 'POST',
      headers: { host: 'aituberkit.example.com' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(403)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('rejects non-POST requests', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    const { req, res } = createMocks({ method: 'GET' })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(405)
    expect(res._getJSONData()).toEqual({ error: 'Method not allowed' })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('updates speaker file when server resource access is allowed', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    const { req, res } = createMocks({ method: 'POST' })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:10101/speakers')
    expect(mockWriteFile).toHaveBeenCalled()
  })

  it('rejects non-ok responses from the AivisSpeech server', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'service unavailable' }),
    }) as jest.Mock
    const { req, res } = createMocks({ method: 'POST' })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(500)
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('rejects invalid speaker response shapes', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ speakers: [] }),
    }) as jest.Mock
    const { req, res } = createMocks({ method: 'POST' })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(500)
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('rejects non-allowlisted custom serverUrl', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    const { req, res } = createMocks({
      method: 'POST',
      query: { serverUrl: 'http://custom:8080' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(400)
    expect(res._getJSONData()).toEqual({ error: 'Server URL is not allowed' })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockWriteFile).not.toHaveBeenCalled()
  })

  it('uses allowlisted custom serverUrl when provided', async () => {
    process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = 'unprotected'
    process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS = 'http://custom:8080'
    const { req, res } = createMocks({
      method: 'POST',
      query: { serverUrl: 'http://custom:8080' },
    })

    await handler(req as any, res as any)

    expect(res._getStatusCode()).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith('http://custom:8080/speakers')
  })
})
