import {
  isStartupGreetingEnabled,
  getStartupGreetingConfig,
  DEFAULT_STARTUP_GREETING_MESSAGE,
  DEFAULT_STARTUP_GREETING_AUDIO_PATH,
} from '@/features/startupGreeting/startupGreetingConfig'
import { isWavBuffer } from '@/features/messages/speakCharacter'

describe('startupGreetingConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('isStartupGreetingEnabled', () => {
    it('returns true when NEXT_PUBLIC_STARTUP_GREETING_ENABLED is "true"', () => {
      process.env.NEXT_PUBLIC_STARTUP_GREETING_ENABLED = 'true'
      process.env.NEXT_PUBLIC_CLUB = 'c3'
      expect(isStartupGreetingEnabled()).toBe(true)
    })

    it('returns false when NEXT_PUBLIC_STARTUP_GREETING_ENABLED is "false"', () => {
      process.env.NEXT_PUBLIC_STARTUP_GREETING_ENABLED = 'false'
      process.env.NEXT_PUBLIC_CLUB = 'ithiel'
      process.env.NEXT_PUBLIC_CHARACTER_NAME = 'イティエル'
      expect(isStartupGreetingEnabled()).toBe(false)
    })

    it('returns true when NEXT_PUBLIC_CLUB is "ithiel"', () => {
      delete process.env.NEXT_PUBLIC_STARTUP_GREETING_ENABLED
      process.env.NEXT_PUBLIC_CLUB = 'ithiel'
      expect(isStartupGreetingEnabled()).toBe(true)
    })

    it('returns true when NEXT_PUBLIC_CHARACTER_NAME is "イティエル"', () => {
      delete process.env.NEXT_PUBLIC_STARTUP_GREETING_ENABLED
      delete process.env.NEXT_PUBLIC_CLUB
      process.env.NEXT_PUBLIC_CHARACTER_NAME = 'イティエル'
      expect(isStartupGreetingEnabled()).toBe(true)
    })

    it('returns false when neither club nor character is ithiel', () => {
      delete process.env.NEXT_PUBLIC_STARTUP_GREETING_ENABLED
      process.env.NEXT_PUBLIC_CLUB = 'c3'
      process.env.NEXT_PUBLIC_CHARACTER_NAME = 'assistant'
      expect(isStartupGreetingEnabled()).toBe(false)
    })
  })

  describe('getStartupGreetingConfig', () => {
    it('returns default config when env vars are not set', () => {
      delete process.env.NEXT_PUBLIC_STARTUP_GREETING_MESSAGE
      delete process.env.NEXT_PUBLIC_STARTUP_GREETING_AUDIO_PATH
      delete process.env.NEXT_PUBLIC_STARTUP_GREETING_EMOTION

      const config = getStartupGreetingConfig()
      expect(config.message).toBe(DEFAULT_STARTUP_GREETING_MESSAGE)
      expect(config.audioPath).toBe(DEFAULT_STARTUP_GREETING_AUDIO_PATH)
      expect(config.emotion).toBe('happy')
    })

    it('respects custom env vars', () => {
      process.env.NEXT_PUBLIC_STARTUP_GREETING_MESSAGE = 'カスタム挨拶'
      process.env.NEXT_PUBLIC_STARTUP_GREETING_AUDIO_PATH = '/custom.wav'
      process.env.NEXT_PUBLIC_STARTUP_GREETING_EMOTION = 'relaxed'

      const config = getStartupGreetingConfig()
      expect(config.message).toBe('カスタム挨拶')
      expect(config.audioPath).toBe('/custom.wav')
      expect(config.emotion).toBe('relaxed')
    })
  })
})

describe('isWavBuffer', () => {
  it('identifies valid RIFF WAVE header', () => {
    const buffer = new ArrayBuffer(12)
    const view = new Uint8Array(buffer)
    // "RIFF"
    view[0] = 0x52
    view[1] = 0x49
    view[2] = 0x46
    view[3] = 0x46
    // "WAVE"
    view[8] = 0x57
    view[9] = 0x41
    view[10] = 0x56
    view[11] = 0x45

    expect(isWavBuffer(buffer)).toBe(true)
  })

  it('returns false for buffer smaller than 12 bytes', () => {
    const buffer = new ArrayBuffer(8)
    expect(isWavBuffer(buffer)).toBe(false)
  })

  it('returns false for non-WAV buffer', () => {
    const buffer = new ArrayBuffer(16)
    const view = new Uint8Array(buffer)
    view.fill(0)
    expect(isWavBuffer(buffer)).toBe(false)
  })
})
