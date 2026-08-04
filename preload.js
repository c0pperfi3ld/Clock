const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('clockAPI', {
  dragStart: () => ipcRenderer.send('drag-start'),
  dragMove: () => ipcRenderer.send('drag-move'),
  dragEnd: () => ipcRenderer.send('drag-end'),
  showPanel: (cur) => ipcRenderer.send('show-panel', cur),
  saveSettings: (d) => ipcRenderer.send('save-settings', d),
  loadSettings: () => ipcRenderer.sendSync('load-settings'),
  closeApp: () => ipcRenderer.send('close-app'),
  onSetStyle: (cb) => ipcRenderer.on('set-style', (_, v) => cb(v)),
  onSetTheme: (cb) => ipcRenderer.on('set-theme', (_, v) => cb(v)),
  onSetOpacity: (cb) => ipcRenderer.on('set-opacity', (_, v) => cb(v)),
  onSetHands: (cb) => ipcRenderer.on('set-hands', (_, v) => cb(v)),
  onWindowResized: (cb) => ipcRenderer.on('window-resized', (_, s) => cb(s))
});
