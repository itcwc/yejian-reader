const { contextBridge, ipcRenderer } = require('electron')
const { version } = require('../package.json')

contextBridge.exposeInMainWorld('yejian', {
  platform: 'desktop',
  os: process.platform,
  version,
  setAppTheme: (theme) => ipcRenderer.send('theme:set', theme),
  davRequest: (payload) => ipcRenderer.invoke('dav:request', payload),
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (callback) => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('update:status', listener)
      return () => ipcRenderer.removeListener('update:status', listener)
    },
  },
})
