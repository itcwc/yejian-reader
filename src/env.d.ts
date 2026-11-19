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

interface DavResponsePayload {
  status: number
  statusText: string
  headers: Record<string, string>
  bodyBase64: string
  error?: string
}

interface Window {
  YeJianBackup?: {
    choose: (name: string) => void
    write: (base64: string) => boolean
    finish: () => boolean
    cancel: () => void
  }
  __yejianBackupChosen?: (status: string) => void
  yejian?: {
    platform: 'desktop'
    os?: string
    version: string
    setAppTheme?: (theme: 'paper' | 'night' | 'green') => void
    davRequest?: (payload: {
      method: string
      url: string
      headers: Record<string, string>
      bodyBase64?: string
    }) => Promise<DavResponsePayload>
    updates?: {
      check: () => Promise<UpdateResult>
      download: () => Promise<{ ok: boolean; supported?: boolean }>
      install: () => Promise<{ ok: boolean; supported?: boolean }>
      onStatus: (callback: (state: UpdateState) => void) => () => void
    }
  }
  __yejianDavResolve?: (id: string, json: string) => void
  YeJianShell?: {
    setSystemBars?: (reading: boolean, color: string) => void
    setImmersive?: (value: boolean) => void
    setShellColor?: (color: string) => void
  }
  /** 安卓壳的原生更新入口：检查 android-release-update.json，有新版本时在应用内下载并调起安装。 */
  YeJianUpdate?: {
    check: () => void
  }
}
