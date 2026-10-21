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
      settingsStore.setState({ assistantTextStyle: 'novel', showInputForm: false })
    })

    it('renders character message with character nameplate when last message is assistant', () => {
      homeStore.setState({
        chatLog: [
          { role: 'assistant', content: 'ようこそ市ヶ谷田町キャンパスへ！' },
        ],
      })

      render(<AssistantText message="ようこそ市ヶ谷田町キャンパスへ！" />)

      expect(screen.getByText('イティエル')).toBeInTheDocument()
      expect(
        screen.getByText('ようこそ市ヶ谷田町キャンパスへ！')
      ).toBeInTheDocument()
      expect(screen.getByText('▼')).toBeInTheDocument()
    })

    it('renders user message with user nameplate when last message is from user', () => {
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

    it('returns null when showInputForm is true to prevent duplicate rendering with MessageInput', () => {
      settingsStore.setState({ showInputForm: true })
      const { container } = render(<AssistantText message="テスト" />)

      expect(container.firstChild).toBeNull()
    })
  })
})
