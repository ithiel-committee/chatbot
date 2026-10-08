import settingsStore from './settings'
import homeStore from './home'
import toastStore from './toast'
import { isMultiModalModel, defaultModels } from '../constants/aiModels'
import type { AIService } from '../constants/settings'
import { logger } from '@/lib/logger'
import { DEFAULT_SETTINGS_TOGGLE_SHORTCUT } from '@/utils/keyboardShortcut'
import { fetchModelCatalogs } from '../constants/modelCatalog'

/**
 * 副作用や連動処理を伴う設定変更アクションを一元管理
 * 従来設定およびクイック設定から共通して呼び出すことで不整合を防止
 */

/**
 * AIモデルを変更し、マルチモーダルモード（画像認識）を自動連動更新
 */
export const setAIModelWithSync = (model: string): void => {
  const currentState = settingsStore.getState()
  settingsStore.setState({ selectAIModel: model })

  // カスタムモデルでなければマルチモーダル対応状況を自動判定
  if (!currentState.customModel) {
    const isMultiModal = isMultiModalModel(currentState.selectAIService, model)
    settingsStore.setState({ enableMultiModal: isMultiModal })
  }
}

/**
 * AIサービスを変更し、デフォルトモデルおよびマルチモーダルモードを同期
 */
export const setAIServiceWithSync = (service: AIService): void => {
  const model = defaultModels[service] || ''
  settingsStore.setState({
    selectAIService: service,
    selectAIModel: model,
  })

  const currentState = settingsStore.getState()
  if (!currentState.customModel) {
    const isMultiModal = isMultiModalModel(service, model)
    settingsStore.setState({ enableMultiModal: isMultiModal })
  }
}

/**
 * YouTube連携モードを切り替え、OFF時は再生状態も安全にリセット
 */
export const setYoutubeModeWithSync = (enabled: boolean): void => {
  settingsStore.setState({
    youtubeMode: enabled,
    ...(enabled ? {} : { youtubePlaying: false }),
  })
}

/**
 * VRMファイルをサーバーにアップロードして永続化し、ビューワに読み込む
 */
