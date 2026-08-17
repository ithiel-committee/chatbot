/**
 * デプロイ文脈（運用プロファイル）ごとの許可/拒否マトリクステスト
 * （docs/access-policy-design.md §3.2 / §7.1）
 *
 * 実際の routePolicies のエントリをスタブハンドラーでラップし、
 * 各プロファイルのenv構成で代表ルートの防御挙動を固定する。
 */
import type { NextApiRequest } from 'next'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import { routePolicies } from '@/lib/accessPolicy/routePolicies'
import type { KnownApiPath } from '@/lib/accessPolicy/routePolicies'
import {
  createMockReq,
  createMockRes,
  mockServerSecretGuard,
} from '../../helpers/apiRouteTestUtils'

const ORIGINAL_ENV = process.env

async function invoke(
  policyPath: KnownApiPath,
  reqOverrides: Partial<NextApiRequest> = {}
) {
  const handler = jest.fn(async (_req, res, _gate) => {
    res.status(200).json({ ok: true })
  })
  const wrapped = withAccessPolicy(routePolicies[policyPath], handler)
  const req = createMockReq(reqOverrides)
  const res = createMockRes()
  await wrapped(req, res)
  return { handler, res }
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
  delete process.env.AITUBERKIT_SERVER_SECRET_TOKEN
  delete process.env.AITUBERKIT_DEMO_ACCESS_TOKEN
  delete process.env.AITUBERKIT_ALLOWED_ORIGINS
  delete process.env.AITUBERKIT_API_KEY
  delete process.env.NEXT_PUBLIC_RESTRICTED_MODE
  delete process.env.OPENAI_TTS_KEY
  delete process.env.OPENAI_API_KEY
  delete process.env.VOICEVOX_SERVER_URL
  delete (
    globalThis as typeof globalThis & {
      __aituberKitServerSecretRateLimit?: unknown
    }
  ).__aituberKitServerSecretRateLimit
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('プロファイル: self-host（既定 = serverSecretMode: disabled, FS利用可）', () => {
  it('client-proxy ルートは通過する（tts-koeiromap）', async () => {
    const { handler } = await invoke('/api/tts-koeiromap', {
      body: { message: 'test', apiKey: 'client-key' },
    })
    expect(handler).toHaveBeenCalled()
  })

  it('クライアントキー持込のTTSは通過する（openAITTS）', async () => {
    const { handler } = await invoke('/api/openAITTS', {
      body: { apiKey: 'client-key', message: 'test' },
    })
    expect(handler).toHaveBeenCalled()
  })

  it('サーバーenvキー利用は拒否される（openAITTS + OPENAI_TTS_KEY）', async () => {
    process.env.OPENAI_TTS_KEY = 'server-key'
    const { res, handler } = await invoke('/api/openAITTS', {
      body: { message: 'test' },
    })
    expect(res._status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  it('ローカルアプリからのVOICEVOX既定URLは通過する', async () => {
    const { handler } = await invoke('/api/tts-voicevox', {
      body: {},
      headers: { host: 'localhost:3000' },
    })
    expect(handler).toHaveBeenCalled()
  })

  it('リモートからのVOICEVOX既定URLは拒否される（プロキシ悪用防止）', async () => {
    const { res } = await invoke('/api/tts-voicevox', {
      body: {},
      headers: { host: 'aituberkit.example.com' },
      socket: {
        remoteAddress: '198.51.100.20',
      } as NextApiRequest['socket'],
    })
    expect(res._status).toBe(403)
  })

  it('ファイル書き込み系は認可なしで通過する（設計§8-6の明示的な現状維持）', async () => {
    const { handler } = await invoke('/api/upload-image', { body: {} })
    expect(handler).toHaveBeenCalled()
  })

  it('外部制御APIはキー未設定なので503（v1/chat）', async () => {
    const { res } = await invoke('/api/v1/chat', { body: {} })
    expect(res._status).toBe(503)
  })
})

describe('プロファイル: self-host（サーバーキー利用 = unprotected）', () => {
  beforeEach(() => {
    mockServerSecretGuard('unprotected')
  })

  it('サーバーenvキーのTTSが通過する', async () => {
    process.env.OPENAI_TTS_KEY = 'server-key'
    const { handler } = await invoke('/api/openAITTS', {
      body: { message: 'test' },
    })
    expect(handler).toHaveBeenCalled()
  })

  it('ローカル既定URLのVOICEVOXが通過する', async () => {
    const { handler } = await invoke('/api/tts-voicevox', { body: {} })
    expect(handler).toHaveBeenCalled()
  })

  it('ローカル既定URLのAivisSpeechが通過する', async () => {
    const { handler } = await invoke('/api/tts-aivisspeech', { body: {} })
    expect(handler).toHaveBeenCalled()
    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        serverUrl: expect.objectContaining({
          raw: 'http://localhost:10101',
        }),
      })
    )
  })

  it('常時ガードのtts-googleが通過する', async () => {
    const { handler } = await invoke('/api/tts-google', { body: {} })
    expect(handler).toHaveBeenCalled()
  })
})

describe('プロファイル: demo/embed（serverSecretMode: demo + restricted）', () => {
  let demoHeaders: Record<string, string>

  beforeEach(() => {
    demoHeaders = mockServerSecretGuard('demo').headers
    process.env.NEXT_PUBLIC_RESTRICTED_MODE = 'true'
  })

  it('同一オリジンのブラウザからサーバーキーTTSが通過する', async () => {
    process.env.OPENAI_TTS_KEY = 'server-key'
    const { handler } = await invoke('/api/openAITTS', {
      body: { message: 'test' },
      headers: demoHeaders,
    })
    expect(handler).toHaveBeenCalled()
  })

  it('cross-siteリクエストは拒否される', async () => {
    process.env.OPENAI_TTS_KEY = 'server-key'
    const { res } = await invoke('/api/openAITTS', {
      body: { message: 'test' },
      headers: {
        host: 'localhost:3000',
        origin: 'http://attacker.example.com',
        'sec-fetch-site': 'cross-site',
      },
    })
    expect(res._status).toBe(403)
  })

  it('ファイル書き込み系は制限モードで403（upload-image）', async () => {
    const { res } = await invoke('/api/upload-image', {
      body: {},
      headers: demoHeaders,
    })
    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({ error: 'feature_disabled_in_restricted_mode' })
    )
  })

  it('fs-read一覧系はハンドラー到達（in-routeでマニフェストfallback）', async () => {
    const { handler } = await invoke('/api/get-vrm-list', { method: 'GET' })
    expect(handler).toHaveBeenCalled()
  })

  it('legacyメッセージキューは制限モードで403', async () => {
    const { res } = await invoke('/api/messages', { body: {} })
    expect(res._status).toBe(403)
  })
})

