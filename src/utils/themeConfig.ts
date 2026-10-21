/**
 * テーマカラーおよびフォントの環境変数読み込み・自動導出ユーティリティ
 */

export interface ThemeColors {
  primary?: string
  primaryHover?: string
  primaryPress?: string
  primaryDisabled?: string
}

export interface ThemeConfig {
  colors: ThemeColors | null
  fontFamily: string | null
  fontUrl: string | null
}

/**
 * 16進数カラーコードをRGBオブジェクトに変換する
 */
export function parseHex(
  hex: string
): { r: number; g: number; b: number } | null {
  const cleanHex = hex.trim().replace(/^#/, '')
  let fullHex = cleanHex

  if (cleanHex.length === 3) {
    fullHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('')
  }

  if (fullHex.length === 6 && /^[0-9a-fA-F]{6}$/.test(fullHex)) {
    const num = parseInt(fullHex, 16)
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    }
  }

  return null
}

/**
 * 数値を2桁のHEX文字列に変換する
 */
function toHex(n: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(n)))
  return clamped.toString(16).padStart(2, '0')
}

/**
 * 16進数カラーの明度を落として暗くする（factor: 0〜1）
 */
export function darkenHex(hex: string, factor: number): string {
  const rgb = parseHex(hex)
  if (!rgb) return hex
  const r = toHex(rgb.r * factor)
  const g = toHex(rgb.g * factor)
  const b = toHex(rgb.b * factor)
  return `#${r}${g}${b}`
}

/**
 * 環境変数からアクセントカラー系列を取得・導出する
 * - primaryが指定され、hover/press/disabledが未指定の場合は同系色として自動計算
 * - 未設定の場合はnullを返し、既存CSS（オレンジ系デフォルト）をそのまま維持する
 */
export function getThemeColors(): ThemeColors | null {
  const primary = (
    process.env.NEXT_PUBLIC_PRIMARY_COLOR ||
    process.env.NEXT_PUBLIC_THEME_PRIMARY_COLOR ||
    ''
  ).trim()

  const primaryHover = (
    process.env.NEXT_PUBLIC_PRIMARY_HOVER_COLOR ||
    process.env.NEXT_PUBLIC_THEME_PRIMARY_HOVER_COLOR ||
    ''
  ).trim()

  const primaryPress = (
    process.env.NEXT_PUBLIC_PRIMARY_PRESS_COLOR ||
    process.env.NEXT_PUBLIC_THEME_PRIMARY_PRESS_COLOR ||
    ''
  ).trim()

  const primaryDisabled = (
    process.env.NEXT_PUBLIC_PRIMARY_DISABLED_COLOR ||
    process.env.NEXT_PUBLIC_THEME_PRIMARY_DISABLED_COLOR ||
    ''
  ).trim()

  // カラー指定が一切ない場合はnull
  if (!primary && !primaryHover && !primaryPress && !primaryDisabled) {
    return null
  }

  const colors: ThemeColors = {}

  if (primary) {
    colors.primary = primary

    // hover
    if (primaryHover) {
      colors.primaryHover = primaryHover
    } else {
      const rgb = parseHex(primary)
      colors.primaryHover = rgb
        ? darkenHex(primary, 0.8)
        : `color-mix(in srgb, ${primary} 80%, black)`
    }

    // press
    if (primaryPress) {
      colors.primaryPress = primaryPress
    } else {
      const rgb = parseHex(primary)
      colors.primaryPress = rgb
        ? darkenHex(primary, 0.65)
        : `color-mix(in srgb, ${primary} 65%, black)`
    }

    // disabled
    if (primaryDisabled) {
      colors.primaryDisabled = primaryDisabled
    } else {
      const rgb = parseHex(primary)
      if (rgb) {
        const hex6 = `${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
        colors.primaryDisabled = `#${hex6}4d` // 約30%の不透明度
      } else {
        colors.primaryDisabled = `color-mix(in srgb, ${primary} 30%, transparent)`
      }
    }
  } else {
    // primary以外の個別色が指定されている場合
    if (primaryHover) colors.primaryHover = primaryHover
    if (primaryPress) colors.primaryPress = primaryPress
    if (primaryDisabled) colors.primaryDisabled = primaryDisabled
  }

  return colors
}

/**
 * 環境変数からテーマ全体の構成を取得する
 */
export function getThemeConfig(): ThemeConfig {
  const colors = getThemeColors()

  const fontFamily = (
    process.env.NEXT_PUBLIC_FONT_FAMILY ||
    process.env.NEXT_PUBLIC_THEME_FONT_FAMILY ||
    ''
  ).trim()

  const fontUrl = (
    process.env.NEXT_PUBLIC_FONT_URL ||
    process.env.NEXT_PUBLIC_THEME_FONT_URL ||
    ''
  ).trim()

  return {
    colors,
    fontFamily: fontFamily || null,
    fontUrl: fontUrl || null,
  }
}

/**
 * HTMLの<head>内に挿入するインラインCSS文字列を生成する
 */
export function getThemeInlineCss(config: ThemeConfig = getThemeConfig()): string {
  const rules: string[] = []

  if (config.colors) {
    if (config.colors.primary) {
      rules.push(`  --color-primary: ${config.colors.primary};`)
    }
    if (config.colors.primaryHover) {
      rules.push(`  --color-primary-hover: ${config.colors.primaryHover};`)
    }
    if (config.colors.primaryPress) {
      rules.push(`  --color-primary-press: ${config.colors.primaryPress};`)
    }
    if (config.colors.primaryDisabled) {
      rules.push(`  --color-primary-disabled: ${config.colors.primaryDisabled};`)
    }
  }

  if (config.fontFamily) {
    rules.push(`  --font-family: ${config.fontFamily};`)
  }

  if (rules.length === 0) {
    return ''
  }

  return `:root {\n${rules.join('\n')}\n}`
}

/**
 * クライアントサイドでDOM（document.documentElement）にCSS変数を直接適用する
 */
export function applyThemeToDOM(config: ThemeConfig = getThemeConfig()): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement

  if (config.colors) {
    if (config.colors.primary) {
      root.style.setProperty('--color-primary', config.colors.primary)
    }
    if (config.colors.primaryHover) {
      root.style.setProperty('--color-primary-hover', config.colors.primaryHover)
    }
    if (config.colors.primaryPress) {
      root.style.setProperty('--color-primary-press', config.colors.primaryPress)
    }
    if (config.colors.primaryDisabled) {
      root.style.setProperty(
        '--color-primary-disabled',
        config.colors.primaryDisabled
      )
    }
  }

  if (config.fontFamily) {
    root.style.setProperty('--font-family', config.fontFamily)
  }
}

