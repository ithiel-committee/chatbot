import { synthesizeVoiceGeminiApi } from '@/features/messages/synthesizeVoiceGemini'

const originalFetch = global.fetch

afterEach(() => {
  global.fetch = originalFetch
})

it('forwards the selected voice and empty instructions and returns audio bytes', async () => {
  const audio = new ArrayBuffer(46)
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, arrayBuffer: async () => audio })
  await expect(
    synthesizeVoiceGeminiApi(
      { message: 'こんにちは。', emotion: 'happy' },
      'key',
      'voice_new',
      ''
    )
  ).resolves.toBe(audio)
  expect(global.fetch).toHaveBeenCalledWith('/api/tts-gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'こんにちは。',
      apiKey: 'key',
      voice: 'voice_new',
      style: '',
      pace: 'default',
    }),
  })
})

it('surfaces the route error for the existing TTS notification', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: '声IDを確認してください。' }),
  })
  await expect(
    synthesizeVoiceGeminiApi(
      { message: 'こんにちは。', emotion: 'neutral' },
      '',
      'voice_new',
      ''
    )
  ).rejects.toThrow('声IDを確認してください。')
})

it('forwards a selected pace without mixing it into the transcript', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(46),
  })
  await synthesizeVoiceGeminiApi(
    { message: 'イティエルです。', emotion: 'neutral' },
    'key',
    'voice_new',
    '',
    'fast'
  )
  expect(
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
  ).toMatchObject({
    message: 'イティエルです。',
    style: '',
    pace: 'fast',
  })
})

it.each(['', '   ', '\n\t'])(
  'falls back to the provisional voice for an empty stored voice: %j',
  async (voice) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(46),
    })
    await synthesizeVoiceGeminiApi(
      { message: 'こんにちは。', emotion: 'neutral' },
      'key',
      voice,
      ''
    )
    expect(
      JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).voice
    ).toBe('voice_gkzvygsq8i5b')
  }
)

it('trims a nonempty stored voice before sending it', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    arrayBuffer: async () => new ArrayBuffer(46),
  })
  await synthesizeVoiceGeminiApi(
    { message: 'こんにちは。', emotion: 'neutral' },
    'key',
    '  Kore \n',
    ''
  )
  expect(
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).voice
  ).toBe('Kore')
})