describe('プロファイル: 外部API利用（AITUBERKIT_API_KEY設定）', () => {
  beforeEach(() => {
    process.env.AITUBERKIT_API_KEY = 'external-key'
  })

  it('Bearer一致でv1が通過する', async () => {
    const { handler } = await invoke('/api/v1/chat', {
      body: {},
      headers: { authorization: 'Bearer external-key' },
    })
    expect(handler).toHaveBeenCalled()
  })

  it('Bearer不一致は401', async () => {
    const { res } = await invoke('/api/v1/chat', {
      body: {},
      headers: { authorization: 'Bearer wrong' },
    })
    expect(res._status).toBe(401)
  })

  it('制限モード環境では外部制御APIも403', async () => {
    process.env.NEXT_PUBLIC_RESTRICTED_MODE = 'true'
    const { res } = await invoke('/api/v1/chat', {
      body: {},
      headers: { authorization: 'Bearer external-key' },
    })
    expect(res._status).toBe(403)
  })
})

describe('プロファイル: protected（Bearerトークン保持クライアント）', () => {
  it('Bearer一致でサーバーキーTTSが通過し、なしは403', async () => {
    const { headers } = mockServerSecretGuard('protected')
    process.env.OPENAI_TTS_KEY = 'server-key'

    const passing = await invoke('/api/openAITTS', {
      body: { message: 'test' },
      headers,
    })
    expect(passing.handler).toHaveBeenCalled()

    const failing = await invoke('/api/openAITTS', {
      body: { message: 'test' },
    })
    expect(failing.res._status).toBe(403)
  })
})
