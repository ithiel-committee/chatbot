import { processAIResponse } from '@/features/chat/speechPipeline/processAIResponse'
import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'
import { speakCharacter } from '@/features/messages/speakCharacter'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'

jest.mock('@/features/chat/aiChatFactory', () => ({
  getAIChatResponseStream: jest.fn(),
}))

jest.mock('@/features/messages/speakCharacter', () => ({
  speakCharacter: jest.fn(),
}))

jest.mock('@/features/messages/characterRenderer', () => ({
  getCharacterRenderer: jest.fn(() => ({
    speak: jest.fn(),
    stopSpeaking: jest.fn(),
    resetToIdle: jest.fn(),
  })),
}))

jest.mock('@/features/memory/memoryStoreSync', () => ({
  saveMessageToMemory: jest.fn().mockResolvedValue(undefined),
}))

describe('processAIResponse 音声待機ゲート連携', () => {
  const upsertMessageMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()

    homeStore.setState({
      chatProcessing: false,
      chatLog: [],
      upsertMessage: upsertMessageMock,
      viewer: { model: null } as any,
    })

    settingsStore.setState({
      selectAIService: 'google',
      selectAIModel: 'gemini-3.8-flash',
      selectVoice: 'gemini',
      thinkingPoseEnabled: false,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const createControllableStream = () => {
    const queue: Array<{ value: string | undefined; done: boolean }> = []
    let nextResolve:
      | ((res: { value: string | undefined; done: boolean }) => void)
      | null = null

    const reader = {
      read: jest.fn().mockImplementation(() => {
        if (queue.length > 0) {
          return Promise.resolve(queue.shift()!)
        }
        return new Promise<{ value: string | undefined; done: boolean }>(
          (resolve) => {
            nextResolve = resolve
          }
        )
      }),
      releaseLock: jest.fn(),
    }
    return {
      stream: { getReader: () => reader },
      pushChunk: async (chunk: string) => {
        if (nextResolve) {
          const res = nextResolve
          nextResolve = null
          res({ value: chunk, done: false })
        } else {
          queue.push({ value: chunk, done: false })
        }
        // イベントループとタイマーを進めてマイクロタスクを消費
        await jest.advanceTimersByTimeAsync(0)
      },
      closeStream: async () => {
        if (nextResolve) {
          const res = nextResolve
          nextResolve = null
          res({ value: undefined, done: true })
        } else {
          queue.push({ value: undefined, done: true })
        }
        await jest.advanceTimersByTimeAsync(0)
      },
    }
  }

  it('音声が再生開始するまでテキストの表示（upsert）を保留し、再生開始で即座に表示する', async () => {
    const { stream, pushChunk, closeStream } = createControllableStream()
    ;(getAIChatResponseStream as jest.Mock).mockResolvedValue(stream)

    const processPromise = processAIResponse([
      { role: 'user', content: 'こんにちは' },
    ])

    // 1文目をプッシュ（文が確定してspeakCharacterが呼ばれる）
    await pushChunk('こんにちは！')

    // 発話依頼（speakCharacter）は呼ばれているが、まだ音声再生（onPlaybackStart）は呼ばれていない
    expect(speakCharacter).toHaveBeenCalled()
    // ゲートが閉まっているため、chatLogへのupsertはまだ保留されている
    expect(upsertMessageMock).not.toHaveBeenCalled()

    // speakCharacter の onPlaybackStart（第6引数）を取得して実行
    const calls = (speakCharacter as jest.Mock).mock.calls
    const onPlaybackStart = calls[0][5]
    expect(typeof onPlaybackStart).toBe('function')

    // 音声再生がスタートした瞬間
    onPlaybackStart()

    // 保留されていたテキストが一括でupsertされる
    expect(upsertMessageMock).toHaveBeenCalledTimes(1)
    expect(upsertMessageMock.mock.calls[0][0]).toMatchObject({
      role: 'assistant',
      content: 'こんにちは！',
    })

    // ゲート開放後の後続テキストは即時upsertされる
    await pushChunk('今日もいい天気ですね。')
    expect(upsertMessageMock).toHaveBeenCalledTimes(2)
    expect(upsertMessageMock.mock.calls[1][0]).toMatchObject({
      role: 'assistant',
      content: 'こんにちは！今日もいい天気ですね。',
    })

    await closeStream()
    await processPromise
  })

  it('短い応答でLLMストリームが先に完了しても、音声再生開始まで待機してからテキストを表示する', async () => {
    const { stream, pushChunk, closeStream } = createControllableStream()
    ;(getAIChatResponseStream as jest.Mock).mockResolvedValue(stream)

    const processPromise = processAIResponse([
      { role: 'user', content: 'テスト' },
    ])

    // 短いテキストをプッシュして直ちにストリーム終了
    await pushChunk('短い返答です。')
    await closeStream()

    // ストリームは終わったが、音声再生がまだ始まっていないため、upsertは呼ばれていない
    expect(upsertMessageMock).not.toHaveBeenCalled()

    // speakCharacter の onPlaybackStart を取得
    const calls = (speakCharacter as jest.Mock).mock.calls
    const onPlaybackStart = calls[0][5]
    expect(typeof onPlaybackStart).toBe('function')

    // 音声再生開始
    onPlaybackStart()

    // processPromise が完了し、テキストが画面に反映される
    const result = await processPromise
    expect(result).toBe('短い返答です。')
    expect(upsertMessageMock).toHaveBeenCalled()
    expect(upsertMessageMock.mock.calls[0][0]).toMatchObject({
      role: 'assistant',
      content: '短い返答です。',
    })
  })

  it('音声が来ない場合でも5秒タイムアウトでゲートが開放されてテキストが表示される', async () => {
    const { stream, pushChunk, closeStream } = createControllableStream()
    ;(getAIChatResponseStream as jest.Mock).mockResolvedValue(stream)

    const processPromise = processAIResponse([
      { role: 'user', content: 'テスト' },
    ])

    await pushChunk('時間のかかる応答テキストです。')
    expect(speakCharacter).toHaveBeenCalled()
    expect(upsertMessageMock).not.toHaveBeenCalled()

    // 4.9秒経過（まだ保留）
    await jest.advanceTimersByTimeAsync(4900)
    expect(upsertMessageMock).not.toHaveBeenCalled()

    // 5秒到達（タイムアウトでゲート自動開放）
    await jest.advanceTimersByTimeAsync(100)
    expect(upsertMessageMock).toHaveBeenCalledTimes(1)
    expect(upsertMessageMock.mock.calls[0][0]).toMatchObject({
      role: 'assistant',
      content: '時間のかかる応答テキストです。',
    })

    await closeStream()
    await processPromise
  })

  it('selectVoiceがnoneの場合は最初から待機ゲートを閉じずに即時表示する', async () => {
    settingsStore.setState({ selectVoice: 'none' })

    const { stream, pushChunk, closeStream } = createControllableStream()
    ;(getAIChatResponseStream as jest.Mock).mockResolvedValue(stream)

    const processPromise = processAIResponse([
      { role: 'user', content: 'テスト' },
    ])

    await pushChunk('音声なしの即時テキスト')

    // 保留されずに直ちにupsertされる
    expect(upsertMessageMock).toHaveBeenCalledTimes(1)
    expect(upsertMessageMock.mock.calls[0][0]).toMatchObject({
      role: 'assistant',
      content: '音声なしの即時テキスト',
    })

    await closeStream()
    await processPromise
  })
})
