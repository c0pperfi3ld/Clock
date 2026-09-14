const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null, panel = null, panelReady = false;
const SETTINGS_PATH = path.join(app.getPath('userData'), 'clock-settings.json');
let settingsCache = null;
let settingsSaveTimer = null;

function loadSettings() {
  if (settingsCache) return settingsCache;
  try { settingsCache = fs.existsSync(SETTINGS_PATH) ? JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8')) : {}; }
  catch (_) { settingsCache = {}; }
  return settingsCache;
}
function flushSettings() {
  if (settingsSaveTimer) { clearTimeout(settingsSaveTimer); settingsSaveTimer = null; }
  if (!settingsCache) return;
  try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settingsCache, null, 2), 'utf-8'); } catch (_) {}
}
function saveSettings(data, immediate = false) {
  settingsCache = data;
  if (immediate) { flushSettings(); return; }
  if (!settingsSaveTimer) settingsSaveTimer = setTimeout(flushSettings, 300);
}
// Migration: drop any legacy reminder data from the settings file
function pruneLegacySettings() {
  const s = loadSettings();
  let changed = false;
  if ('reminders' in s) { delete s.reminders; changed = true; }
  if ('viewMode' in s) { delete s.viewMode; changed = true; }
  if ('windowBoundsBoard' in s) { delete s.windowBoundsBoard; changed = true; }
  if (changed) saveSettings(s);
}

function createWindow() {
  const settings = loadSettings();
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const defaultH = 700;
  // Cap the todo width so the window always fits the screen — otherwise the
  // saved panel width can push the right edge off the display and the user
  // loses the rightmost todos to the screen border.
  const clockMin = 380;
  const maxTodoW = Math.max(180, sw - clockMin - 40);
  let savedTodoW = (settings.todoPanelWidth > 0) ? settings.todoPanelWidth : 260;
  if (savedTodoW > maxTodoW) savedTodoW = maxTodoW;
  const defaultW = 430 + savedTodoW; // clock (430) + todo sidebar + label headroom
  // Migration: ignore saved bounds that look like the old square (1:1) layout
  // or are too small for the new clock+sidebar layout.
  function pickBounds(key, fbW, fbH) {
    let bounds = settings[key] || (key !== 'windowBounds' ? settings.windowBounds : null);
    const looksLegacy = bounds && (
      Math.abs(bounds.width - bounds.height) < 20 || // square (old 1:1 lock)
      bounds.width < 320 ||
      bounds.height < 220
    );
    if (!bounds || looksLegacy) {
      bounds = { x: sw - fbW - 40, y: 40, width: fbW, height: fbH };
    }
    // Shrink absurdly wide windows: content is exactly clock-square + todo,
    // so anything wider than height + todo is dead space. (One-time repair
    // for widths saved before the todo-width sync existed.)
    const maxW = bounds.height + savedTodoW;
    if (bounds.width > maxW + 2) {
      bounds = { x: bounds.x, y: bounds.y, width: Math.round(maxW), height: bounds.height };
    }
    // Keep the window inside the screen work area — a saved x/width combo
    // can otherwise park the right edge past the display, clipping todos.
    if (bounds.x + bounds.width > sw - 8) {
      bounds.width = Math.max(420, sw - 8 - bounds.x);
    }
    if (bounds.x < 8) bounds.x = 8;
    return bounds;
  }
  const bounds = pickBounds('windowBoundsClock', defaultW, defaultH);

  // Tighten overly-wide windows saved before the fix so there is no blank
  // strip on either side — content is exactly clock-square + todo.
  (() => {
    const tightW = Math.round(Math.min(bounds.width, bounds.height + savedTodoW));
    if (bounds.width > tightW + 2 && tightW >= 460) { bounds.width = tightW; }
  })();

  win = new BrowserWindow({
        x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
        frame: false, transparent: true,
        title: '', autoHideMenuBar: true, show: false,
        alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
        backgroundColor: '#00000000',
        resizable: false,
        webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
      });
  // Never flash a white/empty native window: show only once first paint is ready.
  win.once('ready-to-show', () => { if (win && !win.isDestroyed()) win.show(); });
  // Fallback: never leave the window hidden if ready-to-show is ever delayed.
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }, 2000);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setMenuBarVisibility(false);
  win.removeMenu();
  // No aspect-ratio lock: clock stays square on the left, todo panel fills the rest
  win.loadFile('index.html');
  let resizeNotifyTimer = null;
  win.on('resize', () => {
    if (resizeNotifyTimer) return;
    resizeNotifyTimer = setTimeout(() => {
      resizeNotifyTimer = null;
      if (win && !win.isDestroyed()) win.webContents.send('window-resized', {});
    }, 50);
  });
  win.on('moved', () => { saveCurrentBounds(); });
  win.on('closed', () => { win = null; if (panel && !panel.isDestroyed()) panel.close(); });
  applyOnTop(); // enforce topmost level (creation flag alone is droppable on Win)
  // Removed win.on('blur') as re-asserting alwaysOnTop on blur triggers DWM white borders
}

