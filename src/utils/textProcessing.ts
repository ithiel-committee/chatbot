import englishToJapanese from '@/utils/englishToJapanese.json'

interface EnglishToJapanese {
  [key: string]: string
}

const typedEnglishToJapanese = englishToJapanese as EnglishToJapanese

// ソート済みキーをあらかじめメモ化
const sortedEnglishKeys = Object.keys(typedEnglishToJapanese).sort(
  (a, b) => b.length - a.length
)

// 重要な単語を明示的に含める
const importantWords = ['mastra', 'Mastra', 'ithiel', 'gdgoc', 'itl', 'itlfest']

// 最適化: 10文字以下の単語と重要な単語を含める
const commonWordsKeys = [
  ...sortedEnglishKeys.filter((key) => key.length <= 10),
  ...importantWords,
]

// 正規表現をあらかじめコンパイルして再利用
const regexCache = new Map<string, RegExp>()

/**
 * イティエルプロジェクト固有の英単語読み対応表
 * changeEnglishToJapanese がオフの場合でも、これらの重要単語はTTS用に読み変換を行う
 */
export const CUSTOM_PROJECT_WORDS: Record<string, string> = {
  ithiel: 'イティエル',
  gdgoc: 'ジーディージーオーシー',
  itl: 'アイティーエル',
  itlfest: 'アイティーエルフェスト',
}

/**
 * 固有の英単語（大文字小文字問わず）を日本語読みに変換する
 */
export function convertCustomWordsReading(text: string): string {
  let result = text
  for (const [word, reading] of Object.entries(CUSTOM_PROJECT_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(regex, reading)
  }
  return result
}

/**
 * 英語テキストを日本語読みに変換する
 * @param text 変換元の文字列
 * @returns 変換後の文字列
 */
export function convertEnglishToJapaneseReading(text: string): string {
  // 大文字小文字を区別せずに変換するために、テキストを小文字化してキャッシュ
  const lowerText = text.toLowerCase()

  // メモ化されたキーを使用
  return commonWordsKeys.reduce((result, englishWord) => {
    // 最適化: 大文字小文字を区別せずに単語の有無をチェック
    if (!lowerText.includes(englishWord.toLowerCase())) {
      return result
    }

    // 正規表現のキャッシュを利用
    let regex = regexCache.get(englishWord)
    if (!regex) {
      // 大文字小文字を区別せず、単語境界に一致する正規表現
      regex = new RegExp(`\\b${englishWord}\\b`, 'gi')
      regexCache.set(englishWord, regex)
    }

    const japaneseReading =
      typedEnglishToJapanese[englishWord] ??
      typedEnglishToJapanese[englishWord.toLowerCase()] ??
      CUSTOM_PROJECT_WORDS[englishWord.toLowerCase()]
    if (!japaneseReading) return result
    return result.replace(regex, japaneseReading)
  }, text)
}

/**
 * 非同期で英語テキストを日本語読みに変換する
 * UIスレッドをブロックしないように設計
 * @param text 変換元の文字列
 * @returns 変換後の文字列を含むPromise
 */
export async function asyncConvertEnglishToJapaneseReading(
  text: string
): Promise<string> {
  // UIスレッドをブロックしないよう、次のティックまで待機
  await new Promise((resolve) => setTimeout(resolve, 0))

  return convertEnglishToJapaneseReading(text)
}

/**
 * テキスト内に英語（ラテン文字）が含まれているかチェック
 * @param text チェック対象のテキスト
 * @returns 英語が含まれている場合はtrue
 */
export function containsEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text)
}

const DIGIT_READINGS_3DIGIT: Record<string, string> = {
  '0': 'マル',
  '1': 'イチ',
  '2': 'ニ',
  '3': 'サン',
  '4': 'ヨン',
  '5': 'ゴ',
  '6': 'ロク',
  '7': 'ナナ',
  '8': 'ハチ',
  '9': 'キュウ',
}

const DIGIT_READINGS_4DIGIT: Record<string, string> = {
  '0': 'ゼロ',
  '1': 'イチ',
  '2': 'ニ',
  '3': 'サン',
  '4': 'ヨン',
  '5': 'ゴ',
  '6': 'ロク',
  '7': 'ナナ',
  '8': 'ハチ',
  '9': 'キュウ',
}

/**
 * 全角数字を半角数字に正規化
 */
export function normalizeFullWidthDigits(str: string): string {
  return str.replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xfee0)
  )
}

/**
 * 部屋番号の数字を桁数に応じた読み仮名に変換
 * - 3桁: 0を「マル」として1桁ずつ（例: 802 -> ハチマルニ, 702 -> ナナマルニ）
 * - 4桁: 0を「ゼロ」として1桁ずつ（例: 1101 -> イチイチゼロイチ, 1001 -> イチゼロゼロイチ）
 */
export function convertRoomNumberDigitsToReading(digits: string): string {
  const mapping =
    digits.length === 3 ? DIGIT_READINGS_3DIGIT : DIGIT_READINGS_4DIGIT
  return digits
    .split('')
    .map((d) => mapping[d] ?? d)
    .join('')
}

/**
 * 3桁・4桁の教室名を日本語読みに変換する
 * 例:
 * - 802教室 -> ハチマルニ教室
 * - 1101教室 -> イチイチゼロイチ教室
 * - 1001、1002教室 -> イチゼロゼロイチ、イチゼロゼロニ教室
 * - 702号室 -> ナナマルニ号室
 * （2026年や10階などの通常の年号・階数は除外）
 */
export function convertRoomNumbersToReading(text: string): string {
  if (!text) return text

  const normalized = normalizeFullWidthDigits(text)

  // 1. "1001、1002教室" 等の列挙で後方に教室/号室/室が続く3-4桁の数字
  // 2. "802教室", "1101号室", "702 室" 等の直後に教室/号室/室が続く3-4桁の数字
  // 3. "教室 802", "号室 1101" 等の直前に教室/号室/室がある3-4桁の数字
  const roomPattern =
    /(?<!\d)(\d{3,4})(?=\s*(?:[、,・\s]+\d{3,4}\s*)*(?:教室|号室|室))|(?<=(?:教室|号室|室)\s*)(\d{3,4})(?!\d)/g

  return normalized.replace(roomPattern, (match) => {
    return convertRoomNumberDigitsToReading(match)
  })
}

/**
 * 音声合成（TTS）に送信するテキストの読み仮名・表記を正規化する
 * @param text 元のテキスト
 * @param enableFullEnglishDictionary 全英単語辞書変換（changeEnglishToJapanese）を有効にするか
 * @returns 音声合成用に正規化されたテキスト
 */
export async function normalizeSpeechTextForTTS(
  text: string,
  enableFullEnglishDictionary: boolean = false
): Promise<string> {
  if (!text) return text

  let processed = text

  // 1. 教室番号の読み変換 (802教室 -> ハチマルニ教室, 1101教室 -> イチイチゼロイチ教室)
  processed = convertRoomNumbersToReading(processed)

  // 2. 英単語の読み変換
  if (containsEnglish(processed)) {
    if (enableFullEnglishDictionary) {
      processed = await asyncConvertEnglishToJapaneseReading(processed)
    } else {
      processed = convertCustomWordsReading(processed)
    }
  }

  return processed
}
