export type MenuItemType =
  | 'toggle'
  | 'select'
  | 'slider'
  | 'text' // short text, API key, etc
  | 'action' // trigger execution on confirmation (like test, upload image, etc)
  | 'custom' // custom components

export interface MenuOption<T = string | number | boolean> {
  label: string
  value: T
  description?: string
}

export interface MenuItem<T = any> {
  id: string
  label: string
  description?: string
  type: MenuItemType
  getValue?: () => T
  setValue?: (val: T) => void
  options?: MenuOption<T>[]
  min?: number
  max?: number
  step?: number
  unit?: string
  placeholder?: string
  disabled?: () => boolean
  onAction?: () => void
  customRender?: () => React.ReactNode
}

export interface MenuCategory {
  id: string
  label: string
  icon?: string
  items: MenuItem[]
}

export type FocusedPane = 'category' | 'item'
