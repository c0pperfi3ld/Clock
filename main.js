const { app, BrowserWindow, ipcMain, screen, Notification } = require('electron');
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

function createWindow() {
  const settings = loadSettings();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const size = 320;
  const bounds = settings.windowBounds || { x: sw - size - 40, y: 40, width: size, height: size };

  win = new BrowserWindow({
    x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
    minWidth: 120, minHeight: 120, frame: false, transparent: true,
    alwaysOnTop: true, resizable: true, skipTaskbar: false, hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setAspectRatio(1);
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
ipcMain.on('panel-set-reminders', (_, v) => {
  const s = loadSettings();
  s.reminders = v;
  saveSettings(s);
});
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
  createWindow();
  startReminderScheduler();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Reminder Scheduler ──
let reminderInterval = null;
function startReminderScheduler() {
  if (Notification.isSupported()) {
    try { new Notification({ title: 'ChronoCore', body: 'Reminders armed.' }).show(); } catch (e) {}
  }
  if (reminderInterval) clearInterval(reminderInterval);
  // Check every 15s — minute resolution is enough for HH:MM
  reminderInterval = setInterval(checkReminders, 15 * 1000);
  // Also run once after a short delay so the boot notification isn't immediately followed by stale fires
  setTimeout(checkReminders, 5000);
}

function checkReminders() {
  const s = loadSettings();
  const reminders = Array.isArray(s.reminders) ? s.reminders : [];
  if (reminders.length === 0) return;

  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const cur = `${hh}:${mm}`;
  const todayKey = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`;

  let dirty = false;
  for (const r of reminders) {
    if (!r || !r.time) continue;
    if (r.time !== cur) continue;
    if (r.lastFiredDate === todayKey) continue; // already fired today
    // FIRE
    r.lastFiredDate = todayKey;
    dirty = true;
    const label = r.label || 'Reminder';
    // OS notification
    if (Notification.isSupported()) {
      try {
        new Notification({
          title: '⏰ ChronoCore',
          body: label,
          silent: false
        }).show();
      } catch (e) {}
    }
    // Visual alert on clock face
    if (win && !win.isDestroyed()) {
      win.webContents.send('reminder-fired', { id: r.id, label, time: r.time });
    }
    // Recurring=false → schedule for removal after a short delay (let user see it in panel first)
    if (!r.recurring) {
      r.removeAfter = Date.now() + 60 * 1000; // remove in 60s
    }
  }

  // Cleanup expired one-time reminders
  const stillValid = reminders.filter(r => !r.removeAfter || r.removeAfter > Date.now());
  if (stillValid.length !== reminders.length) dirty = true;
  if (dirty) { s.reminders = stillValid; saveSettings(s); }
}
