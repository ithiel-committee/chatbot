import assetManifest from '@/constants/assetManifest.json'
import type { MenuOption } from '@/types/navigationMenu'

let cachedVrmFiles: string[] = [...assetManifest.vrm]
let cachedLive2DModels: Array<{ path: string; name: string }> = [
  ...assetManifest.live2d.map((m) => ({ path: m.path, name: m.name })),
]
let cachedPNGTuberModels: Array<{ path: string; name: string }> = [
  ...assetManifest.pngtuber.map((m) => ({ path: m.path, name: m.name })),
]

let isFetching = false

/**
 * サーバーAPIから最新のモデル一覧をバックグラウンド取得してキャッシュを更新
 */
export const fetchModelCatalogs = async (): Promise<void> => {
  if (typeof window === 'undefined' || isFetching) return
  isFetching = true

  try {
    const vrmRes = await fetch('/api/get-vrm-list')
    if (vrmRes.ok) {
      const data = await vrmRes.json()
      if (Array.isArray(data)) {
        cachedVrmFiles = data
      }
    }
  } catch {}

  try {
    const live2dRes = await fetch('/api/get-live2d-list')
    if (live2dRes.ok) {
      const data = await live2dRes.json()
      if (Array.isArray(data)) {
        cachedLive2DModels = data
      }
    }
  } catch {}

  try {
    const pngRes = await fetch('/api/get-pngtuber-list')
    if (pngRes.ok) {
      const data = await pngRes.json()
      if (Array.isArray(data)) {
        cachedPNGTuberModels = data
      }
    }
  } catch {}

  isFetching = false
}

// ブラウザ初期化時に自動で取得開始
if (typeof window !== 'undefined') {
  fetchModelCatalogs()
}

/**
 * VRMモデルの選択肢リストを生成
 */
export const getVrmOptions = (currentPath?: string): MenuOption<string>[] => {
  const options: MenuOption<string>[] = cachedVrmFiles.map((file) => ({
    label: file.replace('.vrm', ''),
    value: `/vrm/${file}`,
  }))

  // 現在選択されているパスが一覧になければ追加（アップロード直後のカスタムパス等）
  if (currentPath && !options.some((opt) => opt.value === currentPath)) {
    const fileName = currentPath.split('/').pop() || currentPath
    options.unshift({
      label: fileName.replace('.vrm', ''),
      value: currentPath,
    })
  }

  return options
}

/**
 * Live2Dモデルの選択肢リストを生成
 */
export const getLive2DOptions = (
  currentPath?: string
): MenuOption<string>[] => {
  const options: MenuOption<string>[] = cachedLive2DModels.map((model) => ({
    label: model.name,
    value: model.path,
  }))

  if (currentPath && !options.some((opt) => opt.value === currentPath)) {
    const name = currentPath.split('/').filter(Boolean).pop() || currentPath
    options.unshift({
      label: name,
      value: currentPath,
    })
  }

  return options
}

/**
 * PNGTuberモデルの選択肢リストを生成
 */
export const getPNGTuberOptions = (
  currentPath?: string
): MenuOption<string>[] => {
  const options: MenuOption<string>[] = cachedPNGTuberModels.map((model) => ({
    label: model.name,
    value: model.path,
  }))

  if (currentPath && !options.some((opt) => opt.value === currentPath)) {
    const name = currentPath.split('/').filter(Boolean).pop() || currentPath
    options.unshift({
      label: name,
      value: currentPath,
    })
  }

  return options
}
