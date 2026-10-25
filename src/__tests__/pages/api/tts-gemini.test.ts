/** @jest-environment node */
import handler from '@/pages/api/tts-gemini'
import { logger } from '@/lib/logger'
import {
  createMockReq,
  createMockRes,
  mockServerSecretGuard,
} from '../../helpers/apiRouteTestUtils'

const wav = Buffer.alloc(46)
wav.write('RIFF', 0)
wav.writeUInt32LE(38, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(24000, 24)
wav.writeUInt32LE(48000, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(2, 40)
const audioContent = { type: 'audio', data: wav.toString('base64') }
const success = () =>
  new Response(
    JSON.stringify({
      steps: [{ type: 'model_output', content: [audioContent] }],
    })
  )
const body = {
  message: 'イティエルです。',
  voice: 'voice_gkzvygsq8i5b',
  apiKey: 'client-key',
}
const originalEnv = process.env
const originalFetch = global.fetch

async function request(overrides: Record<string, unknown> = body) {
  const res = createMockRes()
  await handler(createMockReq({ body: overrides }), res)
  return res
}

describe('/api/tts-gemini', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.GEMINI_TTS_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.GOOGLE_API_KEY
    mockServerSecretGuard('unprotected')
    global.fetch = jest.fn().mockImplementation(success)
  })
  afterEach(() => {
    process.env = originalEnv
    jest.restoreAllMocks()
    global.fetch = originalFetch
    jest.useRealTimers()
  })

  it('returns the original WAV and sends no styling when directions are empty', async () => {
    const res = await request({ ...body, style: '  ', emotion: 'happy' })
    expect(res._status).toBe(200)
    expect(res._body).toEqual(wav)
    expect(res._headers['Content-Type']).toBe('audio/wav')
    expect(res._headers['Cache-Control']).toBe('no-store')
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/interactions'
    )
    expect(options.headers['x-goog-api-key']).toBe('client-key')
    expect(JSON.parse(options.body)).toEqual({
      model: 'gemini-3.8-flash-lite-tts',
      input: [
        { type: 'user_input', content: [{ type: 'text', text: body.message }] },
      ],
      response_format: {
        type: 'audio',
        mime_type: 'audio/wav',
        sample_rate: 24000,
      },
      generation_config: { speech_config: [{ voice: body.voice }] },
    })
  })

  it('uses the supplied replacement voice and separates style from spoken text', async () => {
    await request({
      ...body,
      voice: 'voice_replacement',
      style: '  落ち着いて  ',
    })
    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(sent.generation_config.speech_config).toEqual([
      { voice: 'voice_replacement' },
    ])
    expect(sent.input[0].content[0]).toEqual({
      type: 'text',
      text: body.message,
      annotations: [{ type: 'speech_metadata', style: '落ち着いて' }],
    })
  })

  it.each([
    ['slow', 'speaking slowly'],
    ['slightly-slow', 'speaking slightly slowly'],
    ['default', ''],
    ['slightly-fast', 'speaking slightly faster'],
    ['fast', 'speaking rapidly'],
  ])(
    'sends %s as a short style hint without altering text or audio format',
    async (pace, hint) => {
      await request({ ...body, pace, style: '' })
      const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      const content = sent.input[0].content[0]
      expect(content.text).toBe(body.message)
      if (hint)
        expect(content.annotations).toEqual([
          { type: 'speech_metadata', style: hint },
        ])
      else expect(content).not.toHaveProperty('annotations')
      expect(sent.generation_config).toEqual({
        speech_config: [{ voice: body.voice }],
      })
      expect(sent.response_format).toEqual({
        type: 'audio',
        mime_type: 'audio/wav',
        sample_rate: 24000,
      })
    }
  )

  it('combines optional acting instructions with the selected pace in one annotation', async () => {
    await request({ ...body, pace: 'fast', style: '  落ち着いて  ' })
    const sent = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
    expect(sent.input[0].content[0].annotations).toEqual([
      { type: 'speech_metadata', style: '落ち着いて, speaking rapidly' },
    ])
  })

  it.each(['1.2', 1.2, null, {}, 'unknown'])(
    'rejects an unsupported pace before calling Gemini: %j',
    async (pace) => {
      expect((await request({ ...body, pace }))._status).toBe(400)
      expect(global.fetch).not.toHaveBeenCalled()
    }
  )

  it.each(['GEMINI_TTS_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'])(
    'guards server credentials from %s',
    async (name) => {
      process.env[name] = 'server-secret'
      mockServerSecretGuard('disabled')
      const res = await request({ message: body.message, voice: body.voice })
      expect(res._status).toBe(403)
      expect(global.fetch).not.toHaveBeenCalled()
    }
  )

  it('uses server fallback keys in priority order and lets a client key override them', async () => {
    process.env.GOOGLE_API_KEY = 'google-key'
    process.env.GEMINI_API_KEY = 'gemini-key'
    process.env.GEMINI_TTS_API_KEY = 'tts-key'
    await request({ ...body, apiKey: '' })
    await request(body)
    expect(
      (global.fetch as jest.Mock).mock.calls.map(
        ([, options]) => options.headers['x-goog-api-key']
      )
    ).toEqual(['tts-key', 'client-key'])
  })

  it('trims a client key before sending it upstream without using a server secret', async () => {
    process.env.GEMINI_TTS_API_KEY = 'server-secret'
    mockServerSecretGuard('disabled')
    expect(
      (await request({ ...body, apiKey: '  client-key \n\t' }))._status
    ).toBe(200)
    expect(
      (global.fetch as jest.Mock).mock.calls[0][1].headers['x-goog-api-key']
    ).toBe('client-key')
  })

  it('falls back from a whitespace-only client key and skips blank server keys', async () => {
    process.env.GEMINI_TTS_API_KEY = '  \n '
    process.env.GEMINI_API_KEY = '  gemini-key \n '
    process.env.GOOGLE_API_KEY = 'google-key'
    expect((await request({ ...body, apiKey: '  \n\t' }))._status).toBe(200)
    expect(
      (global.fetch as jest.Mock).mock.calls[0][1].headers['x-goog-api-key']
    ).toBe('gemini-key')
  })

  it.each(['GEMINI_TTS_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'])(
    'does not bypass the server-secret guard with a whitespace-only client key (%s)',
    async (name) => {
      process.env[name] = 'server-secret'
      mockServerSecretGuard('disabled')
      expect((await request({ ...body, apiKey: '  \n\t' }))._status).toBe(403)
      expect(global.fetch).not.toHaveBeenCalled()
    }
  )

  it('rejects a whitespace-only key when no server key is available', async () => {
    expect((await request({ ...body, apiKey: '  \n\t' }))._status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('rejects a missing key', async () => {
    expect((await request({ ...body, apiKey: '' }))._status).toBe(400)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each([
    { message: '' },
    { message: ' '.repeat(4) },
    { message: 'a'.repeat(5001) },
    { voice: '' },
    { style: 1 },
    { style: 'a'.repeat(4001) },

    { apiKey: {} },
  ])(
    'rejects invalid input without using server credentials: %j',
    async (invalid) => {
      process.env.GEMINI_TTS_API_KEY = 'secret'
      mockServerSecretGuard('disabled')
      expect((await request({ ...body, ...invalid }))._status).toBe(400)
      expect(global.fetch).not.toHaveBeenCalled()
    }
  )

  it('rejects an array key before it can reach an upstream request', async () => {
    process.env.GEMINI_TTS_API_KEY = 'secret'
    mockServerSecretGuard('disabled')
    expect((await request({ ...body, apiKey: [''] }))._status).toBe(403)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it.each([401, 403, 429, 500])(
    'sanitizes upstream HTTP %s errors',
    async (status) => {
      ;(global.fetch as jest.Mock).mockResolvedValue(
        new Response('secret and transcript', { status })
      )
      const res = await request()
      expect(res._status).toBe(status === 429 ? 429 : 502)
      expect(JSON.stringify(res._json)).not.toContain('secret and transcript')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    }
  )

  it.each([
    { steps: [] },
    {
      steps: [
        { type: 'model_output', content: [{ type: 'text', text: 'blocked' }] },
      ],
    },
    {
      steps: [
        { type: 'model_output', content: [{ type: 'audio', data: 'AAAB' }] },
      ],
    },
    { output_audio: audioContent },
  ])('rejects missing or malformed audio', async (payload) => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify(payload))
    )
    expect((await request())._status).toBe(502)
  })

  it('ignores user audio and returns the single model audio block', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue(
      new Response(
        JSON.stringify({
          steps: [
            { type: 'user_input', content: [{ type: 'audio', data: 'bad' }] },
            { type: 'model_output', content: [audioContent] },
          ],
        })
      )
    )
    const res = await request()
    expect(res._status).toBe(200)
    expect(res._body).toEqual(wav)
  })

  it.each([
    [{ type: 'model_output', content: [audioContent, audioContent] }],
    [
      { type: 'model_output', content: [audioContent] },
      { type: 'model_output', content: [audioContent] },
    ],
    [
      {
        type: 'model_output',
        content: [audioContent, { type: 'audio', data: '' }],
      },
    ],
  ])(
    'rejects multiple model audio blocks instead of silently returning a partial recording: %j',
    async (...steps) => {
      const log = jest.spyOn(logger, 'error').mockImplementation(() => {})
      ;(global.fetch as jest.Mock).mockResolvedValue(
        new Response(JSON.stringify({ steps }))
      )
      const res = await request()
      expect(res._status).toBe(502)
      expect(res._body).toBeNull()
      expect(res._json).toEqual({
        error: expect.stringContaining('複数の音声ブロック'),
      })
      expect(log).toHaveBeenCalledWith(
        '[Gemini TTS] Multiple audio blocks are not supported',
        { blockCount: 2 }
      )
    }
  )

  it('times out a stalled upstream request', async () => {
    jest.useFakeTimers()
    ;(global.fetch as jest.Mock).mockImplementation(
      (_, options) =>
        new Promise((_, reject) => {
          options.signal.addEventListener('abort', () =>
            reject(new Error('aborted'))
          )
        })
    )
    const pending = request()
    await jest.advanceTimersByTimeAsync(60_000)
    expect((await pending)._status).toBe(504)
  })

  it('rejects GET before contacting Gemini', async () => {
    const res = createMockRes()
    await handler(createMockReq({ method: 'GET' }), res)
    expect(res._status).toBe(405)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
