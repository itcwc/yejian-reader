import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import {
  applyTheme,
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
} from '@/core/preferences'
import type { ThemeId } from '@/types'

export const usePreferencesStore = defineStore('preferences', () => {
  const prefs = reactive({ ...DEFAULT_PREFERENCES, ...loadPreferences() })

  watch(
    prefs,
    () => {
      savePreferences({ ...prefs })
      applyTheme(prefs.theme)
      window.yejian?.setAppTheme?.(prefs.theme)
    },
    { deep: true },
  )

  applyTheme(prefs.theme)
  window.yejian?.setAppTheme?.(prefs.theme)

  function setTheme(theme: ThemeId) {
    prefs.theme = theme
  }

  function setReaderTheme(theme: ThemeId) {
    prefs.readerTheme = theme
  }

  function cycleTheme() {
    const order: ThemeId[] = ['paper', 'green', 'night']
    const index = order.indexOf(prefs.theme)
    prefs.theme = order[(index + 1) % order.length]
  }

  return { prefs, setTheme, setReaderTheme, cycleTheme }
})
