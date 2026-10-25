/**
 * @jest-environment node
 *
 * evaluateSecretPairs() の単体テスト。特に onlyIfAbsent（S18: 条件付きペア）
 * が difyChat.ts / stylebertvits2.ts が持っていた
 * 「他フィールドが未指定の場合のみenvを見る」という条件結合を
 * 正しく再現することを検証する。
 */
import type { NextApiRequest } from 'next'
import { evaluateSecretPairs } from '@/lib/accessPolicy/secretPairs'
import type { SecretPair } from '@/lib/accessPolicy/types'

const originalEnv = { ...process.env }

function mockReq(body: Record<string, unknown> = {}): NextApiRequest {
  return { body, query: {} } as unknown as NextApiRequest
}

describe('evaluateSecretPairs', () => {
  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns true when the client omits key and env is set (no onlyIfAbsent)', () => {
    process.env.TEST_KEY = 'server-value'
    const pairs: SecretPair[] = [
      { source: 'body', key: 'apiKey', envVars: ['TEST_KEY'] },
    ]
    expect(evaluateSecretPairs(mockReq({}), pairs)).toBe(true)
  })

  it('returns false when the client provides the key (no onlyIfAbsent)', () => {
    process.env.TEST_KEY = 'server-value'
    const pairs: SecretPair[] = [
      { source: 'body', key: 'apiKey', envVars: ['TEST_KEY'] },
    ]
    expect(
      evaluateSecretPairs(mockReq({ apiKey: 'client-value' }), pairs)
    ).toBe(false)
  })

  it('treats whitespace as absent only for pairs opting into trimClientValue', () => {
    process.env.TEST_KEY = 'server-value'
    const pair: SecretPair = {
      source: 'body',
      key: 'apiKey',
      envVars: ['TEST_KEY'],
    }
    const req = mockReq({ apiKey: ' \n\t' })
    expect(evaluateSecretPairs(req, [pair])).toBe(false)
    expect(evaluateSecretPairs(req, [{ ...pair, trimClientValue: true }])).toBe(
      true
    )
    expect(
      evaluateSecretPairs(mockReq({ apiKey: ' client-key ' }), [
        { ...pair, trimClientValue: true },
      ])
    ).toBe(false)
  })

  it('onlyIfAbsent: skips the pair when the gate field is provided by the client', () => {
    process.env.TEST_KEY = 'server-value'
    const pairs: SecretPair[] = [
      {
        source: 'body',
        key: 'apiKey',
        envVars: ['TEST_KEY'],
        onlyIfAbsent: { source: 'body', key: 'url' },
      },
    ]
    // apiKey未指定・envあり・だが url がクライアント提供されているためペア自体を評価しない
    expect(
      evaluateSecretPairs(mockReq({ url: 'https://example.com' }), pairs)
    ).toBe(false)
  })

  it('onlyIfAbsent: evaluates the pair normally when the gate field is absent', () => {
    process.env.TEST_KEY = 'server-value'
    const pairs: SecretPair[] = [
      {
        source: 'body',
        key: 'apiKey',
        envVars: ['TEST_KEY'],
        onlyIfAbsent: { source: 'body', key: 'url' },
      },
    ]
    expect(evaluateSecretPairs(mockReq({}), pairs)).toBe(true)
  })

  it('reproduces difyChat.ts usesServerSecret semantics', () => {
    const pairs: SecretPair[] = [
      {
        source: 'body',
        key: 'apiKey',
        envVars: ['DIFY_KEY', 'DIFY_API_KEY'],
        onlyIfAbsent: { source: 'body', key: 'url' },
      },
      { source: 'body', key: 'url', envVars: ['DIFY_URL'] },
    ]

    // クライアントがurlを提供し、かつapiKey未指定・DIFY_KEY設定済み
    // → 元のロジック: usesServerDifyKey = !apiKey && !usesClientUrl && ... = false
    //   (!url && DIFY_URL) = false（urlありのため）
    //   => usesServerSecret = false
    process.env.DIFY_KEY = 'server-dify-key'
    expect(
      evaluateSecretPairs(
        mockReq({ url: 'https://untrusted.example/v1' }),
        pairs
      )
    ).toBe(false)

    // クライアントがurl/apiKeyともに未指定、DIFY_KEY・DIFY_URLともに設定済み
    // → 元のロジック: usesServerDifyKey = true => usesServerSecret = true
    expect(evaluateSecretPairs(mockReq({}), pairs)).toBe(true)

    // クライアントがapiKeyのみ提供、urlは未指定、DIFY_URL設定済み
    // → 元のロジック: usesServerDifyKey = false（apiKeyあり）
    //   (!url && DIFY_URL) = true => usesServerSecret = true
    delete process.env.DIFY_KEY
    process.env.DIFY_URL = 'https://dify.example/v1'
    expect(
      evaluateSecretPairs(mockReq({ apiKey: 'client-dify-key' }), pairs)
    ).toBe(true)
  })
})
