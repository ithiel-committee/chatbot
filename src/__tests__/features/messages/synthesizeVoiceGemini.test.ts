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
