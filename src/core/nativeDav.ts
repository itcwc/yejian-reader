/**
 * 原生 WebDAV 传输桥。
 *
 * 浏览器里直接 fetch 会被 CORS 拦截，Electron / Android 壳改用原生 HTTP 栈：
 * - Electron：preload 暴露的 davRequest（主进程 net 模块）
 * - Android：WebView 注入的 YeJianBridge 对象，通过全局回调返回结果
 */

export interface DavRequestPayload {
  method: string
  url: string
  headers: Record<string, string>
  bodyBase64?: string
}

export interface DavResponsePayload {
  status: number
  statusText: string
  headers: Record<string, string>
  bodyBase64: string
  error?: string
}

type DavBridge = (payload: DavRequestPayload) => Promise<DavResponsePayload>

interface AndroidBridge {
  request: (id: string, method: string, url: string, headersJson: string, bodyBase64: string) => void
}

let cached: DavBridge | null | undefined
let seq = 0
const pending = new Map<string, (payload: DavResponsePayload) => void>()

function createAndroidBridge(): DavBridge | null {
  const native = (window as unknown as { YeJianBridge?: AndroidBridge }).YeJianBridge
  if (!native?.request) return null

  window.__yejianDavResolve = (id, json) => {
    const resolve = pending.get(id)
    if (!resolve) return
    pending.delete(id)
    try {
      resolve(JSON.parse(json) as DavResponsePayload)
    } catch {
      resolve({ status: 0, statusText: '', headers: {}, bodyBase64: '', error: '原生返回数据解析失败' })
    }
  }

  return (payload) =>
    new Promise<DavResponsePayload>((resolve) => {
      const id = `dav-${(seq += 1)}`
      pending.set(id, resolve)
      native.request(id, payload.method, payload.url, JSON.stringify(payload.headers), payload.bodyBase64 ?? '')
    })
}

export function davBridge(): DavBridge | null {
  if (cached !== undefined) return cached
  const desktop = window.yejian?.davRequest
  cached = desktop ?? createAndroidBridge()
  return cached
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function toResponse(result: DavResponsePayload): Response {
  const headers = new Headers()
  for (const [key, value] of Object.entries(result.headers || {})) {
    if (value) headers.set(key, value)
  }
  const noBody = result.status === 204 || result.status === 304 || !result.bodyBase64
  const body = noBody ? null : new Blob([base64ToBytes(result.bodyBase64)], { type: headers.get('content-type') || '' })
  return new Response(body, {
    status: result.status || 502,
    statusText: result.statusText || '',
    headers,
  })
}