export const uploadAndLoadVRM = async (file: File): Promise<boolean> => {
  if (!file.name.toLowerCase().endsWith('.vrm')) {
    return false
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    const res = await fetch('/api/upload-vrm-list', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      throw new Error(`VRM upload failed with status ${res.status}`)
    }

    const { path } = await res.json()
    settingsStore.setState({ selectedVrmPath: path })
    const { viewer } = homeStore.getState()
    if (viewer) {
      viewer.loadVrm(path)
    }
    // モデル一覧キャッシュを更新
    fetchModelCatalogs()
    return true
  } catch (error) {
    logger.error('Failed to upload VRM from quick settings, falling back to local Blob:', error)
    // フォールバック: アップロード失敗時はBlob URLで即時プレビュー
    const blob = new Blob([file], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    homeStore.getState().viewer?.loadVrm(url)
    return false
  }
}

/**
 * モデル選択を変更し、ビューワへの反映を同期
 */
export const loadSelectedModelWithSync = (
  modelType: 'vrm' | 'live2d' | 'pngtuber',
  path: string
): void => {
  if (modelType === 'vrm') {
    settingsStore.setState({ selectedVrmPath: path })
    const { viewer } = homeStore.getState()
    if (viewer && typeof viewer.loadVrm === 'function') {
      viewer.loadVrm(path)
    }
  } else if (modelType === 'live2d') {
    settingsStore.setState({ selectedLive2DPath: path })
  } else if (modelType === 'pngtuber') {
    settingsStore.setState({ selectedPNGTuberPath: path })
  }
}

/**
 * キャラクター位置の固定・解除・リセット操作を実行
 */
export const handleCharacterPositionAction = (
  action: 'fix' | 'unfix' | 'reset'
): void => {
  try {
    const { viewer, live2dViewer } = homeStore.getState()
    const { modelType } = settingsStore.getState()

    if (modelType === 'vrm') {
      const methodMap = {
        fix: 'fixCameraPosition',
        unfix: 'unfixCameraPosition',
        reset: 'resetCameraPosition',
      }
      const method = methodMap[action]
      if (viewer && typeof (viewer as any)[method] === 'function') {
        ;(viewer as any)[method]()
      } else {
        throw new Error(`VRM viewer method ${method} not available`)
      }
    } else if (live2dViewer) {
      const methodMap = {
        fix: 'fixPosition',
        unfix: 'unfixPosition',
        reset: 'resetPosition',
      }
      const method = methodMap[action]
      if (typeof (live2dViewer as any)[method] === 'function') {
        ;(live2dViewer as any)[method]()
      } else {
        throw new Error(`Live2D viewer method ${method} not available`)
      }
    }

    const messageMap = {
      fix: 'キャラクターの位置を固定しました',
      unfix: 'キャラクターの位置固定を解除しました',
      reset: 'キャラクターの位置をリセットしました',
    }

    toastStore.getState().addToast({
      message: messageMap[action],
      type: action === 'fix' ? 'success' : 'info',
      tag: `position-${action}`,
    })
  } catch (error) {
    logger.error(`Position ${action} failed:`, error)
    toastStore.getState().addToast({
      message: '位置の変更に失敗しました',
      type: 'error',
      tag: 'position-error',
    })
  }
}

/**
 * VRMライティング強度を変更し、ビューワに即時反映
 */
export const setLightingIntensityWithSync = (intensity: number): void => {
  settingsStore.setState({ lightingIntensity: intensity })
  const { viewer } = homeStore.getState()
  if (viewer && typeof viewer.updateLightingIntensity === 'function') {
    viewer.updateLightingIntensity(intensity)
  }
}

/**
 * キャラクタープリセット（1〜5）を選択し、プロンプトを同期
 */
export const selectCharacterPresetWithSync = (index: number): void => {
  const state = settingsStore.getState()
  const presets = [
    state.characterPreset1,
    state.characterPreset2,
    state.characterPreset3,
    state.characterPreset4,
    state.characterPreset5,
  ]
  const names = [
    state.customPresetName1,
    state.customPresetName2,
    state.customPresetName3,
    state.customPresetName4,
    state.customPresetName5,
  ]

  const selectedValue = presets[index] ?? presets[0]
  const presetName = names[index] || `プリセット ${index + 1}`

  settingsStore.setState({
    selectedPresetIndex: index,
    systemPrompt: selectedValue,
  })

  toastStore.getState().addToast({
    message: `キャラクターを「${presetName}」に切り替えました`,
    type: 'info',
    tag: 'character-preset-switching',
  })
}

/**
 * ショートカットキー文字列のサニタイズと重複チェック
 */
export const sanitizeSettingsShortcut = (val: string): string => {
  const trimmed = val.trim()
  if (!trimmed) {
    return DEFAULT_SETTINGS_TOGGLE_SHORTCUT
  }
  const state = settingsStore.getState()
  if (trimmed === state.voiceInputShortcut) {
    // 音声入力ショートカットと競合する場合は既存の設定を維持
    return state.settingsToggleShortcut || DEFAULT_SETTINGS_TOGGLE_SHORTCUT
  }
  return trimmed
}

/**
 * キオスクモードを安全に切り替える（パスコード未設定時の誤作動やロックアウト防止）
 */
export const setSafeKioskMode = (enabled: boolean): boolean => {
  if (!enabled) {
    settingsStore.setState({ kioskModeEnabled: false })
    return true
  }

  const state = settingsStore.getState()
  const passcode = state.kioskPasscode?.trim()
  if (!passcode) {
    if (typeof window !== 'undefined') {
      window.alert('キオスクモードを有効にする前に、従来設定画面でパスコードを設定してください。')
    }
    return false
  }

  if (typeof window !== 'undefined') {
    const confirmed = window.confirm(
      `デモ端末（キオスク）モードを有効にしますか？\n設定画面を開くにはパスコード「${passcode}」の入力が必要になります。`
    )
    if (!confirmed) return false
  }

  settingsStore.setState({ kioskModeEnabled: true })
  return true
}
