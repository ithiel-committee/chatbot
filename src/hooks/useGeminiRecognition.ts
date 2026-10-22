import { logger } from '@/lib/logger'
import { useState, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import toastStore from '@/features/stores/toast'
import homeStore from '@/features/stores/home'
import { useAudioProcessing } from './useAudioProcessing'
import { SpeakQueue } from '@/features/messages/speakQueue'

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(
        reader.error || new Error('Failed to convert audio blob to base64')
      )
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Gemini APIを使用した音声認識のカスタムフック
 */
export function useGeminiRecognition(
  onChatProcessStart: (text: string) => void
) {
  const { t } = useTranslation()
  const selectLanguage = settingsStore((s) => s.selectLanguage)
  const googleKey = settingsStore((s) => s.googleKey)

  // ----- 状態管理 -----
  const [userMessage, setUserMessage] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const isListeningRef = useRef(false)
  const transcriptRef = useRef('')

  // ----- オーディオ処理フックを使用 -----
  const { startRecording, stopRecording } = useAudioProcessing()

  // ----- Gemini APIに音声データを送信して文字起こし -----
  const processGeminiRecognition = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      setIsProcessing(true)

      try {
        const audioBase64 = await blobToBase64(audioBlob)

        logger.log(
          `Sending audio to Gemini transcription - size: ${audioBlob.size} bytes, type: ${audioBlob.type}`
        )

        const response = await fetch('/api/ai/gemini-transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            audioBase64,
            mimeType: audioBlob.type || 'audio/webm',
            googleKey,
            language: selectLanguage,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            `Gemini transcription error: ${response.status} - ${errorData.details || errorData.error || 'Unknown error'}`
          )
        }

        const result = await response.json()
        return result.text || ''
      } catch (error) {
        logger.error('Gemini transcription error:', error)
        toastStore.getState().addToast({
          message: t('Toasts.GeminiTranscriptionError'),
          type: 'error',
          tag: 'gemini-transcription-error',
        })
        return ''
      } finally {
        setIsProcessing(false)
      }
    },
    [googleKey, selectLanguage, t]
  )

  // ----- 音声認識停止処理 -----
  const stopListening = useCallback(async () => {
    isListeningRef.current = false
    setIsListening(false)

    const audioBlob = await stopRecording()

    if (audioBlob && audioBlob.size > 0) {
      try {
        logger.log(
          `Processing audio blob for Gemini - size: ${audioBlob.size} bytes, type: ${audioBlob.type}`
        )

        const transcript = await processGeminiRecognition(audioBlob)

        if (transcript.trim()) {
          logger.log('Gemini transcription result:', transcript)
          transcriptRef.current = transcript
          onChatProcessStart(transcript)
        } else {
          logger.log('Gemini returned empty transcription')
          toastStore.getState().addToast({
            message: t('Toasts.NoSpeechDetected'),
            type: 'info',
            tag: 'no-speech-detected',
          })
        }
      } catch (error) {
        logger.error('Error processing Gemini audio:', error)
        toastStore.getState().addToast({
          message: t('Toasts.GeminiTranscriptionError'),
          type: 'error',
          tag: 'gemini-speech-error',
        })
      }
    } else {
      logger.warn('No audio data recorded')
      toastStore.getState().addToast({
        message: t('Toasts.NoSpeechDetected'),
        type: 'info',
        tag: 'no-speech-detected',
      })
    }
  }, [stopRecording, processGeminiRecognition, onChatProcessStart, t])

  // ----- 音声認識開始処理 -----
  const startListening = useCallback(async () => {
    transcriptRef.current = ''
    setUserMessage('')

    const success = await startRecording()

    if (success) {
      isListeningRef.current = true
      setIsListening(true)
    } else {
      toastStore.getState().addToast({
        message: t('Toasts.SpeechRecognitionError'),
        type: 'error',
        tag: 'speech-recognition-error',
      })
    }
  }, [startRecording, t])

  // ----- 音声認識トグル処理 -----
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      homeStore.setState({ isSpeaking: false })
      SpeakQueue.stopAll()
      startListening()
    }
  }, [startListening, stopListening])

  // ----- メッセージ送信 -----
  const handleSendMessage = useCallback(() => {
    if (userMessage.trim()) {
      homeStore.setState({ isSpeaking: false })
      SpeakQueue.stopAll()
      onChatProcessStart(userMessage)
      setUserMessage('')
    }
  }, [userMessage, onChatProcessStart])

  // ----- メッセージ入力 -----
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setUserMessage(e.target.value)
    },
    []
  )

  const returnValue = useMemo(
    () => ({
      userMessage,
      isListening,
      isProcessing,
      silenceTimeoutRemaining: null,
      handleInputChange,
      handleSendMessage,
      toggleListening,
      startListening,
      stopListening,
    }),
    [
      userMessage,
      isListening,
      isProcessing,
      handleInputChange,
      handleSendMessage,
      toggleListening,
      startListening,
      stopListening,
    ]
  )

  return returnValue
}
