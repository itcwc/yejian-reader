const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const http = require('node:http')
const https = require('node:https')
const path = require('node:path')

const TITLEBAR_HEIGHT = 36
const THEME_BACKGROUND = {
  paper: '#f2efe6',
  night: '#101311',
  green: '#dbe8d4',
}

function applyWindowTheme(theme) {
  const background = THEME_BACKGROUND[theme] || THEME_BACKGROUND.paper
  nativeTheme.themeSource = theme === 'night' ? 'dark' : 'light'
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue
    win.setBackgroundColor(background)
    if (process.platform === 'win32' && typeof win.setTitleBarOverlay === 'function') {
      win.setTitleBarOverlay({
        color: background,
        symbolColor: theme === 'night' ? '#e9e6db' : '#20241f',
        height: TITLEBAR_HEIGHT,
      })
    }
  }
}

/** WebDAV 请求在主进程用 Node HTTP 发起，不受渲染进程 CORS 限制，也支持 PROPFIND 等自定义方法。 */
function davRequest({ method, url, headers, bodyBase64 }) {
  return new Promise((resolve) => {
    let settled = false
    const done = (payload) => {
      if (settled) return
      settled = true
      resolve(payload)
    }
    const fail = (error) => done({ status: 0, statusText: '', headers: {}, bodyBase64: '', error: String(error) })

    if (!/^https?:\/\//i.test(url || '')) {
      fail('地址需要以 http:// 或 https:// 开头')
      return
    }

    const body = bodyBase64 ? Buffer.from(bodyBase64, 'base64') : null
    const CERT_ERROR = /self[- ]signed|certificate|CERT_|UNABLE_TO_VERIFY|DEPTH_ZERO|ERR_TLS/i

    const send = (target, redirects, insecure = false) => {
      let parsed
      try {
        parsed = new URL(target)
      } catch {
        fail('服务器地址格式不正确')
        return
      }

      const lib = parsed.protocol === 'https:' ? https : http
      const plainHeaders = { ...(headers || {}) }
      if (body) plainHeaders['Content-Length'] = String(body.length)

      const request = lib.request(
        {
          protocol: parsed.protocol,
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: `${parsed.pathname}${parsed.search}`,
          method,
          headers: plainHeaders,
          timeout: 30000,
          ...(parsed.protocol === 'https:' ? { rejectUnauthorized: !insecure } : {}),
        },
        (response) => {
          const location = response.headers.location
          if (location && [301, 302, 303, 307, 308].includes(response.statusCode) && redirects > 0) {
            response.resume()
            send(new URL(location, target).toString(), redirects - 1, insecure)
            return
          }

          const chunks = []
          response.on('data', (chunk) => chunks.push(chunk))
          response.on('end', () => {
            const plain = {}
            for (const [key, value] of Object.entries(response.headers)) {
              plain[key] = Array.isArray(value) ? value.join(', ') : String(value ?? '')
            }
            done({
              status: response.statusCode || 0,
              statusText: response.statusMessage || '',
              headers: plain,
              bodyBase64: Buffer.concat(chunks).toString('base64'),
            })
          })
          response.on('error', (error) => fail(error?.message || '响应读取失败'))
        },
      )

      request.on('timeout', () => request.destroy(new Error('连接服务器超时')))
      request.on('error', (error) => {
        const message = error?.message || '网络请求失败'
        if (!insecure && CERT_ERROR.test(message)) {
          send(target, 5, true)
          return
        }
        if (insecure && CERT_ERROR.test(message)) {
          fail('服务器证书校验失败，且放宽校验后仍无法连接，请检查证书与域名是否匹配')
          return
        }
        fail(message)
      })
      if (body) request.write(body)
      request.end()
    }

    send(url, 5)
  })
}

function broadcastUpdate(state) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', state)
  }
}

function setupUpdater() {
  if (!app.isPackaged || process.platform !== 'win32') {
    ipcMain.handle('update:check', () => ({ supported: false }))
    ipcMain.handle('update:download', () => ({ ok: false, supported: false }))
    ipcMain.handle('update:install', () => ({ ok: false, supported: false }))
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcastUpdate({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => {
    broadcastUpdate({ state: 'available', version: info.version })
  })
  autoUpdater.on('update-not-available', () => broadcastUpdate({ state: 'none' }))
  autoUpdater.on('download-progress', (progress) => {
    broadcastUpdate({ state: 'downloading', percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => {
    broadcastUpdate({ state: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (error) => {
    broadcastUpdate({ state: 'error', message: error?.message || '更新失败' })
  })

  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { supported: true, version: result?.updateInfo?.version || null }
    } catch (error) {
      return { supported: true, error: String(error?.message || error) }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (error) {
      broadcastUpdate({ state: 'error', message: error?.message || '下载更新失败' })
      return { ok: false }
    }
  })

  ipcMain.handle('update:install', () => {
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return { ok: true }
  })

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 6000)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 620,
    title: '页间阅读',
    backgroundColor: '#f2efe6',
    autoHideMenuBar: true,
    ...(process.platform === 'win32'
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: {
            color: THEME_BACKGROUND.paper,
            symbolColor: '#20241f',
            height: TITLEBAR_HEIGHT,
          },
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  ipcMain.on('theme:set', (_event, theme) => {
    if (typeof theme === 'string') applyWindowTheme(theme)
  })

  ipcMain.handle('dav:request', (_event, payload) => davRequest(payload || {}))

  setupUpdater()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