let onTopWanted = true;
// Single clock view — one bounds slot.
function boundsKey() { return 'windowBoundsClock'; }
function saveCurrentBounds() {
  if (!win || win.isDestroyed()) return;
  const s = loadSettings();
  const b = win.getBounds();
  s[boundsKey()] = b;
  s.windowBounds = b; // legacy compat
  saveSettings(s);
}
function applyOnTop() {
  if (win && !win.isDestroyed()) {
    try { win.setAlwaysOnTop(onTopWanted, 'pop-up-menu'); } catch (_) {}
  }
  if (panel && !panel.isDestroyed()) {
    try { panel.setAlwaysOnTop(true, 'pop-up-menu'); } catch (_) {}
  }
}

function showPanel(currentState) {
  if (panel && !panel.isDestroyed()) {
    panel.webContents.send('update-state', currentState);
    // If the panel hasn't painted yet, the ready-to-show handler below will
    // reveal it — never force-show a blank white window.
    try { if (panelReady || panel.isVisible()) panel.show(); } catch (_) {}
    try { panel.focus(); } catch (_) {}
    return;
  }

  const settings = loadSettings();
  let pw = 330, ph = 620;
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
        frame: false, transparent: true, alwaysOnTop: true,
        title: '', autoHideMenuBar: true, show: false,
        skipTaskbar: true, hasShadow: false,
        backgroundColor: '#00000000',
        resizable: false,
        webPreferences: { preload: path.join(__dirname, 'preload_panel.js'), contextIsolation: true, nodeIntegration: false }
      });
  panel.setMenuBarVisibility(false);
  panel.loadFile('panel.html');
  panel.webContents.on('did-finish-load', () => {
    panel.webContents.send('update-state', currentState);
  });
  // Same no-white-flash rule as the main window.
  panel.once('ready-to-show', () => { panelReady = true; if (panel && !panel.isDestroyed()) panel.show(); });

  const savePanelBounds = () => {
    if (panel && !panel.isDestroyed()) {
      const s = loadSettings();
      s.panelBounds = panel.getBounds();
      saveSettings(s);
    }
  };

  panel.on('resize', savePanelBounds);
  panel.on('moved', savePanelBounds);

  panel.on('closed', () => { panel = null; panelReady = false; });
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
  saveCurrentBounds();
});

