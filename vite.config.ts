import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import https from 'node:https'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
  const match = host.match(/^172\.(\d+)\./)
  if (match) {
    const second = Number(match[1])
    if (second >= 16 && second <= 31) return true
  }
  return false
}

/**
 * 开发/预览服务器上的 WebDAV 代理：
 * 浏览器直连 WebDAV 常被 CORS 拦截，改为同源转发以绕开跨域限制。
 * 仅监听本机开发服务器，不随静态构建产物发布。
 */
function webdavProxy(): Plugin {
  const handler = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next: (error?: unknown) => void,
  ) => {
    const rawUrl = req.url || ''
    if (!rawUrl.startsWith('/__dav')) return next()

    if (rawUrl.startsWith('/__dav/health')) {
      res.statusCode = 204
      res.end()
      return
    }

    const parsed = new URL(rawUrl, 'http://localhost')
    const target = parsed.searchParams.get('url')
    if (!target) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('缺少 url 参数')
      return
    }

    let targetUrl: URL
    try {
      targetUrl = new URL(target)
    } catch {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('目标地址无效')
      return
    }
    if (!/^https?:$/.test(targetUrl.protocol)) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end('仅支持 http/https')
      return
    }

    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    const body = chunks.length ? Buffer.concat(chunks) : undefined

    const headers: http.OutgoingHttpHeaders = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (!value) continue
      if (['host', 'origin', 'referer', 'connection', 'proxy-connection', 'cookie'].includes(key)) continue
      headers[key] = value
    }

    const insecure = isPrivateHost(targetUrl.hostname)
    const lib = targetUrl.protocol === 'https:' ? https : http
    const upstream = lib.request(
      {
        protocol: targetUrl.protocol,
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: `${targetUrl.pathname}${targetUrl.search}`,
        method: req.method,
        headers,
        ...(targetUrl.protocol === 'https:' ? { rejectUnauthorized: !insecure } : {}),
        timeout: 30000,
      },
      (response) => {
        if (res.headersSent) return
        const responseHeaders = { ...response.headers }
        delete responseHeaders['set-cookie']
        delete responseHeaders['access-control-allow-origin']
        res.writeHead(response.statusCode || 502, responseHeaders)
        response.pipe(res)
      },
    )

    upstream.on('timeout', () => upstream.destroy(new Error('连接目标服务器超时')))
    upstream.on('error', (error) => {
      if (res.headersSent) {
        res.end()
        return
      }
      res.statusCode = 502
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(error.message || '代理请求失败')
    })

    if (body) upstream.write(body)
    upstream.end()
  }

  return {
    name: 'yejian-webdav-proxy',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), webdavProxy()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    host: true,
    port: 5180,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
})
