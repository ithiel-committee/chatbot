import { getAutoHideTimeoutSec } from '@/utils/autoHideConfig'

describe('getAutoHideTimeoutSec', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = originalEnv
    } else {
      delete process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT
    }
  })

  it('未設定時は 0 を返す', () => {
    delete process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT
    expect(getAutoHideTimeoutSec()).toBe(0)
  })

  it('空文字の場合は 0 を返す', () => {
    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = ''
    expect(getAutoHideTimeoutSec()).toBe(0)
  })

  it('0の場合は 0 を返す', () => {
    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = '0'
    expect(getAutoHideTimeoutSec()).toBe(0)
  })

  it('負数の場合は 0 を返す', () => {
    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = '-5'
    expect(getAutoHideTimeoutSec()).toBe(0)
  })

  it('数値に変換できない不正文字列の場合は 0 を返す', () => {
    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = 'invalid'
    expect(getAutoHideTimeoutSec()).toBe(0)
  })

  it('正の数値文字列の場合はその数値を返す', () => {
    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = '5'
    expect(getAutoHideTimeoutSec()).toBe(5)

    process.env.NEXT_PUBLIC_AUTOHIDE_TIMEOUT = '2.5'
    expect(getAutoHideTimeoutSec()).toBe(2.5)
  })
})
