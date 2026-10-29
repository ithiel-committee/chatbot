/**
 * @jest-environment jsdom
 */
import { IdleMotionController } from '@/features/vrmViewer/idleMotionController'
import type { Model } from '@/features/vrmViewer/model'

describe('IdleMotionController', () => {
  const originalEnv = process.env

  let mockModel: Partial<Model>
  let addEventListenerSpy: jest.SpyInstance
  let removeEventListenerSpy: jest.SpyInstance

  beforeEach(() => {
    jest.useFakeTimers()
    process.env = { ...originalEnv }

    mockModel = {
      vrm: {} as any,
      activeSpeechCount: 0,
      poseManager: {
        isActive: false,
        resetToIdle: jest.fn(),
        applyPose: jest.fn().mockResolvedValue(undefined),
      } as any,
    }

    addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
    process.env = originalEnv
  })

  it('NEXT_PUBLIC_IDLE_MOTION_ENABLED が未設定のとき正常に起動すること', () => {
    delete process.env.NEXT_PUBLIC_IDLE_MOTION_ENABLED

    const controller = new IdleMotionController(mockModel as Model)
    controller.start()

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function)
    )
    expect(jest.getTimerCount()).toBeGreaterThan(0)

    controller.dispose()
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'pointerdown',
      expect.any(Function)
    )
  })

  it("NEXT_PUBLIC_IDLE_MOTION_ENABLED='false' のときは start() を呼んでも無効化されること", () => {
    process.env.NEXT_PUBLIC_IDLE_MOTION_ENABLED = 'false'

    const controller = new IdleMotionController(mockModel as Model)
    controller.start()

    expect(addEventListenerSpy).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)

    controller.notifyActivity()
    expect(jest.getTimerCount()).toBe(0)

    controller.dispose()
  })
})
