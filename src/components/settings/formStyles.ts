const settingsControlBaseClass =
  'text-ellipsis rounded-lg bg-white px-4 py-2 hover:bg-white-hover'

export const settingsFieldWidth = {
  numeric: 'w-full sm:w-24',
  numericWide: 'w-full sm:w-32',
  compact: 'w-full sm:w-col-span-2',
  medium: 'w-full sm:w-col-span-4',
  long: 'w-full sm:w-col-span-7',
  full: 'w-full',
} as const

export const settingsControlClass = {
  numeric: `${settingsControlBaseClass} ${settingsFieldWidth.numeric}`,
  numericWide: `${settingsControlBaseClass} ${settingsFieldWidth.numericWide}`,
  compact: `${settingsControlBaseClass} ${settingsFieldWidth.compact}`,
  medium: `${settingsControlBaseClass} ${settingsFieldWidth.medium}`,
  long: `${settingsControlBaseClass} ${settingsFieldWidth.long}`,
  full: `${settingsControlBaseClass} ${settingsFieldWidth.full}`,
} as const

export const settingsActionWidth = 'w-full sm:w-auto'
