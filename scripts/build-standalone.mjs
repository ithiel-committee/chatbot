import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('🚀 Starting Next.js Standalone Build for Desktop...')

// 1. next build を実行
try {
  execSync('next build', { cwd: rootDir, stdio: 'inherit' })
} catch (error) {
  console.error('❌ next build failed:', error)
  process.exit(1)
}

const standaloneDir = path.join(rootDir, '.next', 'standalone')
if (!fs.existsSync(standaloneDir)) {
  console.error('❌ Standalone directory not found at:', standaloneDir)
  process.exit(1)
}

// 2. public フォルダを .next/standalone/public にコピー
const srcPublic = path.join(rootDir, 'public')
const destPublic = path.join(standaloneDir, 'public')
if (fs.existsSync(srcPublic)) {
  console.log('📦 Copying public/ to standalone/public/ ...')
  fs.cpSync(srcPublic, destPublic, { recursive: true })
}

// 3. .next/static を .next/standalone/.next/static にコピー
const srcStatic = path.join(rootDir, '.next', 'static')
const destStatic = path.join(standaloneDir, '.next', 'static')
if (fs.existsSync(srcStatic)) {
  console.log('📦 Copying .next/static/ to standalone/.next/static/ ...')
  fs.cpSync(srcStatic, destStatic, { recursive: true })
}

// 4. .env.local または .env から standalone/.env を安全に生成
const envLocalPath = path.join(rootDir, '.env.local')
const envPath = path.join(rootDir, '.env')
const destEnv = path.join(standaloneDir, '.env')
const sourceEnvPath = fs.existsSync(envLocalPath)
  ? envLocalPath
  : fs.existsSync(envPath)
    ? envPath
    : null

const bundleSecrets = process.env.BUNDLE_SECRETS === 'true'

if (sourceEnvPath) {
  if (bundleSecrets) {
    console.log(
      '⚠️ BUNDLE_SECRETS=true: Copying raw .env with API keys to standalone/.env ...'
    )
    fs.copyFileSync(sourceEnvPath, destEnv)
  } else {
    console.log(
      '🔒 BUNDLE_SECRETS is not set: Sanitizing secret API keys for distribution...'
    )
    const rawContent = fs.readFileSync(sourceEnvPath, 'utf-8')
    // 秘密鍵パターン（*_API_KEY, *_KEY, *_SECRET など、ただし NEXT_PUBLIC_ は除く）を空にする
    const sanitizedContent = rawContent
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('#') || !trimmed.includes('=')) return line
        const [key] = line.split('=')
        const trimmedKey = key.trim()

        const isSecretKey =
          !trimmedKey.startsWith('NEXT_PUBLIC_') &&
          /(KEY|SECRET|TOKEN|PASSWORD)/i.test(trimmedKey)

        if (isSecretKey) {
          return `${trimmedKey}=""`
        }
        return line
      })
      .join('\n')

    fs.writeFileSync(destEnv, sanitizedContent, 'utf-8')
    console.log('✅ Safely bundled sanitized .env (sensitive keys emptied)')
  }
} else {
  console.warn('⚠️ No .env or .env.local found. Using empty or default config.')
}

// 5. 不要なディレクトリのクリーンアップ（.git, docs, logs, src 等）
const unnecessaryDirs = ['.git', 'docs', 'logs', 'src', 'scripts']
for (const dir of unnecessaryDirs) {
  const targetDir = path.join(standaloneDir, dir)
  if (fs.existsSync(targetDir)) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true })
      console.log(`🧹 Cleaned up unnecessary standalone/${dir}/`)
    } catch {
      // ignore
    }
  }
}

console.log('✅ Standalone bundle is ready at .next/standalone!')
