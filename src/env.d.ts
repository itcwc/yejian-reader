/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare const __APP_VERSION__: string

interface UpdateState {
  state: 'checking' | 'available' | 'none' | 'downloading' | 'downloaded' | 'error'
  version?: string
  percent?: number
  message?: string
}

interface UpdateResult {
  supported: boolean
  version?: string | null
  error?: string
}

interface Window {
  yejian?: {
    platform: 'desktop'
    version: string
    setAppTheme?: (theme: 'paper' | 'night' | 'green') => void
    updates?: {
      check: () => Promise<UpdateResult>
      download: () => Promise<{ ok: boolean; supported?: boolean }>
      install: () => Promise<{ ok: boolean; supported?: boolean }>
      onStatus: (callback: (state: UpdateState) => void) => () => void
    }
  }
}