// ── IPC: Window-edge resize (8 edges/corners) ──
let appResizeStart = null;
let appResizeEdge = null; // 'n','s','w','e','nw','ne','sw','se'
ipcMain.on('resize-start', (_, edge) => {
  if (!win) return;
  appResizeEdge = edge || null;
  win.setResizable(true);
  const cursor = screen.getCursorScreenPoint();
  const b = win.getBounds();
  appResizeStart = { sx: cursor.x, sy: cursor.y, x: b.x, y: b.y, w: b.width, h: b.height };
});
ipcMain.on('resize-move', () => {
  if (!win || !appResizeStart) return;
  const cursor = screen.getCursorScreenPoint();
  const dx = cursor.x - appResizeStart.sx;
  const dy = cursor.y - appResizeStart.sy;
  let nx = appResizeStart.x;
  let ny = appResizeStart.y;
  let nw = appResizeStart.w;
  let nh = appResizeStart.h;
  if (appResizeEdge.includes('n')) {
    ny += dy;
    nh -= dy;
  }
  if (appResizeEdge.includes('s')) {
    nh += dy;
  }
  if (appResizeEdge.includes('w')) {
    nx += dx;
    nw -= dx;
  }
  if (appResizeEdge.includes('e')) {
    nw += dx;
  }
  // Apply minimum sizes
  nw = Math.max(380, nw);
  nh = Math.max(260, nh);
  // Apply screen bounds
  const display = screen.getDisplayNearestPoint({ x: nx, y: ny });
  const wa = display.workArea;
  if (nx < wa.x) nx = wa.x;
  if (ny < wa.y) ny = wa.y;
  if (nx + nw > wa.x + wa.width) nw = wa.width - (nx - wa.x);
  if (ny + nh > wa.y + wa.height) nh = wa.height - (ny - wa.y);
  win.setBounds({ x: Math.round(nx), y: Math.round(ny), width: Math.round(nw), height: Math.round(nh) });
});
ipcMain.on('resize-end', () => {
  win.setResizable(false);
  saveCurrentBounds();
  appResizeStart = null;
});

