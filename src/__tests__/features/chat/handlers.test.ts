import {
  handleSendChatFn,
  handleReceiveTextFromWsFn,
  processAIResponse,
} from '@/features/chat/handlers'
import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'
import { speakCharacter } from '@/features/messages/speakCharacter'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import slideStore from '@/features/stores/slide'
import externalLinkageWebSocketStore from '@/features/stores/externalLinkageWebSocketStore'
import toastStore from '@/features/stores/toast'
import i18next from 'i18next'
import { Message } from '@/features/messages/messages'
import { CONVERSATION_LATENCY_SUMMARY_EVENT } from '@/features/chat/conversationLatency'

jest.mock('@/features/chat/aiChatFactory', () => ({
  getAIChatResponseStream: jest.fn(),
}))

jest.mock('@/features/messages/speakCharacter', () => ({
  speakCharacter: jest.fn(),
}))

jest.mock('@/components/slides', () => ({
  goToSlide: jest.fn(),
}))

jest.mock('@/features/stores/home', () => ({
  getState: jest.fn(),
  setState: jest.fn(),
  upsertMessage: jest.fn(),
}))

jest.mock('@/features/stores/settings', () => ({
  getState: jest.fn(),
}))

jest.mock('@/features/stores/slide', () => ({
  getState: jest.fn(),
}))

jest.mock('@/features/stores/websocketStore', () => ({
  getState: jest.fn(),
}))

jest.mock('@/features/stores/externalLinkageWebSocketStore', () => ({
  getState: jest.fn(),
}))

jest.mock('@/features/stores/toast', () => ({
  getState: jest.fn(),
}))

jest.mock('i18next', () => ({
  t: jest.fn((key) => key),
}))

