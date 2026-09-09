const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('panelAPI', {
  setStyle: (v) => ipcRenderer.send('panel-set-style', v),
  setTheme: (v) => ipcRenderer.send('panel-set-theme', v),
  setHands: (v) => ipcRenderer.send('panel-set-hands', v),
  setOpacity: (v) => ipcRenderer.send('panel-set-opacity', v),
  setOnTop: (v) => ipcRenderer.send('panel-set-ontop', v),
  setSessions: (v) => ipcRenderer.send('panel-set-sessions', v),
  setBlockOpacity: (v) => ipcRenderer.send('panel-set-block-opacity', v),
  setBlockAnim: (v) => ipcRenderer.send('panel-set-block-anim', v),
  setTooltipAnim: (v) => ipcRenderer.send('panel-set-tooltip-anim', v),
  setTooltipSize: (v) => ipcRenderer.send('panel-set-tooltip-size', v),
  setReminders: (v) => ipcRenderer.send('panel-set-reminders', v),
  focusTimeInput: (type, timeStr) => ipcRenderer.send('panel-focus-time', {type, timeStr}),
  blurTimeInput: () => ipcRenderer.send('panel-blur-time'),
  closePanel: () => ipcRenderer.send('panel-close'),
  closeApp: () => ipcRenderer.send('close-app'),
  onUpdateState: (cb) => ipcRenderer.on('update-state', (_, s) => cb(s)),
  onUpdateTime: (cb) => ipcRenderer.on('update-time', (_, data) => cb(data))
});
