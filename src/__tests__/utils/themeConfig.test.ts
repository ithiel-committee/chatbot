import {
  parseHex,
  darkenHex,
  getThemeColors,
  getThemeConfig,
  getThemeInlineCss,
  applyThemeToDOM,
} from '@/utils/themeConfig'

describe('themeConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_PRIMARY_COLOR
    delete process.env.NEXT_PUBLIC_PRIMARY_HOVER_COLOR
    delete process.env.NEXT_PUBLIC_PRIMARY_PRESS_COLOR
    delete process.env.NEXT_PUBLIC_PRIMARY_DISABLED_COLOR
    delete process.env.NEXT_PUBLIC_THEME_PRIMARY_COLOR
    delete process.env.NEXT_PUBLIC_THEME_PRIMARY_HOVER_COLOR
    delete process.env.NEXT_PUBLIC_THEME_PRIMARY_PRESS_COLOR
    delete process.env.NEXT_PUBLIC_THEME_PRIMARY_DISABLED_COLOR
    delete process.env.NEXT_PUBLIC_FONT_FAMILY
    delete process.env.NEXT_PUBLIC_THEME_FONT_FAMILY
    delete process.env.NEXT_PUBLIC_FONT_URL
    delete process.env.NEXT_PUBLIC_THEME_FONT_URL
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('parseHex & darkenHex', () => {
    it('parses 6-digit and 3-digit hex colors', () => {
      expect(parseHex('#f5800b')).toEqual({ r: 245, g: 128, b: 11 })
      expect(parseHex('f5800b')).toEqual({ r: 245, g: 128, b: 11 })
      expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
      expect(parseHex('invalid')).toBeNull()
    })

    it('darkens hex color correctly', () => {
      const darkened = darkenHex('#f5800b', 0.8)
      expect(darkened).toBe('#c46609')
    })
  })

  describe('when no theme env variables are set', () => {
    it('returns null colors and empty inline css so existing defaults remain intact', () => {
      expect(getThemeColors()).toBeNull()
      const config = getThemeConfig()
      expect(config.colors).toBeNull()
      expect(config.fontFamily).toBeNull()
      expect(config.fontUrl).toBeNull()
      expect(getThemeInlineCss(config)).toBe('')
    })
  })

  describe('when NEXT_PUBLIC_PRIMARY_COLOR is specified', () => {
    it('automatically derives hover, press, and disabled colors from primary hex', () => {
      process.env.NEXT_PUBLIC_PRIMARY_COLOR = '#3b82f6'

      const colors = getThemeColors()
      expect(colors).not.toBeNull()
      expect(colors?.primary).toBe('#3b82f6')
      expect(colors?.primaryHover).toBe(darkenHex('#3b82f6', 0.8))
      expect(colors?.primaryPress).toBe(darkenHex('#3b82f6', 0.65))
      expect(colors?.primaryDisabled).toBe('#3b82f64d')

      const css = getThemeInlineCss()
      expect(css).toContain('--color-primary: #3b82f6;')
      expect(css).toContain(`--color-primary-hover: ${darkenHex('#3b82f6', 0.8)};`)
      expect(css).toContain(`--color-primary-press: ${darkenHex('#3b82f6', 0.65)};`)
      expect(css).toContain('--color-primary-disabled: #3b82f64d;')
    })

    it('derives color-mix variants for non-hex primary colors', () => {
      process.env.NEXT_PUBLIC_PRIMARY_COLOR = 'rgb(59, 130, 246)'

      const colors = getThemeColors()
      expect(colors?.primary).toBe('rgb(59, 130, 246)')
      expect(colors?.primaryHover).toBe(
        'color-mix(in srgb, rgb(59, 130, 246) 80%, black)'
      )
      expect(colors?.primaryPress).toBe(
        'color-mix(in srgb, rgb(59, 130, 246) 65%, black)'
      )
      expect(colors?.primaryDisabled).toBe(
        'color-mix(in srgb, rgb(59, 130, 246) 30%, transparent)'
      )
    })

    it('allows individual colors to override auto-derived colors', () => {
      process.env.NEXT_PUBLIC_PRIMARY_COLOR = '#3b82f6'
      process.env.NEXT_PUBLIC_PRIMARY_HOVER_COLOR = '#1d4ed8'
      process.env.NEXT_PUBLIC_PRIMARY_PRESS_COLOR = '#1e40af'
      process.env.NEXT_PUBLIC_PRIMARY_DISABLED_COLOR = '#93c5fd'

      const colors = getThemeColors()
      expect(colors?.primary).toBe('#3b82f6')
      expect(colors?.primaryHover).toBe('#1d4ed8')
      expect(colors?.primaryPress).toBe('#1e40af')
      expect(colors?.primaryDisabled).toBe('#93c5fd')
    })
  })

  describe('font family & font url configuration', () => {
    it('sets font family and font url correctly in config and inline css', () => {
      process.env.NEXT_PUBLIC_FONT_FAMILY = "'Zen Maru Gothic', sans-serif"
      process.env.NEXT_PUBLIC_FONT_URL =
        'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic&display=swap'

      const config = getThemeConfig()
      expect(config.fontFamily).toBe("'Zen Maru Gothic', sans-serif")
      expect(config.fontUrl).toBe(
        'https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic&display=swap'
      )

      const css = getThemeInlineCss(config)
      expect(css).toContain("--font-family: 'Zen Maru Gothic', sans-serif;")
    })
  })

  describe('alias support (NEXT_PUBLIC_THEME_*)', () => {
    it('reads alias environment variables', () => {
      process.env.NEXT_PUBLIC_THEME_PRIMARY_COLOR = '#10b981'
      process.env.NEXT_PUBLIC_THEME_FONT_FAMILY = "'Noto Sans JP', sans-serif"

      const config = getThemeConfig()
      expect(config.colors?.primary).toBe('#10b981')
      expect(config.fontFamily).toBe("'Noto Sans JP', sans-serif")
    })
  })

  describe('applyThemeToDOM', () => {
    it('applies styles to documentElement', () => {
      process.env.NEXT_PUBLIC_PRIMARY_COLOR = '#3b82f6'
      process.env.NEXT_PUBLIC_FONT_FAMILY = 'CustomFont'

      applyThemeToDOM()

      expect(
        document.documentElement.style.getPropertyValue('--color-primary')
      ).toBe('#3b82f6')
      expect(
        document.documentElement.style.getPropertyValue('--font-family')
      ).toBe('CustomFont')
    })
  })
})
