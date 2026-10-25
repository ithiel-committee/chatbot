import {
  MessageLogWriter,
  NormalizedMessageLogWriter,
} from '@/features/chat/speechPipeline/messageLogWriter'
import { Message } from '@/features/messages/messages'

jest.mock('@/features/stores/home', () => ({
  getState: jest.fn(),
}))

describe('MessageLogWriter（ストリーミング表示）', () => {
  it('表示テキストを同一メッセージIDへ追記する', () => {
    const upsert = jest.fn()
    const writer = new MessageLogWriter(upsert)

    writer.appendDisplay('こんに')
    writer.appendDisplay('ちは')

    expect(upsert).toHaveBeenCalledTimes(2)
    const [first, second] = upsert.mock.calls.map((c) => c[0] as Message)
    expect(first.content).toBe('こんに')
    expect(second.content).toBe('こんにちは')
    expect(first.id).toBe(second.id)
    expect(first.role).toBe('assistant')
  })

  it('空テキストではupsertしない', () => {
    const upsert = jest.fn()
    const writer = new MessageLogWriter(upsert)
    writer.appendDisplay('')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('コードブロックでメッセージ境界が生まれる（D3）', () => {
    const upsert = jest.fn()
    const writer = new MessageLogWriter(upsert)

    writer.appendDisplay('前半。')
    writer.appendCodeBlock('const a = 1')
    writer.appendDisplay('後半。')
    writer.finalize()

    const calls = upsert.mock.calls.map((c) => c[0] as Message)
    const codeCall = calls.find((c) => c.role === 'code')
    expect(codeCall?.content).toBe('const a = 1')
    expect(codeCall?.id).toBeUndefined()

    const before = calls.find((c) => c.content === '前半。')
    const after = calls.find((c) => c.content === '後半。')
    expect(before?.id).not.toBe(after?.id)
  })

  it('空白のみのコードブロックはupsertしない', () => {
    const upsert = jest.fn()
    const writer = new MessageLogWriter(upsert)
    writer.appendCodeBlock('   \n')
    expect(upsert).not.toHaveBeenCalled()
  })

  it('thinkingチャンクを蓄積してupsertする', () => {
    const upsert = jest.fn()
    const writer = new MessageLogWriter(upsert)

    writer.appendThinking('思考1')
    writer.appendThinking('思考2')
    writer.appendDisplay('本文')

    const calls = upsert.mock.calls.map((c) => c[0] as Message)
    expect(calls[0]).toMatchObject({ content: '', thinking: '思考1' })
    expect(calls[1]).toMatchObject({ content: '', thinking: '思考1思考2' })
    expect(calls[2]).toMatchObject({ content: '本文', thinking: '思考1思考2' })
    expect(new Set(calls.map((c) => c.id)).size).toBe(1)
  })

  it('finalizeはトリム済みの最終内容を返しupsertする', () => {
    const upsert = jest.fn()
    const writer = new MessageLogWriter(upsert)
    writer.appendDisplay('  本文です  ')
    expect(writer.finalize()).toBe('本文です')
    const last = upsert.mock.calls.at(-1)?.[0] as Message
    expect(last.content).toBe('本文です')
  })

  it('内容が空ならfinalizeはupsertせず空文字を返す', () => {
    const upsert = jest.fn()
    const writer = new MessageLogWriter(upsert)
    expect(writer.finalize()).toBe('')
    expect(upsert).not.toHaveBeenCalled()
  })

  describe('音声待機ゲート（gated）', () => {
    beforeEach(() => {
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('ゲート有効時はreleaseGateが呼ばれるまで表示upsertを保留する', () => {
      const upsert = jest.fn()
      const writer = new MessageLogWriter(upsert, { gated: true })

      writer.appendDisplay('保留テキスト1')
      writer.appendDisplay('保留テキスト2')

      expect(upsert).not.toHaveBeenCalled()

      // 音声再生開始などを模してゲートを開放
      writer.releaseGate()

      expect(upsert).toHaveBeenCalledTimes(1)
      const call = upsert.mock.calls[0][0] as Message
      expect(call.content).toBe('保留テキスト1保留テキスト2')

      // 開放後の追加は即時upsertされる
      writer.appendDisplay('追加テキスト')
      expect(upsert).toHaveBeenCalledTimes(2)
      expect(upsert.mock.calls[1][0].content).toBe(
        '保留テキスト1保留テキスト2追加テキスト'
      )
    })

    it('タイムアウト（例: 5秒）が経過すると自動的にゲートが開放される', () => {
      const upsert = jest.fn()
      const writer = new MessageLogWriter(upsert, {
        gated: true,
        gateTimeoutMs: 5000,
      })

      writer.appendDisplay('タイムアウト待ちテキスト')
      expect(upsert).not.toHaveBeenCalled()

      // 4.9秒経過ではまだ保留
      jest.advanceTimersByTime(4900)
      expect(upsert).not.toHaveBeenCalled()

      // 5秒到達でゲートが自動開放されてupsertされる
      jest.advanceTimersByTime(100)
      expect(upsert).toHaveBeenCalledTimes(1)
      expect(upsert.mock.calls[0][0].content).toBe('タイムアウト待ちテキスト')
    })

    it('コードブロック到着時にゲートが開放される', () => {
      const upsert = jest.fn()
      const writer = new MessageLogWriter(upsert, { gated: true })

      writer.appendDisplay('コード前の文。')
      expect(upsert).not.toHaveBeenCalled()

      writer.appendCodeBlock('const x = 1')
      // 前半テキストとコードブロックの両方がupsertされる
      const calls = upsert.mock.calls.map((c) => c[0] as Message)
      expect(calls.some((c) => c.content === 'コード前の文。')).toBe(true)
      expect(calls.some((c) => c.role === 'code')).toBe(true)
    })

    it('finalize呼び出し時に未開放のゲートが自動開放される', () => {
      const upsert = jest.fn()
      const writer = new MessageLogWriter(upsert, { gated: true })

      writer.appendDisplay('短いテキスト')
      expect(upsert).not.toHaveBeenCalled()

      const result = writer.finalize()
      expect(result).toBe('短いテキスト')
      expect(upsert).toHaveBeenCalled()
      expect(upsert.mock.calls.at(-1)?.[0].content).toBe('短いテキスト')
    })
  })
})

describe('NormalizedMessageLogWriter（speakMessageHandler表示）', () => {
  it('speechイベントから正規化形式（タグ+スペース結合）を再構成する', () => {
    const upsert = jest.fn()
    const writer = new NormalizedMessageLogWriter(upsert)

    writer.handleEvent({
      kind: 'speech',
      text: 'こんにちは。',
      emotionTag: '[happy]',
      emotionTagExplicit: true,
    })
    writer.handleEvent({ kind: 'speech', text: '元気？', emotionTag: '' })
    writer.finalize()

    expect(upsert).toHaveBeenCalledTimes(1)
    const msg = upsert.mock.calls[0][0] as Message
    expect(msg.content).toBe('[happy] こんにちは。 元気？')
    expect(msg.role).toBe('assistant')
  })

  it('持ち越しによる暗黙タグは表示にプレフィックスしない（明示タグのみ）', () => {
    const upsert = jest.fn()
    const writer = new NormalizedMessageLogWriter(upsert)

    // 実segmenterが「[happy]一文目。二文目。」から生成するイベント列を模す:
    // 二文目のタグは持ち越し（emotionTagExplicit: false）
    writer.handleEvent({
      kind: 'speech',
      text: '一文目。',
      emotionTag: '[happy]',
      emotionTagExplicit: true,
    })
    writer.handleEvent({
      kind: 'speech',
      text: '二文目。',
      emotionTag: '[happy]',
      emotionTagExplicit: false,
    })
    writer.finalize()

    const msg = upsert.mock.calls[0][0] as Message
    expect(msg.content).toBe('[happy] 一文目。 二文目。')
  })

  it('モーションタグは表示に含めない（現行踏襲）', () => {
    const upsert = jest.fn()
    const writer = new NormalizedMessageLogWriter(upsert)
    writer.handleEvent({
      kind: 'speech',
      text: 'うーん。',
      emotionTag: '',
      motionTag: 'think',
    })
    writer.finalize()
    const msg = upsert.mock.calls[0][0] as Message
    expect(msg.content).toBe('うーん。')
  })

  it('コードブロックはID付きcodeメッセージとして分離される', () => {
    const upsert = jest.fn()
    const writer = new NormalizedMessageLogWriter(upsert)

    writer.handleEvent({ kind: 'speech', text: '前半。', emotionTag: '' })
    writer.handleEvent({ kind: 'code', content: 'const a = 1' })
    writer.handleEvent({ kind: 'speech', text: '後半。', emotionTag: '' })
    writer.finalize()

    const calls = upsert.mock.calls.map((c) => c[0] as Message)
    expect(calls.map((c) => c.role)).toEqual(['assistant', 'code', 'assistant'])
    expect(calls[1].id).toBeDefined()
    expect(calls[0].id).not.toBe(calls[2].id)
    expect(calls[0].content).toBe('前半。')
    expect(calls[2].content).toBe('後半。')
  })

  it('displayイベントは無視する', () => {
    const upsert = jest.fn()
    const writer = new NormalizedMessageLogWriter(upsert)
    writer.handleEvent({ kind: 'display', text: '生テキスト' })
    writer.finalize()
    expect(upsert).not.toHaveBeenCalled()
  })
})