// ── IPC: Todo-list-only resize (width). Resizes the todo panel itself,
// NOT the window — renderer updates --todo-panel-width live, main just
// persists. Window stays put so the clock shrinks/grows inside the same frame.
let todoResizeStart = null;
ipcMain.on('todo-resize-start', () => {
  todoResizeStart = {};
});
ipcMain.on('todo-resize-move', (_, d) => {
  if (d && typeof d.todoWidth === 'number' && d.todoWidth > 0) {
    const s0 = loadSettings();
    // Hard cap at the screen work area so dragging wider never pushes the
    // window's right edge off the display (would clip todos at the border).
    const cur = win && !win.isDestroyed() ? win.getBounds() : null;
    const wa = cur ? screen.getDisplayNearestPoint({ x: cur.x, y: cur.y }).workArea : null;
    const maxByScreen = wa ? Math.max(180, wa.width - cur.x - 40 - 380) : 640;
    s0.todoPanelWidth = Math.max(180, Math.min(Math.min(640, maxByScreen), Math.round(d.todoWidth)));
    saveSettings(s0);
  }
});
ipcMain.on('todo-resize-end', () => {
  todoResizeStart = null;
  // Width already persisted; bounds stay fresh without growing window.
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
ipcMain.on('panel-set-bg-alpha', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-bg-alpha', v); });
ipcMain.on('panel-set-clock-scale', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-clock-scale', v); });
ipcMain.on('panel-set-app-padding', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-app-padding', v); });
ipcMain.on('panel-set-pct-offset', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-pct-offset', v); });
ipcMain.on('panel-set-app-border-w', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-app-border-w', v); });
ipcMain.on('panel-set-app-border-r', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-app-border-r', v); });
ipcMain.on('panel-set-app-border-c', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-app-border-c', v); });
ipcMain.on('panel-set-app-border-a', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-app-border-a', v); });
ipcMain.on('panel-set-border-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-border-anim', v); });
ipcMain.on('panel-set-border-anim-speed', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-border-anim-speed', v); });
// Shine animation
ipcMain.on('panel-set-shine-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-anim', v); });
ipcMain.on('panel-set-shine-speed', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-speed', v); });
ipcMain.on('panel-set-shine-angle', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-angle', v); });
ipcMain.on('panel-set-shine-width', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-width', v); });
ipcMain.on('panel-set-shine-opacity', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-opacity', v); });
ipcMain.on('panel-set-shine-color', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-color', v); });
ipcMain.on('panel-set-shine-border-opacity', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-border-opacity', v); });
ipcMain.on('panel-set-shine-easing', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-easing', v); });
ipcMain.on('panel-set-shine-delay', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-delay', v); });
ipcMain.on('panel-set-shine-direction', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-direction', v); });
ipcMain.on('panel-set-shine-fade', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-fade', v); });
ipcMain.on('panel-set-shine-repeat', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-shine-repeat', v); });
ipcMain.on('panel-set-sessions', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-sessions', v); });
ipcMain.on('panel-set-block-opacity', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-block-opacity', v); });
ipcMain.on('panel-set-block-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-block-anim', v); });
ipcMain.on('panel-set-tooltip-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-tooltip-anim', v); });
ipcMain.on('panel-set-tooltip-size', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-tooltip-size', v); });
ipcMain.on('panel-set-orbit-speed', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-orbit-speed', v); });
ipcMain.on('panel-set-orbit-style', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-orbit-style', v); });
ipcMain.on('panel-set-todo-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-todo-anim', v); });
ipcMain.on('panel-set-window-fit', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-window-fit', v); });
ipcMain.on('panel-set-title-gap', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-title-gap', v); });
ipcMain.on('panel-set-favorites', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-favorites', v); });
ipcMain.on('panel-set-todo-opacity', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-todo-opacity', v); });
ipcMain.on('panel-set-todo-box-opaque', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-todo-box-opaque', v); });
ipcMain.on('panel-set-todo-box-opacity', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-todo-box-opacity', v); });
ipcMain.on('panel-set-cal-anim', (_, v) => { if (win && !win.isDestroyed()) win.webContents.send('set-cal-anim', v); });
ipcMain.on('set-ignore-mouse', (_, b) => {
  if (win && !win.isDestroyed()) {
    try { win.setIgnoreMouseEvents(!!b, { forward: true }); } catch (_) {}
  }
});

// ── Window auto-fit: grow the window height so task labels never clip ──
// Grow-only (never auto-shrinks: restoring a smaller size would reintroduce
// the same overflow and oscillate). Shrink manually any time; the next
// overflow simply grows again. Capped to the display work area.
ipcMain.on('fit-window', (_, need) => {
  if (!win || win.isDestroyed()) return;
  const top = Math.max(0, Math.round((need && need.top) || 0));
  const bottom = Math.max(0, Math.round((need && need.bottom) || 0));
  if (top + bottom <= 0) return;
  const cur = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: cur.x, y: cur.y });
  const wa = display.workArea;
  const nh = Math.max(340, Math.min(cur.height + top + bottom + 4, wa.height));
  if (nh <= cur.height + 1) return; // already fits or no room left
  let ny = cur.y - top;
  if (ny < wa.y) ny = wa.y;
  if (ny + nh > wa.y + wa.height) ny = Math.max(wa.y, wa.y + wa.height - nh);
  const nb = { x: cur.x, y: Math.round(ny), width: cur.width, height: Math.round(nh) };
  win.setResizable(true);
  win.setBounds(nb);
  win.setResizable(false);
  saveCurrentBounds();
});
ipcMain.on('panel-focus-time', (_, data) => { if (win && !win.isDestroyed()) win.webContents.send('focus-time', data); });
ipcMain.on('panel-blur-time', () => { if (win && !win.isDestroyed()) win.webContents.send('blur-time'); });
ipcMain.on('clock-update-time', (_, data) => { if (panel && !panel.isDestroyed()) panel.webContents.send('update-time', data); });
ipcMain.on('panel-set-ontop', (_, v) => { onTopWanted = !!v; applyOnTop(); });
ipcMain.on('panel-close', () => { if (panel && !panel.isDestroyed()) panel.close(); });
ipcMain.on('close-app', () => app.quit());

// ── IPC: Settings Persistence ──
// Force IMMEDIATE flush on every save — the 300ms debounce was losing the
// user's last adjustment if they closed the panel (or worse, the app)
// within the window. Disk writes are cheap; lost settings are not.
ipcMain.on('save-settings', (_, data) => { const s = loadSettings(); Object.assign(s, data); saveSettings(s, true); });
ipcMain.on('load-settings', (event) => { event.returnValue = loadSettings(); });

app.whenReady().then(() => {
  pruneLegacySettings();
  createWindow();
});
// The renderer flushes its final debounced patch while its window closes, so
// write the cached aggregate at the last safe application lifecycle point.
app.on('will-quit', flushSettings);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
