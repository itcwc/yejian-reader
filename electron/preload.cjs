const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('yejian', {
  platform: 'desktop',
  version: '0.1.0',
})
