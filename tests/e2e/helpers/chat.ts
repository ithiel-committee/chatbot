import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { storageKeys } from './app'

export const tinyPngDataUrl =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

type ChatApiMockOptions = {
  reply: string
}

type ChatApiRequest = {
  messages?: Array<{
    role?: string
    content?: unknown
  }>
  stream?: boolean
  aiService?: string
  model?: string
}

type SaveChatLogRequest = {
  messages?: unknown[]
  isNewFile?: boolean
}

type MultimodalTextPart = {
  type: 'text'
  text: string
}

type MultimodalImagePart = {
  type: 'image'
  image: string
}

const ttsApiPattern =
  /\/api\/(tts-|stylebertvits2|elevenLabs|cartesia|openAITTS|azureOpenAITTS)/
const localHosts = new Set(['127.0.0.1', 'localhost', '::1'])

export async function mockChatFlowApis(
  page: Page,
  { reply }: ChatApiMockOptions
) {
  const aiRequests: ChatApiRequest[] = []
  const saveChatLogRequests: SaveChatLogRequest[] = []
  const ttsRequests: string[] = []
  const externalRequests: string[] = []

  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (!localHosts.has(url.hostname)) {
      if (
        request.resourceType() === 'fetch' ||
        request.resourceType() === 'xhr'
      ) {
        externalRequests.push(request.url())
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, blockedByE2E: true }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType:
          request.resourceType() === 'stylesheet'
            ? 'text/css'
            : 'application/javascript',
        body: '',
      })
      return
    }

    if (url.pathname === '/api/ai/vercel') {
      const requestBody = request.postDataJSON() as ChatApiRequest
      aiRequests.push(requestBody)

      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: reply,
      })
      return
    }

    if (url.pathname === '/api/save-chat-log') {
      saveChatLogRequests.push(request.postDataJSON() as SaveChatLogRequest)

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Logs saved successfully' }),
      })
      return
    }

    if (url.pathname === '/api/embedding') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ embedding: Array(1536).fill(0) }),
      })
      return
    }

    if (ttsApiPattern.test(url.pathname)) {
      ttsRequests.push(request.url())

      await route.fulfill({
        status: 200,
        contentType: 'audio/wav',
        body: Buffer.alloc(0),
      })
      return
    }

    await route.continue()
  })

  return {
    aiRequests,
    saveChatLogRequests,
    ttsRequests,
    externalRequests,
  }
}

export async function pasteImageIntoChatInput(
  page: Page,
  {
    dataUrl = tinyPngDataUrl,
    fileName = 'e2e-image.png',
    mimeType = 'image/png',
  }: {
    dataUrl?: string
    fileName?: string
    mimeType?: string
  } = {}
) {
  await page.getByTestId('chat-message-input').evaluate(
    (element, { dataUrl, fileName, mimeType }) => {
      const base64 = dataUrl.split(',')[1] ?? ''
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const file = new File([bytes], fileName, { type: mimeType })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)

      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'clipboardData', {
        value: dataTransfer,
      })
      element.dispatchEvent(event)
    },
    { dataUrl, fileName, mimeType }
  )

  await expect(page.getByAltText('Pasted image')).toBeVisible()
}

export async function dropImageOnChatInput(
  page: Page,
  {
    dataUrl = tinyPngDataUrl,
    fileName = 'e2e-image.png',
    mimeType = 'image/png',
  }: {
    dataUrl?: string
    fileName?: string
    mimeType?: string
  } = {}
) {
  await page.getByTestId('chat-message-input').evaluate(
    (element, { dataUrl, fileName, mimeType }) => {
      const base64 = dataUrl.split(',')[1] ?? ''
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
      const file = new File([bytes], fileName, { type: mimeType })
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)

      const event = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'dataTransfer', {
        value: dataTransfer,
      })
      element.dispatchEvent(event)
    },
    { dataUrl, fileName, mimeType }
  )

  await expect(page.getByAltText('Pasted image')).toBeVisible()
}

export async function readHomeChatLog(page: Page) {
  try {
    return await page.evaluate((homeStorageKey) => {
      const raw = localStorage.getItem(homeStorageKey)
      return raw ? JSON.parse(raw).state.chatLog : []
    }, storageKeys.home)
  } catch {
    return []
  }
}

export function getMultimodalTextPart(
  content: unknown
): MultimodalTextPart | undefined {
  return getContentParts(content).find(isMultimodalTextPart)
}

export function getMultimodalImagePart(
  content: unknown
): MultimodalImagePart | undefined {
  return getContentParts(content).find(isMultimodalImagePart)
}

function getContentParts(content: unknown): unknown[] {
  return Array.isArray(content) ? content : []
}

function isMultimodalTextPart(part: unknown): part is MultimodalTextPart {
  return isRecord(part) && part.type === 'text' && typeof part.text === 'string'
}

function isMultimodalImagePart(part: unknown): part is MultimodalImagePart {
  return (
    isRecord(part) && part.type === 'image' && typeof part.image === 'string'
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
