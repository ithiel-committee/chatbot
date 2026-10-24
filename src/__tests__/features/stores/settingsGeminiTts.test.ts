import { DEFAULT_GEMINI_TTS_VOICE } from '@/features/constants/geminiTts'

const originalEnv = process.env
const loadStore = () => {
  jest.resetModules()
  return require('@/features/stores/settings').default
}

beforeEach(() => {
  localStorage.clear()
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES: 'false',
  }
  delete process.env.NEXT_PUBLIC_GEMINI_TTS_VOICE
  delete process.env.NEXT_PUBLIC_GEMINI_TTS_STYLE
})
afterEach(() => {
  process.env = originalEnv
  localStorage.clear()
})

it('defaults to the provisional voice and no acting instructions', () => {
  const store = loadStore()
  expect(store.getState().geminiTtsVoice).toBe(DEFAULT_GEMINI_TTS_VOICE)
  expect(store.getState().geminiTtsStyle).toBe('')
})

it('supports voice and style environment defaults', () => {
  process.env.NEXT_PUBLIC_GEMINI_TTS_VOICE = 'voice_env'
  process.env.NEXT_PUBLIC_GEMINI_TTS_STYLE = '落ち着いて'
  expect(loadStore().getState()).toMatchObject({
    geminiTtsVoice: 'voice_env',
    geminiTtsStyle: '落ち着いて',
  })
})

it('retains a changed voice and cleared instructions after reloading', () => {
  const store = loadStore()
  store.setState({
    selectVoice: 'gemini',
    geminiTtsVoice: 'voice_replacement',
    geminiTtsStyle: '',
    geminiTtsApiKey: 'private-key',
  })
  expect(loadStore().getState()).toMatchObject({
    selectVoice: 'gemini',
    geminiTtsVoice: 'voice_replacement',
    geminiTtsStyle: '',
  })
  const { createSettingsFileData } = require('@/features/settings/settingsFile')
  expect(createSettingsFileData(false).settings).not.toHaveProperty(
    'geminiTtsApiKey'
  )
  expect(createSettingsFileData(true).settings.geminiTtsApiKey).toBe(
    'private-key'
  )
})
