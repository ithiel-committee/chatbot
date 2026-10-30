import {
  convertEnglishToJapaneseReading,
  asyncConvertEnglishToJapaneseReading,
  containsEnglish,
  convertCustomWordsReading,
  convertRoomNumbersToReading,
  normalizeSpeechTextForTTS,
} from '../../../src/utils/textProcessing'
import { migrateOpenAIModelName } from '../../../src/utils/modelMigration'

jest.mock('../../../src/utils/englishToJapanese.json', () => ({
  hello: 'ハロー',
  world: 'ワールド',
  test: 'テスト',
  mastra: 'マストラ',
  ithiel: 'イティエル',
  gdgoc: 'ジーディージーオーシー',
  itl: 'アイティーエル',
  itlfest: 'アイティーエルフェスト',
}))

describe('textProcessing', () => {
  describe('convertEnglishToJapaneseReading', () => {
    it('英語を日本語読みに変換する', () => {
      const result = convertEnglishToJapaneseReading('hello world')
      expect(result).toContain('ハロー')
      expect(result).toContain('ワールド')
    })

    it('英語が含まれていない場合は元のテキストを返す', () => {
      const text = 'こんにちは'
      expect(convertEnglishToJapaneseReading(text)).toBe(text)
    })

    it('重要な単語を変換する', () => {
      const result = convertEnglishToJapaneseReading('This is Mastra')
      expect(result).toContain('マストラ')
    })
  })

  describe('asyncConvertEnglishToJapaneseReading', () => {
    it('非同期で英語を日本語読みに変換する', async () => {
      const result = await asyncConvertEnglishToJapaneseReading('hello test')
      expect(result).toContain('ハロー')
      expect(result).toContain('テスト')
    })
  })

  describe('containsEnglish', () => {
    it('英語が含まれている場合はtrueを返す', () => {
      expect(containsEnglish('Hello, world!')).toBe(true)
      expect(containsEnglish('こんにちはworld')).toBe(true)
    })

    it('英語が含まれていない場合はfalseを返す', () => {
      expect(containsEnglish('こんにちは、世界！')).toBe(false)
      expect(containsEnglish('１２３４５')).toBe(false)
    })
  })

  describe('convertCustomWordsReading', () => {
    it('ithiel, gdgoc, itl を大文字小文字問わずカタカナ読みに変換する', () => {
      expect(convertCustomWordsReading('iThieLの部屋')).toBe('イティエルの部屋')
      expect(convertCustomWordsReading('GDGoC Chuo')).toBe(
        'ジーディージーオーシー Chuo'
      )
      expect(convertCustomWordsReading('iTLのキャンパス')).toBe(
        'アイティーエルのキャンパス'
      )
      expect(convertCustomWordsReading('iTLFest.2026')).toBe(
        'アイティーエルフェスト.2026'
      )
    })
  })

  describe('convertRoomNumbersToReading', () => {
    it('3桁の教室番号（802教室、702号室等）を「マル」として1桁ずつ変換する', () => {
      expect(convertRoomNumbersToReading('802教室')).toBe('ハチマルニ教室')
      expect(convertRoomNumbersToReading('801教室')).toBe('ハチマルイチ教室')
      expect(convertRoomNumbersToReading('702号室')).toBe('ナナマルニ号室')
      expect(convertRoomNumbersToReading('101室')).toBe('イチマルイチ室')
    })

    it('4桁の教室番号（1101教室、1001教室等）を「ゼロ」として1桁ずつ変換する', () => {
      expect(convertRoomNumbersToReading('1101教室')).toBe(
        'イチイチゼロイチ教室'
      )
      expect(convertRoomNumbersToReading('1001教室')).toBe(
        'イチゼロゼロイチ教室'
      )
      expect(convertRoomNumbersToReading('1002教室')).toBe('イチゼロゼロニ教室')
    })

    it('複数並んだ教室番号（1001、1002教室）も変換されること', () => {
      expect(convertRoomNumbersToReading('1001、1002教室')).toBe(
        'イチゼロゼロイチ、イチゼロゼロニ教室'
      )
    })

    it('全角数字（８０２教室）も半角に正規化されて変換されること', () => {
      expect(convertRoomNumbersToReading('８０２教室')).toBe('ハチマルニ教室')
    })

    it('2026年や10階などの年号・階数は変換されないこと', () => {
      expect(convertRoomNumbersToReading('2026年10月31日 10階')).toBe(
        '2026年10月31日 10階'
      )
      expect(convertRoomNumbersToReading('8階802教室')).toBe(
        '8階ハチマルニ教室'
      )
    })
  })

  describe('normalizeSpeechTextForTTS', () => {
    it('英単語と教室番号の両方が同時に正規化されること', async () => {
      const input = '8階802教室でGDGoCの展示があります。iThieLに会いに来てね！'
      const output = await normalizeSpeechTextForTTS(input, false)
      expect(output).toBe(
        '8階ハチマルニ教室でジーディージーオーシーの展示があります。イティエルに会いに来てね！'
      )
    })
  })

  describe('migrateOpenAIModelName', () => {
    it('should migrate legacy OpenAI model names with date suffixes', () => {
      expect(migrateOpenAIModelName('gpt-4o-mini-2024-07-18')).toBe(
        'gpt-4o-mini'
      )
      expect(migrateOpenAIModelName('gpt-4o-2024-11-20')).toBe('gpt-4o')
      expect(migrateOpenAIModelName('gpt-4.5-preview-2025-02-27')).toBe(
        'gpt-4.5-preview'
      )
      expect(migrateOpenAIModelName('gpt-4.1-nano-2025-04-14')).toBe(
        'gpt-4.1-nano'
      )
      expect(migrateOpenAIModelName('gpt-4.1-mini-2025-04-14')).toBe(
        'gpt-4.1-mini'
      )
      expect(migrateOpenAIModelName('gpt-4.1-2025-04-14')).toBe('gpt-4.1')
    })

    it('should return the same model name if not in legacy list', () => {
      expect(migrateOpenAIModelName('gpt-4o-mini')).toBe('gpt-4o-mini')
      expect(migrateOpenAIModelName('gpt-4o')).toBe('gpt-4o')
      expect(migrateOpenAIModelName('gpt-4.5-preview')).toBe('gpt-4.5-preview')
      expect(migrateOpenAIModelName('gpt-4')).toBe('gpt-4')
      expect(migrateOpenAIModelName('gpt-3.5-turbo')).toBe('gpt-3.5-turbo')
      expect(migrateOpenAIModelName('custom-model')).toBe('custom-model')
    })
  })
})
