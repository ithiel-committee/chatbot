import { render, screen } from '@testing-library/react'
import { AssistantText } from '@/components/assistantText'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'

describe('AssistantText component', () => {
  beforeEach(() => {
    settingsStore.setState({
      characterName: 'イティエル',
      userDisplayName: 'あなた',
      showCharacterName: true,
      assistantTextStyle: 'bubble',
      showPresetQuestions: false,
      presetQuestions: [],
    })
    homeStore.setState({
      chatLog: [],
      chatProcessing: false,
      isSpeaking: false,
    })
  })

  it('renders bubble style correctly', () => {
    settingsStore.setState({ assistantTextStyle: 'bubble' })
    render(<AssistantText message="こんにちは！" />)

    expect(screen.getByText('イティエル')).toBeInTheDocument()
    expect(screen.getByText('こんにちは！')).toBeInTheDocument()
  })

  it('renders borderless style correctly', () => {
    settingsStore.setState({ assistantTextStyle: 'borderless' })
    render(<AssistantText message="映画字幕風のテキストです" />)

    expect(screen.getByText('イティエル')).toBeInTheDocument()
    expect(screen.getByText('映画字幕風のテキストです')).toBeInTheDocument()
  })

  describe('novel style (ノベルゲーム風UI)', () => {
    beforeEach(() => {
      jest.useFakeTimers()
      settingsStore.setState({
        assistantTextStyle: 'novel',
        showInputForm: false,
      })
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('types character message one by one and displays full text upon completion', () => {
      homeStore.setState({
        chatLog: [{ role: 'assistant', content: 'こんにちは' }],
      })

      const { act } = require('@testing-library/react')
      render(<AssistantText message="こんにちは" />)

      expect(screen.getByText('イティエル')).toBeInTheDocument()

      // タイマーを進めて全文字表示を完了させる
      act(() => {
        jest.advanceTimersByTime(200)
      })

      expect(screen.getByText('こんにちは')).toBeInTheDocument()
      expect(screen.getByText('▼')).toBeInTheDocument()
    })

    it('renders user message immediately without typewriter delay', () => {
      homeStore.setState({
        chatLog: [
          { role: 'assistant', content: '前回のメッセージ' },
          { role: 'user', content: '学食はどこにありますか？' },
        ],
      })

      render(<AssistantText message="前回のメッセージ" />)

      expect(screen.getByText('あなた')).toBeInTheDocument()
      expect(screen.getByText('学食はどこにありますか？')).toBeInTheDocument()
      expect(screen.queryByText('前回のメッセージ')).not.toBeInTheDocument()
    })

    it('displays thinking indicator when processing without text', () => {
      homeStore.setState({
        chatLog: [],
        chatProcessing: true,
      })

      render(<AssistantText message="" />)

      expect(screen.getByText('イティエルが考え中')).toBeInTheDocument()
    })

    it('skips to full text immediately when text area is clicked', () => {
      homeStore.setState({
        chatLog: [
          { role: 'assistant', content: '長いメッセージをスキップするテスト' },
        ],
      })

      const { fireEvent, act } = require('@testing-library/react')
      render(<AssistantText message="長いメッセージをスキップするテスト" />)

      // まだタイピング中なので全文は出ていない
      expect(
        screen.queryByText('長いメッセージをスキップするテスト')
      ).not.toBeInTheDocument()

      // ダイアログをクリック
      const textArea = screen.getByTestId('novel-text-area')
      act(() => {
        fireEvent.click(textArea)
      })

      // 全文が表示される
      expect(
        screen.getByText('長いメッセージをスキップするテスト')
      ).toBeInTheDocument()
      expect(screen.getByText('▼')).toBeInTheDocument()
    })

    it('returns null when showInputForm is true to prevent duplicate rendering with MessageInput', () => {
      settingsStore.setState({ showInputForm: true })
      const { container } = render(<AssistantText message="テスト" />)

      expect(container.firstChild).toBeNull()
    })
  })
})
