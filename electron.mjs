import { app, BrowserWindow, screen, session } from 'electron'
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

// サーバー起動待機（標準httpポーリング）
function waitForServer(url, timeoutMs = 30000, intervalMs = 300) {
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

// Next.js standalone サーバーの起動
async function startStandaloneServer(port) {
  const standaloneDir = app.isPackaged
    ? path.join(process.resourcesPath, 'standalone')
    : path.join(__dirname, '.next', 'standalone')

  const serverPath = path.join(standaloneDir, 'server.js')

  if (!fs.existsSync(serverPath)) {
    console.error(`Next.js standalone server not found at: ${serverPath}`)
    return false
  }

  // 実行ファイルと同階層の .env を優先ロード（ユーザーが後からキー変更できるように）
  const externalEnvPath = app.isPackaged
    ? path.join(path.dirname(process.execPath), '.env')
    : path.join(__dirname, '.env')

  const internalEnvPath = path.join(standaloneDir, '.env')
  const envFilePath = fs.existsSync(externalEnvPath)
    ? externalEnvPath
    : internalEnvPath

  console.log(`Starting Next.js server on port ${port}...`)

  serverProcess = fork(serverPath, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      PORT: port.toString(),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      DOTENV_CONFIG_PATH: envFilePath,
    },
    stdio: 'inherit',
  })

  serverProcess.on('exit', (code, signal) => {
    console.log(`Next.js server exited with code ${code}, signal ${signal}`)
    serverProcess = null
  })

  // サーバーの起動を待機
  try {
    await waitForServer(`http://127.0.0.1:${port}`, 30000, 300)
    console.log(`Next.js server is ready at http://127.0.0.1:${port}`)
    return true
  } catch (err) {
    console.error('Timeout waiting for Next.js server to start:', err)
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
    await waitForServer('http://localhost:3000', 30000)
  } else {
    const port = await getFreePort(3000)
    targetUrl = `http://127.0.0.1:${port}`
    const serverStarted = await startStandaloneServer(port)
    if (!serverStarted) {
      console.error('Failed to start internal server.')
    }
  }

  mainWindow.loadURL(targetUrl)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

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
