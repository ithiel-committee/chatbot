
import type { Model } from './model'
import settingsStore from '@/features/stores/settings'
import { logger } from '@/lib/logger'

const FIRST_IDLE_MS = 20_000
const MIN_INTERVAL_MS = 15_000
const MAX_INTERVAL_MS = 35_000
const MOTION_DURATION_MS = 5_000

// ランダム再生したいポーズ
const IDLE_POSES = [
  'wave',
  'clap',
  'bow',
  'shrug',
  'shy',
  'think',
]

export class IdleMotionController {
  private model: Model
  private timer?: ReturnType<typeof setTimeout>
  private motionTimer?: ReturnType<typeof setTimeout>
  private generation = 0
  private active = false
  private disposed = false
  private lastPose?: string

  constructor(model: Model) {
    this.model = model
  }

  public start() {
    this.disposed = false

    window.addEventListener('pointerdown', this.onActivity)
    window.addEventListener('pointermove', this.onActivity)
    window.addEventListener('keydown', this.onActivity)
    window.addEventListener('wheel', this.onActivity)
    window.addEventListener('touchstart', this.onActivity)

    this.notifyActivity()
  }

  private onActivity = () => {
    this.notifyActivity()
  }

  public notifyActivity = () => {
    if (this.disposed) return

    this.generation++
    this.clearTimers()

    if (this.active) {
      this.active = false
      this.model.poseManager.resetToIdle(this.model)
    }

    this.schedule(FIRST_IDLE_MS)
  }

  private schedule(delay: number) {
    if (this.disposed) return

    this.timer = setTimeout(() => {
      void this.playRandomMotion()
    }, delay)
  }

  private async playRandomMotion() {
    if (this.disposed || !this.model.vrm) return

    // 発話中や他のモーション実行中は割り込まない
    if (
      this.model.activeSpeechCount > 0 ||
      this.model.poseManager.isActive
    ) {
      this.schedule(3_000)
      return
    }

    const poses = settingsStore.getState().poseConfigs
    const candidates = poses.filter(
      (pose) =>
        IDLE_POSES.includes(pose.id) &&
        pose.id !== this.lastPose
    )

    const available =
      candidates.length > 0
        ? candidates
        : poses.filter((pose) => IDLE_POSES.includes(pose.id))

    if (available.length === 0) {
      this.schedule(5_000)
      return
    }

    const pose = available[Math.floor(Math.random() * available.length)]
    const generation = ++this.generation

    this.lastPose = pose.id
    this.active = true

    try {
      await this.model.poseManager.applyPose(
        this.model,
        pose.id,
        pose
      )

      if (this.disposed || generation !== this.generation) return

      this.motionTimer = setTimeout(() => {
        if (this.disposed || generation !== this.generation) return

        this.active = false
        this.model.poseManager.resetToIdle(this.model)

        const delay =
          MIN_INTERVAL_MS +
          Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)

        this.schedule(delay)
      }, MOTION_DURATION_MS)
    } catch (error) {
      logger.error('Idle motion failed:', error)
      if (generation !== this.generation || this.disposed) return

      this.active = false
      this.model.poseManager.resetToIdle(this.model)
      this.schedule(5_000)
    }
  }

  private clearTimers() {
    if (this.timer) clearTimeout(this.timer)
    if (this.motionTimer) clearTimeout(this.motionTimer)
    this.timer = undefined
    this.motionTimer = undefined
  }

  public dispose() {
    this.generation++
    this.disposed = true
    this.clearTimers()

    window.removeEventListener('pointerdown', this.onActivity)
    window.removeEventListener('pointermove', this.onActivity)
    window.removeEventListener('keydown', this.onActivity)
    window.removeEventListener('wheel', this.onActivity)
    window.removeEventListener('touchstart', this.onActivity)

    if (this.active) {
      this.active = false
      if (this.model.vrm) {
        this.model.poseManager.resetToIdle(this.model)
      }
    }
  }
}