describe('handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('handleSendChatFn', () => {
    it('メッセージが空の場合は処理を行わない', async () => {
      const handleSendChat = handleSendChatFn()
      await handleSendChat(null as unknown as string)

      expect(homeStore.setState).not.toHaveBeenCalled()
    })

    it('externalLinkageModeがtrueの場合、WebSocketを使用してメッセージを送信する', async () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      }
      const mockWsManager = {
        websocket: mockWebSocket,
      }
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: mockWsManager,
        protocolVersion: 'legacy',
      })
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      ;(homeStore.getState as jest.Mock).mockReturnValue({
        chatLog: [],
        modalImage: '',
        upsertMessage: jest.fn(),
      })

      const handleSendChat = handleSendChatFn()
      await handleSendChat('テストメッセージ')

      expect(homeStore.setState).toHaveBeenCalledWith({ chatProcessing: true })
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ content: 'テストメッセージ', type: 'chat' })
      )
      expect((homeStore.getState() as any).upsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          content: 'テストメッセージ',
        })
      )
    })

    it('externalLinkageModeがtrueで画像がある場合、WebSocketペイロードにimageを含める', async () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      }
      const mockWsManager = {
        websocket: mockWebSocket,
      }
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: mockWsManager,
        protocolVersion: 'legacy',
      })
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      const mockUpsertMessage = jest.fn()
      ;(homeStore.getState as jest.Mock).mockReturnValue({
        chatLog: [],
        modalImage: 'data:image/png;base64,iVBORw0KGgo=',
        upsertMessage: mockUpsertMessage,
      })

      const handleSendChat = handleSendChatFn()
      await handleSendChat('画像付きメッセージ')

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          content: '画像付きメッセージ',
          type: 'chat',
          image: 'data:image/png;base64,iVBORw0KGgo=',
        })
      )
      expect(mockUpsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          content: [
            { type: 'text', text: '画像付きメッセージ' },
            { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
          ],
        })
      )
      expect(homeStore.setState).toHaveBeenCalledWith({ modalImage: '' })
    })

    it('externalLinkageModeがtrueだがWebSocketが接続されていない場合、エラーを表示する', async () => {
      const mockAddToast = jest.fn()
      const mockWebSocket = {
        readyState: WebSocket.CLOSED,
      }
      const mockWsManager = {
        websocket: mockWebSocket,
      }
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: mockWsManager,
        protocolVersion: 'legacy',
      })
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      ;(toastStore.getState as jest.Mock).mockReturnValue({
        addToast: mockAddToast,
      })

      const handleSendChat = handleSendChatFn()
      await handleSendChat('テストメッセージ')

      expect(homeStore.setState).toHaveBeenCalledWith({ chatProcessing: true })
      expect(mockAddToast).toHaveBeenCalledWith({
        message: 'NotConnectedToExternalAssistant',
        type: 'error',
        tag: 'not-connected-to-external-assistant',
      })
      expect(homeStore.setState).toHaveBeenCalledWith({
        chatProcessing: false,
      })
    })

    it('externalLinkageModeがtrueでv2接続済みの場合、v2イベントで送信する', async () => {
      const mockWebSocket = {
        readyState: WebSocket.OPEN,
        send: jest.fn(),
      }
      const mockStartRequest = jest.fn()
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: {
          websocket: mockWebSocket,
        },
        protocolVersion: '2',
        startRequest: mockStartRequest,
      })
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      ;(homeStore.getState as jest.Mock).mockReturnValue({
        chatLog: [],
        modalImage: '',
        upsertMessage: jest.fn(),
      })

      const handleSendChat = handleSendChatFn()
      await handleSendChat('v2メッセージ')

      const sent = JSON.parse(mockWebSocket.send.mock.calls[0][0])
      expect(sent.version).toBe('2')
      expect(sent.type).toBe('chat.message')
      expect(sent.payload.text).toBe('v2メッセージ')
      expect(mockStartRequest).toHaveBeenCalledWith(sent.id)
    })

    it('通常モードの場合、AIチャットレスポンスを処理する', async () => {
      const mockChatLog: Message[] = []
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({ value: 'テスト応答', done: false })
          .mockResolvedValueOnce({ value: undefined, done: true }),
        releaseLock: jest.fn(),
      }
      const mockStream = {
        getReader: jest.fn().mockReturnValue(mockReader),
      } as unknown as ReadableStream<string>
      ;(getAIChatResponseStream as jest.Mock).mockResolvedValue(mockStream)
      const mockHomeStore = {
        chatLog: mockChatLog,
        chatProcessing: false,
        modalImage: '',
        setState: jest.fn(),
        upsertMessage: jest.fn((newMessage: Message) => {
          const existingIndex = mockChatLog.findIndex(
            (msg) =>
              msg.audio?.id === newMessage.audio?.id &&
              newMessage.audio?.id !== undefined
          )
          if (existingIndex !== -1) {
            mockChatLog[existingIndex] = {
              ...mockChatLog[existingIndex],
              ...newMessage,
            }
          } else {
            mockChatLog.push({ content: '', ...newMessage })
          }
        }),
      }
      ;(homeStore.getState as jest.Mock).mockReturnValue(mockHomeStore)
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: false,
        realtimeAPIMode: false,
        slideMode: false,
        systemPrompt: 'テストプロンプト',
        includeTimestampInUserMessage: false,
        poseConfigs: [],
      })

      const handleSendChat = handleSendChatFn()
      await handleSendChat('テストメッセージ')

      expect(homeStore.setState).toHaveBeenCalledWith({ chatProcessing: true })
      expect(mockHomeStore.upsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'user',
          content: 'テストメッセージ',
        })
      )
      expect(getAIChatResponseStream).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: 'テストプロンプト',
          }),
        ])
      )
    })
  })

  describe('handleReceiveTextFromWsFn', () => {
    it('画像付きメッセージを受信した場合、マルチモーダル形式で格納する', async () => {
      const mockUpsertMessage = jest.fn()
      const mockWsManager = {
        textBlockStarted: false,
        setTextBlockStarted: jest.fn(),
      }
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      ;(homeStore.getState as jest.Mock).mockReturnValue({
        chatLog: [],
        upsertMessage: mockUpsertMessage,
      })
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: mockWsManager,
      })

      const handleReceiveTextFromWs = handleReceiveTextFromWsFn()
      await handleReceiveTextFromWs(
        'テスト応答',
        'assistant',
        'happy',
        undefined,
        'data:image/png;base64,iVBORw0KGgo='
      )

      expect(mockUpsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: [
            { type: 'text', text: 'テスト応答' },
            { type: 'image', image: 'data:image/png;base64,iVBORw0KGgo=' },
          ],
        })
      )
    })

    it('画像なしメッセージを受信した場合、テキストのみで格納する', async () => {
      const mockUpsertMessage = jest.fn()
      const mockWsManager = {
        textBlockStarted: false,
        setTextBlockStarted: jest.fn(),
      }
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      ;(homeStore.getState as jest.Mock).mockReturnValue({
        chatLog: [],
        upsertMessage: mockUpsertMessage,
      })
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: mockWsManager,
      })

      const handleReceiveTextFromWs = handleReceiveTextFromWsFn()
      await handleReceiveTextFromWs('テスト応答', 'assistant', 'neutral')

      expect(mockUpsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: 'テスト応答',
        })
      )
    })

    it('ストリーミング追記時にマルチモーダルコンテンツの画像を保持する', async () => {
      const mockUpsertMessage = jest.fn()
      const mockWsManager = {
        textBlockStarted: true,
        setTextBlockStarted: jest.fn(),
      }
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      ;(homeStore.getState as jest.Mock).mockReturnValue({
        chatLog: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: [
              { type: 'text', text: '最初のチャンク' },
              { type: 'image', image: 'data:image/png;base64,abc123' },
            ],
          },
        ],
        upsertMessage: mockUpsertMessage,
      })
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: mockWsManager,
      })

      const handleReceiveTextFromWs = handleReceiveTextFromWsFn()
      await handleReceiveTextFromWs('追加テキスト', 'assistant', 'happy')

      expect(mockUpsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'text', text: '最初のチャンク追加テキスト' },
            { type: 'image', image: 'data:image/png;base64,abc123' },
          ],
        })
      )
    })

    it('v2外部連携で発話ライフサイクルイベントを送信する', async () => {
      const mockUpsertMessage = jest.fn()
      const mockSend = jest.fn()
      const mockWsManager = {
        textBlockStarted: false,
        setTextBlockStarted: jest.fn(),
      }
      ;(settingsStore.getState as jest.Mock).mockReturnValue({
        externalLinkageMode: true,
      })
      ;(homeStore.getState as jest.Mock).mockReturnValue({
        chatLog: [],
        upsertMessage: mockUpsertMessage,
      })
      ;(externalLinkageWebSocketStore.getState as jest.Mock).mockReturnValue({
        wsManager: mockWsManager,
        protocolVersion: '2',
        send: mockSend,
      })
      ;(speakCharacter as jest.Mock).mockImplementation(
        (_sessionId, _talk, onStart, onComplete) => {
          onStart?.()
          onComplete?.()
        }
      )

      const handleReceiveTextFromWs = handleReceiveTextFromWsFn()
      await handleReceiveTextFromWs(
        'テスト応答',
        'assistant',
        'happy',
        '',
        undefined,
        'msg_request'
      )
      await handleReceiveTextFromWs(
        '',
        'assistant',
        'neutral',
        'end',
        undefined,
        'msg_request'
      )

      const sentTypes = mockSend.mock.calls.map(
        ([data]) => JSON.parse(data).type
      )
      expect(sentTypes).toEqual(
        expect.arrayContaining([
          'character.message.received',
          'character.message.rendered',
          'character.speech.start',
          'character.speech.done',
          'character.response.done',
        ])
      )

      const responseDone = mockSend.mock.calls
        .map(([data]) => JSON.parse(data))
        .find((event) => event.type === 'character.response.done')
      expect(responseDone.requestId).toBe('msg_request')
      expect(responseDone.payload.speechSegmentCount).toBe(1)
    })
  })

  describe('processAIResponse', () => {
    it('AIレスポンスストリームがnullの場合、処理を終了する', async () => {
      ;(getAIChatResponseStream as jest.Mock).mockResolvedValue(null)
      const onSummary = jest.fn()
      window.addEventListener(CONVERSATION_LATENCY_SUMMARY_EVENT, onSummary)

      await processAIResponse([])

      window.removeEventListener(CONVERSATION_LATENCY_SUMMARY_EVENT, onSummary)
      expect(homeStore.setState).toHaveBeenCalledWith({ chatProcessing: false })
      expect(speakCharacter).not.toHaveBeenCalled()
      expect(onSummary).toHaveBeenCalledTimes(1)
    })

    it('AIリクエスト失敗時もレイテンシ計測を完了する', async () => {
      ;(getAIChatResponseStream as jest.Mock).mockRejectedValue(
        new Error('request failed')
      )
      const onSummary = jest.fn()
      window.addEventListener(CONVERSATION_LATENCY_SUMMARY_EVENT, onSummary)

      await processAIResponse([])

      window.removeEventListener(CONVERSATION_LATENCY_SUMMARY_EVENT, onSummary)
      expect(homeStore.setState).toHaveBeenCalledWith({ chatProcessing: false })
      expect(onSummary).toHaveBeenCalledTimes(1)
    })
  })
})
