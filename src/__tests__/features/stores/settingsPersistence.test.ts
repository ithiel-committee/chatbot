describe('settingsStore persistence', () => {
  const storageKey = 'aitube-kit-settings'
  const originalSelectedVrmPath = process.env.NEXT_PUBLIC_SELECTED_VRM_PATH
  const originalAlwaysOverride =
    process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES
  const originalShowInputForm = process.env.NEXT_PUBLIC_SHOW_INPUT_FORM
  const originalChatLogMode = process.env.NEXT_PUBLIC_CHAT_LOG_MODE
  const originalBackgroundImagePath =
    process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PATH

  const loadStore = () => {
    jest.resetModules()
    return require('@/features/stores/settings').default
  }

  afterEach(() => {
    localStorage.clear()
    process.env.NEXT_PUBLIC_SELECTED_VRM_PATH = originalSelectedVrmPath
    process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES =
      originalAlwaysOverride
    if (originalShowInputForm === undefined) {
      delete process.env.NEXT_PUBLIC_SHOW_INPUT_FORM
    } else {
      process.env.NEXT_PUBLIC_SHOW_INPUT_FORM = originalShowInputForm
    }
    if (originalChatLogMode === undefined) {
      delete process.env.NEXT_PUBLIC_CHAT_LOG_MODE
    } else {
      process.env.NEXT_PUBLIC_CHAT_LOG_MODE = originalChatLogMode
    }
    if (originalBackgroundImagePath === undefined) {
      delete process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PATH
    } else {
      process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PATH =
        originalBackgroundImagePath
    }
  })

  it('prefers environment values before components read the store when override is enabled', () => {
    process.env.NEXT_PUBLIC_SELECTED_VRM_PATH = '/vrm/nikechan_v2.vrm'
    process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES = 'true'

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        state: {
          selectedVrmPath: '/vrm/nikechan_v1.vrm',
        },
        version: 0,
      })
    )

    const settingsStore = loadStore()

    expect(settingsStore.getState().selectedVrmPath).toBe(
      '/vrm/nikechan_v2.vrm'
    )
  })

  it('keeps persisted values when override is disabled', () => {
    process.env.NEXT_PUBLIC_SELECTED_VRM_PATH = '/vrm/nikechan_v2.vrm'
    process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES = 'false'

    localStorage.setItem(
      storageKey,
      JSON.stringify({
        state: {
          selectedVrmPath: '/vrm/custom.vrm',
        },
        version: 0,
      })
    )

    const settingsStore = loadStore()

    expect(settingsStore.getState().selectedVrmPath).toBe('/vrm/custom.vrm')
  })

  it('uses environment defaults for chat log and input form visibility', () => {
    process.env.NEXT_PUBLIC_SHOW_INPUT_FORM = 'false'
    process.env.NEXT_PUBLIC_CHAT_LOG_MODE = 'hidden'

    const settingsStore = loadStore()

    expect(settingsStore.getState().showInputForm).toBe(false)
    expect(settingsStore.getState().chatLogMode).toBe('hidden')
  })

  it('falls back to the chat-log view for an invalid chat log mode', () => {
    process.env.NEXT_PUBLIC_CHAT_LOG_MODE = 'invalid'

    const settingsStore = loadStore()

    expect(settingsStore.getState().chatLogMode).toBe('chat-log')
  })

  it('persists customized keyboard shortcuts', () => {
    const settingsStore = loadStore()

    settingsStore.setState({
      settingsToggleShortcut: 'Control+Shift+KeyS',
      voiceInputShortcut: 'Space',
    })

    const persisted = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    expect(persisted.state.settingsToggleShortcut).toBe('Control+Shift+KeyS')
    expect(persisted.state.voiceInputShortcut).toBe('Space')
  })

  it('persists user-configurable settings previously omitted from storage', () => {
    process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES = 'false'
    const settingsStore = loadStore()

    settingsStore.setState({
      anthropicKey: 'anthropic-test-key',
      dynamicRetrievalThreshold: 0.65,
      showControlPanel: false,
      showInputForm: false,
      chatLogMode: 'hidden',
      backgroundImageUrl: 'green',
    })

    const persisted = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    expect(persisted.state.anthropicKey).toBe('anthropic-test-key')
    expect(persisted.state.dynamicRetrievalThreshold).toBe(0.65)
    expect(persisted.state.showControlPanel).toBe(false)
    expect(persisted.state.showInputForm).toBe(false)
    expect(persisted.state.chatLogMode).toBe('hidden')
    expect(persisted.state.backgroundImageUrl).toBe('green')

    const reloadedSettingsStore = loadStore()
    expect(reloadedSettingsStore.getState().anthropicKey).toBe(
      'anthropic-test-key'
    )
    expect(reloadedSettingsStore.getState().dynamicRetrievalThreshold).toBe(
      0.65
    )
    expect(reloadedSettingsStore.getState().showControlPanel).toBe(false)
    expect(reloadedSettingsStore.getState().showInputForm).toBe(false)
    expect(reloadedSettingsStore.getState().chatLogMode).toBe('hidden')
    expect(reloadedSettingsStore.getState().backgroundImageUrl).toBe('green')
  })

  describe('background image overwrite and persistence behavior', () => {
    it('verifies default background is /backgrounds/bg-c.png when not configured', () => {
      const settingsStore = loadStore()
      expect(settingsStore.getState().backgroundImageUrl).toBe(
        '/backgrounds/bg-c.png'
      )
    })

    it('preserves setting when changed from default (/backgrounds/bg-c.png) to /backgrounds/bg.jpg', () => {
      process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES = 'false'
      const settingsStore = loadStore()

      settingsStore.setState({
        backgroundImageUrl: '/backgrounds/bg.jpg',
      })

      const persisted = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      expect(persisted.state.backgroundImageUrl).toBe('/backgrounds/bg.jpg')

      const reloadedStore = loadStore()
      expect(reloadedStore.getState().backgroundImageUrl).toBe(
        '/backgrounds/bg.jpg'
      )
    })

    it('preserves setting when changed from default to green', () => {
      process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES = 'false'
      const settingsStore = loadStore()

      settingsStore.setState({
        backgroundImageUrl: 'green',
      })

      const reloadedStore = loadStore()
      expect(reloadedStore.getState().backgroundImageUrl).toBe('green')
    })

    it('demonstrates mergePersistedSettings overwrite if background is /backgrounds/bg-c.png and env default is different', () => {
      // If environment changes default to custom.jpg
      process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PATH = '/backgrounds/custom.jpg'
      process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES = 'false'

      // But user intentionally chose /backgrounds/bg-c.png
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: {
            backgroundImageUrl: '/backgrounds/bg-c.png',
          },
          version: 0,
        })
      )

      const reloadedStore = loadStore()
      // Because mergePersistedSettings treats /backgrounds/bg-c.png as an old default to migrate,
      // it gets overwritten by currentState.backgroundImageUrl (/backgrounds/custom.jpg)!
      expect(reloadedStore.getState().backgroundImageUrl).toBe(
        '/backgrounds/custom.jpg'
      )
    })

    it('demonstrates continuous env override when NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES is true', () => {
      process.env.NEXT_PUBLIC_ALWAYS_OVERRIDE_WITH_ENV_VARIABLES = 'true'
      const settingsStore = loadStore()

      // User changes setting from default to /backgrounds/bg.jpg
      settingsStore.setState({
        backgroundImageUrl: '/backgrounds/bg.jpg',
      })

      // When reloaded, because ALWAYS_OVERRIDE is true, it is overwritten back to default!
      const reloadedStore = loadStore()
      expect(reloadedStore.getState().backgroundImageUrl).toBe(
        '/backgrounds/bg-c.png'
      )
    })
  })
})
