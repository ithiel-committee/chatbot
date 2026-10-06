import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT || 3100)
const baseURL = `http://127.0.0.1:${port}`
const e2eMode = process.env.E2E_MODE || 'development'
const isProductionMode = e2eMode === 'production'
const nextBin = './node_modules/next/dist/bin/next'

// Playwright同梱のChromium(148系)はローカル環境でdevサーバーからの遅延チャンク取得が
// 約60秒停止し全テストがタイムアウトする。またGitHub ActionsではPlaywright browser
// installがダウンロード後の展開で停止するため、CI/ローカルともインストール済みの
// Chrome(stable)を使用する。
// E2E_BROWSER_CHANNEL で明示的に上書き可能（例: E2E_BROWSER_CHANNEL=chromium）。
const browserChannel = process.env.E2E_BROWSER_CHANNEL || 'chrome'

const desktopSpecs = /^(?!.*\.(mobile|production)\.spec\.ts$).*\.spec\.ts$/
const mobileSpecs = /.*\.mobile\.spec\.ts$/
const productionSpecs = /.*\.production\.spec\.ts$/

export default defineConfig({
  testDir: './tests/e2e',
  // ローカルはdevサーバーのオンデマンドコンパイル等で1ステップが遅くなりがち
  // なため、複数ステップのテストがタイムアウトしないよう余裕を持たせる
  timeout: process.env.CI ? 30_000 : 60_000,
  expect: {
    timeout: process.env.CI ? 5_000 : 10_000,
  },
  fullyParallel: true,
  // ローカルでの並列実行はブラウザ多重起動とdevサーバーのコンパイル競合で
  // タイムアウトが多発するため直列実行にする。CIはデフォルトの並列数を使う。
  workers: process.env.CI ? undefined : 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    channel: browserChannel,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: isProductionMode
      ? `npm run build && node ${nextBin} start -p ${port}`
      : `node scripts/start-e2e-server.js`,
    url: baseURL,
    reuseExistingServer: !process.env.CI && !isProductionMode,
    timeout: isProductionMode ? 240_000 : 120_000,
    env: {
      E2E_PORT: String(port),
      NEXT_PUBLIC_SHOW_INTRODUCTION: 'false',
      NEXT_PUBLIC_MODEL_TYPE: 'pngtuber',
      NEXT_PUBLIC_SELECTED_PNGTUBER_PATH: '/pngtuber/nike01',
      // .env.localでデモモードが有効だとテスト時にUIが応答不能になるため強制無効化
      NEXT_PUBLIC_DEMO_MODE: 'false',
    },
  },
  projects: isProductionMode
    ? [
        {
          name: 'production-chromium',
          testMatch: productionSpecs,
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          testMatch: desktopSpecs,
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'mobile-chromium',
          testMatch: mobileSpecs,
          use: { ...devices['Pixel 5'] },
        },
      ],
})
