import { getVoiceLanguageCode } from '@/utils/voiceLanguage'

describe('getVoiceLanguageCode', () => {
  const mappings: [string, string][] = [
    ['ja', 'ja-JP'],
    ['en', 'en-US'],
  ]

  it.each(mappings)('should map "%s" to "%s"', (input, expected) => {
    expect(getVoiceLanguageCode(input)).toBe(expected)
  })

  it('should return ja-JP as default for unknown language', () => {
    expect(getVoiceLanguageCode('unknown')).toBe('ja-JP')
  })

  it('should return ja-JP for empty string', () => {
    expect(getVoiceLanguageCode('')).toBe('ja-JP')
  })

  it('should return ja-JP as default for unsupported languages (ko, zh, fr, etc.)', () => {
    expect(getVoiceLanguageCode('ko')).toBe('ja-JP')
    expect(getVoiceLanguageCode('zh')).toBe('ja-JP')
    expect(getVoiceLanguageCode('fr')).toBe('ja-JP')
  })
})
