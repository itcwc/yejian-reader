const { app, BrowserWindow, ipcMain, nativeTheme, shell } = require('electron')
const { autoUpdater } = require('electron-updater')
const path = require('node:path')

const THEME_BACKGROUND = {
  paper: '#f2efe6',
  night: '#101311',
  green: '#dbe8d4',
}

function applyWindowTheme(theme) {
  const background = THEME_BACKGROUND[theme] || THEME_BACKGROUND.paper
  nativeTheme.themeSource = theme === 'night' ? 'dark' : 'light'
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.setBackgroundColor(background)
  }
}

function broadcastUpdate(state) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('update:status', state)
  }
}

function setupUpdater() {
  if (!app.isPackaged) {
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

  setupUpdater()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
