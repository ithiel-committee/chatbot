import {
  isDateTimeInjectionEnabled,
  buildCurrentDateTimePrompt,
  appendCurrentDateTimeToPrompt,
  DATETIME_PROMPT_HEADER_JA,
  DATETIME_PROMPT_HEADER_EN,
} from '@/features/chat/dateTimePrompt'
import settingsStore from '@/features/stores/settings'

describe('dateTimePrompt', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPT
    delete process.env.NEXT_PUBLIC_TIMEZONE
    settingsStore.setState({ injectDateTimeToSystemPrompt: false })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('isDateTimeInjectionEnabled', () => {
    it('デフォルト（環境変数なし）では無効（false）であること', () => {
      expect(isDateTimeInjectionEnabled()).toBe(false)
    })

    it('NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPTがtrueのとき有効であること', () => {
      process.env.NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPT = 'true'
      expect(isDateTimeInjectionEnabled()).toBe(true)
    })

    it('NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPTがfalseのとき無効であること', () => {
      process.env.NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPT = 'false'
      expect(isDateTimeInjectionEnabled()).toBe(false)
    })

    it('settingsStoreで有効化されている場合にtrueを返すこと', () => {
      settingsStore.setState({ injectDateTimeToSystemPrompt: true })
      expect(isDateTimeInjectionEnabled()).toBe(true)
    })
  })

  describe('buildCurrentDateTimePrompt', () => {
    const fixedDate = new Date('2026-10-22T06:30:00Z') // 15:30 JST

    it('日本語（ja）用のフォーマットを正しく生成すること', () => {
      const prompt = buildCurrentDateTimePrompt(fixedDate, 'ja', 'Asia/Tokyo')
      expect(prompt).toContain(DATETIME_PROMPT_HEADER_JA)
      expect(prompt).toContain('Asia/Tokyo')
      expect(prompt).toContain('15:30')
      expect(prompt).toContain('基準として回答')
    })

    it('英語（en）用のフォーマットを正しく生成すること', () => {
      const prompt = buildCurrentDateTimePrompt(fixedDate, 'en', 'Asia/Tokyo')
      expect(prompt).toContain(DATETIME_PROMPT_HEADER_EN)
      expect(prompt).toContain('Asia/Tokyo')
      expect(prompt).toContain('15:30')
    })

    it('不正なタイムゾーンが渡された場合もクラッシュせずフォールバックすること', () => {
      const prompt = buildCurrentDateTimePrompt(fixedDate, 'ja', 'INVALID_ZONE')
      expect(prompt).toContain('Current Time:')
      expect(prompt).toContain('UTC')
    })
  })

  describe('appendCurrentDateTimeToPrompt', () => {
    const fixedDate = new Date('2026-10-22T06:30:00Z')

    it('フラグが無効な場合は元のシステムプロンプトをそのまま返すこと', () => {
      const basePrompt = 'あなたは明るいアシスタントです。'
      const result = appendCurrentDateTimeToPrompt(basePrompt, fixedDate, 'ja')
      expect(result).toBe(basePrompt)
    })

    it('フラグが有効な場合は末尾に日時情報を付加すること', () => {
      process.env.NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPT = 'true'
      const basePrompt = 'あなたは明るいアシスタントです。'
      const result = appendCurrentDateTimeToPrompt(basePrompt, fixedDate, 'ja')
      expect(result).toContain(basePrompt)
      expect(result).toContain(DATETIME_PROMPT_HEADER_JA)
      expect(result).toContain('15:30')
    })

    it('空のプロンプトに対しても正しく日時情報のみを返すこと', () => {
      process.env.NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPT = 'true'
      const result = appendCurrentDateTimeToPrompt('', fixedDate, 'ja')
      expect(result).toContain(DATETIME_PROMPT_HEADER_JA)
      expect(result.startsWith('\n\n')).toBe(false)
    })

    it('既に日時ヘッダーが含まれている場合は二重付加しないこと', () => {
      process.env.NEXT_PUBLIC_INJECT_DATETIME_TO_SYSTEM_PROMPT = 'true'
      const basePrompt = `あなたはアシスタントです。\n\n${DATETIME_PROMPT_HEADER_JA}\n現在の日時: 2026/10/22(木) 15:30`
      const result = appendCurrentDateTimeToPrompt(basePrompt, fixedDate, 'ja')
      expect(result).toBe(basePrompt)
    })
  })
})
