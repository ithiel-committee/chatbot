/**
 * @jest-environment jsdom
 */
import { Viewer } from '@/features/vrmViewer/viewer'
import * as THREE from 'three'

const mockRender = jest.fn()
const mockSetPixelRatio = jest.fn()
const mockSetSize = jest.fn()
const mockDispose = jest.fn()

// Three.js の OrbitControls をモック
jest.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: jest.fn().mockImplementation(() => ({
    target: new THREE.Vector3(),
    update: jest.fn(),
    addEventListener: jest.fn(),
    screenSpacePanning: false,
    enabled: true,
  })),
}))

// Three.js の WebGLRenderer をモック
jest.mock('three', () => {
  const actualThree = jest.requireActual('three')
  return {
    ...actualThree,
    WebGLRenderer: jest.fn().mockImplementation(() => ({
      domElement: document.createElement('canvas'),
      setPixelRatio: mockSetPixelRatio,
      setSize: mockSetSize,
      render: mockRender,
      dispose: mockDispose,
    })),
  }
})

describe('Viewer - バックグラウンド移行・復帰時の視線および物理演算保護', () => {
  let viewer: Viewer
  let mockCanvas: HTMLCanvasElement
  let parentElement: HTMLDivElement

  beforeEach(() => {
    jest.clearAllMocks()

    // DOM セットアップ
    parentElement = document.createElement('div')
    Object.defineProperty(parentElement, 'clientWidth', {
      value: 800,
      configurable: true,
    })
    Object.defineProperty(parentElement, 'clientHeight', {
      value: 600,
      configurable: true,
    })

    mockCanvas = document.createElement('canvas')
    parentElement.appendChild(mockCanvas)
    document.body.appendChild(parentElement)

    // requestAnimationFrame のモック
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)

    viewer = new Viewer()
    viewer.setup(mockCanvas)
    mockRender.mockClear()
  })

  afterEach(() => {
    if (parentElement.parentNode) {
      parentElement.parentNode.removeChild(parentElement)
    }
    jest.restoreAllMocks()
  })

  it('document.hidden === true（タブが裏にある状態）では model.update とレンダリングがスキップされること', () => {
    const mockModel = {
      update: jest.fn(),
    }
    viewer.model = mockModel as any

    // document.hidden を true にシミュレート
    Object.defineProperty(document, 'hidden', {
      value: true,
      configurable: true,
    })

    viewer.update()

    expect(mockModel.update).not.toHaveBeenCalled()
    expect(mockRender).not.toHaveBeenCalled()
  })

  it('タブ復帰時に delta が巨大化（数秒〜数十秒）しても最大 0.1秒にクランプされること', () => {
    const mockModel = {
      update: jest.fn(),
    }
    viewer.model = mockModel as any

    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    })

    // 累積時間が 10秒（巨大なデルタ）経過したとシミュレート
    jest.spyOn((viewer as any)._clock, 'getDelta').mockReturnValue(10.0)

    viewer.update()

    // 0.1秒（10FPS相当）にクランプされていることを検証
    expect(mockModel.update).toHaveBeenCalledWith(0.1)
  })

  it('visibilitychange（表への復帰）時に springBoneManager.reset() が呼ばれ、累積時間が破棄されること', () => {
    const resetSpringBone = jest.fn()
    viewer.model = {
      update: jest.fn(),
      vrm: {
        springBoneManager: {
          reset: resetSpringBone,
        },
      },
    } as any

    const clockStartSpy = jest.spyOn((viewer as any)._clock, 'start')
    const clockDeltaSpy = jest.spyOn((viewer as any)._clock, 'getDelta')
    const resizeSpy = jest.spyOn(viewer, 'resize')

    Object.defineProperty(document, 'hidden', {
      value: false,
      configurable: true,
    })

    document.dispatchEvent(new Event('visibilitychange'))

    expect(clockStartSpy).toHaveBeenCalled()
    expect(clockDeltaSpy).toHaveBeenCalled()
    expect(resizeSpy).toHaveBeenCalled()
    expect(resetSpringBone).toHaveBeenCalled()
  })

  it('ウィンドウ最小化等で clientWidth / clientHeight が 0 の場合、カメラ行列の NaN 汚染を防ぐため resize をスキップすること', () => {
    Object.defineProperty(parentElement, 'clientWidth', {
      value: 0,
      configurable: true,
    })
    Object.defineProperty(parentElement, 'clientHeight', {
      value: 0,
      configurable: true,
    })

    const updateProjectionMatrixSpy = jest.spyOn(
      (viewer as any)._camera,
      'updateProjectionMatrix'
    )

    viewer.resize()

    expect(updateProjectionMatrixSpy).not.toHaveBeenCalled()
  })
})
