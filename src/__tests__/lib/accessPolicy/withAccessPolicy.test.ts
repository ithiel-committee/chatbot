import type { NextApiRequest } from 'next'
import { withAccessPolicy } from '@/lib/accessPolicy/withAccessPolicy'
import type { PolicyGate } from '@/lib/accessPolicy/withAccessPolicy'
import type { RoutePolicy } from '@/lib/accessPolicy/types'
import {
  createMockReq,
  createMockRes,
  mockServerSecretGuard,
} from '../../helpers/apiRouteTestUtils'

const ORIGINAL_ENV = process.env

function basePolicy(overrides: Partial<RoutePolicy> = {}): RoutePolicy {
  return {
    path: '/api/test-route',
    featureName: 'test-route',
    methods: ['POST'],
    resources: ['client-proxy'],
    secret: { kind: 'none' },
    restrictedBehavior: 'none',
    ...overrides,
  }
}

function runHandler(
  policy: RoutePolicy,
  reqOverrides: Partial<NextApiRequest> = {}
) {
  const handler = jest.fn(
    async (_req: NextApiRequest, res, _gate: PolicyGate) => {
      res.status(200).json({ ok: true })
    }
  )
  const wrapped = withAccessPolicy(policy, handler)
  const req = createMockReq(reqOverrides)
  const res = createMockRes()
  return { handler, req, res, invoke: () => wrapped(req, res) }
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV }
  delete process.env.AITUBERKIT_SERVER_SECRET_ACCESS_MODE
  delete process.env.AITUBERKIT_SERVER_SECRET_TOKEN
  delete process.env.AITUBERKIT_DEMO_ACCESS_TOKEN
  delete process.env.AITUBERKIT_ALLOWED_ORIGINS
  delete process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS
  delete process.env.AITUBERKIT_DEMO_RATE_LIMIT_PER_MINUTE
  delete process.env.AITUBERKIT_API_KEY
  delete process.env.NEXT_PUBLIC_RESTRICTED_MODE
  delete (
    globalThis as typeof globalThis & {
      __aituberKitServerSecretRateLimit?: unknown
    }
  ).__aituberKitServerSecretRateLimit
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('withAccessPolicy: メソッド検査', () => {
  it('宣言外メソッドは405（統一シェイプ）', async () => {
    const { handler, res, invoke } = runHandler(basePolicy(), {
      method: 'GET',
    })
    await invoke()
    expect(res._status).toBe(405)
    expect(res._json).toEqual({ error: 'Method not allowed' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('宣言メソッドはハンドラーに到達する', async () => {
    const { handler, res, invoke } = runHandler(basePolicy())
    await invoke()
    expect(res._status).toBe(200)
    expect(handler).toHaveBeenCalled()
  })

  it('複数メソッド宣言に対応する', async () => {
    const policy = basePolicy({ methods: ['GET', 'POST'] })
    const { handler, invoke } = runHandler(policy, { method: 'GET' })
    await invoke()
    expect(handler).toHaveBeenCalled()
  })
})

describe('withAccessPolicy: 制限モード', () => {
  it('restrictedBehavior=deny は制限モード時に403を返す', async () => {
    process.env.NEXT_PUBLIC_RESTRICTED_MODE = 'true'
    const { handler, res, invoke } = runHandler(
      basePolicy({ restrictedBehavior: 'deny' })
    )
    await invoke()
    expect(res._status).toBe(403)
    expect(res._json).toEqual({
      error: 'feature_disabled_in_restricted_mode',
      message: expect.stringContaining('test-route'),
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('restrictedFeatureName が拒否メッセージに使われる', async () => {
    process.env.NEXT_PUBLIC_RESTRICTED_MODE = 'true'
    const { res, invoke } = runHandler(
      basePolicy({
        restrictedBehavior: 'deny',
        restrictedFeatureName: 'custom-name',
      })
    )
    await invoke()
    expect(res._json).toEqual(
      expect.objectContaining({
        message: expect.stringContaining('custom-name'),
      })
    )
  })

  it('restrictedBehavior=in-route は制限モードでもハンドラーに到達する', async () => {
    process.env.NEXT_PUBLIC_RESTRICTED_MODE = 'true'
    const { handler, invoke } = runHandler(
      basePolicy({ restrictedBehavior: 'in-route' })
    )
    await invoke()
    expect(handler).toHaveBeenCalled()
  })

  it('メソッド検査が制限モード拒否より先に評価される（統一順序）', async () => {
    process.env.NEXT_PUBLIC_RESTRICTED_MODE = 'true'
    const { res, invoke } = runHandler(
      basePolicy({ restrictedBehavior: 'deny' }),
      { method: 'GET' }
    )
    await invoke()
    expect(res._status).toBe(405)
  })
})

describe('withAccessPolicy: 外部制御API認証', () => {
  const policy = () =>
    basePolicy({
      resources: ['external-control'],
      requiresApiKey: true,
    })

  it('AITUBERKIT_API_KEY 未設定は503', async () => {
    const { res, invoke } = runHandler(policy())
    await invoke()
    expect(res._status).toBe(503)
    expect(res._json).toEqual(
      expect.objectContaining({ code: 'API_KEY_NOT_CONFIGURED' })
    )
  })

  it('トークン不一致は401', async () => {
    process.env.AITUBERKIT_API_KEY = 'valid-key'
    const { res, invoke } = runHandler(policy(), {
      headers: { authorization: 'Bearer wrong-key' },
    })
    await invoke()
    expect(res._status).toBe(401)
    expect(res._json).toEqual(
      expect.objectContaining({ code: 'INVALID_API_KEY' })
    )
  })

  it('トークン一致でハンドラーに到達する', async () => {
    process.env.AITUBERKIT_API_KEY = 'valid-key'
    const { handler, invoke } = runHandler(policy(), {
      headers: { authorization: 'Bearer valid-key' },
    })
    await invoke()
    expect(handler).toHaveBeenCalled()
  })

  it('制限モード拒否が認証チェックより先に評価される', async () => {
    process.env.NEXT_PUBLIC_RESTRICTED_MODE = 'true'
    const { res, invoke } = runHandler(
      basePolicy({
        resources: ['external-control'],
        requiresApiKey: true,
        restrictedBehavior: 'deny',
      })
    )
    await invoke()
    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({ error: 'feature_disabled_in_restricted_mode' })
    )
  })
})

describe('withAccessPolicy: サーバーURL検証', () => {
  const policy = () =>
    basePolicy({
      resources: ['server-secret', 'server-url'],
      secret: {
        kind: 'pairs',
        pairs: [
          { source: 'body', key: 'serverUrl', envVars: ['TEST_SERVER_URL'] },
        ],
      },
      serverUrl: {
        source: 'body',
        key: 'serverUrl',
        envVar: 'TEST_SERVER_URL',
        defaultUrl: 'http://localhost:50021',
      },
    })

  afterEach(() => {
    delete process.env.TEST_SERVER_URL
  })

  it('パース不能なクライアントURLは400', async () => {
    const { res, invoke } = runHandler(policy(), {
      body: { serverUrl: 'not a url' },
    })
    await invoke()
    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Invalid server URL' })
  })

  it('env設定URLがパース不能なら（クライアントURLが正当でも）400', async () => {
    process.env.TEST_SERVER_URL = 'broken url'
    process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS =
      'https://tts.example.com'
    const { res, invoke } = runHandler(policy(), {
      body: { serverUrl: 'https://tts.example.com' },
    })
    await invoke()
    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Invalid server URL' })
  })

  it('http/https以外のプロトコルは400', async () => {
    const { res, invoke } = runHandler(policy(), {
      body: { serverUrl: 'ftp://example.com' },
    })
    await invoke()
    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Invalid server URL protocol' })
  })

  it('許可リスト外のpublicなクライアントURLは400', async () => {
    const { res, invoke } = runHandler(policy(), {
      body: { serverUrl: 'https://evil.example.com' },
    })
    await invoke()
    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Server URL is not allowed' })
  })

  it('許可リスト内のpublicなクライアントURLはガードなしで通過する', async () => {
    process.env.AITUBERKIT_ALLOWED_TTS_SERVER_ORIGINS =
      'https://tts.example.com'
    const { handler, invoke } = runHandler(policy(), {
      body: { serverUrl: 'https://tts.example.com' },
    })
    await invoke()
    expect(handler).toHaveBeenCalled()
    const gate = handler.mock.calls[0][2] as PolicyGate
    expect(gate.serverUrl?.raw).toBe('https://tts.example.com')
    expect(gate.serverUrl?.isProtectedServerResource).toBe(false)
  })

  it('クライアントURLなし（デフォルトlocalhost）はガード発動、既定モードで403', async () => {
    const { res, invoke } = runHandler(policy())
    await invoke()
    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({ errorCode: 'ServerSecretAccessDenied' })
    )
  })

  it('ローカル/プライベートなクライアントURLはガード発動、既定モードで403', async () => {
    const { res, invoke } = runHandler(policy(), {
      body: { serverUrl: 'http://192.168.1.10:50021' },
    })
    await invoke()
    expect(res._status).toBe(403)
  })

  it('unprotectedモードならデフォルトURLでも通過し、解決済みURLがgateに載る', async () => {
    mockServerSecretGuard('unprotected')
    const { handler, invoke } = runHandler(policy())
    await invoke()
    expect(handler).toHaveBeenCalled()
    const gate = handler.mock.calls[0][2] as PolicyGate
    expect(gate.serverUrl?.raw).toBe('http://localhost:50021')
    expect(gate.serverUrl?.isProtectedServerResource).toBe(true)
    expect(gate.serverUrl?.isClientProvided).toBe(false)
  })
})

describe('withAccessPolicy: server-secret（pairs）', () => {
  const policy = () =>
    basePolicy({
      resources: ['server-secret'],
      secret: {
        kind: 'pairs',
        pairs: [
          { source: 'body', key: 'apiKey', envVars: ['TEST_TTS_KEY'] },
          { source: 'body', key: 'voiceId', envVars: ['TEST_TTS_VOICE_ID'] },
        ],
      },
    })

  afterEach(() => {
    delete process.env.TEST_TTS_KEY
    delete process.env.TEST_TTS_VOICE_ID
  })

  it('クライアントが全値を持ち込めばガード非発動で通過する', async () => {
    process.env.TEST_TTS_KEY = 'server-key'
    const { handler, invoke } = runHandler(policy(), {
      body: { apiKey: 'client-key', voiceId: 'client-voice' },
    })
    await invoke()
    expect(handler).toHaveBeenCalled()
    const gate = handler.mock.calls[0][2] as PolicyGate
    expect(gate.usesServerSecret).toBe(false)
  })

  it('envもクライアント値もない場合はガード非発動（秘匿リソース不使用）', async () => {
    const { handler, invoke } = runHandler(policy(), { body: {} })
    await invoke()
    expect(handler).toHaveBeenCalled()
  })

  it('一部でもenvにフォールバックするならガード発動: disabledで403', async () => {
    process.env.TEST_TTS_VOICE_ID = 'server-voice'
    const { res, handler, invoke } = runHandler(policy(), {
      body: { apiKey: 'client-key' },
    })
    await invoke()
    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({
        errorCode: 'ServerSecretAccessDenied',
        feature: 'test-route',
      })
    )
    expect(handler).not.toHaveBeenCalled()
  })

  it('unprotectedモードは通過し usesServerSecret=true が伝わる', async () => {
    mockServerSecretGuard('unprotected')
    process.env.TEST_TTS_KEY = 'server-key'
    const { handler, invoke } = runHandler(policy(), { body: {} })
    await invoke()
    expect(handler).toHaveBeenCalled()
    const gate = handler.mock.calls[0][2] as PolicyGate
    expect(gate.usesServerSecret).toBe(true)
  })

  it('protectedモード: Bearer一致で通過、なしで403', async () => {
    const { headers } = mockServerSecretGuard('protected')
    process.env.TEST_TTS_KEY = 'server-key'

    const passing = runHandler(policy(), { body: {}, headers })
    await passing.invoke()
    expect(passing.handler).toHaveBeenCalled()

    const failing = runHandler(policy(), { body: {} })
    await failing.invoke()
    expect(failing.res._status).toBe(403)
  })

  it('demoモード: same-originで通過、レート超過で429', async () => {
    const { headers } = mockServerSecretGuard('demo')
    process.env.TEST_TTS_KEY = 'server-key'
    process.env.AITUBERKIT_DEMO_RATE_LIMIT_PER_MINUTE = '1'

    const first = runHandler(policy(), { body: {}, headers })
    await first.invoke()
    expect(first.handler).toHaveBeenCalled()

    const second = runHandler(policy(), { body: {}, headers })
    await second.invoke()
    expect(second.res._status).toBe(429)
    expect(second.res._json).toEqual(
      expect.objectContaining({ errorCode: 'ServerSecretRateLimited' })
    )
  })

  it('demoモード: cross-siteは403', async () => {
    mockServerSecretGuard('demo')
    process.env.TEST_TTS_KEY = 'server-key'
    const { res, invoke } = runHandler(policy(), {
      body: {},
      headers: {
        host: 'localhost:3000',
        origin: 'http://attacker.example.com',
        'sec-fetch-site': 'cross-site',
      },
    })
    await invoke()
    expect(res._status).toBe(403)
  })
})

describe('withAccessPolicy: server-secret（always）', () => {
  const policy = () =>
    basePolicy({
      resources: ['server-secret'],
      secret: { kind: 'always' },
    })

  it('クライアント値に関係なく常時ガード: disabledで403', async () => {
    const { res, invoke } = runHandler(policy(), {
      body: { apiKey: 'client-key' },
    })
    await invoke()
    expect(res._status).toBe(403)
  })

  it('unprotectedで通過し usesServerSecret=true', async () => {
    mockServerSecretGuard('unprotected')
    const { handler, invoke } = runHandler(policy())
    await invoke()
    const gate = handler.mock.calls[0][2] as PolicyGate
    expect(gate.usesServerSecret).toBe(true)
  })
})

describe('withAccessPolicy: server-secret（dynamic）', () => {
  const policy = () =>
    basePolicy({
      resources: ['server-secret'],
      secret: { kind: 'dynamic' },
    })

  it('ラッパー自体はガードせずハンドラーに到達する', async () => {
    const { handler, invoke } = runHandler(policy())
    await invoke()
    expect(handler).toHaveBeenCalled()
  })

  it('gate.guardServerSecret(false) はガードせずtrue', async () => {
    const wrapped = withAccessPolicy(policy(), async (_req, res, gate) => {
      expect(gate.guardServerSecret(false)).toBe(true)
      res.status(200).json({ ok: true })
    })
    const res = createMockRes()
    await wrapped(createMockReq(), res)
    expect(res._status).toBe(200)
  })

  it('gate.guardServerSecret(true) は既定モードで403を送信しfalseを返す', async () => {
    let guardResult: boolean | undefined
    const wrapped = withAccessPolicy(policy(), async (_req, res, gate) => {
      guardResult = gate.guardServerSecret(true)
      if (!guardResult) return
      res.status(200).json({ ok: true })
    })
    const res = createMockRes()
    await wrapped(createMockReq(), res)
    expect(guardResult).toBe(false)
    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({ errorCode: 'ServerSecretAccessDenied' })
    )
  })

  it('gate.guardServerSecret(true) はunprotectedモードでtrue', async () => {
    mockServerSecretGuard('unprotected')
    const wrapped = withAccessPolicy(policy(), async (_req, res, gate) => {
      expect(gate.guardServerSecret(true)).toBe(true)
      res.status(200).json({ ok: true })
    })
    const res = createMockRes()
    await wrapped(createMockReq(), res)
    expect(res._status).toBe(200)
  })

  it('動的URLは同一マシンのループバック接続だけ既定モードで許可する', async () => {
    const wrapped = withAccessPolicy(policy(), async (_req, res, gate) => {
      if (
        !gate.guardServerSecret(true, {
          allowLocalLoopbackUrl: new URL('http://127.0.0.1:11434'),
        })
      ) {
        return
      }
      res.status(200).json({ ok: true })
    })
    const res = createMockRes()

    await wrapped(
      createMockReq({
        headers: { host: 'localhost:3000' },
        socket: { remoteAddress: '127.0.0.1' } as never,
      }),
      res
    )

    expect(res._status).toBe(200)
  })

  it('動的ループバックURLでもリモート要求は既定モードで拒否する', async () => {
    const wrapped = withAccessPolicy(policy(), async (_req, res, gate) => {
      if (
        !gate.guardServerSecret(true, {
          allowLocalLoopbackUrl: new URL('http://127.0.0.1:11434'),
        })
      ) {
        return
      }
      res.status(200).json({ ok: true })
    })
    const res = createMockRes()

    await wrapped(
      createMockReq({
        headers: { host: 'aituberkit.example.com' },
        socket: { remoteAddress: '198.51.100.20' } as never,
      }),
      res
    )

    expect(res._status).toBe(403)
    expect(res._json).toEqual(
      expect.objectContaining({ errorCode: 'ServerSecretAccessDenied' })
    )
  })

  it('dynamic以外のルートで guardServerSecret を呼ぶとthrow', async () => {
    const wrapped = withAccessPolicy(
      basePolicy({ secret: { kind: 'none' } }),
      async (_req, _res, gate) => {
        gate.guardServerSecret(true)
      }
    )
    await expect(wrapped(createMockReq(), createMockRes())).rejects.toThrow(
      /only available for secret.kind === 'dynamic'/
    )
  })
})
