import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * APIルートテスト用の共有ユーティリティ。
 * process.env を変更するため、利用側のテストで
 * beforeEach/afterEach による process.env の退避・復元を行うこと。
 */

export type MockApiResponse = NextApiResponse & {
  _status: number
  _json: unknown
  _headers: Record<string, unknown>
  _body: unknown
  _ended: boolean
  _writes: string[]
  _writeChunks: unknown[]
  _emit: (event: string, ...args: unknown[]) => void
}

export function createMockReq(
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return {
    method: 'POST',
    body: {},
    query: {},
    headers: {},
    socket: { remoteAddress: '127.0.0.1', on: () => {} },
    ...overrides,
  } as unknown as NextApiRequest
}

export function createMockRes(): MockApiResponse {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const res = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, unknown>,
    _body: null as unknown,
    _ended: false,
    _writes: [] as string[],
    _writeChunks: [] as unknown[],
    headersSent: false,
    writableEnded: false,
    status(code: number) {
      res._status = code
      return res
    },
    json(data: unknown) {
      res.headersSent = true
      res._json = data
      res._ended = true
      res.writableEnded = true
      return res
    },
    setHeader(key: string, value: unknown) {
      res._headers[key] = value
      return res
    },
    writeHead(code: number, headers?: Record<string, unknown>) {
      res._status = code
      Object.assign(res._headers, headers || {})
      res.headersSent = true
      return res
    },
    send(data: unknown) {
      res.headersSent = true
      res._body = data
      res._ended = true
      res.writableEnded = true
      return res
    },
    write(chunk: unknown) {
      res.headersSent = true
      res._writes.push(String(chunk))
      res._writeChunks.push(chunk)
      return true
    },
    once(event: string, listener: (...args: unknown[]) => void) {
      const eventListeners = listeners.get(event) ?? new Set()
      eventListeners.add(listener)
      listeners.set(event, eventListeners)
      return res
    },
    off(event: string, listener: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(listener)
      return res
    },
    _emit(event: string, ...args: unknown[]) {
      const eventListeners = [...(listeners.get(event) ?? [])]
      listeners.delete(event)
      eventListeners.forEach((listener) => listener(...args))
    },
    flushHeaders() {
      res.headersSent = true
    },
    end(data?: unknown) {
      res.headersSent = true
      if (data !== undefined) {
        res._body = data
      }
      res._ended = true
      res.writableEnded = true
      return res
    },
  }
  return res as unknown as MockApiResponse
}

export type ServerSecretGuardMode =
  | 'disabled'
  | 'protected'
  | 'demo'
  | 'unprotected'

export type MockServerSecretGuardOptions = {
  /** protectedモードのBearerトークン（既定: 'test-secret-token'） */
  token?: string
  /** demoモードのリクエスト元ホスト（既定: 'localhost:3000'） */
  host?: string
  /** demoモードのアクセストークン（指定時のみ AITUBERKIT_DEMO_ACCESS_TOKEN を設定） */
  demoToken?: string
}

/**
 * guardServerSecretAccess の4モードを模倣する環境変数を設定し、
 * そのモードでガードを通過できるリクエストヘッダーを返す。
 *
 * - disabled: ガードは常に拒否（403）
 * - protected: 返却ヘッダーの Authorization Bearer で通過
 * - demo: 返却ヘッダーの same-origin 情報で通過
 * - unprotected: ヘッダー不要で通過
 */
export function mockServerSecretGuard(
  mode: ServerSecretGuardMode,
  options: MockServerSecretGuardOptions = {}
): { headers: Record<string, string> } {
  const {
    token = 'test-secret-token',
    host = 'localhost:3000',
    demoToken,
  } = options

  process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE = mode
  delete process.env.AITUBERKIT_ALLOWED_ORIGINS
  delete process.env.AITUBERKIT_SERVER_SECRET_TOKEN
  delete process.env.AITUBERKIT_DEMO_ACCESS_TOKEN

  if (mode === 'protected') {
    process.env.AITUBERKIT_SERVER_SECRET_TOKEN = token
    return { headers: { authorization: `Bearer ${token}` } }
  }

  if (mode === 'demo') {
    const headers: Record<string, string> = {
      host,
      origin: `http://${host}`,
      'sec-fetch-site': 'same-origin',
    }
    if (demoToken) {
      process.env.AITUBERKIT_DEMO_ACCESS_TOKEN = demoToken
      headers['x-aituberkit-demo-token'] = demoToken
    }
    return { headers }
  }

  return { headers: {} }
}
