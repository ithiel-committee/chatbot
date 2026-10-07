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

  const warmup = async () => {
    console.log(
      `\n[compile] 🔄 サーバー起動を検知しました。トップページとAPIルートを事前コンパイル中...\n`
    )
    const startTime = Date.now()

    // コンパイル中インジケーター（スピナー + 経過時間）
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let frameIdx = 0
    let isCompleted = false
    const progressTimer = setInterval(() => {
      if (isCompleted) return
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      const frame = spinnerFrames[frameIdx % spinnerFrames.length]
      frameIdx++
      process.stdout.write(
        `\r[compile] ${frame} 事前コンパイル実行中... (${elapsed}s)`
      )
    }, 200)

    const fetchRoute = (url) =>
      new Promise((resolve) => {
        const req = http.get(url, (res) => {
          res.on('data', () => {})
          res.on('end', () => resolve(true))
        })
        req.on('error', () => resolve(false))
      })

    // トップページと主要APIエンドポイントを同時にウォームアップ
    await Promise.all([
      fetchRoute(TARGET_URL),
      fetchRoute(`${TARGET_URL}api/ai/vercel`),
    ])

    isCompleted = true
    clearInterval(progressTimer)
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    process.stdout.write('\r' + ' '.repeat(60) + '\r')
    console.log(
      `\n=================================================================` +
        `\n✨ [compile] 事前コンパイル完了 (${elapsed}s)! (トップページ + AI API)` +
        `\n👉 ブラウザで開く準備が整いました: ${TARGET_URL}` +
        `\n=================================================================\n`
    )
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
