const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('panelAPI', {
  setStyle: (v) => ipcRenderer.send('panel-set-style', v),
  setTheme: (v) => ipcRenderer.send('panel-set-theme', v),
  setHands: (v) => ipcRenderer.send('panel-set-hands', v),
  setOpacity: (v) => ipcRenderer.send('panel-set-opacity', v),
  setOnTop: (v) => ipcRenderer.send('panel-set-ontop', v),
  closePanel: () => ipcRenderer.send('panel-close'),
  closeApp: () => ipcRenderer.send('close-app'),
  onUpdateState: (cb) => ipcRenderer.on('update-state', (_, s) => cb(s))
});
