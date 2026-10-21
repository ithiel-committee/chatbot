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

// 4. .env.local または .env を standalone/.env にコピー（方法1-a: APIキー等を含める）
const envLocalPath = path.join(rootDir, '.env.local')
const envPath = path.join(rootDir, '.env')
const destEnv = path.join(standaloneDir, '.env')

if (fs.existsSync(envLocalPath)) {
  console.log('🔑 Copying .env.local to standalone/.env ...')
  fs.copyFileSync(envLocalPath, destEnv)
} else if (fs.existsSync(envPath)) {
  console.log('🔑 Copying .env to standalone/.env ...')
  fs.copyFileSync(envPath, destEnv)
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
