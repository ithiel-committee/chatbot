import type { TFunction } from 'i18next'
import { AIService } from '@/features/constants/settings'

export interface AIServiceConfig {
  value: AIService
  label: string
  keyLabel?: string
  keyPlaceholder?: string
  linkUrl?: string
  linkLabel?: string
  description?: string
  showMultiModalToggle?: boolean
  customModelValidation?: boolean
}

export const aiServiceOptions: AIServiceConfig[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'dify', label: 'Dify' },
  { value: 'custom-api', label: 'Custom API' },
]

export const getServiceConfigByKey = (
  t: TFunction
): Record<AIService, AIServiceConfig> => ({
  openai: {
    value: 'openai',
    label: 'OpenAI',
    keyLabel: t('OpenAIAPIKeyLabel'),
    keyPlaceholder: 'sk-...',
    linkUrl: 'https://platform.openai.com/account/api-keys',
    linkLabel: 'OpenAI Platform',
    showMultiModalToggle: true,
  },
  anthropic: {
    value: 'anthropic',
    label: 'Anthropic',
    keyLabel: t('AnthropicAPIKeyLabel'),
    keyPlaceholder: 'sk-...',
    linkUrl: 'https://console.anthropic.com',
    linkLabel: 'Anthropic Console',
    showMultiModalToggle: true,
  },
  google: {
    value: 'google',
    label: 'Google Gemini',
    keyLabel: t('GoogleAPIKeyLabel'),
    linkUrl: 'https://aistudio.google.com/app/apikey?hl=ja',
    linkLabel: 'Google AI Studio',
    showMultiModalToggle: true,
  },
  azure: {
    value: 'azure',
    label: 'Azure OpenAI',
    keyLabel: t('AzureAPIKeyLabel'),
    linkUrl:
      'https://portal.azure.com/#view/Microsoft_Azure_AI/AzureOpenAI/keys',
    linkLabel: 'Azure OpenAI Portal',
  },
  groq: {
    value: 'groq',
    label: 'Groq',
    keyLabel: t('GroqAPIKeyLabel'),
    keyPlaceholder: 'gsk-...',
    linkUrl: 'https://console.groq.com/keys',
    linkLabel: 'Groq Dashboard',
    showMultiModalToggle: true,
  },
  openrouter: {
    value: 'openrouter',
    label: 'OpenRouter',
    keyLabel: t('OpenRouterAPIKeyLabel'),
    keyPlaceholder: 'sk-...',
    linkUrl: 'https://openrouter.ai/keys',
    linkLabel: t('OpenRouterDashboardLink', 'OpenRouter Dashboard'),
    showMultiModalToggle: true,
    customModelValidation: false,
  },
  lmstudio: {
    value: 'lmstudio',
    label: 'LM Studio',
    showMultiModalToggle: true,
    customModelValidation: false,
  },
  ollama: {
    value: 'ollama',
    label: 'Ollama',
    showMultiModalToggle: true,
    customModelValidation: false,
  },
  dify: {
    value: 'dify',
    label: 'Dify',
    keyLabel: t('DifyAPIKeyLabel'),
  },
  'custom-api': {
    value: 'custom-api',
    label: 'Custom API',
    showMultiModalToggle: true,
  },
})
