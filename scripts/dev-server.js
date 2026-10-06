const { spawn } = require('child_process')
const http = require('http')

const PORT = process.env.PORT || 3000
const HOST = process.env.HOSTNAME || 'localhost'
const TARGET_URL = `http://${HOST}:${PORT}/`

const run = async () => {
  // 1. ロゴの表示
  try {
    require('./print-startup-logo')
  } catch {
    // ロゴ表示に失敗しても処理を継続
  }

  // 2. next dev --turbo の起動
  const useTurbo = process.env.TURBO !== 'false'
  const nextArgs = ['next', 'dev']
  if (useTurbo) {
    nextArgs.push('--turbo')
  }
  if (process.env.PORT) {
    nextArgs.push('-p', String(process.env.PORT))
  }
  if (process.env.HOSTNAME) {
    nextArgs.push('-H', process.env.HOSTNAME)
  }

  const isWindows = process.platform === 'win32'
  const nextCmd = isWindows ? 'pnpm.cmd' : 'pnpm'

  const child = spawn(nextCmd, nextArgs, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env },
  })

  child.on('error', (err) => {
    console.error('[dev-server] Failed to start next dev:', err)
  })

  // 3. バックグラウンドウォームアップ
  const pollServer = async (retries = 60, intervalMs = 500) => {
    for (let i = 0; i < retries; i++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const isUp = await checkServerUp()
      if (isUp) {
        warmup()
        return
      }
    }
  }

  const checkServerUp = () => {
    return new Promise((resolve) => {
      const req = http.get(TARGET_URL, (res) => {
        // レスポンスが来たらサーバー起動と判断
        resolve(true)
        res.resume() // consume stream
      })
      req.on('error', () => resolve(false))
      req.setTimeout(2000, () => {
        req.destroy()
        resolve(false)
      })
    })
  }

  const warmup = () => {
    console.log(`\n[warmup] 🔄 サーバー起動を検知しました。トップページ (${TARGET_URL}) を事前コンパイル中...\n`)
    const startTime = Date.now()
    const req = http.get(TARGET_URL, (res) => {
      res.on('data', () => {})
      res.on('end', () => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(
          `\n=================================================================` +
            `\n✨ [warmup] 事前コンパイル完了 (${elapsed}s)!` +
            `\n👉 ブラウザで開く準備が整いました: ${TARGET_URL}` +
            `\n=================================================================\n`
        )
      })
    })
    req.on('error', (err) => {
      console.warn('[warmup] 事前コンパイルリクエスト中にエラーが発生しました:', err.message)
    })
  }

  pollServer().catch(() => {})

  const handleExit = () => {
    if (child && !child.killed) {
      child.kill('SIGINT')
    }
  }

  process.on('SIGINT', handleExit)
  process.on('SIGTERM', handleExit)
}

run()
