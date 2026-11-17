import { bytesToBase64, davBridge, toResponse } from './nativeDav'

export type WebdavErrorKind = 'config' | 'auth' | 'cors' | 'http' | 'notfound'

export class WebdavError extends Error {
  kind: WebdavErrorKind
  status?: number

  constructor(kind: WebdavErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'WebdavError'
    this.kind = kind
    this.status = status
  }
}

export interface WebdavConfig {
  url: string
  username: string
  password: string
}

function base64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function normalizeBase(url: string): string {
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new WebdavError('config', '服务器地址需要以 http:// 或 https:// 开头')
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:displayname />
    <d:getcontentlength />
    <d:resourcetype />
  </d:prop>
</d:propfind>`

const PROXY_BASE = '/__dav'
let proxyReady: Promise<boolean> | null = null

/**
 * 开发服务器内置同源代理，可绕过浏览器对 WebDAV 的 CORS 限制。
 * 静态部署环境没有该代理，会自动回退到直连。
 */
function proxyAvailable(): Promise<boolean> {
  if (!proxyReady) {
    proxyReady = fetch(`${PROXY_BASE}/health`, { method: 'GET', cache: 'no-store' })
      .then((response) => response.status === 204)
      .catch(() => false)
  }
  return proxyReady
}

export class WebdavClient {
  private base: string
  private authorization: string

  constructor(config: WebdavConfig) {
    this.base = normalizeBase(config.url)
    this.authorization = `Basic ${base64Utf8(`${config.username}:${config.password}`)}`
  }

  private url(path: string): string {
    const trimmed = path.replace(/^\/+/, '')
    if (!trimmed) return this.base
    const suffix = trimmed
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    return `${this.base}${suffix}${trimmed.endsWith('/') ? '/' : ''}`
  }

  private guard(response: Response): Response {
    if (response.status === 401 || response.status === 403) {
      throw new WebdavError('auth', '认证失败，请检查账号与密码（部分服务需要使用应用专用密码）。', response.status)
    }
    return response
  }

  private async request(method: string, path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', this.authorization)
    const target = this.url(path)

    // 桌面端与安卓壳走原生 HTTP 栈，不受浏览器 CORS 限制。
    const native = davBridge()
    if (native) {
      const plainHeaders: Record<string, string> = {}
      headers.forEach((value, key) => {
        plainHeaders[key] = value
      })
      let bodyBase64: string | undefined
      if (typeof init.body === 'string') {
        bodyBase64 = bytesToBase64(new TextEncoder().encode(init.body))
      } else if (init.body instanceof Uint8Array) {
        bodyBase64 = bytesToBase64(init.body)
      } else if (init.body instanceof Blob) {
        bodyBase64 = bytesToBase64(new Uint8Array(await init.body.arrayBuffer()))
      }
      const result = await native({ method, url: target, headers: plainHeaders, bodyBase64 })
      if (result.error) {
        throw new WebdavError('cors', `无法连接服务器：${result.error}。请检查地址、网络与证书。`)
      }
      return this.guard(toResponse(result))
    }

    if (await proxyAvailable()) {
      let response: Response
      try {
        response = await fetch(`${PROXY_BASE}?url=${encodeURIComponent(target)}`, {
          ...init,
          method,
          headers,
          cache: 'no-store',
          credentials: 'omit',
        })
      } catch {
        throw new WebdavError('cors', '本地代理请求失败，请确认开发服务器仍在运行后重试。')
      }
      if (response.status === 502) {
        const detail = (await response.text().catch(() => '')).trim()
        throw new WebdavError(
          'cors',
          `代理无法连接 WebDAV 服务器：${detail || '网络不可达'}。请检查地址、端口与证书是否可访问。`,
          502,
        )
      }
      return this.guard(response)
    }

    let response: Response
    try {
      response = await fetch(target, {
        ...init,
        method,
        headers,
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
      })
    } catch {
      throw new WebdavError(
        'cors',
        '无法连接服务器：请检查地址、网络与证书；浏览器直连 WebDAV 还要求服务端允许跨域（CORS）。用 npm run dev 启动时内置代理可自动绕过该限制。',
      )
    }
    return this.guard(response)
  }

  async test(): Promise<void> {
    const response = await this.request('PROPFIND', '', {
      headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
      body: PROPFIND_BODY,
    })
    if (!(response.ok || response.status === 207 || response.status === 301 || response.status === 302)) {
      throw new WebdavError('http', `服务器返回 ${response.status}，请确认 WebDAV 地址是否正确。`, response.status)
    }
  }

  async ensureCollection(path: string): Promise<void> {
    const clean = path.replace(/\/+$/, '')
    let response = await this.request('MKCOL', `${clean}/`)
    if (response.status === 409) {
      // 部分服务（Apache/Nginx dav）对结尾斜杠处理不同，去掉斜杠再试一次
      const retry = await this.request('MKCOL', clean)
      if ([200, 201, 204, 405].includes(retry.status)) return
      response = retry
    }
    if ([200, 201, 204, 405].includes(response.status)) return
    if (response.status === 409) {
      throw new WebdavError(
        'http',
        `目录创建失败（409）：${this.url(`${clean}/`)} 的上级目录不存在或 WebDAV 账号无写入权限。请确认站点里该目录真实存在，并给运行用户（如 www）写权限。`,
        409,
      )
    }
    if (response.status === 403) {
      throw new WebdavError('auth', '没有写入权限，请检查 WebDAV 账号权限。', 403)
    }
    throw new WebdavError('http', `创建目录失败（${response.status}）。`, response.status)
  }

  async put(path: string, data: Blob | string): Promise<void> {
    // 部分服务端（宝塔 Nginx + 防火墙）对带 Content-Type 的 PUT 会返回 500，统一用无类型字节流上传
    const bytes =
      typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(await data.arrayBuffer())
    const response = await this.request('PUT', path, { body: bytes })
    if (!response.ok) {
      throw new WebdavError('http', `上传失败（${response.status} ${response.statusText}）。`, response.status)
    }
  }

  async getText(path: string): Promise<string | null> {
    const response = await this.request('GET', path)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new WebdavError('http', `读取失败（${response.status}）。`, response.status)
    }
    return response.text()
  }

  async getBlob(path: string): Promise<Blob | null> {
    const response = await this.request('GET', path)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new WebdavError('http', `下载失败（${response.status}）。`, response.status)
    }
    return response.blob()
  }

  async remove(path: string): Promise<void> {
    const response = await this.request('DELETE', path)
    if (!response.ok && response.status !== 404) {
      throw new WebdavError('http', `删除失败（${response.status}）。`, response.status)
    }
  }
}
