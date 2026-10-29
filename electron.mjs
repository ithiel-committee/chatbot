import { app, BrowserWindow, screen, session, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { fork } from 'child_process'
import net from 'net'
import fs from 'fs'
import http from 'http'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let serverProcess = null

// ログファイルへの記録関数（パッケージ版のデバッグ用）
function logToFile(msg) {
  try {
    const logDir = app.getPath('userData')
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    const logPath = path.join(logDir, 'electron-app.log')
    const timestamp = new Date().toISOString()
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`)
  } catch {
    // ログ書き込み失敗は無視
  }
}

function logInfo(msg) {
  console.log(msg)
  logToFile(`INFO: ${msg}`)
}

function logError(msg) {
  console.error(msg)
  logToFile(`ERROR: ${msg}`)
}

// サーバー起動待機（標準httpポーリング）
function waitForServer(url, timeoutMs = 45000, intervalMs = 400) {
  const startTime = Date.now()
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(url, (res) => {
        resolve(true)
      })
      req.on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(
            new Error(`Server at ${url} did not respond within ${timeoutMs}ms`)
          )
        } else {
          setTimeout(check, intervalMs)
        }
      })
      req.end()
    }
    check()
  })
}

// 空きポートの自動検出
function getFreePort(preferredPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(preferredPort, '127.0.0.1', () => {
      server.close(() => resolve(preferredPort))
    })
    server.on('error', () => {
      // 指定ポートが使用中の場合、OSに空きポートを自動割り当てさせる
      const fallback = net.createServer()
      fallback.listen(0, '127.0.0.1', () => {
        const assignedPort = fallback.address().port
        fallback.close(() => resolve(assignedPort))
      })
    })
  })
}

// .env ファイルのパーサー関数
function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const result = {}
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#')) continue
      const eqIdx = line.indexOf('=')
      if (eqIdx === -1) continue
      const key = line.slice(0, eqIdx).trim()
      let val = line.slice(eqIdx + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      val = val.replace(/\\n/g, '\n').replace(/\\r/g, '\r')
      result[key] = val
    }
    return result
  } catch (err) {
    logError(`Failed to parse env file at ${filePath}: ${err.message}`)
    return {}
  }
}

// 実行ファイルのベースディレクトリを取得（Portable版対応）
function getAppBaseDir() {
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return process.env.PORTABLE_EXECUTABLE_DIR
  }
  if (app.isPackaged) {
    return path.dirname(process.execPath)
  }
  return __dirname
}

// Next.js standalone サーバーの起動
async function startStandaloneServer(port) {
  const standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, 'standalone')
    : path.join(__dirname, '.next', 'standalone')

  const serverPath = path.join(standaloneDir, 'server.js')
  logInfo(`Checking standalone server at: ${serverPath}`)

  if (!fs.existsSync(serverPath)) {
    const err = `Next.js standalone server not found at: ${serverPath}`
    logError(err)
    dialog.showErrorBox('iThiel Chatbot 起動エラー', `${err}\nアプリを終了します。`)
    return false
  }

  // 1. 同梱 .env をロード
  // 2. 外部 .env / .env.local を優先ロード（ユーザーが配置したキーで上書き）
  const baseDir = getAppBaseDir()
  logInfo(`App base directory for external config: ${baseDir}`)

  const envCandidates = [
    path.join(standaloneDir, '.env'),
    path.join(baseDir, '.env'),
    path.join(baseDir, '.env.local'),
  ]

  let loadedEnv = {}
  for (const candidate of envCandidates) {
    if (fs.existsSync(candidate)) {
      const parsed = parseEnvFile(candidate)
      const keys = Object.keys(parsed)
      logInfo(
        `Loaded ${keys.length} vars from: ${candidate} (${keys
          .map((k) => (k.includes('KEY') || k.includes('SECRET') ? `${k}=***` : k))
          .join(', ')})`
      )
      loadedEnv = { ...loadedEnv, ...parsed }
    }
  }

  logInfo(`Starting Next.js server on port ${port}...`)

  serverProcess = fork(serverPath, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ...loadedEnv,
      PORT: port.toString(),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
    },
    stdio: 'inherit',
  })

  serverProcess.on('exit', (code, signal) => {
    logInfo(`Next.js server exited with code ${code}, signal ${signal}`)
    serverProcess = null
  })

  // サーバーの起動を待機
  try {
    await waitForServer(`http://127.0.0.1:${port}`, 45000, 400)
    logInfo(`Next.js server is ready at http://127.0.0.1:${port}`)
    return true
  } catch (err) {
    const msg = `Timeout waiting for Next.js server to start: ${err.message}`
    logError(msg)
    dialog.showErrorBox(
      'iThiel Chatbot 起動タイムアウト',
      `内蔵サーバーの起動が制限時間内に完了しませんでした。\nPCの負荷状況を確認の上、再起動をお試しください。\nログ: ${path.join(app.getPath('userData'), 'electron-app.log')}`
    )
    return false
  }
}

// ウィンドウ作成
async function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const preloadPath = path.join(__dirname, 'preload.js')

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width),
    height: Math.min(840, height),
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'iThiel AI Chatbot',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      devTools: isDev,
      ...(fs.existsSync(preloadPath) ? { preload: preloadPath } : {}),
    },
    // transparent: true, // 必要に応じて透明マスコットモードを切り替え可能
    hasShadow: true,
  })

  let targetUrl = 'http://localhost:3000'

  if (isDev) {
    try {
      await waitForServer('http://localhost:3000', 30000)
    } catch {
      dialog.showErrorBox('開発サーバー未起動', 'http://localhost:3000 が起動していません。')
      app.quit()
      return
    }
  } else {
    const port = await getFreePort(3000)
    targetUrl = `http://127.0.0.1:${port}`
    const serverStarted = await startStandaloneServer(port)
    if (!serverStarted) {
      logError('Failed to start internal server. Quitting application.')
      app.quit()
      return
    }
  }

  logInfo(`Loading URL: ${targetUrl}`)

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logError(`Failed to load URL ${validatedURL}: ${errorCode} ${errorDescription}`)
    dialog.showErrorBox(
      '画面読み込みエラー',
      `画面の読み込みに失敗しました (${errorDescription})。\nURL: ${validatedURL}`
    )
    mainWindow.show()
  })

  mainWindow.loadURL(targetUrl)

  const showWindow = () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show()
      if (isDev) {
        mainWindow.webContents.openDevTools()
      }
    }
  }

  mainWindow.once('ready-to-show', showWindow)
  mainWindow.webContents.once('did-finish-load', showWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// アプリケーション終了時にサーバープロセスを確実に停止
function cleanupServer() {
  if (serverProcess) {
    console.log('Stopping Next.js server process...')
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
}

app.on('before-quit', cleanupServer)

app.on('window-all-closed', () => {
  cleanupServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.whenReady().then(() => {
  // マイク・メディアデバイスへのアクセス権限を自動許可（プロンプト抑止）
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true)
        return
      }
      callback(false)
    }
  )

  if (session.defaultSession.setPermissionCheckHandler) {
    session.defaultSession.setPermissionCheckHandler(
      (webContents, permission) => {
        return permission === 'media'
      }
    )
  }

  createWindow()
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
