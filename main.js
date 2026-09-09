const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null, panel = null;
const SETTINGS_PATH = path.join(app.getPath('userData'), 'clock-settings.json');

function loadSettings() {
  try { return fs.existsSync(SETTINGS_PATH) ? JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) : {}; }
  catch (e) { return {}; }
}
function saveSettings(data) {
  try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf-8'); } catch (e) {}
}
// Migration: drop any legacy reminder data from the settings file
function pruneLegacySettings() {
  const s = loadSettings();
  let changed = false;
  if ('reminders' in s) { delete s.reminders; changed = true; }
  if (changed) saveSettings(s);
}

function createWindow() {
  const settings = loadSettings();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const defaultH = 380;
  const defaultW = 640; // clock (380) + todo sidebar (260)
  // Migration: ignore saved bounds that look like the old square (1:1) layout
  // or are too small for the new clock+sidebar layout.
  let bounds = settings.windowBounds;
  const looksLegacy = bounds && (
    Math.abs(bounds.width - bounds.height) < 20 || // square (old 1:1 lock)
    bounds.width < 480 ||
    bounds.height < 280
  );
  if (!bounds || looksLegacy) {
    bounds = { x: sw - defaultW - 40, y: 40, width: defaultW, height: defaultH };
  }

  win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    minWidth: 460, minHeight: 300, frame: false, transparent: true,
    alwaysOnTop: true, resizable: true, skipTaskbar: false, hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // No aspect-ratio lock: clock stays square on the left, todo panel fills the rest
  win.loadFile('index.html');
  win.on('resize', () => { if (win) win.webContents.send('window-resized', {}); });
  win.on('moved', () => { const s = loadSettings(); s.windowBounds = win.getBounds(); saveSettings(s); });
  win.on('closed', () => { win = null; if (panel && !panel.isDestroyed()) panel.close(); });
}

function showPanel(currentState) {
  if (panel && !panel.isDestroyed()) {
    panel.webContents.send('update-state', currentState);
    panel.show();
    panel.focus();
    return;
  }

  const settings = loadSettings();
  let pw = 260, ph = 560;
  let px, py;

  if (settings.panelBounds) {
    pw = settings.panelBounds.width;
    ph = settings.panelBounds.height;
    px = settings.panelBounds.x;
    py = settings.panelBounds.y;
  } else {
    const clockBounds = win.getBounds();
    const display = screen.getDisplayNearestPoint({ x: clockBounds.x, y: clockBounds.y });
    const wa = display.workArea;
    px = clockBounds.x + clockBounds.width + 12;
    py = clockBounds.y;
    if (px + pw > wa.x + wa.width) px = clockBounds.x - pw - 12;
    if (py + ph > wa.y + wa.height) py = wa.y + wa.height - ph;
    if (py < wa.y) py = wa.y;
  }

  panel = new BrowserWindow({
    x: px, y: py, width: pw, height: ph,
    minWidth: 220, minHeight: 300,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: true, skipTaskbar: true, hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload_panel.js'), contextIsolation: true, nodeIntegration: false }
  });
  panel.loadFile('panel.html');
  panel.webContents.on('did-finish-load', () => {
    panel.webContents.send('update-state', currentState);
  });

  const savePanelBounds = () => {
    if (panel && !panel.isDestroyed()) {
      const s = loadSettings();
      s.panelBounds = panel.getBounds();
      saveSettings(s);
    }
  };

  panel.on('resize', savePanelBounds);
  panel.on('moved', savePanelBounds);

  panel.on('closed', () => { panel = null; });
}

// ── IPC: Clock Drag ──
let dragOffset = null;
ipcMain.on('drag-start', () => {
  if (!win) return;
  const cursor = screen.getCursorScreenPoint();
  const [wx, wy] = win.getPosition();
  dragOffset = { x: cursor.x - wx, y: cursor.y - wy };
});
ipcMain.on('drag-move', () => {
  if (!win || !dragOffset) return;
  const cursor = screen.getCursorScreenPoint();
  win.setPosition(cursor.x - dragOffset.x, cursor.y - dragOffset.y);
});
ipcMain.on('drag-end', () => {
  dragOffset = null;
  if (win) { const s = loadSettings(); s.windowBounds = win.getBounds(); saveSettings(s); }
});

// ── IPC: Panel Open ──
ipcMain.on('show-panel', (_, currentState) => {
  showPanel(currentState);
});

// ── IPC: Panel → Clock (forwarding changes) ──
ipcMain.on('panel-set-style', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-style', v); });
ipcMain.on('panel-set-theme', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-theme', v); });
ipcMain.on('panel-set-hands', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-hands', v); });
ipcMain.on('panel-set-opacity', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-opacity', v); });
ipcMain.on('panel-set-sessions', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-sessions', v); });
ipcMain.on('panel-set-block-opacity', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-block-opacity', v); });
ipcMain.on('panel-set-block-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-block-anim', v); });
ipcMain.on('panel-set-tooltip-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-tooltip-anim', v); });
ipcMain.on('panel-set-tooltip-size', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-tooltip-size', v); });
ipcMain.on('panel-focus-time', (_, data) => { if (win && !win.isDestroyed()) win.webContents.send('focus-time', data); });
ipcMain.on('panel-blur-time', () => { if (win && !win.isDestroyed()) win.webContents.send('blur-time'); });
ipcMain.on('clock-update-time', (_, data) => { if (panel && !panel.isDestroyed()) panel.webContents.send('update-time', data); });
ipcMain.on('panel-set-ontop', (_, v) => { if (win) win.setAlwaysOnTop(v); });
ipcMain.on('panel-close', () => { if (panel && !panel.isDestroyed()) panel.close(); });
ipcMain.on('close-app', () => app.quit());

// ── IPC: Settings Persistence ──
ipcMain.on('save-settings', (_, data) => { const s = loadSettings(); Object.assign(s, data); saveSettings(s); });
ipcMain.on('load-settings', (event) => { event.returnValue = loadSettings(); });

app.whenReady().then(() => {
  pruneLegacySettings();
  createWindow();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
