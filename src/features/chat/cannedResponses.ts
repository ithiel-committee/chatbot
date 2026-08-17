import { Message } from '@/features/messages/messages'

export interface CannedResponseRule {
  keywords: string[]
  reply: string
  emotion: string
}

/**
 * 定型文のルールリスト
 * キーワードのいずれかに一致した場合、対応する応答を返します。
 */
export const cannedResponseRules: CannedResponseRule[] = [
  {
    keywords: ['こんにちは', 'ハロー', 'はじめまして', '自己紹介', 'hi', 'Hi'],
    reply:
      'こんにちは！中央大学国際情報学部（iTL）のイティエルです！何かお手伝いできることはありますか？',
    emotion: 'happy',
  },
  {
    keywords: [
      'お腹空いた',
      'お腹すいた',
      '昼ご飯',
      '昼ごはん',
      'ランチ',
      '学食',
      '弁当',
    ],
    reply:
      '市ヶ谷田町キャンパスには学食がないので、近隣のお弁当屋さんやカフェが人気なんですよ！一週間頑張ったご褒美には、美味しい外食を食べに行くのもいいですね！',
    emotion: 'relaxed',
  },
  {
    keywords: ['時間割', '授業', '講義', '課題'],
    reply:
      '時間割や講義情報ですね！国際情報学部の時間割は、学内ポータルで確認できます。課題の提出期限などは、うっかり忘れがちなのでスケジュール帳にしっかりメモしておきましょうね！',
    emotion: 'relaxed',
  },
  {
    keywords: ['キャンパス', '場所', 'どこ', '中央大学'],
    reply:
      '国際情報学部は「市ヶ谷田町キャンパス」の1学部のみ独立しているんです。市ヶ谷駅から近くて、とてもアクセスしやすい綺麗なビルなんですよ！',
    emotion: 'happy',
  },
  {
    keywords: ['雨', '天気', '寒'],
    reply:
      '今日はなんだか天気が悪くて肌寒いですね……。激しい寒暖差が続いていますので、体調管理には気を付けて、温かくしてお過ごしくださいね。',
    emotion: 'sad',
  },
  {
    keywords: ['疲れた', 'しんどい', '眠い'],
    reply:
      '今日もお疲れ様です！なかなか作業に身が入らない日もありますよね。そういう時は温かい飲み物でも飲んで、無理せずスケジュールを見直してみるのもおすすめですよ。',
    emotion: 'relaxed',
  },
  {
    keywords: ['法律', '情報', '勉強', 'iTL', 'itl'],
    reply:
      '国際情報学部は「情報の仕組み」と「法律（IT社会のルール）」、「グローバル教養」の3つを学ぶ学部なんですよ。新しい技術を正しく使うための力を身につけられるんです！',
    emotion: 'happy',
  },
]

/**
 * ユーザーの入力から定型的な応対を取得する
 */
export function getCannedResponse(messages: Message[]): string | null {
  if (messages.length === 0) return null

  const lastMessage = messages[messages.length - 1]
  if (lastMessage.role !== 'user') return null

  const content = lastMessage.content
  if (!content) return null

  const text =
    typeof content === 'string'
      ? content
      : content.map((c) => (c.type === 'text' ? c.text : '')).join(' ')

  // ルールを順番に評価し、キーワードが含まれていれば応答を返す
  for (const rule of cannedResponseRules) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      // 感情タグを付与して返す
      return `[${rule.emotion}]${rule.reply}`
    }
  }

  return null
}

/**
 * 定型文をAI生成風のストリームとして返すモックストリームを生成する
 */
export function createCannedResponseStream(
  text: string
): ReadableStream<string> {
  const tagMatch = text.match(/^\s*(\[[^\]]+\])+/)
  const tags = tagMatch ? tagMatch[0] : ''
  const body = tags ? text.slice(tags.length) : text

  return new ReadableStream({
    async start(controller) {
      if (tags) {
        controller.enqueue(tags)
      }

      const chunkSize = 2
      for (let i = 0; i < body.length; i += chunkSize) {
        const chunk = body.slice(i, i + chunkSize)
        controller.enqueue(chunk)
        await new Promise((resolve) => setTimeout(resolve, 20))
      }

      controller.close()
    },
  })
}
