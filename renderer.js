/**
 * Floating Clock Widget Engine v6
 * 52 Designs (13 Ghost/Floating, 25 With Dial, 14 Unique Motion)
 * 10 Hand Styles × 10 Color Themes
 * High-performance 60fps canvas renderer
 */
(() => {
  const api = window.clockAPI;
  const canvas = document.getElementById('clock');
  const X = canvas.getContext('2d');
  
  window.addEventListener('error', e => {
     api.saveSettings({ _lastError: new Date().toISOString() + ' | ' + (e.error ? e.error.stack : e.message) });
  });

  const PI2 = Math.PI * 2;
  const DEG2RAD = Math.PI / 180;

  const THEMES = {
    midnight:  { accent:'#8b5cf6', sec:'#ef4444', glow:'rgba(139,92,246,0.5)' },
    obsidian:  { accent:'#10b981', sec:'#38bdf8', glow:'rgba(16,185,129,0.5)' },
    charcoal:  { accent:'#38bdf8', sec:'#f43f5e', glow:'rgba(56,189,248,0.5)' },
    slate:     { accent:'#f59e0b', sec:'#10b981', glow:'rgba(245,158,11,0.5)' },
    eclipse:   { accent:'#ef4444', sec:'#fbbf24', glow:'rgba(239,68,68,0.5)' },
    void:      { accent:'#ec4899', sec:'#8b5cf6', glow:'rgba(236,72,153,0.5)' },
    graphite:  { accent:'#14b8a6', sec:'#f97316', glow:'rgba(20,184,166,0.5)' },
    onyx:      { accent:'#f97316', sec:'#06b6d4', glow:'rgba(249,115,22,0.5)' },
    shadow:    { accent:'#a855f7', sec:'#ec4899', glow:'rgba(168,85,247,0.5)' },
    abyss:     { accent:'#06b6d4', sec:'#10b981', glow:'rgba(6,182,212,0.5)' },
    glacier:   { accent:'#7dd3fc', sec:'#f8fafc', glow:'rgba(125,211,252,0.52)' },
    orchid:    { accent:'#d8b4fe', sec:'#fb7185', glow:'rgba(216,180,254,0.52)' },
    ember:     { accent:'#fb923c', sec:'#fef3c7', glow:'rgba(251,146,60,0.52)' },
    forest:    { accent:'#4ade80', sec:'#a7f3d0', glow:'rgba(74,222,128,0.52)' },
    solar:     { accent:'#facc15', sec:'#fb7185', glow:'rgba(250,204,21,0.52)' },
    ocean:     { accent:'#22d3ee', sec:'#818cf8', glow:'rgba(34,211,238,0.52)' }
  };

  let style='handsonly_ghost', theme='midnight', handType='tapered', opacity=100, sessions=[], blockOpacity=0.25;
  let blockAnim = { style: 'pulse', speed: 1.0 };
  let tooltipAnim = 'bounce';
  let tooltipSize = 1.0;
  let orbitSpeed = 1.0;
  let orbitStyle = 'dash';
  // Time allocations (sessions) master switch. Data is always preserved;
  // when false only rendering + creation/selection are gated off.
  const SESSIONS_ENABLED = true;
  // Keep task cards still by default. Motion remains available from the
  // customization panel, but a calm default is easier to scan and cheaper
  // to render when a list becomes long.
  let todoAnim = 'none';
  let titleGap = 1.0; // multiplier for title-to-ring distance
  let todoOpacity = 100; // todo panel opacity %; 0-100
  let favorites = { faces:[], hands:[], themes:[], blockFx:[], tooltipAnim:[], orbit:[], todoAnim:[] };
  let editingTaskIdx = -1; // task index within session for multi-task editing
  let windowFitAuto = true; // grow/shrink the window so labels never clip
  // Legacy entrance-only ids map to their nearest continuous loop.
  const TODO_ANIM_LEGACY = { slide:'tide-x', 'fade-up':'float', pop:'pulse', flip:'sway', bounce:'bob', 'swing-in':'wiggle', 'roll-in':'jelly' };
  function todoAnimEff() { return TODO_ANIM_LEGACY[todoAnim] || todoAnim || 'float'; }
  const saved = api.loadSettings();
  if (saved.favorites) favorites = Object.assign({}, favorites, saved.favorites);
  if (saved.clockStyle) style=saved.clockStyle;
  if (saved.theme) theme=saved.theme;
  if (saved.handType) handType=saved.handType;
  if (typeof saved.opacity==='number') opacity=saved.opacity;
  if (saved.sessions) sessions=saved.sessions;
  if (typeof saved.blockOpacity==='number') blockOpacity=saved.blockOpacity;
  if (saved.blockAnim) blockAnim=saved.blockAnim;
  if (saved.tooltipAnim) tooltipAnim=saved.tooltipAnim;
  if (saved.tooltipSize) tooltipSize=saved.tooltipSize;
  if (typeof saved.orbitSpeed==='number') orbitSpeed=saved.orbitSpeed;
  if (saved.orbitStyle) orbitStyle=saved.orbitStyle;
  if (saved.todoAnim) todoAnim=saved.todoAnim;
  if (typeof saved.windowFitAuto === 'boolean') windowFitAuto=saved.windowFitAuto;
  if (typeof saved.titleGap === 'number') titleGap=saved.titleGap;
  if (typeof saved.todoOpacity === 'number') todoOpacity = saved.todoOpacity;
  // ── Per-date todo workspaces ──
  // Each calendar date owns its own tab set: todosByDate[YYYY-MM-DD] = { lists, active }.
  // todoLists / activeTodoList / todos stay live aliases of the SELECTED date's
  // workspace so all existing todo code works untouched.
  function dateKeyOf(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function normalizeLists(raw, fb) {
    if (Array.isArray(raw) && raw.length) {
      return raw.map((l, i) => ({
        id: l.id || ('list-' + (i + 1)),
        name: l.name || ('List ' + (i + 1)),
        todos: Array.isArray(l.todos) ? l.todos : []
      }));
    }
    return fb;
  }
  const TODAY_KEY = dateKeyOf(new Date());
  let todosByDate = {};
  let selectedTodoDate = TODAY_KEY;
  let todoCalOpen = false;
  if (saved.todosByDate && typeof saved.todosByDate === 'object') {
    Object.keys(saved.todosByDate).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      const ws = saved.todosByDate[k] || {};
      todosByDate[k] = {
        lists: normalizeLists(ws.lists, [{ id: 'list-1', name: 'List 1', todos: [] }]),
        active: (typeof ws.active === 'number' && ws.active >= 0) ? ws.active : 0
      };
      if (!todosByDate[k].lists[todosByDate[k].active]) todosByDate[k].active = 0;
    });
  }
  if (typeof saved.selectedTodoDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.selectedTodoDate)) {
    selectedTodoDate = saved.selectedTodoDate;
  }
  if (typeof saved.todoCalOpen === 'boolean') todoCalOpen = saved.todoCalOpen;
  if (!todosByDate[selectedTodoDate]) {
    // Legacy migration: pre-date single tab set becomes today's workspace.
    let legacy = normalizeLists(saved.todoLists, null);
    if (!legacy) legacy = [{ id: 'list-1', name: 'List 1', todos: (saved.todos || []) }];
    let legacyActive = (typeof saved.activeTodoList === 'number' && legacy[saved.activeTodoList]) ? saved.activeTodoList : 0;
    todosByDate[selectedTodoDate] = { lists: legacy, active: legacyActive };
  }
  let todoLists = todosByDate[selectedTodoDate].lists;
  let activeTodoList = todosByDate[selectedTodoDate].active;
  let todos = todoLists[activeTodoList].todos; // alias for the ACTIVE list's array
  function syncDateAliases() {
    todoLists = todosByDate[selectedTodoDate].lists;
    activeTodoList = todosByDate[selectedTodoDate].active;
    todos = todoLists[activeTodoList].todos;
  }
  function dateTodoCount(k) {
    const ws = todosByDate[k];
    if (!ws) return 0;
    return ws.lists.reduce((n, l) => n + l.todos.length +
      l.todos.reduce((m, t) => m + (Array.isArray(t.subtasks) ? t.subtasks.length : 0), 0), 0);
  }
  // ── Per-date time blocks: sessions stays a live alias of the SELECTED date ──
  let sessionsByDate = {};
  if (saved.sessionsByDate && typeof saved.sessionsByDate === 'object') {
    Object.keys(saved.sessionsByDate).forEach(k => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(saved.sessionsByDate[k])) sessionsByDate[k] = saved.sessionsByDate[k];
    });
  }
  if (!sessionsByDate[selectedTodoDate]) sessionsByDate[selectedTodoDate] = sessions; // legacy global → selected date
  sessions = sessionsByDate[selectedTodoDate];
  function syncSessionAlias() { sessions = sessionsByDate[selectedTodoDate]; }
  function setSessions(arr) { sessions = arr; sessionsByDate[selectedTodoDate] = arr; }
  let todoBoxOpaque = !!saved.todoBoxOpaque;
  let todoBoxOpacity = 100; // task-card transparency %; multiplies weight-tint alphas
  if (typeof saved.todoBoxOpacity === 'number') todoBoxOpacity = saved.todoBoxOpacity;
  let calAnim = 'pop'; // calendar entrance animation (unique to the mini calendar)
  if (typeof saved.calAnim === 'string') calAnim = saved.calAnim;
  // Derive a muted darker variant of an #rrggbb color (for elapsed wedges).
  function deriveElapsedColor(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim());
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    let r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    const l2 = Math.max(0.15, l - 0.35);          // much darker
    const s2 = Math.min(1, Math.max(0.15, s * 0.40)); // much more desaturated
    const f = k => {
      const kk = (k + h / 30) % 12;
      const a = s2 * Math.min(l2, 1 - l2);
      const c = l2 - a * Math.max(Math.min(kk - 3, 9 - kk, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  // Normalize session tasks: single string → array
  function genId(p) { return (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function normalizeSessions() {
    sessions.forEach(s => {
      if (!s) return;
      if (!s.id) s.id = genId('s'); // stable id for todo linking
      if (!Array.isArray(s.tasks)) {
        s.tasks = (s.task && typeof s.task === 'string') ? [s.task] : [];
      }
      delete s.task;
      // Guarantee remaining ≠ elapsed color from the start (legacy sessions
      // predate elapsedColor — backfill a muted darker tone of the same hue).
      if (s.color && !s.elapsedColor) s.elapsedColor = deriveElapsedColor(s.color);
    });
  }
  normalizeSessions();
  // Debounced settings writer: sliders/keystrokes queue patches, one
  // synchronous file write per 300ms burst. Flushed on unload so quit
  // never loses the trailing edge.
  let savePending = null, saveTimer = null;
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (savePending) { try { api.saveSettings(savePending); } catch (_) {} savePending = null; }
  }
  function queueSave(patch) {
    if (!savePending) savePending = {};
    Object.assign(savePending, patch);
    if (!saveTimer) saveTimer = setTimeout(flushSave, 300);
  }
  function saveTodos() { queueSave({ todosByDate, selectedTodoDate, todoCalOpen, todoLists, activeTodoList }); }
  // One-time switch: the outer arc defaults to flowing rainbow (user keeps control after).
  if (!saved.orbitFlowDefaulted) { orbitStyle = 'rainbow-flow'; queueSave({ orbitStyle, orbitFlowDefaulted: true }); }
  window.addEventListener('beforeunload', flushSave);

  function applyOpacity() { canvas.style.opacity=opacity/100; }
  function applyTodoOpacity() { const p = document.getElementById('todo-panel'); if (p) p.style.opacity = todoOpacity / 100; }
  function applyTodoBoxOpaque() { const p = document.getElementById('todo-panel'); if (p) p.dataset.boxOpaque = todoBoxOpaque ? '1' : '0'; }
  applyTodoOpacity();
  applyTodoBoxOpaque();
  applyOpacity();
  function save() { queueSave({clockStyle:style,theme,handType,opacity,sessions,sessionsByDate,selectedTodoDate,blockOpacity,blockAnim,tooltipAnim,tooltipSize,orbitSpeed,orbitStyle,todoAnim,titleGap,windowFitAuto,favorites,todoOpacity,todoBoxOpaque,todoBoxOpacity,calAnim}); }
  api.onSetStyle(s => { style=s; save(); });
  api.onSetTheme(t => { theme=t; save(); });
  api.onSetOpacity(o => { opacity=o; applyOpacity(); save(); });
  api.onSetHands(h => { handType=h; save(); });
  api.onSetSessions(s => { setSessions(s); normalizeSessions(); pruneTodoLinks(); save(); });
  api.onSetBlockOpacity(o => { blockOpacity=o; save(); });
  api.onSetBlockAnim(a => { blockAnim=a; save(); });
  api.onSetTooltipAnim(a => { tooltipAnim=a; save(); });
  if (api.onSetTooltipSize) api.onSetTooltipSize(s => { tooltipSize=s; save(); });
  if (api.onSetOrbitSpeed) api.onSetOrbitSpeed(s => { orbitSpeed=s; save(); });
  if (api.onSetOrbitStyle) api.onSetOrbitStyle(s => { orbitStyle=s; save(); });
  if (api.onSetTodoAnim) api.onSetTodoAnim(s => { todoAnim=s; applyTodoAnim(); save(); });
  if (api.onSetWindowFit) api.onSetWindowFit(v => { windowFitAuto = !!v; save(); lastFitSent = { t: -1, b: -1 }; });
  if (api.onSetTitleGap) api.onSetTitleGap(v => { titleGap = v; save(); });
  if (api.onSetFavorites) api.onSetFavorites(f => { favorites = f || favorites; save(); });
  if (api.onSetTodoOpacity) api.onSetTodoOpacity(v => { todoOpacity = v; applyTodoOpacity(); save(); });
  if (api.onSetTodoBoxOpaque) api.onSetTodoBoxOpaque(v => { todoBoxOpaque = !!v; applyTodoBoxOpaque(); renderTodos(); save(); });
  if (api.onSetTodoBoxOpacity) api.onSetTodoBoxOpacity(v => { todoBoxOpacity = v; applyTodoBoxOpacity(); save(); });
  function applyCalAnim() {
    const cal = document.getElementById('todo-cal-wrap');
    if (cal) cal.dataset.calanim = calAnim || 'pop';
  }
  if (api.onSetCalAnim) api.onSetCalAnim(v => { calAnim = v || 'pop'; applyCalAnim(); save(); });

  // ── Tooltip font resize (Ctrl + scroll) / Orbit speed (Alt + scroll) ──
  let tooltipResizePulse = 0;
  let orbitSpeedPulse = 0;
  canvas.addEventListener('wheel', e => {
    if (e.altKey) {
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.1 : -0.1;
      orbitSpeed = Math.max(0, Math.min(10.0, Math.round(((orbitSpeed || 0) + step) * 10) / 10));
      save();
      orbitSpeedPulse = performance.now();
      return;
    }
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.1 : -0.1;
    tooltipSize = Math.max(0.3, Math.min(5.0, (tooltipSize || 1.0) + step));
    save();
    tooltipResizePulse = performance.now();
  }, { passive: false });

  const pWrapS = document.getElementById('picker-wrap-start');
  const pWrapE = document.getElementById('picker-wrap-end');
  const pInputS = document.getElementById('color-start');
  const pInputE = document.getElementById('color-end');

  // Sync color changes back to session
  if (pInputS) pInputS.addEventListener('input', e => {
     if (interactiveMode && interactiveMode.startsWith('edit-')) {
         const idx = parseInt(interactiveMode.split('-')[1]);
         if (sessions[idx]) {
            sessions[idx].color = e.target.value;
            save();
         }
     }
  });
  if (pInputE) pInputE.addEventListener('input', e => {
     if (interactiveMode && interactiveMode.startsWith('edit-')) {
         const idx = parseInt(interactiveMode.split('-')[1]);
         if (sessions[idx]) {
            sessions[idx].elapsedColor = e.target.value;
            save();
         }
     }
  });

  // Cached wrapper metrics — one layout read per resize, reused by every
  // frame instead of forcing reflow from the hot draw path.
  let wrapSize = { w: 300, h: 300 };
  function resize() {
    // Canvas fills the clock wrapper (left square area). The todo panel lives
    // in the right side of the window and is HTML-based, so it has its own
    // layout. The renderer only needs to track the wrapper's size.
    // A canvas above 2× has a steep fill-rate cost with little visible gain
    // for this small floating widget. Re-read on resize because DPI can change
    // when moving between monitors.
    // 1.5× keeps small text crisp while using ~44% less canvas memory than a
    // 2× backing store. This matters because transparent canvases are kept in
    // GPU memory for the widget's entire lifetime.
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const wrap = document.getElementById('clock-wrapper');
    const w = Math.max(80, wrap.clientWidth || 0);
    const h = Math.max(80, wrap.clientHeight || 0);
    wrapSize = { w, h };
    canvas.width = w*dpr; canvas.height = h*dpr;
    canvas.style.width = w+'px'; canvas.style.height = h+'px';
    X.setTransform(dpr,0,0,dpr,0,0);
    try { lastLabelSig = '__resize__'; } catch (_) {} // declared later; ignore TDZ on first run
  }
  resize();
  // Re-run after first paint to catch any post-layout sizing adjustments
  requestAnimationFrame(resize);
  window.addEventListener('resize', resize);
  api.onWindowResized(resize);

  // ── Clock dial bounds (cached, recomputed on resize) ──
  // All drawing uses the wrapper's center, NOT the window center.
  // ── Label orbit geometry (single source of truth) ──
  // Dial -> SIGNIFICANT BUFFER -> dotted orbit -> small gap -> ring text.
  // Glyphs are guaranteed strictly outside the dotted ring: the text circle
  // sits at orbitR + OUTER_GAP + half-height, so even full-swing motion
  // never crosses back inside the dotted line.
  const ORBIT_GAP = 42;   // significant distance buffer: dial edge -> dotted ring
  const OUTER_GAP_BASE = 20; // dotted ring -> text circle (covers motion offsets)
  function orbitRadius(r) { return r + ORBIT_GAP; }

  function applyTodoAnim() {
    const eff = todoAnimEff();
    const panel = document.getElementById('todo-panel');
    if (panel) panel.dataset.anim = eff;
    const cal = document.getElementById('todo-cal-wrap');
    if (cal) cal.dataset.anim = eff;
  }

  function clockBounds() {
    const w = wrapSize.w, h = wrapSize.h; // cached by resize()
    const cx = w/2, cy = h/2;
    // Room for: dotted orbit (42) + outer gap (20) + typical box half-size.
    // FIXED SIZE: the dial never shrinks, no matter how many labels exist.
    // Ring-text labels shrink their own font down to 8px to fit; the
    // window auto-fit grows the window instead of touching the dial.
    const margin = 70;
    const r = Math.max(50, Math.min(cx, cy) - margin);
    return { cx, cy, r, w, h };
  }

  function drawLabelOrbit(cx, cy, r) {
    const or = orbitRadius(r);
    // Clockwise rotation scaled by orbitSpeed. 1.0x ~= 20px/s. 0 = paused.
    const spd = (typeof orbitSpeed === 'number' ? orbitSpeed : 1.0);
    const nowMs = performance.now();
    const rot = (nowMs / 1000) * 20 * (spd * spd);
    const st = orbitStyle || 'dash';
    X.save();
    if (st === 'double') {
      // Two counter-rotating dashed rings straddling the orbit radius.
      for (const [off, dash, col, lw, dir] of [
        [-9, [10, 7], 'rgba(148,210,185,0.65)', 1.5, -1],
        [9, [4, 6], 'rgba(139,92,246,0.55)', 1.2, 1],
      ]) {
        X.beginPath();
        X.arc(cx, cy, or + off, 0, PI2);
        X.setLineDash(dash);
        try { X.lineDashOffset = dir * rot; } catch (_) {}
        X.strokeStyle = col;
        X.lineWidth = lw;
        X.stroke();
      }
      X.setLineDash([]);
    } else if (st === 'glow') {
      // Solid softly-pulsing glow ring (no dashes; pulse rate follows speed).
      const pulse = 0.45 + 0.25 * Math.sin((nowMs / 1000) * (1 + spd * 1.5) * Math.PI * 2 * 0.5);
      X.beginPath();
      X.arc(cx, cy, or, 0, PI2);
      X.strokeStyle = `rgba(148,210,185,${pulse.toFixed(3)})`;
      X.lineWidth = 2;
      try { X.shadowColor = 'rgba(148,210,185,0.7)'; X.shadowBlur = 10 + 6 * spd; } catch (_) {}
      X.stroke();
      try { X.shadowBlur = 0; } catch (_) {}
    } else if (st === 'rainbow-flow') {
      // Single arc line, rainbow gradient flowing start -> end around the dial.
      const segs = 72;
      const flow = (nowMs / 1000) * (40 + 80 * spd); // hue drift deg/s
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * PI2;
        const a1 = ((i + 1.02) / segs) * PI2;
        const hue = (((i / segs) * 360 + flow) % 360 + 360) % 360;
        X.beginPath();
        X.arc(cx, cy, or, a0, a1);
        X.strokeStyle = `hsl(${hue.toFixed(1)}, 90%, 60%)`;
        X.lineWidth = 2.5;
        X.stroke();
      }
    } else if (st === 'comet') {
      // Faint full ring + bright comet arc sweeping clockwise.
      X.beginPath();
      X.arc(cx, cy, or, 0, PI2);
      X.setLineDash([]);
      X.strokeStyle = 'rgba(148,210,185,0.22)';
      X.lineWidth = 1.5;
      X.stroke();
      const head = rot / or; // clockwise head angle
      const tail = head - Math.PI * 0.45;
      X.beginPath();
      X.arc(cx, cy, or, tail, head);
      X.strokeStyle = 'rgba(148,210,185,0.95)';
      X.lineWidth = 3;
      X.lineCap = 'round';
      try { X.shadowColor = 'rgba(148,210,185,0.9)'; X.shadowBlur = 12; } catch (_) {}
      X.stroke();
      try { X.shadowBlur = 0; } catch (_) {}
      // Comet head dot
      X.beginPath();
      X.arc(cx + Math.cos(head) * or, cy + Math.sin(head) * or, 3.2, 0, PI2);
      X.fillStyle = '#a7f3d0';
      X.fill();
    } else if (st === 'rainbow') {
      // Rotating rainbow segments sweeping clockwise.
      const segs = 24;
      const base = rot / or;
      for (let i = 0; i < segs; i++) {
        const a0 = base + (i / segs) * PI2;
        const a1 = base + ((i + 0.82) / segs) * PI2;
        X.beginPath();
        X.arc(cx, cy, or, a0, a1);
        X.strokeStyle = `hsla(${(i * 15 + nowMs / 40) % 360},90%,65%,0.8)`;
        X.lineWidth = 2.5;
        X.stroke();
      }
    } else if (st === 'sparkle') {
      // Faint ring + sparkling dots travelling clockwise.
      X.beginPath();
      X.arc(cx, cy, or, 0, PI2);
      X.setLineDash([3, 9]);
      try { X.lineDashOffset = -rot; } catch (_) {}
      X.strokeStyle = 'rgba(148,210,185,0.3)';
      X.lineWidth = 1.2;
      X.stroke();
      X.setLineDash([]);
      const n = 8;
      const head = rot / or;
      for (let i = 0; i < n; i++) {
        const a = head - (i / n) * PI2;
        const tw = 0.5 + 0.5 * Math.sin(nowMs / 180 + i * 1.7);
        X.beginPath();
        X.arc(cx + Math.cos(a) * or, cy + Math.sin(a) * or, 1 + 2.4 * tw, 0, PI2);
        X.fillStyle = `rgba(167,243,208,${(0.25 + 0.75 * tw).toFixed(3)})`;
        try { X.shadowColor = 'rgba(167,243,208,0.9)'; X.shadowBlur = 8 * tw; } catch (_) {}
        X.fill();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (st === 'tide') {
      // Breathing double dashed ring (in/out tide, drift follows speed).
      const tide = Math.sin((nowMs / 1000) * (0.6 + spd * 0.8) * Math.PI) * 5;
      for (const [off, dash, col] of [[-4 + tide, [12, 8], 'rgba(148,210,185,0.6)'], [6 - tide, [5, 7], 'rgba(139,92,246,0.5)']]) {
        X.beginPath();
        X.arc(cx, cy, or + off, 0, PI2);
        X.setLineDash(dash);
        try { X.lineDashOffset = -rot; } catch (_) {}
        X.strokeStyle = col;
        X.lineWidth = 1.4;
        X.stroke();
      }
      X.setLineDash([]);
    } else if (st === 'cyber-scan') {
      // High-tech cyber radar sweep with reticle tick marks
      X.beginPath();
      X.arc(cx, cy, or - 6, 0, PI2);
      X.strokeStyle = 'rgba(56,189,248,0.2)';
      X.lineWidth = 1;
      X.stroke();
      X.beginPath();
      X.arc(cx, cy, or + 6, 0, PI2);
      X.strokeStyle = 'rgba(56,189,248,0.2)';
      X.lineWidth = 1;
      X.stroke();
      const baseA = rot / or;
      for (let i = 0; i < 4; i++) {
        const a = baseA + (i * Math.PI * 0.5);
        const cosA = Math.cos(a), sinA = Math.sin(a);
        X.beginPath();
        X.moveTo(cx + cosA * (or - 8), cy + sinA * (or - 8));
        X.lineTo(cx + cosA * (or + 8), cy + sinA * (or + 8));
        X.strokeStyle = 'rgba(56,189,248,0.7)';
        X.lineWidth = 1.5;
        X.stroke();
      }
      const sweepLen = 0.65;
      const head = baseA;
      const tail = head - sweepLen;
      X.beginPath();
      X.arc(cx, cy, or, tail, head);
      X.strokeStyle = 'rgba(56,189,248,0.9)';
      X.lineWidth = 3.5;
      X.lineCap = 'round';
      try { X.shadowColor = '#38bdf8'; X.shadowBlur = 10; } catch (_) {}
      X.stroke();
      try { X.shadowBlur = 0; } catch (_) {}
      X.beginPath();
      X.arc(cx + Math.cos(head) * or, cy + Math.sin(head) * or, 3, 0, PI2);
      X.fillStyle = '#e0f2fe';
      X.fill();
    } else if (st === 'particles') {
      // Cosmic swarm of orbiting starlight particles
      X.beginPath();
      X.arc(cx, cy, or, 0, PI2);
      X.setLineDash([2, 10]);
      try { X.lineDashOffset = -rot * 0.5; } catch (_) {}
      X.strokeStyle = 'rgba(167,139,250,0.2)';
      X.lineWidth = 1;
      X.stroke();
      X.setLineDash([]);
      const count = 18;
      const baseA = (rot * 0.7) / or;
      for (let i = 0; i < count; i++) {
        const a = baseA + (i / count) * PI2;
        const radWobble = or + Math.sin(nowMs / 500 + i * 1.4) * 6;
        const pSize = 1.2 + 1.6 * (0.5 + 0.5 * Math.sin(nowMs / 300 + i * 2));
        const px = cx + Math.cos(a) * radWobble;
        const py = cy + Math.sin(a) * radWobble;
        const col = i % 3 === 0 ? '#38bdf8' : (i % 3 === 1 ? '#c084fc' : '#34d399');
        X.beginPath();
        X.arc(px, py, pSize, 0, PI2);
        X.fillStyle = col;
        try { X.shadowColor = col; X.shadowBlur = 6; } catch (_) {}
        X.fill();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (st === 'pulse-wave') {
      // Concentric ripple waves pulsating outward from dial
      const speedFactor = 0.6 + spd * 0.5;
      const phase = ((nowMs / 1000) * speedFactor) % 1;
      const waves = 3;
      for (let k = 0; k < waves; k++) {
        const p = (phase + k / waves) % 1;
        const ripR = or - 10 + p * 22;
        const alpha = (1 - p) * 0.75;
        X.beginPath();
        X.arc(cx, cy, ripR, 0, PI2);
        X.strokeStyle = `rgba(148,210,185,${alpha.toFixed(3)})`;
        X.lineWidth = 1.6 * (1 - p * 0.4);
        try { X.shadowColor = 'rgba(148,210,185,0.6)'; X.shadowBlur = 6 * (1 - p); } catch (_) {}
        X.stroke();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (st === 'quantum') {
      // High-energy quantum electric arc plasma ring
      const pts = 28;
      const tSec = nowMs / 1000;
      X.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * PI2 + rot / or;
        const jitter = Math.sin(i * 9 + tSec * 16) * 4.5 + Math.cos(i * 5 - tSec * 22) * 2;
        const qx = cx + Math.cos(a) * (or + jitter);
        const qy = cy + Math.sin(a) * (or + jitter);
        if (i === 0) X.moveTo(qx, qy); else X.lineTo(qx, qy);
      }
      X.closePath();
      X.strokeStyle = 'rgba(56,189,248,0.85)';
      X.lineWidth = 1.8;
      try { X.shadowColor = '#06b6d4'; X.shadowBlur = 10; } catch (_) {}
      X.stroke();
      X.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * PI2 - rot / or;
        const jitter = Math.sin(i * 7 - tSec * 14) * 3;
        const qx = cx + Math.cos(a) * (or - 4 + jitter);
        const qy = cy + Math.sin(a) * (or - 4 + jitter);
        if (i === 0) X.moveTo(qx, qy); else X.lineTo(qx, qy);
      }
      X.closePath();
      X.strokeStyle = 'rgba(192,132,252,0.65)';
      X.lineWidth = 1.2;
      try { X.shadowColor = '#c084fc'; X.shadowBlur = 8; } catch (_) {}
      X.stroke();
      try { X.shadowBlur = 0; } catch (_) {}
    } else if (st === 'vortex') {
      // Logarithmic spiral vortex filaments
      const arms = 8;
      const baseA = (rot * 1.5) / or;
      for (let k = 0; k < arms; k++) {
        const armA = baseA + (k / arms) * PI2;
        X.beginPath();
        for (let step = 0; step <= 10; step++) {
          const frac = step / 10;
          const currR = or - 12 + frac * 24;
          const currA = armA + frac * 0.45;
          const vx = cx + Math.cos(currA) * currR;
          const vy = cy + Math.sin(currA) * currR;
          if (step === 0) X.moveTo(vx, vy); else X.lineTo(vx, vy);
        }
        X.strokeStyle = `hsla(${(k * 45 + nowMs / 30) % 360}, 85%, 65%, 0.75)`;
        X.lineWidth = 1.8;
        try { X.shadowColor = 'rgba(255,255,255,0.4)'; X.shadowBlur = 4; } catch (_) {}
        X.stroke();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (st === 'gear-teeth') {
      // Precision mechanical gear cog ring
      const teeth = 32;
      const baseA = rot / or;
      X.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a0 = baseA + (i / teeth) * PI2;
        const a1 = baseA + ((i + 0.35) / teeth) * PI2;
        const a2 = baseA + ((i + 0.65) / teeth) * PI2;
        const a3 = baseA + ((i + 1.0) / teeth) * PI2;
        const rIn = or - 3.5, rOut = or + 3.5;
        if (i === 0) X.moveTo(cx + Math.cos(a0) * rIn, cy + Math.sin(a0) * rIn);
        X.lineTo(cx + Math.cos(a1) * rIn, cy + Math.sin(a1) * rIn);
        X.lineTo(cx + Math.cos(a1) * rOut, cy + Math.sin(a1) * rOut);
        X.lineTo(cx + Math.cos(a2) * rOut, cy + Math.sin(a2) * rOut);
        X.lineTo(cx + Math.cos(a2) * rIn, cy + Math.sin(a2) * rIn);
        X.lineTo(cx + Math.cos(a3) * rIn, cy + Math.sin(a3) * rIn);
      }
      X.closePath();
      X.strokeStyle = 'rgba(245,158,11,0.85)';
      X.lineWidth = 1.5;
      X.stroke();
      X.beginPath();
      X.arc(cx, cy, or - 8, 0, PI2);
      X.strokeStyle = 'rgba(245,158,11,0.3)';
      X.lineWidth = 1;
      X.stroke();
      for (let i = 0; i < 12; i++) {
        const a = baseA * 0.5 + (i / 12) * PI2;
        X.beginPath();
        X.arc(cx + Math.cos(a) * (or - 8), cy + Math.sin(a) * (or - 8), 1.4, 0, PI2);
        X.fillStyle = '#fbbf24';
        X.fill();
      }
    } else if (st === 'neon-chase') {
      // Twin hyper-velocity laser chasers
      X.beginPath();
      X.arc(cx, cy, or, 0, PI2);
      X.strokeStyle = 'rgba(255,255,255,0.08)';
      X.lineWidth = 1;
      X.stroke();
      const baseA = (rot * 1.6) / or;
      const chasers = [
        { offset: 0, col: '#f43f5e', rgb: '244,63,94' },
        { offset: Math.PI, col: '#06b6d4', rgb: '6,182,212' }
      ];
      chasers.forEach(ch => {
        const head = baseA + ch.offset;
        const tailLen = 1.1;
        const segments = 12;
        for (let s = 0; s < segments; s++) {
          const a0 = head - (s / segments) * tailLen;
          const a1 = head - ((s + 1) / segments) * tailLen;
          const aAlpha = (1 - s / segments) * 0.9;
          X.beginPath();
          X.arc(cx, cy, or, a1, a0);
          X.strokeStyle = `rgba(${ch.rgb},${aAlpha.toFixed(3)})`;
          X.lineWidth = 2.8 * (1 - s / segments * 0.5);
          X.stroke();
        }
        const hx = cx + Math.cos(head) * or;
        const hy = cy + Math.sin(head) * or;
        X.beginPath();
        X.arc(hx, hy, 3.5, 0, PI2);
        X.fillStyle = '#ffffff';
        try { X.shadowColor = ch.col; X.shadowBlur = 12; } catch (_) {}
        X.fill();
        try { X.shadowBlur = 0; } catch (_) {}
      });
    } else if (st === 'eclipse-corona') {
      // Shimmering solar prominence corona flares
      const rays = 36;
      const baseA = rot / or;
      const tSec = nowMs / 1000;
      X.beginPath();
      X.arc(cx, cy, or - 4, 0, PI2);
      X.strokeStyle = 'rgba(251,191,36,0.35)';
      X.lineWidth = 1.2;
      X.stroke();
      for (let i = 0; i < rays; i++) {
        const a = baseA + (i / rays) * PI2;
        const flareLen = 4 + 9 * (0.5 + 0.5 * Math.sin(i * 3.7 + tSec * 4));
        const r0 = or - 3;
        const r1 = r0 + flareLen;
        const cosA = Math.cos(a), sinA = Math.sin(a);
        X.beginPath();
        X.moveTo(cx + cosA * r0, cy + sinA * r0);
        X.lineTo(cx + cosA * r1, cy + sinA * r1);
        const col = i % 2 === 0 ? 'rgba(251,191,36,0.85)' : 'rgba(249,115,22,0.75)';
        X.strokeStyle = col;
        X.lineWidth = 1.6;
        try { X.shadowColor = '#f59e0b'; X.shadowBlur = 6; } catch (_) {}
        X.stroke();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (st === 'dna-helix') {
      // Intertwined double sinusoidal orbit helix
      const waveFreq = 12;
      const tPhase = rot / 6;
      const pts = 64;
      X.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * PI2;
        const rOff = Math.sin(a * waveFreq + tPhase) * 6;
        const hx = cx + Math.cos(a) * (or + rOff);
        const hy = cy + Math.sin(a) * (or + rOff);
        if (i === 0) X.moveTo(hx, hy); else X.lineTo(hx, hy);
      }
      X.strokeStyle = 'rgba(56,189,248,0.8)';
      X.lineWidth = 1.8;
      try { X.shadowColor = '#38bdf8'; X.shadowBlur = 5; } catch (_) {}
      X.stroke();
      X.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * PI2;
        const rOff = -Math.sin(a * waveFreq + tPhase) * 6;
        const hx = cx + Math.cos(a) * (or + rOff);
        const hy = cy + Math.sin(a) * (or + rOff);
        if (i === 0) X.moveTo(hx, hy); else X.lineTo(hx, hy);
      }
      X.strokeStyle = 'rgba(236,72,153,0.8)';
      X.lineWidth = 1.8;
      try { X.shadowColor = '#ec4899'; X.shadowBlur = 5; } catch (_) {}
      X.stroke();
      try { X.shadowBlur = 0; } catch (_) {}
      for (let rIdx = 0; rIdx < waveFreq * 2; rIdx++) {
        const a = (rIdx / (waveFreq * 2)) * PI2;
        const rOff = Math.sin(a * waveFreq + tPhase) * 6;
        if (Math.abs(rOff) > 3) {
          X.beginPath();
          X.moveTo(cx + Math.cos(a) * (or + rOff), cy + Math.sin(a) * (or + rOff));
          X.lineTo(cx + Math.cos(a) * (or - rOff), cy + Math.sin(a) * (or - rOff));
          X.strokeStyle = 'rgba(255,255,255,0.4)';
          X.lineWidth = 1;
          X.stroke();
        }
      }
    } else if (st === 'hex-shield') {
      // Segmented tactical defense aegis shield
      const segs = 6;
      const baseA = rot / or;
      const gapAngle = 0.18;
      const segAngle = (PI2 / segs) - gapAngle;
      for (let i = 0; i < segs; i++) {
        const aStart = baseA + i * (PI2 / segs);
        const aEnd = aStart + segAngle;
        const pulse = 0.5 + 0.5 * Math.sin(nowMs / 400 + i);
        X.beginPath();
        X.arc(cx, cy, or, aStart, aEnd);
        X.strokeStyle = `rgba(16,185,129,${(0.4 + 0.5 * pulse).toFixed(3)})`;
        X.lineWidth = 3;
        try { X.shadowColor = '#10b981'; X.shadowBlur = 8 * pulse; } catch (_) {}
        X.stroke();
        try { X.shadowBlur = 0; } catch (_) {}
        X.beginPath();
        X.arc(cx, cy, or + 5, aStart + 0.08, aEnd - 0.08);
        X.strokeStyle = 'rgba(16,185,129,0.3)';
        X.lineWidth = 1;
        X.stroke();
        [aStart, aEnd].forEach(capA => {
          X.beginPath();
          X.arc(cx + Math.cos(capA) * or, cy + Math.sin(capA) * or, 2.2, 0, PI2);
          X.fillStyle = '#6ee7b7';
          X.fill();
        });
      }
    } else if (st === 'saturn') {
      // Oblique ringed-planet band (tilted ellipse) + orbiting moon dot.
      X.save();
      X.translate(cx, cy); X.rotate(0.42); X.scale(1, 0.42);
      for (const [rr, col, lw] of [
        [or - 4, 'rgba(245,158,11,0.25)', 4],
        [or, 'rgba(245,158,11,0.9)', 2],
        [or + 5, 'rgba(245,158,11,0.3)', 3]
      ]) {
        X.beginPath(); X.arc(0, 0, rr, 0, PI2);
        X.strokeStyle = col; X.lineWidth = lw; X.stroke();
      }
      X.restore();
      const moonA = rot / or;
      X.beginPath();
      X.arc(cx + Math.cos(moonA) * or, cy + Math.sin(moonA) * or, 3, 0, PI2);
      X.fillStyle = '#fbbf24';
      X.fill();
    } else if (st === 'lightning') {
      // Zig-zag bolts crackling radially off the ring.
      const tSec = nowMs / 1000;
      const baseA = rot / or;
      const bolts = 7;
      for (let b = 0; b < bolts; b++) {
        const seed = Math.floor(tSec * 8) + b * 29;
        const ang = baseA + (b / bolts) * PI2;
        const lit = Math.sin(tSec * 11 + b * 1.9) > 0.55;
        X.beginPath();
        for (let j = 0; j <= 6; j++) {
          const rr = or - 6 + j * 2;
          const jat = ang + Math.sin(seed * 5 + j * 2.3) * 0.16;
          const px = cx + Math.cos(jat) * rr, py = cy + Math.sin(jat) * rr;
          if (j === 0) X.moveTo(px, py); else X.lineTo(px, py);
        }
        X.strokeStyle = lit ? 'rgba(250,204,21,0.95)' : 'rgba(250,204,21,0.3)';
        X.lineWidth = lit ? 2 : 1;
        try { if (lit) { X.shadowColor = '#fde047'; X.shadowBlur = 10; } } catch (_) {}
        X.stroke();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (st === 'beacon') {
      // Rotating radar beacon sweep restricted to the gap band near the ring.
      const baseA = rot / or;
      X.beginPath();
      X.arc(cx, cy, or - 20, 0, PI2);
      X.strokeStyle = 'rgba(56,189,248,0.22)';
      X.lineWidth = 1;
      X.stroke();
      const segs = 16;
      for (let s = 0; s < segs; s++) {
        const a0 = baseA - (s / segs) * 1.4;
        const a1 = baseA - ((s + 1) / segs) * 1.4;
        const aa = 1 - s / segs;
        X.beginPath();
        X.arc(cx, cy, or - 12, a1, a0);
        X.strokeStyle = `rgba(56,189,248,${(aa * 0.7).toFixed(3)})`;
        X.lineWidth = 9 - aa * 6;
        X.stroke();
      }
      X.beginPath(); X.arc(cx, cy, 3, 0, PI2);
      X.fillStyle = '#7dd3fc';
      X.fill();
    } else if (st === 'chains') {
      // Overlapping chain links with pins, wink in sequence behind the sweep.
      const tSec = nowMs / 1000;
      const links = 14;
      const baseA = rot / or;
      for (let i = 0; i < links; i++) {
        const a0 = baseA + (i / links) * PI2;
        const a1 = a0 + (1.5 / links) * PI2;
        const wink = 0.55 + 0.45 * Math.sin(tSec * 3 + i * 0.9);
        X.beginPath();
        X.arc(cx, cy, or, a0, a1);
        X.strokeStyle = `rgba(93,127,160,${wink.toFixed(3)})`;
        X.lineWidth = 2;
        X.stroke();
        const pa = a0 + 0.001;
        X.beginPath();
        X.arc(cx + Math.cos(pa) * or, cy + Math.sin(pa) * or, 1.8, 0, PI2);
        X.fillStyle = '#cbd5e1';
        X.fill();
      }
    } else if (st === 'hyperspace') {
      // Warp-speed radial streaks + deterministic star points.
      const tSec = nowMs / 1000;
      const baseA = (rot * 1.8) / or;
      const rays = 26;
      for (let i = 0; i < rays; i++) {
        const a = baseA + (i / rays) * PI2;
        const stretch = 1.4 + 2.6 * (0.5 + 0.5 * Math.sin(tSec * 7 + i * 2.7));
        const cosA = Math.cos(a), sinA = Math.sin(a);
        X.beginPath();
        X.moveTo(cx + cosA * (or - 14), cy + sinA * (or - 14));
        X.lineTo(cx + cosA * (or + 14), cy + sinA * (or + 14));
        X.strokeStyle = `rgba(224,242,254,${(0.25 * stretch).toFixed(3)})`;
        X.lineWidth = 0.8 + stretch * 0.4;
        X.stroke();
        const pr = or - 8 - ((i * 13) % 10);
        X.beginPath();
        X.arc(cx + cosA * pr, cy + sinA * pr, 1.1, 0, PI2);
        X.fillStyle = '#e0f2fe';
        X.fill();
      }
    } else if (st === 'ferris') {
      // Ferris wheel: hub, cabin spokes and rotating cars.
      const cabins = 8;
      const baseA = rot / or;
      const hubR = 14;
      X.beginPath(); X.arc(cx, cy, or - hubR, 0, PI2);
      X.strokeStyle = 'rgba(148,210,185,0.2)'; X.lineWidth = 1; X.stroke();
      for (let i = 0; i < cabins; i++) {
        const a = baseA + (i / cabins) * PI2;
        const cosA = Math.cos(a), sinA = Math.sin(a);
        X.beginPath();
        X.moveTo(cx + cosA * hubR, cy + sinA * hubR);
        X.lineTo(cx + cosA * (or - hubR), cy + sinA * (or - hubR));
        X.strokeStyle = 'rgba(148,210,185,0.45)';
        X.lineWidth = 1.2;
        X.stroke();
        X.beginPath();
        X.arc(cx + cosA * (or - hubR), cy + sinA * (or - hubR), 2.4, 0, PI2);
        X.fillStyle = '#a7f3d0';
        X.fill();
      }
      X.beginPath(); X.arc(cx, cy, hubR, 0, PI2);
      X.strokeStyle = 'rgba(148,210,185,0.5)';
      X.lineWidth = 1.4;
      X.stroke();
    } else if (st === 'binary-orbit') {
      const baseA = rot / or;
      X.beginPath(); X.arc(cx, cy, or, 0, PI2);
      X.strokeStyle = 'rgba(255,255,255,0.05)'; X.lineWidth = 1; X.stroke();
      const localRot = (nowMs / 1000) * 4 * spd;
      const px = cx + Math.cos(baseA) * or; const py = cy + Math.sin(baseA) * or;
      const rOff = 8;
      X.beginPath(); X.arc(px + Math.cos(localRot) * rOff, py + Math.sin(localRot) * rOff, 3.5, 0, PI2);
      X.fillStyle = '#38bdf8'; X.fill();
      X.beginPath(); X.arc(px + Math.cos(localRot + Math.PI) * rOff, py + Math.sin(localRot + Math.PI) * rOff, 3.5, 0, PI2);
      X.fillStyle = '#f43f5e'; X.fill();
    } else if (st === 'shockwave') {
      const period = 2000 / (spd || 1);
      const phase = (nowMs % period) / period;
      X.beginPath(); X.arc(cx, cy, or, 0, PI2);
      X.strokeStyle = 'rgba(16, 185, 129, 0.4)'; X.lineWidth = 2; X.stroke();
      X.beginPath(); X.arc(cx, cy, or + phase * 30, 0, PI2);
      X.strokeStyle = 'rgba(16, 185, 129, ' + ((1 - phase) * 0.8) + ')';
      X.lineWidth = 2 * (1 - phase); X.stroke();
    } else if (st === 'constellation') {
      const pts = 7; const baseA = rot / or;
      X.beginPath();
      for (let i = 0; i < pts; i++) {
        const a = baseA + (i / pts) * PI2;
        const rVar = or + Math.sin(nowMs/500 + i) * 6;
        const px = cx + Math.cos(a) * rVar; const py = cy + Math.sin(a) * rVar;
        if (i === 0) X.moveTo(px, py); else X.lineTo(px, py);
      }
      X.closePath();
      X.strokeStyle = 'rgba(236, 72, 153, 0.6)'; X.lineWidth = 1.5; X.stroke();
      for (let i = 0; i < pts; i++) {
        const a = baseA + (i / pts) * PI2;
        const rVar = or + Math.sin(nowMs/500 + i) * 6;
        X.beginPath(); X.arc(cx + Math.cos(a) * rVar, cy + Math.sin(a) * rVar, 2.5, 0, PI2);
        X.fillStyle = '#fbcfe8'; X.fill();
      }
    } else if (st === 'fireflies') {
      const count = 12; const baseA = rot * 0.5 / or;
      for (let i = 0; i < count; i++) {
        const a = baseA + (i / count) * PI2 + Math.sin(nowMs/1000 + i) * 0.2;
        const rVar = or + Math.cos(nowMs/800 + i*2) * 12;
        const px = cx + Math.cos(a) * rVar; const py = cy + Math.sin(a) * rVar;
        X.beginPath(); X.arc(px, py, 2, 0, PI2); X.fillStyle = '#fbbf24';
        try { X.shadowColor = '#f59e0b'; X.shadowBlur = 8; } catch(_) {}
        X.fill();
        try { X.shadowBlur = 0; } catch(_) {}
        X.beginPath(); X.arc(px, py, 10, 0, PI2); X.fillStyle = 'rgba(251, 191, 36, 0.1)'; X.fill();
      }
    } else if (st === 'matrix-rain') {
      const lines = 24;
      for (let i = 0; i < lines; i++) {
        const a = (i / lines) * PI2;
        const speedOff = i * 123;
        const drop = ((nowMs + speedOff) * (0.05 * spd)) % 30;
        X.beginPath();
        X.moveTo(cx + Math.cos(a) * (or - 15 + drop), cy + Math.sin(a) * (or - 15 + drop));
        X.lineTo(cx + Math.cos(a) * (or - 5 + drop), cy + Math.sin(a) * (or - 5 + drop));
        X.strokeStyle = 'rgba(74, 222, 128, ' + (1 - drop/30) + ')';
        X.lineWidth = 2; X.stroke();
      }
    } else if (st === 'aurora-band') {
      const pts = 60; X.beginPath();
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * PI2;
        const rVar = or + Math.sin(a * 4 + nowMs/600 * spd) * 8;
        const px = cx + Math.cos(a) * rVar; const py = cy + Math.sin(a) * rVar;
        if (i === 0) X.moveTo(px, py); else X.lineTo(px, py);
      }
      X.closePath();
      const grad = X.createLinearGradient(cx - or, cy - or, cx + or, cy + or);
      grad.addColorStop(0, 'rgba(16, 185, 129, 0.7)');
      grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.7)');
      grad.addColorStop(1, 'rgba(139, 92, 246, 0.7)');
      X.strokeStyle = grad; X.lineWidth = 4; X.stroke();
    } else {
      // 'dash' — classic clockwise rotating dotted ring.
      X.beginPath();
      X.arc(cx, cy, or, 0, PI2);
      X.setLineDash([8, 8]);
      try { X.lineDashOffset = -rot; } catch (_) {}
      X.strokeStyle = 'rgba(148,210,185,0.65)';
      X.lineWidth = 1.5;
      X.stroke();
      X.setLineDash([]);
    }
    try { X.lineDashOffset = 0; } catch (_) {}
    X.restore();
  }

  // ── Orbit-speed indicator (brief flash after Alt+scroll / slider) ──
  function drawOrbitSpeedIndicator(cx, cy, r) {
    if (!orbitSpeedPulse) return;
    const elapsed = performance.now() - orbitSpeedPulse;
    if (elapsed > 1200) { orbitSpeedPulse = 0; return; }
    const fade = 1 - (elapsed / 1200);
    const spd = (typeof orbitSpeed === 'number' ? orbitSpeed : 1.0);
    const label = spd === 0 ? 'Orbit Paused' : `Orbit ${spd.toFixed(1)}×`;
    X.save();
    X.globalAlpha = fade;
    X.font = '700 12px Inter, system-ui, sans-serif';
    const tw = X.measureText(label).width;
    const padX = 12, padY = 6;
    const bw = tw + padX * 2, bh = 12 + padY * 2;
    const bx = cx - bw / 2;
    const by = Math.max(4, cy - r + 8);
    X.beginPath();
    const pr = bh / 2;
    X.roundRect(bx, by, bw, bh, pr);
    X.closePath();
    X.fillStyle = 'rgba(45,212,191,0.92)';
    X.shadowColor = 'rgba(45,212,191,0.5)';
    X.shadowBlur = 14;
    X.fill();
    X.shadowBlur = 0;
    X.fillStyle = '#fff';
    X.textAlign = 'center';
    X.textBaseline = 'middle';
    X.fillText(label, cx, by + pr);
    X.restore();
  }

  let dragging=false;
  
  // Edit-mode UI cluster (knobs / delete / color pickers) auto-hides when the
  // window loses focus or the cursor leaves the cluster.
  let windowFocused = true;
  window.addEventListener('focus', () => { windowFocused = true; });
  window.addEventListener('blur', () => { windowFocused = false; });

  // Click-through state: cursor over fully transparent pixels → window
  // forwards clicks to apps underneath (setIgnoreMouseEvents + forward).
  let ignoreMouseActive = false;
  
  let interactiveMode = null;
  let interactiveDate = null;
  let draggingKnob = false;
  let dragLastAngle = 0;
  let dragCurrentTimeMs = 0;

  api.onFocusTime(data => {
    interactiveMode = data.type;
    const [h, m] = data.timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h) || 0, parseInt(m) || 0, 0, 0);
    interactiveDate = d;
  });

  api.onBlurTime(() => {
    if (!draggingKnob) interactiveMode = null;
  });

  function getAngleForDate(d) {
    const msIn12h = (d.getHours() % 12) * 3600000 + d.getMinutes() * 60000;
    return (msIn12h / 43200000) * PI2 - (Math.PI / 2);
  }

  canvas.addEventListener('mousedown', e => { 
    if(e.button !== 0) return;
    
    // Convert to canvas-local coordinates
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    // Exit × (hover button, top-left of dial) → close the app
    if (isOnExitButton(mx, my)) {
        api.closeApp();
        return;
    }

    // Resize handle (dial bottom-right) → always resize the window
    if (isOnResizeHandle(mx, my)) {
        resizing = true;
        api.resizeStart();
        return;
    }

    // Check gear icon click first
    if (isClickOnGear(mx, my)) {
        api.showPanel({style,theme,handType,opacity,sessions,blockOpacity,blockAnim,tooltipAnim,tooltipSize,orbitSpeed,orbitStyle,todoAnim,titleGap,windowFitAuto,favorites,todoOpacity,todoBoxOpaque,todoBoxOpacity,calAnim});
       return;
    }

    // Grab handle → always drag the window
    if (isOnGrabHandle(mx, my)) {
        dragging = true;
        api.dragStart();
        return;
    }

    // ── Circular ring labels: × chip clears the task, text opens the editor ──
    {
        const hit = hitLabelArc(mx, my);
        if (hit && sessions[hit.arc.idx]) {
            e.preventDefault();
            if (hit.kind === 'chip') {
                const sess = sessions[hit.arc.idx];
                const ti = hit.arc.taskIdx;
                if (ti >= 0 && Array.isArray(sess.tasks)) {
                    sess.tasks.splice(ti, 1);
                    save();
} else {
                    // placeholder — clear all tasks
                    sess.tasks = [];
                    save();
                }
            } else {
                startEditLabel(hit.arc.idx, hit.arc.taskIdx, {
                    x: hit.arc.x0, y: hit.arc.y0,
                    w: hit.arc.x1 - hit.arc.x0, h: hit.arc.y1 - hit.arc.y0
                });
            }
            return;
        }
    }

    const { cx, cy, r } = clockBounds();
    const dx = mx - cx, dy = my - cy;
    const dist = Math.hypot(dx, dy);

    // ── If in edit mode, check knobs / delete / dismiss ──
    if (interactiveMode && interactiveMode.startsWith('edit-')) {
       const idx = parseInt(interactiveMode.split('-')[1]);
       const sess = sessions[idx];
       if (sess) {
           // Delete block button (only in -both mode; sits at the END angle
           // so mid-wedge clicks select/toggle instead of deleting)
if (interactiveMode.endsWith('-both')) {
                // Delete sits at the wedge midpoint so mid-wedge clicks delete
                const dDelS = new Date(sess.start);
                const dDelE = new Date(sess.end);
                const midA = getAngleForDate(new Date((dDelS.getTime() + dDelE.getTime()) / 2));
                const delBtnX = cx + Math.cos(midA) * (r - 35);
                const delBtnY = cy + Math.sin(midA) * (r - 35);
                if (Math.hypot(mx - delBtnX, my - delBtnY) < 14) {
                   const delId = sess && sess.id;
                   if (delId) unlinkBlock(delId);
                   lastDisarmedArm = null;
                   disarmTodoLink();
                   sessions.splice(idx, 1);
                   save();
                   interactiveMode = null;
                   if (pWrapS) pWrapS.style.display = 'none';
                   if (pWrapE) pWrapE.style.display = 'none';
                    editingLabelIdx = -1;
                    if (editInput && editInput.parentNode) editInput.parentNode.removeChild(editInput);
                    editInput = null;
                    lastLabelSig = '__cleared__';
                    return;
               }
           }
           
           // Start/End knob grab
           const dStart = new Date(sess.start);
           const dEnd = new Date(sess.end);
           const aStart = getAngleForDate(dStart);
           const aEnd = getAngleForDate(dEnd);
           
           const kxS = cx + Math.cos(aStart) * (r - 12);
           const kyS = cy + Math.sin(aStart) * (r - 12);
           const kxE = cx + Math.cos(aEnd) * (r - 12);
           const kyE = cy + Math.sin(aEnd) * (r - 12);
           
           if (Math.hypot(mx - kxS, my - kyS) < 45) {
               draggingKnob = true;
               interactiveMode = `edit-${idx}-start`; interactiveDate = dStart;
               let angle = Math.atan2(my - cy, mx - cx);
               if (angle < 0) angle += PI2;
               dragLastAngle = angle;
               dragCurrentTimeMs = sess.start;
               return;
           }
           if (Math.hypot(mx - kxE, my - kyE) < 45) {
               draggingKnob = true;
               interactiveMode = `edit-${idx}-end`; interactiveDate = dEnd;
               let angle = Math.atan2(my - cy, mx - cx);
               if (angle < 0) angle += PI2;
               dragLastAngle = angle;
               dragCurrentTimeMs = sess.end;
               return;
           }
       }
       
       // Click missed all edit controls → exit edit mode, then continue to wedge/create check
       interactiveMode = null;
       lastDisarmedArm = linkBlockId;
       disarmTodoLink();
       if (pWrapS) pWrapS.style.display = 'none';
       if (pWrapE) pWrapE.style.display = 'none';
    } else if (interactiveMode && interactiveDate) {
       // Old single-knob create logic
       const angle = getAngleForDate(interactiveDate);
       const kx = cx + Math.cos(angle) * (r - 12);
       const ky = cy + Math.sin(angle) * (r - 12);
       if (Math.hypot(mx - kx, my - ky) < 45) {
          draggingKnob = true;
          let a = Math.atan2(my - cy, mx - cx);
          if (a < 0) a += PI2;
          dragLastAngle = a;
          dragCurrentTimeMs = interactiveDate.getTime();
          return;
       }
    }
    
    // ── Check if clicked ON a wedge or empty outer ring ──
    // (disabled while time allocations are off → falls through to drag)
    if (SESSIONS_ENABLED && dist <= r) {
        let angle = Math.atan2(dy, dx) + (Math.PI / 2);
        if (angle < 0) angle += PI2; if (angle >= PI2) angle -= PI2;
        const MS_IN_12H = 43200000;
        
        let foundIdx = -1;
        if (sessions && sessions.length > 0) {
            for (let i = 0; i < sessions.length; i++) {
               const sess = sessions[i];
               const sDate = new Date(sess.start);
               const startMsIn12h = (sDate.getHours() % 12) * 3600000 + sDate.getMinutes() * 60000;
               const startAngle = (startMsIn12h / MS_IN_12H) * PI2;
               const sweepAngle = Math.min(PI2, ((sess.end - sess.start) / MS_IN_12H) * PI2);
               const endAngle = startAngle + sweepAngle;
               
               let inWedge = false;
               if (endAngle > PI2) {
                   inWedge = (angle >= startAngle && angle <= PI2) || (angle >= 0 && angle <= endAngle - PI2);
               } else {
                   inWedge = (angle >= startAngle && angle <= endAngle);
               }
               if (inWedge) { foundIdx = i; break; }
            }
        }
        
        if (foundIdx !== -1) {
           interactiveMode = `edit-${foundIdx}-both`;
           const clicked = sessions[foundIdx];
           // Second click on the armed block deactivates (banner goes away too).
           if (lastDisarmedArm && clicked && clicked.id === lastDisarmedArm) lastDisarmedArm = null;
           else { lastDisarmedArm = null; armTodoLink(clicked); }
           return;
        } else if (dist > r - 60) {
           // Clicked empty space on the outer ring -> spawn new block
           const now = new Date();
           let totalMins = Math.round((angle / PI2) * 12 * 60);
           totalMins = Math.round(totalMins / 5) * 5;
           
           let hrs12 = Math.floor(totalMins / 60);
           let mins = totalMins % 60;
           if (hrs12 >= 12) hrs12 -= 12;
           
           const cand1 = new Date(now);
           cand1.setHours(hrs12, mins, 0, 0);
           const cand2 = new Date(cand1); cand2.setHours(hrs12 + 12, mins, 0, 0);
           let start = (cand1.getTime() > now.getTime()) ? cand1 : cand2;
           if (start.getTime() <= now.getTime()) {
              start = new Date(cand1);
              start.setDate(start.getDate() + 1);
           }
           // Planning another date: keep the clicked time-of-day, swap in the viewed date.
           if (selectedTodoDate !== TODAY_KEY) {
              const yp = selectedTodoDate.split('-').map(Number);
              start = new Date(yp[0], yp[1] - 1, yp[2], start.getHours(), start.getMinutes(), 0, 0);
           }
           
           const end = new Date(start);
           end.setHours(start.getHours() + 1);
           
           if (!sessions) sessions = [];
           
           let hue = (210 + sessions.length * 137.5) % 360;
           const hslToHex = (h, s, l) => {
             l /= 100;
             const a = s * Math.min(l, 1 - l) / 100;
             const f = n => {
               const k = (n + h / 30) % 12;
               const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
               return Math.round(255 * color).toString(16).padStart(2, '0');
             };
             return `#${f(0)}${f(8)}${f(4)}`;
           };
           
sessions.push({
                start: start.getTime(),
                end: end.getTime(),
                color: hslToHex(hue, 85, 60),
                elapsedColor: hslToHex(hue, 60, 40),
                type: 'custom',
                tasks: []
            });
           
           save();
           interactiveMode = `edit-${sessions.length - 1}-both`;
           lastDisarmedArm = null;
           armTodoLink(sessions[sessions.length - 1]);
           return;
        }
    }
    
    // Nothing interactive hit → drag window
    interactiveMode = null;
    lastDisarmedArm = null;
    disarmTodoLink();
    dragging=true; 
    api.dragStart(); 
  });

  window.addEventListener('mousemove', e => { 
    if(dragging) api.dragMove(); 
    else if (resizing) api.resizeMove(); 
    else if (draggingKnob && interactiveMode && interactiveMode !== 'none') {
       if (interactiveMode.endsWith('-both')) return; // Just displaying both, not dragging
       const rect = canvas.getBoundingClientRect();
       const mx = e.clientX - rect.left;
       const my = e.clientY - rect.top;
       const { cx, cy } = clockBounds();
       let angle = Math.atan2(my - cy, mx - cx);
       if (angle < 0) angle += PI2;
       
       let clockAngle = angle + (Math.PI / 2);
       if (clockAngle < 0) clockAngle += PI2;
       if (clockAngle >= PI2) clockAngle -= PI2;
       let deltaA = angle - dragLastAngle;
       if (deltaA > Math.PI) deltaA -= PI2;
       else if (deltaA < -Math.PI) deltaA += PI2;
       dragLastAngle = angle;
       
       const msPerRad = (12 * 3600000) / PI2;
       dragCurrentTimeMs += deltaA * msPerRad;
       
       // round to nearest 1 minute
       let newTimeMs = Math.round(dragCurrentTimeMs / 60000) * 60000;
       
       if (interactiveMode.startsWith('edit-')) {
           const idx = parseInt(interactiveMode.split('-')[1]);
           const key = interactiveMode.split('-')[2]; // 'start' or 'end'
           const sess = sessions[idx];
           if (sess) {
               if (key === 'start' && newTimeMs >= sess.end - 60000) newTimeMs = sess.end - 60000;
                if (key === 'end' && newTimeMs <= sess.start + 60000) newTimeMs = sess.start + 60000;

                sess[key] = newTimeMs;

                const d = new Date(newTimeMs);
               const outTimeStr = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
               api.updateTimeInput({type: interactiveMode, timeStr: outTimeStr});
               interactiveDate = d; // update for draw
           }
       } else {
           interactiveDate = new Date(newTimeMs);
           const timeStr = `${interactiveDate.getHours().toString().padStart(2,'0')}:${interactiveDate.getMinutes().toString().padStart(2,'0')}`;
           api.updateTimeInput({type: interactiveMode, timeStr});
       }
    }
  });

  window.addEventListener('mouseup', () => { 
    if(resizing){resizing=false;api.resizeEnd();} 
    if(dragging){dragging=false;api.dragEnd();} 
    if(draggingKnob) {
      draggingKnob = false;
      save(); // Save once at the end of the drag
      renderTodos(); // linked chips/timelines pick up the new times
      if (interactiveMode && interactiveMode.startsWith('edit-')) {
         const idx = interactiveMode.split('-')[1];
         interactiveMode = `edit-${idx}-both`; // Return to showing both handles
} else {
         interactiveMode = null;
      }
      if (viewMode === 'board') try { renderBoard(); } catch (_) {}
    }
  });
  // Canvas-drawn settings gear
  let gearOpacity = 0;
  let lastMouseMove = 0;
  let lastMouseX = null, lastMouseY = null;
  let gearX = 0, gearY = 0, gearR = 14;
  let handleX = 0, handleY = 0, handleOpacity = 0;
  let resizing = false;
  let resizeHandleX = 0, resizeHandleY = 0, resizeOpacity = 0;
  let exitX = 0, exitY = 0, exitOpacity = 0;

  // Track the label currently being edited (its ring text hides meanwhile)
  let editingLabelIdx = -1;
  let editInput = null;

  // ── Todo list (HTML panel) — minimal: + button, add box, task cards ──
  const todoList = document.getElementById('todo-list');
  const todoAddBox = document.getElementById('todo-add-box');
  const todoAddPlus = document.getElementById('todo-add-plus');
  const todoTabs = document.getElementById('todo-tabs');
  const todoTabAdd = document.getElementById('todo-tab-add');

  // Dot tabs: one dot per list; active dot is filled. Click switches tab.
  function renderTodoTabs() {
    if (!todoTabs) return;
    todoTabs.innerHTML = '';
    todoLists.forEach((l, i) => {
      const dot = document.createElement('button');
      dot.className = 'todo-tab' + (i === activeTodoList ? ' active' : '');
      dot.title = l.name + ' (' + l.todos.length + ' items)';
      dot.addEventListener('click', () => switchTodoList(i));
      todoTabs.appendChild(dot);
    });
  }

  function switchTodoList(i) {
    if (i === activeTodoList) return;
    activeTodoList = i;
    todosByDate[selectedTodoDate].active = i;
    todos = todoLists[i].todos;
    renderTodoTabs();
    renderTodos();
    saveTodos();
  }

  todoTabAdd.addEventListener('click', () => {
    todoLists.push({ id: 'list-' + Date.now(), name: 'List ' + (todoLists.length + 1), todos: [] });
    activeTodoList = todoLists.length - 1;
    todosByDate[selectedTodoDate].active = activeTodoList;
    todos = todoLists[activeTodoList].todos;
    renderTodoTabs();
    renderTodos();
    renderCalendar();
    saveTodos();
    todoAddBox.focus();
  });

  // ── Mini calendar: toggle, per-date counts, click switches date workspace ──
  const todoCalToggle = document.getElementById('todo-cal-toggle');
  const todoCalWrap = document.getElementById('todo-cal-wrap');
  const todoCalTitle = document.getElementById('todo-cal-title');
  const todoCalGrid = document.getElementById('todo-cal-grid');
  const todoCalFoot = document.getElementById('todo-cal-foot');
  const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let calYear, calMonth;
  { const sd = new Date(selectedTodoDate + 'T12:00:00'); calYear = sd.getFullYear(); calMonth = sd.getMonth(); }

  function switchTodoDate(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    if (!todosByDate[key]) todosByDate[key] = { lists: [{ id: 'list-1', name: 'List 1', todos: [] }], active: 0 };
    if (!sessionsByDate[key]) sessionsByDate[key] = [];
    selectedTodoDate = key;
    syncDateAliases();
    syncSessionAlias();
    normalizeSessions();
    renderTodoTabs();
    pruneTodoLinks(); // drops a stale arm (banner+render included), keeps a still-valid one
    renderCalendar();
    saveTodos();
    save();
  }

  function renderCalendar() {
    if (!todoCalGrid) return;
    if (todoCalWrap) todoCalWrap.classList.toggle('open', !!todoCalOpen);
    if (todoCalToggle) todoCalToggle.classList.toggle('active', !!todoCalOpen);
    if (!todoCalOpen) return;
    if (todoCalTitle) todoCalTitle.textContent = CAL_MONTHS[calMonth] + ' ' + calYear;
    todoCalGrid.innerHTML = '';
    ['Mo','Tu','We','Th','Fr','Sa','Su'].forEach(d => {
      const h = document.createElement('div');
      h.className = 'todo-cal-dow';
      h.textContent = d;
      todoCalGrid.appendChild(h);
    });
    const first = new Date(calYear, calMonth, 1);
    let lead = (first.getDay() + 6) % 7; // Monday-first
    for (let i = 0; i < lead; i++) {
      const b = document.createElement('div');
      b.className = 'todo-cal-blank';
      todoCalGrid.appendChild(b);
    }
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const key = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      const n = dateTodoCount(key);
      const state = key < TODAY_KEY ? ' past' : key > TODAY_KEY ? ' future' : '';
      const c = document.createElement('button');
      c.className = 'todo-cal-day' + (key === selectedTodoDate ? ' sel' : '') + (key === TODAY_KEY ? ' today' : '') + state + (n > 0 ? ' has' : '');
      c.title = key + ' · ' + n + ' task' + (n === 1 ? '' : 's');
      c.style.setProperty('--ci', (lead + d - 1) % 42); // stagger index for entrance
      c.innerHTML = '<span class="cal-cell"><span class="dnum">' + d + '</span>' + (n > 0 ? '<span class="dcnt">' + n + '</span>' : '') + '</span>';
      if (n > 0) c.style.animationDelay = (-((d % 7) * 0.3)).toFixed(2) + 's'; // phase-offset the loop
      c.addEventListener('click', () => switchTodoDate(key));
      todoCalGrid.appendChild(c);
    }
    if (todoCalFoot) {
      const n = dateTodoCount(selectedTodoDate);
      const sd = new Date(selectedTodoDate + 'T12:00:00');
      const label = sd.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      todoCalFoot.textContent = label + ' · ' + n + ' task' + (n === 1 ? '' : 's');
    }
  }

  if (todoCalToggle) todoCalToggle.addEventListener('click', () => {
    todoCalOpen = !todoCalOpen;
    renderCalendar();
    saveTodos();
  });
  const todoCalPrev = document.getElementById('todo-cal-prev');
  const todoCalNext = document.getElementById('todo-cal-next');
  const todoCalToday = document.getElementById('todo-cal-today');
  if (todoCalPrev) todoCalPrev.addEventListener('click', () => {
    calMonth -= 1; if (calMonth < 0) { calMonth = 11; calYear -= 1; }
    renderCalendar();
  });
  if (todoCalNext) todoCalNext.addEventListener('click', () => {
    calMonth += 1; if (calMonth > 11) { calMonth = 0; calYear += 1; }
    renderCalendar();
  });
  if (todoCalToday) todoCalToday.addEventListener('click', () => {
    const t = new Date(); calYear = t.getFullYear(); calMonth = t.getMonth();
    switchTodoDate(dateKeyOf(t));
  });

  // ── Block ↔ todo linking ──
  // Clicking a clock wedge arms its session (linkBlockId); clicking a parent
  // todo card then attaches/detaches it. Linked cards show a live countdown chip.
  let linkBlockId = null;
  let lastDisarmedArm = null; // arm cleared by edit-dismiss, so a wedge click can toggle off
  const todoLinkBar = document.getElementById('todo-link-bar');
  const todoLinkText = document.getElementById('todo-link-text');
  const todoLinkCancel = document.getElementById('todo-link-cancel');
  if (todoLinkCancel) todoLinkCancel.addEventListener('click', () => disarmTodoLink(true));

  function fmtClock(ms) {
    const d = new Date(ms);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
function fmtLeft(ms) {
    const neg = ms < 0;
    if (neg) ms = -ms;
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    return (neg ? '-' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }
  // Bare remaining number for the outside-the-box label.
  function getRelativeSessionTimes(sess, now) {
  if (!sess) return {start:0, end:0};
  const sD = new Date(sess.start);
  const nowD = new Date(now);
  let sToday = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate(), sD.getHours(), sD.getMinutes(), sD.getSeconds(), sD.getMilliseconds()).getTime();
  const dur = sess.end - sess.start;
  let diff = sToday - now;
  let sClosest = sToday;
  if (diff > 12 * 3600 * 1000) sClosest -= 24 * 3600 * 1000;
  else if (diff < -12 * 3600 * 1000) sClosest += 24 * 3600 * 1000;
  return { start: sClosest, end: sClosest + dur };
}
  function etimeText(sess, now) {
    if (!sess) return '';
    const rel = getRelativeSessionTimes(sess, now);
    if (now < rel.start) return fmtLeft(rel.start - now);
    if (now <= rel.end) return fmtLeft(rel.end - now);
    return fmtLeft(rel.end - now);
  }
  function armTodoLink(sess) {
    if (!sess) return;
    if (!sess.id) { sess.id = genId('s'); save(); } // persist the id the link points at
    linkBlockId = sess.id;
    updateLinkBar();
    showLinkToast('🔗 Linking ' + fmtClock(sess.start) + '–' + fmtClock(sess.end) + ' — click a todo');
  }
  function disarmTodoLink(silent) {
    if (!linkBlockId) return;
    linkBlockId = null;
    updateLinkBar();
    if (!silent) showLinkToast('Linking off');
  }
  let linkToastTimer = null;
  function showLinkToast(txt) {
    const t = document.getElementById('link-toast');
    if (!t) return;
    t.textContent = txt;
    t.classList.add('show');
    if (linkToastTimer) clearTimeout(linkToastTimer);
    linkToastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function unlinkBlock(id) {
    if (!id) return;
    let changed = false;
    const clear = (o) => {
      if (!o) return;
      if (o.blockId === id) { o.blockId = null; changed = true; }
      (o.subtasks || []).forEach(clear);
    };
    todoLists.forEach(l => (l.todos || []).forEach(clear));
    if (changed) { saveTodos(); renderBoard(); }
  }
  function pruneTodoLinks() {
    const ids = new Set(sessions.map(s => s && s.id));
    let changed = false;
    const prune = (o) => {
      if (!o) return;
      if (o.blockId && !ids.has(o.blockId)) { o.blockId = null; changed = true; }
      (o.subtasks || []).forEach(prune);
    };
    todoLists.forEach(l => (l.todos || []).forEach(prune));
    if (changed) { saveTodos(); renderBoard(); }
    if (linkBlockId && !ids.has(linkBlockId)) linkBlockId = null;
    updateLinkBar();
  }
function toggleTodoLink(id) {
    const t = todos.find(x => x.id === id);
    if (!t || !linkBlockId) return;
    t.blockId = (t.blockId === linkBlockId) ? null : linkBlockId;
    saveTodos(); save(); renderTodos(); renderBoard();
  }
  function toggleSubtaskLink(pathArr) {
    const s = getNodeByPath(pathArr);
    if (!s || !linkBlockId) return;
    s.blockId = (s.blockId === linkBlockId) ? null : linkBlockId;
    saveTodos(); save(); renderTodos(); renderBoard();
  }
  function blockPct(sess, now) {
    if (!sess || !(sess.end > sess.start)) return 0;
    const rel = getRelativeSessionTimes(sess, now);
    return Math.max(0, Math.min(100, (now - rel.start) / (rel.end - rel.start) * 100));
  }
  function timelineHtml(sess, now, slim, rem, el) {
    if (!sess) return '';
    rem = (/^#[0-9a-f]{6}$/i.test(rem || '') ? rem : '#8b5cf6');
    el = (/^#[0-9a-f]{6}$/i.test(el || '') ? el : '#ec4899');
    const pct = blockPct(sess, now).toFixed(1);
    return `<div class="todo-timeline${slim ? ' slim' : ''}" data-start="${sess.start}" data-end="${sess.end}" style="background:${rem}40">` +
      `<div class="todo-time-fill" style="width:${pct}%;background:${el}"></div></div>`;
  }
  function updateLinkBar() {
    const sess = linkBlockId && sessions.find(s => s.id === linkBlockId);
    if (todoLinkBar) todoLinkBar.hidden = !sess;
    if (sess && todoLinkText) {
      todoLinkText.textContent = '🔗 Linking to block ' + fmtClock(sess.start) + '–' + fmtClock(sess.end) + ' — click a todo to attach';
    }
    todoList.classList.toggle('link-mode', !!sess);
    renderTodos();
  }

  // Per-task remaining/elapsed colors (golden-angle variety, like blocks).
  function todoHsl(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }
  function nextTodoHue() {
    let n = 0;
    Object.keys(todosByDate).forEach(k => {
      (todosByDate[k].lists || []).forEach(l => {
        (l.todos || []).forEach(function walk(t) { n++; (t.subtasks || []).forEach(walk); });
      });
    });
    return (210 + n * 137.5) % 360;
  }
  // Assign distinct remaining + elapsed colors wherever missing (recursive).
  function ensureTodoColors(t) {
    if (!t) return;
    if (!t.color || !t.elapsedColor) {
      const hue = nextTodoHue();
      t.color = todoHsl(hue, 85, 60);
      t.elapsedColor = deriveElapsedColor(t.color);
    }
    (t.subtasks || []).forEach(ensureTodoColors);
  }
  // Plus SVG for add subtask
  const SUBTASK_PLUS_SVG = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  // Position weight 0..10: +/- counter per task, top-down order. The WHOLE
  // box takes the counter color, very visible: low = green, mid = yellow,
  // very high = red. Pulsing outline runs off the --wc var (see CSS).
  function clampWeight(v) { v = Math.round(typeof v === 'number' ? v : 0); return Math.max(0, Math.min(10, v)); }
  function weightRgb(w) {
    w = clampWeight(w) / 10 * 2; // 0..2 across 3 stops
    const stops = [[74, 222, 128], [250, 204, 21], [239, 68, 68]];
    const i = Math.min(1, Math.floor(w)), f = w - i;
    return stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  }
  function paintWeight(card, w, linked) {
    if (!card) return;
    w = clampWeight(w);
    // 100% = fully opaque solid; lower values fade toward glass.
    const op = (typeof todoBoxOpacity === 'number' ? todoBoxOpacity : 100) / 100;
    const c = weightRgb(w);
    const soft = `rgba(${c[0]},${c[1]},${c[2]},${(0.15 + 0.85 * op).toFixed(3)})`;
    const mid = `rgba(${c[0]},${c[1]},${c[2]},${(0.25 + 0.75 * op).toFixed(3)})`;
    const strong = `rgba(${c[0]},${c[1]},${c[2]},${(0.30 + 0.70 * op).toFixed(3)})`;
    const num = card.querySelector('.todo-weight span');
    if (num) num.textContent = w;
    card.style.background = soft;
    card.style.borderColor = mid;
    card.style.boxShadow = `0 0 0 1px ${mid}, 0 0 14px rgba(${c[0]},${c[1]},${c[2]},${(0.35 * op).toFixed(3)}), 0 4px 12px rgba(0,0,0,0.2)`;
    card.style.setProperty('--wc', strong);
  }
  // Repaint all visible cards when the transparency slider moves (no re-render).
  function applyTodoBoxOpacity() {
    todoList.querySelectorAll('.todo-item').forEach(card => {
      const num = card.querySelector('.todo-weight span');
      paintWeight(card, num ? +num.textContent : 0, card.classList.contains('linked'));
    });
  }
  // One-time migration: legacy priority flags become weights.
  function normalizeTodoWeights() {
    const map = { high: 3, medium: 2, low: 1 };
    Object.keys(todosByDate).forEach(k => {
      (todosByDate[k].lists || []).forEach(l => {
        (l.todos || []).forEach(t => {
          if (typeof t.weight !== 'number') t.weight = map[t.priority] || 0;
          t.weight = clampWeight(t.weight);
          delete t.priority;
          (t.subtasks || []).forEach(s => { s.weight = clampWeight(s.weight); });
          ensureTodoColors(t); // backfill distinct remaining/elapsed colors
        });
      });
    });
  }

  function escapeHtml(s) {
    return (s || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── Subtask helpers ──

  function getNodeByPath(pathArr) {
    if (!pathArr || !pathArr.length) return null;
    let curr = todos.find(x => x.id === pathArr[0]);
    if (!curr) return null;
    for (let i = 1; i < pathArr.length; i++) {
      if (!curr.subtasks) return null;
      curr = curr.subtasks.find(x => x.id === pathArr[i]);
      if (!curr) return null;
    }
    return curr;
  }

  function getParentByPath(pathArr) {
    if (!pathArr || pathArr.length < 2) return null;
    return getNodeByPath(pathArr.slice(0, -1));
  }

  function ensureSubtasks(t) {
    if (!Array.isArray(t.subtasks)) t.subtasks = [];
    return t.subtasks;
  }

  function addSubtask(pathArr, text) {
    const t = getNodeByPath(pathArr);
    if (!t) return;
    ensureSubtasks(t);
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    const hue = nextTodoHue();
    const col = todoHsl(hue, 85, 60);
    t.subtasks.push({
      id: Date.now() + '-st-' + Math.random().toString(36).slice(2,6),
      text: trimmed,
      done: false,
      weight: 0,
      color: col,
      elapsedColor: deriveElapsedColor(col),
      collapsed: false
    });
    saveTodos(); renderTodos(); renderCalendar();
  }

  function toggleSubtask(pathArr) {
    const t = getNodeByPath(pathArr);
    if (!t) return;
    t.done = !t.done;
    saveTodos(); renderTodos();
  }

  function removeSubtask(pathArr) {
    if (pathArr.length < 2) return;
    const p = getParentByPath(pathArr);
    if (!p || !p.subtasks) return;
    const subId = pathArr[pathArr.length - 1];
    p.subtasks = p.subtasks.filter(x => x.id !== subId);
    saveTodos(); renderTodos(); renderCalendar();
  }

  function updateSubtaskText(pathArr, text) {
    const t = getNodeByPath(pathArr);
    if (!t) return;
    const v = (text || '').trim();
    if (!v) { removeSubtask(pathArr); return; }
    t.text = v;
    saveTodos();
  }

  function toggleCollapse(pathArr) {
    const t = getNodeByPath(pathArr);
    if (!t) return;
    t.collapsed = !t.collapsed;
    saveTodos(); renderTodos();
  }

  let dragSub = null;
  function moveSubtask(srcPath, dstPath, pos) {
    const src = getNodeByPath(srcPath);
    const dst = getNodeByPath(dstPath);
    if (!src || !dst) return;
    
    const srcParent = getParentByPath(srcPath);
    if (!srcParent || !srcParent.subtasks) return;
    
    const fromIdx = srcParent.subtasks.findIndex(x => x.id === src.id);
    if (fromIdx === -1) return;
    
    const [moving] = srcParent.subtasks.splice(fromIdx, 1);
    
    if (pos === 'inside-end') {
      ensureSubtasks(dst).push(moving);
    } else {
      const dstParent = getParentByPath(dstPath);
      if (!dstParent) return;
      let toIdx = dstParent.subtasks.findIndex(x => x.id === dst.id);
      if (toIdx === -1) { dstParent.subtasks.push(moving); }
      else {
        if (pos === 'after') toIdx += 1;
        dstParent.subtasks.splice(toIdx, 0, moving);
      }
    }
    saveTodos(); renderTodos(); renderTodoTabs(); renderCalendar();
  }
  
  function clearDropMarks() {
    todoList.querySelectorAll('.drop-before,.drop-after,.drop-inside,.dragging')
      .forEach(el => el.classList.remove('drop-before','drop-after','drop-inside','dragging'));
  }

  const CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="chev-svg"><polyline points="9 18 15 12 9 6"></polyline></svg>';
  const CHEVRON_DOWN_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="chev-svg down"><polyline points="6 9 12 15 18 9"></polyline></svg>';

  function renderSubtasks(subs, parentPath, depth, baseIdx) {
    if (!subs || !subs.length) return 0;
    let count = 0;
    subs.forEach((s, si) => {
      count++;
      const currentPath = [...parentPath, s.id];
      const pathStr = currentPath.join(',');
      const sli = document.createElement('li');
      const sLinked = s.blockId && sessions.find(x => x.id === s.blockId);
      
      const hasChildren = s.subtasks && s.subtasks.length > 0;
      const isCollapsed = s.collapsed;
      
      sli.className = 'todo-item st-block' + (s.done ? ' st-done' : '') + (sLinked ? ' linked' : '');
      sli.dataset.path = pathStr;
      sli.dataset.todoid = parentPath[0]; 
      sli.dataset.stid = s.id;
      
      sli.draggable = true;
      
      const indent = Math.min(depth, 5) * 14;
      sli.style.marginLeft = indent + 'px';
      
      if (todoAnimEff() !== 'none') sli.style.animationDelay = '0s, ' + (-(baseIdx * 0.3 + si * 0.15)).toFixed(2) + 's';
      
      const chev = hasChildren ? `<button class="st-collapse" data-action="collapse" data-path="${pathStr}">${isCollapsed ? CHEVRON_SVG : CHEVRON_DOWN_SVG}</button>` : '<span class="st-collapse-spacer" style="width:14px;display:inline-block"></span>';
      
      sli.innerHTML = `
        ${chev}
        <div class="st-check ${s.done ? 'checked' : ''}" data-action="st-toggle" data-path="${pathStr}"></div>
        <div class="st-text" data-action="st-edit" data-path="${pathStr}">${escapeHtml(s.text)}</div>
        <button class="st-add-trigger" data-action="st-add-focus" data-path="${pathStr}" title="Add subtask">${SUBTASK_PLUS_SVG}</button>
        <button class="st-del" data-action="st-del" data-path="${pathStr}" title="Remove">×</button>
        <div class="todo-weight mini" title="Position weight">
          <button data-action="sw-plus" data-path="${pathStr}" title="Move up">▲</button><button data-action="sw-minus" data-path="${pathStr}" title="Move down">▼</button><span>${s.weight || 0}</span>
        </div>
            ${timelineHtml(sLinked, Date.now(), true, s.color, s.elapsedColor)}
            ${sLinked ? '<span class="todo-etime" data-start="' + sLinked.start + '" data-end="' + sLinked.end + '">' + etimeText(sLinked, Date.now()) + '</span>' : ''}
          `;
      todoList.appendChild(sli);
      paintWeight(sli, s.weight || 0, !!sLinked);
      
      if (hasChildren && !isCollapsed) {
        count += renderSubtasks(s.subtasks, currentPath, depth + 1, baseIdx + count);
      }
    });
    return count;
  }

  function renderTodos() {
    todoList.innerHTML = '';
    todos.forEach((t, idx) => {
      const li = document.createElement('li');
      const linkedSess = t.blockId && sessions.find(s => s.id === t.blockId);
      const hasChildren = t.subtasks && t.subtasks.length > 0;
      const isCollapsed = t.collapsed;
      
      li.className = 'todo-item' + (t.done ? ' done' : '') + (linkedSess ? ' linked' : '');
      if (todoAnimEff() !== 'none') li.style.animationDelay = '0s, ' + (-(idx * 0.3)).toFixed(2) + 's';
      li.dataset.id = t.id;
      li.dataset.path = t.id;
      const subs = ensureSubtasks(t);
      const timeLine = timelineHtml(linkedSess, Date.now(), false, t.color, t.elapsedColor);

      const chev = hasChildren ? `<button class="st-collapse" data-action="collapse" data-path="${t.id}">${isCollapsed ? CHEVRON_SVG : CHEVRON_DOWN_SVG}</button>` : '<span class="st-collapse-spacer" style="width:14px;display:inline-block"></span>';

      li.innerHTML = `
        ${chev}
        <div class="todo-check ${t.done ? 'checked' : ''}" data-action="toggle" data-path="${t.id}"></div>
        <div class="todo-text" data-action="edit" data-path="${t.id}">${escapeHtml(t.text)}</div>
        <button class="st-add-trigger" data-action="st-add-focus" data-path="${t.id}" title="Add subtask">${SUBTASK_PLUS_SVG}</button>
        <button class="todo-del" data-action="del" data-path="${t.id}" title="Delete">×</button>
        <div class="todo-weight" title="Position weight (higher sits on top)">
          <button data-action="w-plus" data-path="${t.id}" title="Move up">▲</button><button data-action="w-minus" data-path="${t.id}" title="Move down">▼</button><span>${t.weight || 0}</span>
        </div>
        ${timeLine}
        ${linkedSess ? '<span class="todo-etime" data-start="' + linkedSess.start + '" data-end="' + linkedSess.end + '">' + etimeText(linkedSess, Date.now()) + '</span>' : ''}
      `;
      todoList.appendChild(li);
      paintWeight(li, t.weight || 0, !!linkedSess);

      if (hasChildren && !isCollapsed) {
        renderSubtasks(subs, [t.id], 1, idx);
      }
    });
  }

  function addTodo(text) {
    const t = (text || '').trim();
    if (!t) return;
    const hue = nextTodoHue();
    const col = todoHsl(hue, 85, 60);
    todos.unshift({
      id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
      text: t, done: false, createdAt: Date.now(),
      weight: 0, color: col, elapsedColor: deriveElapsedColor(col)
    });
    saveTodos();
    renderTodos();
    renderCalendar();
  }

  function removeTodo(id) {
    const li = todoList.querySelector(`.todo-item[data-id="${id}"]`);
    const dropFromList = () => {
      todos = todos.filter(t => t.id !== id);
      todoLists[activeTodoList].todos = todos; // keep the tab's array in sync
      saveTodos(); renderTodos(); renderCalendar();
    };
    if (li) {
      li.classList.add('removing');
      setTimeout(dropFromList, 260);
    } else {
      dropFromList();
    }
  }

  function toggleTodo(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    saveTodos(); renderTodos();
  }

  function bumpWeight(id, d) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    t.weight = clampWeight((t.weight || 0) + d);
    saveTodos();
    const card = todoList.querySelector(`.todo-item[data-id="${id}"]`);
    if (card) paintWeight(card, t.weight, !!(t.blockId && sessions.find(s => s.id === t.blockId)));
  }
  
  function bumpSubWeight(pathArr, d) {
    const s = getNodeByPath(pathArr);
    if (!s) return;
    s.weight = clampWeight((s.weight || 0) + d);
    saveTodos();
    const pathStr = pathArr.join(',');
    const card = todoList.querySelector(`.todo-item[data-path="${pathStr}"]`);
    if (card) paintWeight(card, s.weight, !!(s.blockId && sessions.find(x => x.id === s.blockId)));
  }

  function updateTodoText(id, text) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    const v = (text || '').trim();
    if (!v) { removeTodo(id); return; }
    t.text = v;
    saveTodos();
  }

  // Add box behavior: type + Enter to save
  todoAddBox.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const txt = todoAddBox.textContent.trim();
      if (txt) {
        addTodo(txt);
        todoAddBox.textContent = '';
        // Keep focus so the user can add more
        todoAddBox.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      todoAddBox.textContent = '';
      todoAddBox.blur();
    }
  });
  // Blur the add box when clicking outside the panel
  todoAddBox.addEventListener('blur', () => { /* keep text — user might want to come back */ });

  // + button focuses the add box
  todoAddPlus.addEventListener('click', () => {
    todoAddBox.focus();
  });

  // List interactions (event delegation)
  todoList.addEventListener('click', e => {
    // Link mode: a block is armed — parent cards attach/detach the todo,
    // subtask rows attach/detach that subtask. Delete still deletes.
    if (linkBlockId) {
      const delBtn = e.target.closest && (e.target.closest('[data-action="del"]') || e.target.closest('[data-action="st-del"]'));
      if (!delBtn) {
        const card = e.target.closest && e.target.closest('.todo-item[data-id]');
        if (card) { e.stopPropagation(); toggleTodoLink(card.dataset.id); return; }
        const sub = e.target.closest && e.target.closest('.todo-item[data-stid]');
        if (sub && sub.dataset.path) { e.stopPropagation(); toggleSubtaskLink(sub.dataset.path.split(',')); return; }
      }
    }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id || (el.dataset.path ? el.dataset.path.split(',')[0] : null);

    if (action === 'collapse') {
      e.stopPropagation();
      const p = el.dataset.path ? el.dataset.path.split(',') : [id];
      toggleCollapse(p);
      return;
    }
    if (action === 'st-toggle') {
      e.stopPropagation();
      toggleSubtask(el.dataset.path.split(','));
      return;
    }
    if (action === 'st-del') {
      e.stopPropagation();
      removeSubtask(el.dataset.path.split(','));
      return;
    }
    if (action === 'st-add-focus') {
      e.stopPropagation();
      const p = el.dataset.path ? el.dataset.path.split(',') : [id];
      const sid = Date.now() + '-st-' + Math.random().toString(36).slice(2,6);
      
      const targetNode = getNodeByPath(p);
      if (!targetNode) return;
      ensureSubtasks(targetNode).push({ id: sid, text: '', done: false, weight: 0, collapsed: false });
      targetNode.collapsed = false; // ensure it's open to see the new task
      saveTodos();
      renderTodos();
      renderCalendar();
      
      const newPath = el.dataset.path ? el.dataset.path + ',' + sid : id + ',' + sid;
      const newEl = todoList.querySelector(`.st-text[data-path="${newPath}"]`);
      if (newEl) {
        newEl.setAttribute('contenteditable', 'true');
        newEl.focus();
        const finish = () => {
          newEl.removeAttribute('contenteditable');
          newEl.removeEventListener('blur', finish);
          newEl.removeEventListener('keydown', onKey);
          updateSubtaskText(newPath.split(','), newEl.textContent);
          renderTodos();
        };
        const onKey = (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); newEl.blur(); }
          if (ev.key === 'Escape') { newEl.textContent = ''; newEl.blur(); }
        };
        newEl.addEventListener('blur', finish);
        newEl.addEventListener('keydown', onKey);
      }
      return;
    }
    if (action === 'st-edit') {
      e.stopPropagation();
      const p = el.dataset.path.split(',');
      el.setAttribute('contenteditable', 'true');
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const finish = () => {
        el.removeAttribute('contenteditable');
        el.removeEventListener('blur', finish);
        el.removeEventListener('keydown', onKey);
        updateSubtaskText(p, el.textContent);
        renderTodos();
      };
      const onKey = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
        if (ev.key === 'Escape') {
          const t = getNodeByPath(p);
          el.textContent = t ? t.text : '';
          el.blur();
        }
      };
      el.addEventListener('blur', finish);
      el.addEventListener('keydown', onKey);
      return;
    }

    // ── Original todo actions ──
    if (action === 'toggle') { toggleTodo(id); return; }
    if (action === 'del')    { e.stopPropagation(); removeTodo(id); return; }
    if (action === 'w-plus')  { e.stopPropagation(); bumpWeight(id, 1); return; }
    if (action === 'w-minus') { e.stopPropagation(); bumpWeight(id, -1); return; }
    if (action === 'sw-plus')  { e.stopPropagation(); bumpSubWeight(el.dataset.path.split(','), 1); return; }
    if (action === 'sw-minus')  { e.stopPropagation(); bumpSubWeight(el.dataset.path.split(','), -1); return; }
    if (action === 'edit') {
      el.setAttribute('contenteditable', 'true');
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      const finish = () => {
        el.removeAttribute('contenteditable');
        el.removeEventListener('blur', finish);
        el.removeEventListener('keydown', onKey);
        updateTodoText(id, el.textContent);
        renderTodos();
      };
      const onKey = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
        if (ev.key === 'Escape') { el.textContent = todos.find(t => t.id === id)?.text || ''; el.blur(); }
      };
      el.addEventListener('blur', finish);
      el.addEventListener('keydown', onKey);
    }
  });

  // Subtask drag & drop: reorder within parent, or move under another parent.
  // - Drag over a subtask = insert before/after (top/bottom half).
  // - Drag over a parent card = append to end of that parent.
  todoList.addEventListener('dragstart', e => {
    const sli = e.target.closest ? e.target.closest('.st-block') : null;
    if (!sli) return;
    if (sli.querySelector('[contenteditable="true"]')) { e.preventDefault(); return; }
    dragSub = { todoId: sli.dataset.todoid, subId: sli.dataset.stid };
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragSub.subId); } catch (_) {}
    requestAnimationFrame(() => sli.classList.add('dragging'));
  });
  todoList.addEventListener('dragover', e => {
    if (!dragSub) return;
    const sli = e.target.closest ? e.target.closest('.st-block') : null;
    const pli = e.target.closest ? e.target.closest('.todo-item:not(.st-block)') : null;
    if (!sli && !pli) return;
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
    const overOwnCard = sli && sli.dataset.todoid === dragSub.todoId && sli.dataset.stid === dragSub.subId;
    todoList.querySelectorAll('.drop-before,.drop-after,.drop-inside')
      .forEach(el => el.classList.remove('drop-before','drop-after','drop-inside'));
    if (sli && !overOwnCard) {
      const rc = sli.getBoundingClientRect();
      const after = (e.clientY - rc.top) > rc.height / 2;
      sli.classList.add(after ? 'drop-after' : 'drop-before');
    } else if (pli) {
      pli.classList.add('drop-inside');
    }
  });
  todoList.addEventListener('dragleave', e => {
    const li = e.target.closest ? e.target.closest('.todo-item') : null;
    if (li) li.classList.remove('drop-before','drop-after','drop-inside');
  });
  todoList.addEventListener('drop', e => {
    if (!dragSub) return;
    const sli = e.target.closest ? e.target.closest('.st-block') : null;
    const pli = e.target.closest ? e.target.closest('.todo-item:not(.st-block)') : null;
    if (sli && !(sli.dataset.todoid === dragSub.todoId && sli.dataset.stid === dragSub.subId)) {
      e.preventDefault();
      const rc = sli.getBoundingClientRect();
      const after = (e.clientY - rc.top) > rc.height / 2;
      moveSubtask(dragSub.todoId, dragSub.subId, sli.dataset.todoid, sli.dataset.stid, after ? 'after' : 'before');
    } else if (pli && !sli) {
      e.preventDefault();
      moveSubtask(dragSub.todoId, dragSub.subId, pli.dataset.id, null, 'inside-end');
    }
    dragSub = null;
    clearDropMarks();
  });
  todoList.addEventListener('dragend', () => { dragSub = null; clearDropMarks(); });

  // Live timelines + outside counters: refresh in place every second so the
  // seconds visibly tick (no re-render, never disturbs editing).
  setInterval(() => {
    try {
      const now = Date.now();
      todoList.querySelectorAll('.todo-timeline[data-start]').forEach(el => {
        const fill = el.firstElementChild;
        if (fill) fill.style.width = blockPct({ start: +el.dataset.start, end: +el.dataset.end }, now).toFixed(1) + '%';
      });
      todoList.querySelectorAll('.todo-etime[data-start]').forEach(el => {
        const txt = etimeText({ start: +el.dataset.start, end: +el.dataset.end }, now);
        if (el.textContent !== txt) el.textContent = txt;
      });
    } catch (_) {}
  }, 1000);

  normalizeTodoWeights();
  applyTodoAnim();
  applyCalAnim();
  renderTodoTabs();
  renderTodos();
  renderCalendar();

  window.addEventListener('mousemove', e => {
    lastMouseMove = Date.now();
    const rect = canvas.getBoundingClientRect();
    lastMouseX = e.clientX - rect.left;
    lastMouseY = e.clientY - rect.top;
  });

  function startEditLabel(idx, taskIdx, box) {
     if (editingLabelIdx === idx && editingTaskIdx === taskIdx && editInput) return;
     stopEditLabel(true);
     editingLabelIdx = idx;
     editingTaskIdx = taskIdx;
     lastLabelSig = '__editing__';
     
     const sizeScale = tooltipSize || 1.0;
     const fontPx = Math.round(11 * sizeScale);
     const sess = sessions[idx];
     const tasks = sess ? (sess.tasks || []) : [];
     const isPlaceholder = taskIdx === -1;
     const currentText = isPlaceholder ? '' : (tasks[taskIdx] || '');

     editInput = document.createElement('input');
     editInput.type = 'text';
     editInput.value = currentText;
     editInput.placeholder = isPlaceholder ? 'New task...' : 'Task name...';
     Object.assign(editInput.style, {
        position: 'absolute',
        left: box.x + 'px',
        top: box.y + 'px',
        width: Math.max(box.w, 64) + 'px',
        height: box.h + 'px',
        background: 'rgba(10,10,20,0.96)',
        border: '1px solid ' + (sess ? sess.color : '#3b82f6'),
        borderRadius: '3px',
        color: '#fff',
        fontSize: fontPx + 'px',
        fontWeight: '600',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '0 3px',
        outline: 'none',
        zIndex: '500',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
        pointerEvents: 'auto'
     });
     editInput.addEventListener('input', () => {
        if (!sessions[idx]) return;
        const t = sessions[idx].tasks || [];
        if (isPlaceholder) return; // handled on blur/enter
        t[taskIdx] = editInput.value;
        save();
     });
     editInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
           const val = editInput.value.trim();
           if (isPlaceholder && val && sessions[idx]) {
              if (!sessions[idx].tasks) sessions[idx].tasks = [];
              sessions[idx].tasks.push(val);
              save();
           }
           stopEditLabel();
        }
        if (e.key === 'Escape') stopEditLabel();
     });
     editInput.addEventListener('blur', () => setTimeout(() => {
        if (!editInput) return;
        const val = editInput.value.trim();
        if (isPlaceholder && val && sessions[idx]) {
           if (!sessions[idx].tasks) sessions[idx].tasks = [];
           sessions[idx].tasks.push(val);
           save();
        } else if (!isPlaceholder && sessions[idx]) {
           // If user cleared the text, remove the task
           if (!val && sessions[idx].tasks) {
              sessions[idx].tasks.splice(taskIdx, 1);
              save();
           }
        }
        stopEditLabel();
     }, 100));
     editInput.addEventListener('mousedown', e => e.stopPropagation());
     document.getElementById('clock-wrapper').appendChild(editInput);
     editInput.focus();
     editInput.select();
  }

  function stopEditLabel(silent) {
     editingLabelIdx = -1;
     editingTaskIdx = -1;
     if (editInput && editInput.parentNode) editInput.parentNode.removeChild(editInput);
     editInput = null;
     if (!silent) lastLabelSig = '__editdone__';
  }

  // ── Circular task labels: text set directly on the orbit ring ──
  // Upper-half arcs read normally (glyphs stand outward on the ring);
  // lower-half arcs flip (glyphs hang under the ring) so text stays
  // readable everywhere. Layout is cached by signature; only the motion
  // (radial/tangent wobble, glow, alpha) is evaluated per frame.
  let lastLabelSig = '__init__';
  let labelLayouts = []; // [{idx,mid,upper,R,font,lineH,chars,total,half,isPH,color}]
  let labelArcs = [];    // per-frame hit records [{idx,R,mid,half,lineH,x0,y0,x1,y1,chip,isPH,visible}]
  let lastMouseCanvas = null; // canvas-relative mouse, for placeholder proximity

  function labelMotionParams(style) {
    // r: radial px amp, rf: Hz, t: tangential px amp, tf: Hz,
    // a: alpha dip, af: Hz, g: glow 0-2, w/wf: per-glyph wave, hb: heartbeat, gl: glitch gate
    switch (style) {
      case 'slide': return { t:6, tf:.5 };
      case 'fade': return { a:.45, af:.5 };
      case 'flip': return { t:4, tf:.7, r:2, rf:.7 };
      case 'typewriter': return { t:2, tf:.5, a:.12, af:.5 };
      case 'glow-in': return { g:1 };
      case 'scale-pop': return { r:4, rf:.5 };
      case 'swing': return { t:5, tf:.45 };
      case 'wave': return { r:3, rf:.8, w:2, wf:1 };
      case 'jitter': return { t:2, tf:6, r:1.5, rf:7 };
      case 'orbit': return { t:4, tf:.3 };
      case 'breathing': return { r:4, rf:.25, a:.1, af:.25 };
      case 'elastic': return { r:6, rf:.5 };
      case 'wobble': return { t:3, tf:.9, r:2, rf:.9 };
      case 'neon-pulse': return { g:2, a:.2, af:1.2 };
      case 'shiver': return { t:1.2, tf:8 };
      case 'heartbeat': return { r:5, rf:.9, hb:1 };
      case 'float-tilt': return { r:3, rf:.5, t:3, tf:.5 };
      case 'zoom-spin': return { r:5, rf:.4, t:5, tf:.4 };
      case 'glitch': return { t:3, tf:5, g:1, gl:1 };
      case 'flicker': return { a:.6, af:1.8 };
      case 'drift': return { t:7, tf:.3 };
      case 'pendulum': return { t:6, tf:.45 };
      case 'snake': return { w:3, wf:1.2 };
      case 'blink': return { a:.7, af:.4 };
      case 'tada': return { r:4, rf:.5, t:4, tf:.5 };
      default: return { r:6, rf:.5 }; // bounce
    }
  }

  function motionPad(mp) { return 6 + (mp.r || 0) + (mp.t || 0); }

  // Sample points across an arc (upper: θ grows left→right; lower: shrinks).
  function arcSamples(upper, mid, half, n) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const off = n === 1 ? 0 : -half + (2 * half * k) / (n - 1);
      out.push(upper ? mid + off : mid - off);
    }
    return out;
  }

  function labelSig(cx, cy, r, W, H) {
    return [cx|0, cy|0, r|0, W, H, tooltipSize, tooltipAnim, titleGap,
      sessions.map(s => s.start + ':' + s.end + ':' + JSON.stringify(s.tasks||[]) + ':' + (s.color || '')).join('|'),
      editingLabelIdx + ':' + editingTaskIdx].join('~');
  }

  let nextLabelCheckAt = 0;
  function syncLabels(cx, cy, r, W, H) {
    // Serializing all label content every frame is expensive for long task
    // lists. A four-times-per-second validation is imperceptible here and
    // still reacts immediately to explicit resize/expiry invalidations.
    const now = performance.now();
    if (lastLabelSig !== '__resize__' && lastLabelSig !== '__expiry__' && now < nextLabelCheckAt) return;
    nextLabelCheckAt = now + 250;
    // Change-driven: re-layout only when data or geometry changed.
    const sig = labelSig(cx, cy, r, W, H);
    if (sig === lastLabelSig) return;
    lastLabelSig = sig;
    layoutLabels(cx, cy, r, W, H);
  }

  // Expired sessions drop off the dial: re-check visibility every 10s and
  // invalidate ONLY when the visible set actually changed.
  let lastVisSig = '';
  setInterval(() => {
    try {
      if (document.hidden) return;
      const now = Date.now();
      const vs = sessions.map(s => (s && s.end > now - 300000 && s.tasks && s.tasks.length ? '1' : '0')).join('');
      if (vs !== lastVisSig) { lastVisSig = vs; lastLabelSig = '__expiry__'; }
    } catch (_) {}
  }, 10000);

  // Ask main to grow the window so labels never clip (throttled, grow-only).
  let lastFitSent = { t: -1, b: -1 }, lastFitAt = 0;
  function maybeFitWindow(needT, needB) {
    if (!windowFitAuto || !api.fitWindow) return;
    needT = Math.max(0, Math.ceil(needT)); needB = Math.max(0, Math.ceil(needB));
    const now = performance.now();
    if ((needT === lastFitSent.t && needB === lastFitSent.b) || now - lastFitAt < 800) return;
    lastFitSent = { t: needT, b: needB }; lastFitAt = now;
    try { api.fitWindow({ top: needT, bottom: needB }); } catch (_) {}
  }

  function layoutLabels(cx, cy, r, W, H) {
    const now = Date.now();
    labelLayouts = [];
    if (!SESSIONS_ENABLED) return; // no ring labels while allocations are off
    const sizeScale = tooltipSize || 1.0;
    const baseFont = Math.round(12 * sizeScale);
    const mp = labelMotionParams(tooltipAnim || 'bounce');
    const pad = motionPad(mp);
    const orbitR = orbitRadius(r);
    const outerGap = Math.max(OUTER_GAP_BASE * titleGap, Math.round(10 * sizeScale));
    const wrapRect0 = document.getElementById('clock-wrapper').getBoundingClientRect();
    const eastMax = window.innerWidth - (wrapRect0.left || 0) - 4;
    let fitMin = Infinity, fitMax = -Infinity;
    sessions.forEach((sess, i) => {
      if (!sess || sess.end < now - 5 * 60 * 1000) return;
      const tasks = sess.tasks || [];
      const hasTasks = tasks.length > 0;
      // Multi-task stacks radially: every task shares the block midpoint
      // angle, each row sits one line-height further out — one below another.
      const mid = getAngleForDate(new Date((sess.start + sess.end) / 2));
      const rowGap = Math.max(3, Math.round(4 * sizeScale));
      let stackY = 0; // accumulated radial offset for rows below
      const emit = (taskText, t, isPH, addMarker) => {
        if (!taskText) return;
        const itemTaskIdx = (isPH || addMarker) ? -1 : t;
        if (editingLabelIdx === i && editingTaskIdx === itemTaskIdx) return;
        const upper = Math.sin(mid) < 0;
        let cur = addMarker ? Math.max(9, baseFont * 0.78) : baseFont, chars = null, total = 0, lineH = 0, R = 0, half = 0;
        for (let a = 0; a < 12; a++) {
          X.font = `600 ${cur}px Inter, system-ui, sans-serif`;
          lineH = cur * 1.15;
          R = orbitR + outerGap + stackY + lineH / 2 + pad;
          const gap = cur * 0.08;
          chars = [...taskText].map(ch => ({ ch, adv: X.measureText(ch).width + gap }));
          total = chars.reduce((s, c) => s + c.adv, 0);
          half = (total / 2) / R;
          let ok = true;
          for (const th of arcSamples(upper, mid, half, 9)) {
            for (const rr of [R - lineH / 2, R + lineH / 2]) {
              const px = cx + Math.cos(th) * rr, py = cy + Math.sin(th) * rr;
              if (px < 2 || px > eastMax || py < 2 || py > H - 2) { ok = false; break; }
            }
            if (!ok) break;
          }
          if (ok || cur <= 8) break;
          cur -= 1;
        }
        labelLayouts.push({ idx: i, taskIdx: itemTaskIdx, mid, upper, R, font: cur, lineH, chars, total, half, isPH, addMarker, color: sess.color || '#3b82f6' });
        stackY += lineH + rowGap;
        if (!isPH && !addMarker) {
          for (const th of arcSamples(upper, mid, half, 9)) {
            for (const rr of [R - lineH / 2, R + lineH / 2]) {
              const py = cy + Math.sin(th) * rr;
              if (py < fitMin) fitMin = py;
              if (py > fitMax) fitMax = py;
            }
          }
        }
      };
      // No '+' add-markers around the dial: blocks show only their real tasks.
      // (Tasks are managed from the Blocks tab / todo panel instead.)
      tasks.forEach((txt, t) => emit(txt, t, false, false));
    });
    maybeFitWindow(4 - fitMin, fitMax - (H - 4));
  }

  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= PI2;
    while (d < -Math.PI) d += PI2;
    return d;
  }

  function hitLabelArc(mx, my) {
    const { cx, cy } = clockBounds(); // cached metrics, no reflow
    for (let k = labelArcs.length - 1; k >= 0; k--) {
      const A = labelArcs[k];
      if (!A.visible) continue;
      if (A.chip && Math.hypot(mx - A.chip.x, my - A.chip.y) < A.chip.r + 5)
        return { kind: 'chip', arc: A };
      const d = Math.hypot(mx - cx, my - cy);
      if (Math.abs(d - A.R) < A.lineH * 0.8) {
        if (Math.abs(angDiff(Math.atan2(my - cy, mx - cx), A.mid)) < A.half + 0.04)
          return { kind: 'text', arc: A };
      }
    }
    return null;
  }

  function drawCircularLabels(cx, cy) {
    const mp = labelMotionParams(tooltipAnim || 'bounce');
    const t = performance.now() / 1000;
    labelArcs = [];
    X.save();
    X.textAlign = 'center';
    X.textBaseline = 'middle';
    for (const L of labelLayouts) {
      const ax = cx + Math.cos(L.mid) * L.R, ay = cy + Math.sin(L.mid) * L.R;
      let visible = true, alpha = 1;
      if (L.isPH) {
        // Placeholder '+' only surfaces when the mouse comes close.
        visible = !!(lastMouseCanvas && Math.hypot(lastMouseCanvas.x - ax, lastMouseCanvas.y - ay) < 90);
        alpha = 0.55 + 0.25 * Math.sin(t * 2 + L.idx);
        if (!visible) { labelArcs.push({ idx: L.idx, isPH: true, visible: false }); continue; }
      }
      const seed = L.idx * 100 + (L.taskIdx >= 0 ? L.taskIdx : 0);
      const s1 = Math.sin(PI2 * (mp.rf || 0.5) * t + seed * 1.3);
      const s2 = Math.sin(PI2 * (mp.tf || 0.5) * t + seed * 2.1);
      let radial = (mp.r || 0) * s1;
      if (mp.hb) {
        const ph = ((t * (mp.rf || 0.9)) + seed * 0.37) % 1;
        radial += (mp.r || 0) * Math.pow(Math.max(0, Math.sin(ph * PI2)), 6);
      }
      let tangPx = (mp.t || 0) * s2;
      if (mp.gl) tangPx *= (Math.sin(t * 0.7 + seed) > 0.6) ? 1 : 0.15; // glitch gate
      alpha *= 1 - (mp.a || 0) * (0.5 + 0.5 * Math.sin(PI2 * (mp.af || 0.5) * t + seed));
      alpha = Math.max(0, Math.min(1, alpha));
      const R = L.R + radial;
      const tang = tangPx / R; // tangential wobble as angular offset
      X.font = `600 ${L.font}px Inter, system-ui, sans-serif`;
      X.globalAlpha = alpha;
      X.fillStyle = L.isPH ? '#e9d5ff' : (L.addMarker ? 'rgba(255,255,255,0.38)' : '#ffffff');
      if (L.addMarker) X.globalAlpha = alpha * 0.75;
      if (mp.g) { X.shadowColor = L.color; X.shadowBlur = 10 * mp.g * (0.6 + 0.4 * s1); }
      else X.shadowBlur = 0;
      let acc = -L.total / 2;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const n = L.chars.length;
      L.chars.forEach((c, k) => {
        const off = acc + c.adv / 2; acc += c.adv;
        let wob = 0;
        if (mp.w) wob = mp.w * Math.sin(PI2 * (mp.wf || 1) * t + k * 0.7 + seed);
        const th = L.upper ? L.mid + (off + wob) / R + tang
                           : L.mid - (off + wob) / R - tang;
        const px = cx + Math.cos(th) * R, py = cy + Math.sin(th) * R;
        if (px < x0) x0 = px; if (px > x1) x1 = px;
        if (py < y0) y0 = py; if (py > y1) y1 = py;
        X.save();
        X.translate(px, py);
        X.rotate(L.upper ? th + Math.PI / 2 : th - Math.PI / 2);
        X.fillText(c.ch, 0, 0);
        X.restore();
      });
      // Leading color dot marks the block's color.
      if (!L.addMarker) {
        const thLead = L.upper ? L.mid - L.half : L.mid + L.half;
        const thDot = L.upper ? thLead - 9 / R : thLead + 9 / R;
        X.save();
        X.globalAlpha = alpha;
        X.shadowBlur = mp.g ? 8 : 0;
        X.shadowColor = L.color;
        X.fillStyle = L.color;
        X.beginPath();
        X.arc(cx + Math.cos(thDot) * R, cy + Math.sin(thDot) * R, Math.max(2.5, L.font * 0.22), 0, PI2);
        X.fill();
        X.restore();
      }
      // Trailing × chip clears the task (sits on the reading side).
      let chip = null;
      if (!L.isPH && !L.addMarker) {
        const thTrail = L.upper ? L.mid + L.half : L.mid - L.half;
        const chipR = Math.max(8, L.font * 0.55);
        const thChip = L.upper ? thTrail + (chipR + 6) / R : thTrail - (chipR + 6) / R;
        const chx = cx + Math.cos(thChip) * R, chy = cy + Math.sin(thChip) * R;
        X.save();
        X.globalAlpha = alpha * 0.9;
        X.shadowBlur = 0;
        X.fillStyle = 'rgba(10,10,20,0.85)';
        X.strokeStyle = 'rgba(239,68,68,0.8)';
        X.lineWidth = 1;
        X.beginPath(); X.arc(chx, chy, chipR, 0, PI2); X.fill(); X.stroke();
        X.fillStyle = '#f87171';
        X.font = `700 ${Math.round(chipR * 1.1)}px Inter, system-ui, sans-serif`;
        X.fillText('×', chx, chy + 0.5);
        X.restore();
        chip = { x: chx, y: chy, r: chipR };
        if (chx - chipR < x0) x0 = chx - chipR;
        if (chx + chipR > x1) x1 = chx + chipR;
        if (chy - chipR < y0) y0 = chy - chipR;
        if (chy + chipR > y1) y1 = chy + chipR;
      }
      const padB = 4;
      labelArcs.push({ idx: L.idx, taskIdx: L.taskIdx, R, mid: L.mid, half: L.half, upper: L.upper,
        lineH: L.lineH, x0: x0 - padB, y0: y0 - padB, x1: x1 + padB, y1: y1 + padB,
        chip, isPH: L.isPH, addMarker: L.addMarker, visible: true });
    }
    X.restore();
    if (lastMouseCanvas) {
      try { canvas.style.cursor = hitLabelArc(lastMouseCanvas.x, lastMouseCanvas.y) ? 'pointer' : ''; }
      catch (_) {}
    }
  }

  window.addEventListener('mousemove', e => {
    // Canvas-relative mouse for placeholder proximity + hover cursor.
    try {
      const rect = canvas.getBoundingClientRect();
      lastMouseCanvas = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    } catch (_) {}

// Click-through: DISABLED — the window now has an opaque backdrop (#0e0e17),
// so every pixel belongs to the app. Forwarding clicks based on canvas alpha
// would create invisible holes (user sees solid panel, clicks fall through).
// Only re-arms to interactive if some stale state left it ignoring.
    try {
      if (ignoreMouseActive) { ignoreMouseActive = false; api.setIgnoreMouse(false); }
      return;
    } catch (_) {
      if (ignoreMouseActive) { ignoreMouseActive = false; api.setIgnoreMouse(false); }
    }
  });

  function drawGearIcon(cx, cy, r) {
    // Positioned OUTSIDE the dial — past the orbit ring, top-right diagonal.
    const gearAngle = -Math.PI / 4;
    const gearRadius = r + ORBIT_GAP + 26;
    gearX = cx + Math.cos(gearAngle) * gearRadius;
    gearY = cy + Math.sin(gearAngle) * gearRadius;
    
    const elapsed = Date.now() - lastMouseMove;
    const targetOp = elapsed < 1800 ? 0.7 : 0;
    gearOpacity += (targetOp - gearOpacity) * 0.1;
    if (gearOpacity < 0.02) return;

    X.save();
    X.globalAlpha = gearOpacity;
    
    // Background circle
    X.beginPath();
    X.arc(gearX, gearY, gearR, 0, PI2);
    X.fillStyle = 'rgba(255,255,255,0.1)';
    X.fill();
    X.strokeStyle = 'rgba(255,255,255,0.2)';
    X.lineWidth = 1;
    X.stroke();

    // Gear teeth
    const teethCount = 8;
    const outerR = gearR * 0.75;
    const innerR = gearR * 0.55;
    X.beginPath();
    for (let i = 0; i < teethCount; i++) {
      const a1 = (i / teethCount) * PI2;
      const a2 = ((i + 0.35) / teethCount) * PI2;
      const a3 = ((i + 0.5) / teethCount) * PI2;
      const a4 = ((i + 0.85) / teethCount) * PI2;
      if (i === 0) X.moveTo(gearX + Math.cos(a1) * outerR, gearY + Math.sin(a1) * outerR);
      X.lineTo(gearX + Math.cos(a2) * outerR, gearY + Math.sin(a2) * outerR);
      X.lineTo(gearX + Math.cos(a2) * innerR, gearY + Math.sin(a2) * innerR);
      X.lineTo(gearX + Math.cos(a3) * innerR, gearY + Math.sin(a3) * innerR);
      X.lineTo(gearX + Math.cos(a4) * innerR, gearY + Math.sin(a4) * innerR);
      X.lineTo(gearX + Math.cos(a4) * outerR, gearY + Math.sin(a4) * outerR);
      const a5 = ((i + 1) / teethCount) * PI2;
      X.lineTo(gearX + Math.cos(a5) * outerR, gearY + Math.sin(a5) * outerR);
    }
    X.closePath();
    X.fillStyle = 'rgba(255,255,255,0.85)';
    X.fill();

    // Center hole
    X.beginPath();
    X.arc(gearX, gearY, gearR * 0.22, 0, PI2);
    X.fillStyle = 'rgba(0,0,0,0.6)';
    X.fill();

    X.restore();
  }

  function isClickOnGear(mx, my) {
    return gearOpacity > 0.1 && Math.hypot(mx - gearX, my - gearY) < gearR + 4;
  }

  // -- Bottom grip: big round drag button, always drags the window --
  function drawGrabHandle(cx, cy, r) {
    handleX = cx;
    handleY = cy + r + 36;
    const elapsed = Date.now() - lastMouseMove;
    const targetOp = elapsed < 1800 ? 0.6 : 0;
    handleOpacity += (targetOp - handleOpacity) * 0.1;
    if (handleOpacity < 0.02) return;
    X.save();
    X.globalAlpha = handleOpacity;
    const R = 18;
    X.beginPath();
    X.arc(handleX, handleY, R, 0, PI2);
    X.fillStyle = 'rgba(255,255,255,0.10)';
    X.fill();
    X.strokeStyle = 'rgba(255,255,255,0.30)';
    X.lineWidth = 1.5;
    X.stroke();
    // 3x3 grip dots
    X.fillStyle = 'rgba(255,255,255,0.60)';
    for (let gy = -1; gy <= 1; gy++) {
      for (let gx = -1; gx <= 1; gx++) {
        X.beginPath();
        X.arc(handleX + gx * 7, handleY + gy * 7, 1.8, 0, PI2);
        X.fill();
      }
    }
    X.restore();
  }

  function isOnGrabHandle(mx, my) {
    return handleOpacity > 0.1 && Math.hypot(mx - handleX, my - handleY) < 26;
  }

  // -- Resize grip (dial bottom-right): drags a diagonal arrow → window grows --
  function isOnResizeHandle(mx, my) {
    return Math.hypot(mx - resizeHandleX, my - resizeHandleY) < 18;
  }
  function drawResizeHandle(cx, cy, r) {
    resizeHandleX = cx + r + 34;
    resizeHandleY = cy + r + 34;
    // Reveal on hover (pinned while the cursor is over it) or recent mouse use.
    const over = lastMouseCanvas && isOnResizeHandle(lastMouseCanvas.x, lastMouseCanvas.y);
    const elapsed = Date.now() - lastMouseMove;
    const targetOp = (over || elapsed < 1800) ? 0.7 : 0;
    resizeOpacity += (targetOp - resizeOpacity) * 0.18;
    if (resizeOpacity < 0.02) return;
    X.save();
    X.globalAlpha = resizeOpacity;
    X.beginPath(); X.arc(resizeHandleX, resizeHandleY, 14, 0, PI2);
    X.fillStyle = 'rgba(10,10,20,0.7)'; X.fill();
    X.lineWidth = 1; X.strokeStyle = 'rgba(255,255,255,0.35)'; X.stroke();
    X.strokeStyle = 'rgba(255,255,255,0.75)';
    X.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      X.beginPath();
      X.moveTo(resizeHandleX - 11 + i * 4, resizeHandleY + 11 - i * 4);
      X.lineTo(resizeHandleX - 4 + i * 4, resizeHandleY + 4 - i * 4);
      X.stroke();
    }
    X.restore();
  }

  // -- Exit × (dial top-left, hover button): closes the app --
  function isOnExitButton(mx, my) {
    return Math.hypot(mx - exitX, my - exitY) < 16;
  }
  function drawExitButton(cx, cy, r) {
    exitX = cx - r - 34;
    exitY = cy - r - 34;
    const over = lastMouseCanvas && isOnExitButton(lastMouseCanvas.x, lastMouseCanvas.y);
    const elapsed = Date.now() - lastMouseMove;
    const targetOp = (over || elapsed < 1800) ? 0.7 : 0;
    exitOpacity += (targetOp - exitOpacity) * 0.18;
    if (exitOpacity < 0.02) return;
    X.save();
    X.globalAlpha = exitOpacity;
    X.beginPath(); X.arc(exitX, exitY, 13, 0, PI2);
    X.fillStyle = 'rgba(10,10,20,0.78)'; X.fill();
    X.lineWidth = 1.5; X.strokeStyle = 'rgba(239,68,68,0.8)'; X.stroke();
    X.strokeStyle = '#ef4444';
    X.lineWidth = 2;
    const s = 5.5;
    X.beginPath();
    X.moveTo(exitX - s, exitY - s); X.lineTo(exitX + s, exitY + s);
    X.moveTo(exitX + s, exitY - s); X.lineTo(exitX - s, exitY + s);
    X.stroke();
    X.restore();
  }

  // ── Tooltip size indicator (brief flash after Ctrl+scroll) ──
  function drawTooltipSizeIndicator(cx, cy, r) {
    if (!tooltipResizePulse) return;
    const elapsed = performance.now() - tooltipResizePulse;
    if (elapsed > 1200) { tooltipResizePulse = 0; return; }
    const fade = 1 - (elapsed / 1200);
    const label = `Tooltip ${(tooltipSize || 1.0).toFixed(1)}×`;
    X.save();
    X.globalAlpha = fade;
    X.font = '700 12px Inter, system-ui, sans-serif';
    const tw = X.measureText(label).width;
    const padX = 12, padY = 6;
    const bw = tw + padX * 2, bh = 12 + padY * 2;
    const bx = cx - bw / 2;
    const by = Math.max(4, cy - r + 8);
    X.beginPath();
    const pr = bh / 2;
    X.roundRect(bx, by, bw, bh, pr);
    X.closePath();
    X.fillStyle = 'rgba(167,139,250,0.92)';
    X.shadowColor = 'rgba(167,139,250,0.5)';
    X.shadowBlur = 14;
    X.fill();
    X.shadowBlur = 0;
    X.fillStyle = '#fff';
    X.textAlign = 'center';
    X.textBaseline = 'middle';
    X.fillText(label, cx, by + pr);
    X.restore();
  }

  function drawGhostPure(cx,cy,r,hrF,minF,secF,t) {
     const [ha,ma,sa]=angles(hrF,minF,secF);
     for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
       X.beginPath();X.arc(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88,Math.max(1.5,r*0.012),0,PI2);
       X.fillStyle='rgba(255,255,255,0.18)';X.fill();}
     drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.65)','rgba(255,255,255,0.45)',t.sec,false,0.7);
  }

  function drawGhostMist(cx,cy,r,hrF,minF,secF,t) {
     X.save();X.globalAlpha=0.15;
     for(let l=0;l<3;l++){const rr=r*0.85-l*12;
       X.beginPath();X.arc(cx,cy,rr,0,PI2);
       X.strokeStyle=l===0?'rgba(255,255,255,0.5)':l===1?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.15)';
       X.lineWidth=1;X.stroke();}
     X.restore();
     const [ha,ma,sa]=angles(hrF,minF,secF);
     drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.55)','rgba(255,255,255,0.4)',t.sec,false,0.65);
  }

  function drawGhostPrism(cx,cy,r,hrF,minF,secF,t) {
     const [ha,ma,sa]=angles(hrF,minF,secF);
     // Chromatic offset hands
     drawHandSet(cx-1.5,cy,r,ha,ma,sa,'rgba(239,68,68,0.7)','rgba(239,68,68,0.5)',null);
     drawHandSet(cx+1.5,cy,r,ha,ma,sa,'rgba(56,189,248,0.7)','rgba(56,189,248,0.5)',null);
     drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','rgba(255,255,255,0.9)',t.sec,true);
  }

  function drawGhostWireframe(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r*0.9,0,PI2);
    X.strokeStyle='rgba(255,255,255,0.06)';X.lineWidth=0.5;X.stroke();
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.beginPath();X.moveTo(cx+Math.sin(a)*r*0.82,cy-Math.cos(a)*r*0.82);
      X.lineTo(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88);
      X.strokeStyle='rgba(255,255,255,0.2)';X.lineWidth=0.8;X.stroke();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'rgba(255,255,255,0.7)',t.sec,true);
  }


  function drawGhostShadow(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    // Soft floating dark shadow hands with zero outline
    drawHandSet(cx+3,cy+4,r,ha,ma,sa,'rgba(0,0,0,0.55)','rgba(0,0,0,0.4)',null);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.9)','rgba(255,255,255,0.7)',t.sec);
  }

  function drawGhostEmber(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.7)','rgba(255,255,255,0.5)',t.sec);
    // Floating glowing ember particles at tips
    const hx=cx+Math.sin(ha)*r*0.5, hy=cy-Math.cos(ha)*r*0.5;
    const mx=cx+Math.sin(ma)*r*0.74, my=cy-Math.cos(ma)*r*0.74;
    X.save();X.shadowColor='#f97316';X.shadowBlur=12;
    X.beginPath();X.arc(hx,hy,Math.max(3,r*0.025),0,PI2);X.fillStyle='#f97316';X.fill();
    X.beginPath();X.arc(mx,my,Math.max(2.5,r*0.02),0,PI2);X.fillStyle='#fbbf24';X.fill();
    X.restore();
  }

  function drawGhostGlass(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    X.save();X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=15;
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.4)','rgba(255,255,255,0.25)',t.sec,true);
    X.restore();
  }

  function drawGhostStarlight(cx,cy,r,hrF,minF,secF,t) {
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.save();X.shadowColor='#fff';X.shadowBlur=6;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.85,cy-Math.cos(a)*r*0.85,Math.max(1.8,r*0.014),0,PI2);
      X.fillStyle='#fff';X.fill();X.restore();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','rgba(255,255,255,0.8)',t.sec,true);
  }

  function drawGhostPulsar(cx,cy,r,hrF,minF,secF,t) {
    const pulse=1+Math.sin(Date.now()*0.004)*0.08;
    X.save();X.shadowColor=t.accent;X.shadowBlur=16*pulse;
    X.beginPath();X.arc(cx,cy,r*0.06*pulse,0,PI2);X.fillStyle=t.accent;X.fill();X.restore();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff',t.accent,t.sec,true);
  }

  function drawGhostCyberpunk(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    X.save();X.shadowColor='#06b6d4';X.shadowBlur=8;
    drawHandSet(cx,cy,r,ha,ma,sa,'#06b6d4','#ec4899',t.sec,true);
    X.restore();
  }

  function drawGhostZenith(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(226,232,240,0.85)','rgba(203,213,225,0.65)',t.sec,false,0.85);
  }

  function drawHandsOnlyDark(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88,Math.max(1.5,r*0.012),0,PI2);
      X.fillStyle='rgba(255,255,255,0.12)';X.fill();}
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.85)','rgba(255,255,255,0.6)',t.sec);
  }

  function drawHandsOnlyGlow(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.save();X.shadowColor=t.accent;X.shadowBlur=4;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88,Math.max(1.5,r*0.012),0,PI2);
      X.fillStyle=t.accent;X.fill();X.restore();}
    X.save();X.shadowColor=t.accent;X.shadowBlur=8;
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'rgba(255,255,255,0.7)',t.sec,true);
    X.restore();
  }

  /* ================================================================
   *  MODULAR HAND DRAWING SYSTEM — 9 Types + helpers
   * ================================================================ */

  function drawHandSet(cx, cy, r, hAngle, mAngle, sAngle, hCol, mCol, sCol, glowSec=false, opacityScale=1) {
    X.save();
    if (opacityScale < 1) X.globalAlpha *= opacityScale;
    const hType = handType, mType = handType, sType = handType;
    const HANDS = {
      tapered: {
        hour: (cx,cy,a,len,col) => _tapered(cx,cy,a,len,len*0.09,len*0.03,col),
        minute: (cx,cy,a,len,col) => _tapered(cx,cy,a,len,len*0.065,len*0.02,col)
      },
      sword: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
          const w=len*0.04;
          X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w*0.7,-len*0.4);X.lineTo(0,-len);X.lineTo(w*0.7,-len*0.4);X.lineTo(w,0);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
          const w=len*0.03;
          X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w*0.7,-len*0.45);X.lineTo(0,-len);X.lineTo(w*0.7,-len*0.45);X.lineTo(w,0);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      dauphine: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
          const w=len*0.05;
          X.beginPath();X.moveTo(0,len*0.1);X.lineTo(-w,0);X.lineTo(-w*0.3,-len*0.5);X.lineTo(0,-len);X.lineTo(w*0.3,-len*0.5);X.lineTo(w,0);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
          const w=len*0.04;
          X.beginPath();X.moveTo(0,len*0.1);X.lineTo(-w,0);X.lineTo(-w*0.3,-len*0.5);X.lineTo(0,-len);X.lineTo(w*0.3,-len*0.5);X.lineTo(w,0);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      leaf: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
          X.beginPath();X.moveTo(0,len*0.12);
          X.quadraticCurveTo(-len*0.06,-len*0.3,0,-len);
          X.quadraticCurveTo(len*0.06,-len*0.3,0,len*0.12);
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
          X.beginPath();X.moveTo(0,len*0.12);
          X.quadraticCurveTo(-len*0.045,-len*0.35,0,-len);
          X.quadraticCurveTo(len*0.045,-len*0.35,0,len*0.12);
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      baton: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
          X.beginPath();X.roundRect(-len*0.025,len*0.1,len*0.05,-len-len*0.1,len*0.012);
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
          X.beginPath();X.roundRect(-len*0.018,len*0.1,len*0.036,-len-len*0.1,len*0.009);
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      skeletonH: {
        hour: (cx,cy,a,len,col) => _tapered(cx,cy,a,len,len*0.09,len*0.03,col,true),
        minute: (cx,cy,a,len,col) => _tapered(cx,cy,a,len,len*0.065,len*0.02,col,true)
      },
      arrow: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
          const w=len*0.035;
          X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.7);X.lineTo(-w*1.8,-len*0.7);X.lineTo(0,-len);X.lineTo(w*1.8,-len*0.7);X.lineTo(w,-len*0.7);X.lineTo(w,len*0.1);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
          const w=len*0.025;
          X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.72);X.lineTo(-w*1.8,-len*0.72);X.lineTo(0,-len);X.lineTo(w*1.8,-len*0.72);X.lineTo(w,-len*0.72);X.lineTo(w,len*0.1);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      spade: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
          const w=len*0.025;
          X.beginPath();X.moveTo(-w,len*0.12);X.lineTo(-w,-len*0.65);
          X.quadraticCurveTo(-len*0.07,-len*0.85,0,-len);
          X.quadraticCurveTo(len*0.07,-len*0.85,w,-len*0.65);
          X.lineTo(w,len*0.12);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
          const w=len*0.018;
          X.beginPath();X.moveTo(-w,len*0.12);X.lineTo(-w,-len*0.68);
          X.quadraticCurveTo(-len*0.055,-len*0.88,0,-len);
          X.quadraticCurveTo(len*0.055,-len*0.88,w,-len*0.68);
          X.lineTo(w,len*0.12);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      cathedral: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
          const w=len*0.04;
          X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w,-len*0.5);X.lineTo(-w*0.5,-len*0.55);X.lineTo(-w*0.5,-len);X.lineTo(0,-len*0.95);X.lineTo(w*0.5,-len);X.lineTo(w*0.5,-len*0.55);X.lineTo(w,-len*0.5);X.lineTo(w,0);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
          const w=len*0.03;
          X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w,-len*0.5);X.lineTo(-w*0.4,-len*0.55);X.lineTo(-w*0.4,-len);X.lineTo(0,-len*0.96);X.lineTo(w*0.4,-len);X.lineTo(w*0.4,-len*0.55);X.lineTo(w,-len*0.5);X.lineTo(w,0);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      // ── Needle styles (3 new) ──
      needle: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=5;
          X.beginPath();X.moveTo(0,len*0.15);X.lineTo(-len*0.012,len*0.05);X.lineTo(0,-len);X.lineTo(len*0.012,len*0.05);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=4;
          X.beginPath();X.moveTo(0,len*0.15);X.lineTo(-len*0.008,len*0.05);X.lineTo(0,-len);X.lineTo(len*0.008,len*0.05);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      spike: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.5)';X.shadowBlur=6;
          X.beginPath();X.moveTo(0,len*0.2);X.lineTo(-len*0.006,len*0.08);X.lineTo(0,-len);X.lineTo(len*0.006,len*0.08);X.closePath();
          X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,len*0.08,len*0.012,0,PI2);X.fillStyle=col;X.fill();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.45)';X.shadowBlur=5;
          X.beginPath();X.moveTo(0,len*0.2);X.lineTo(-len*0.004,len*0.08);X.lineTo(0,-len);X.lineTo(len*0.004,len*0.08);X.closePath();
          X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,len*0.08,len*0.009,0,PI2);X.fillStyle=col;X.fill();
          X.restore();
        }
      },
      alpha: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=5;
          // Diamond-tip alpha hand
          X.beginPath();X.moveTo(0,len*0.18);X.lineTo(-len*0.022,len*0.02);X.lineTo(-len*0.006,-len*0.5);X.lineTo(0,-len);X.lineTo(len*0.006,-len*0.5);X.lineTo(len*0.022,len*0.02);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=4;
          X.beginPath();X.moveTo(0,len*0.18);X.lineTo(-len*0.015,len*0.02);X.lineTo(-len*0.005,-len*0.5);X.lineTo(0,-len);X.lineTo(len*0.005,-len*0.5);X.lineTo(len*0.015,len*0.02);X.closePath();
          X.fillStyle=col;X.fill();X.restore();
        }
      },
      chronometer: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=5;
          X.beginPath();X.moveTo(-len*0.035,len*0.15);X.lineTo(len*0.035,len*0.15);
          X.lineTo(len*0.018,-len*0.75);X.lineTo(0,-len);X.lineTo(-len*0.018,-len*0.75);X.closePath();
          X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,len*0.15,len*0.08,0,PI2);X.lineWidth=1.5;X.strokeStyle=col;X.stroke();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=4;
          X.beginPath();X.moveTo(-len*0.025,len*0.15);X.lineTo(len*0.025,len*0.15);
          X.lineTo(len*0.012,-len*0.8);X.lineTo(0,-len);X.lineTo(-len*0.012,-len*0.8);X.closePath();
          X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,len*0.15,len*0.065,0,PI2);X.lineWidth=1.5;X.strokeStyle=col;X.stroke();
          X.restore();
        }
      },
      luminous: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=5;
          X.beginPath();X.roundRect(-len*0.05,-len,len*0.1,len*1.12,len*0.02);X.fillStyle=col;X.fill();
          X.beginPath();X.roundRect(-len*0.02,-len*0.9,len*0.04,len*0.7,len*0.01);X.fillStyle='rgba(255,255,255,0.9)';X.fill();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=4;
          X.beginPath();X.roundRect(-len*0.038,-len,len*0.076,len*1.12,len*0.015);X.fillStyle=col;X.fill();
          X.beginPath();X.roundRect(-len*0.015,-len*0.92,len*0.03,len*0.75,len*0.008);X.fillStyle='rgba(255,255,255,0.9)';X.fill();
          X.restore();
        }
      },
      minimalist_dot: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=5;
          X.beginPath();X.moveTo(0,len*0.1);X.lineTo(0,-len*0.82);X.lineWidth=Math.max(2,len*0.04);X.strokeStyle=col;X.lineCap='round';X.stroke();
          X.beginPath();X.arc(0,-len,Math.max(3,len*0.09),0,PI2);X.fillStyle=col;X.fill();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
          X.beginPath();X.moveTo(0,len*0.1);X.lineTo(0,-len*0.86);X.lineWidth=Math.max(1.5,len*0.026);X.strokeStyle=col;X.lineCap='round';X.stroke();
          X.beginPath();X.arc(0,-len,Math.max(2.5,len*0.07),0,PI2);X.fillStyle=col;X.fill();
          X.restore();
        }
      },
      art_deco: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=5;
          const w=len*0.055;
          X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(w,len*0.1);X.lineTo(w,-len*0.3);X.lineTo(w*0.6,-len*0.3);
          X.lineTo(w*0.6,-len*0.65);X.lineTo(w*0.3,-len*0.65);X.lineTo(0,-len);
          X.lineTo(-w*0.3,-len*0.65);X.lineTo(-w*0.6,-len*0.65);X.lineTo(-w*0.6,-len*0.3);X.lineTo(-w,-len*0.3);
          X.closePath();X.fillStyle=col;X.fill();X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=4;
          const w=len*0.04;
          X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(w,len*0.1);X.lineTo(w,-len*0.35);X.lineTo(w*0.6,-len*0.35);
          X.lineTo(w*0.6,-len*0.7);X.lineTo(w*0.25,-len*0.7);X.lineTo(0,-len);
          X.lineTo(-w*0.25,-len*0.7);X.lineTo(-w*0.6,-len*0.7);X.lineTo(-w*0.6,-len*0.35);X.lineTo(-w,-len*0.35);
          X.closePath();X.fillStyle=col;X.fill();X.restore();
        }
      },
      scalpel: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=5;
          X.beginPath();X.moveTo(0,len*0.55);X.lineTo(-len*0.008,len*0.5);
          X.lineTo(-len*0.006,-len*0.3);X.lineTo(0,-len);X.lineTo(len*0.006,-len*0.3);X.lineTo(len*0.008,len*0.5);X.closePath();
          X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,len*0.48,len*0.012,0,PI2);X.fillStyle='rgba(255,255,255,0.5)';X.fill();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
          X.beginPath();X.moveTo(0,len*0.55);X.lineTo(-len*0.005,len*0.51);
          X.lineTo(-len*0.004,-len*0.35);X.lineTo(0,-len);X.lineTo(len*0.004,-len*0.35);X.lineTo(len*0.005,len*0.51);X.closePath();
          X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,len*0.5,len*0.008,0,PI2);X.fillStyle='rgba(255,255,255,0.5)';X.fill();
          X.restore();
        }
      },
      flame: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(239,68,68,0.55)';X.shadowBlur=9;
          X.beginPath();X.moveTo(0,len*0.2);
          X.quadraticCurveTo(-len*0.055,-len*0.4,0,-len);
          X.quadraticCurveTo(len*0.03,-len*0.5,len*0.035,len*0.05);
          X.quadraticCurveTo(len*0.028,len*0.3,0,len*0.2);
          X.closePath();X.fillStyle=col;X.fill();
          X.beginPath();X.moveTo(0,len*0.15);
          X.quadraticCurveTo(-len*0.018,-len*0.35,0,-len*0.82);
          X.quadraticCurveTo(len*0.012,-len*0.3,0,len*0.15);
          X.fillStyle='rgba(255,255,255,0.28)';X.fill();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(239,68,68,0.5)';X.shadowBlur=7;
          X.beginPath();X.moveTo(0,len*0.2);
          X.quadraticCurveTo(-len*0.042,-len*0.42,0,-len);
          X.quadraticCurveTo(len*0.024,-len*0.52,len*0.028,len*0.05);
          X.quadraticCurveTo(len*0.022,len*0.3,0,len*0.2);
          X.closePath();X.fillStyle=col;X.fill();
          X.beginPath();X.moveTo(0,len*0.15);
          X.quadraticCurveTo(-len*0.014,-len*0.36,0,-len*0.84);
          X.quadraticCurveTo(len*0.01,-len*0.3,0,len*0.15);
          X.fillStyle='rgba(255,255,255,0.28)';X.fill();
          X.restore();
        }
      },
      crystal: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=5;
          const gr=X.createLinearGradient(-len*0.05,0,len*0.05,0);
          gr.addColorStop(0,'rgba(255,255,255,0.7)');gr.addColorStop(0.25,col);gr.addColorStop(1,col);
          X.beginPath();X.moveTo(0,len*0.35);X.lineTo(-len*0.02,len*0.05);X.lineTo(-len*0.055,-len*0.5);
          X.lineTo(0,-len);X.lineTo(len*0.055,-len*0.5);X.lineTo(len*0.02,len*0.05);X.closePath();
          X.fillStyle=gr;X.fill();
          X.lineWidth=0.6;X.strokeStyle='rgba(255,255,255,0.35)';
          X.beginPath();X.moveTo(-len*0.018,-len*0.15);X.lineTo(len*0.018,-len*0.15);X.stroke();
          X.beginPath();X.moveTo(-len*0.03,-len*0.45);X.lineTo(len*0.03,-len*0.45);X.stroke();
          X.beginPath();X.moveTo(-len*0.012,-len*0.75);X.lineTo(len*0.012,-len*0.75);X.stroke();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=4;
          const gr=X.createLinearGradient(-len*0.04,0,len*0.04,0);
          gr.addColorStop(0,'rgba(255,255,255,0.7)');gr.addColorStop(0.25,col);gr.addColorStop(1,col);
          X.beginPath();X.moveTo(0,len*0.35);X.lineTo(-len*0.015,len*0.05);X.lineTo(-len*0.042,-len*0.52);
          X.lineTo(0,-len);X.lineTo(len*0.042,-len*0.52);X.lineTo(len*0.015,len*0.05);X.closePath();
          X.fillStyle=gr;X.fill();
          X.lineWidth=0.6;X.strokeStyle='rgba(255,255,255,0.35)';
          X.beginPath();X.moveTo(-len*0.013,-len*0.15);X.lineTo(len*0.013,-len*0.15);X.stroke();
          X.beginPath();X.moveTo(-len*0.022,-len*0.45);X.lineTo(len*0.022,-len*0.45);X.stroke();
          X.beginPath();X.moveTo(-len*0.008,-len*0.76);X.lineTo(len*0.008,-len*0.76);X.stroke();
          X.restore();
        }
      },
      ruler: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=5;
          const w=len*0.045;
          X.beginPath();X.roundRect(-w,len*0.08,w*2,-len*1.1,w*0.5);X.fillStyle=col;X.fill();
          X.strokeStyle='rgba(255,255,255,0.6)';X.lineWidth=0.7;
          for (let i=0;i<12;i++){
            const yy=len*0.08-(i+1)*len*0.09;
            X.beginPath();X.moveTo(-w,yy);X.lineTo(-w + (i%3===0?w*2: (i%3===1?w*1.2:w*0.6)),yy);X.stroke();
          }
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=4;
          const w=len*0.035;
          X.beginPath();X.roundRect(-w,len*0.08,w*2,-len*1.1,w*0.4);X.fillStyle=col;X.fill();
          X.strokeStyle='rgba(255,255,255,0.6)';X.lineWidth=0.6;
          for (let i=0;i<10;i++){
            const yy=len*0.08-(i+1)*len*0.095;
            X.beginPath();X.moveTo(-w,yy);X.lineTo(-w + (i%3===0?w*2: (i%3===1?w*1.2:w*0.6)),yy);X.stroke();
          }
          X.restore();
        }
      },
      halo: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=5;
          const w=len*0.03;
          X.beginPath();X.roundRect(-w,len*0.1,w*2,-len*0.85,w*0.5);X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,-len,len*0.1,0,PI2);X.strokeStyle=col;X.lineWidth=w*1.3;X.stroke();
          X.beginPath();X.arc(0,-len,1.6,0,PI2);X.fillStyle=col;X.fill();
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
          const w=len*0.022;
          X.beginPath();X.roundRect(-w,len*0.1,w*2,-len*0.87,w*0.4);X.fillStyle=col;X.fill();
          X.beginPath();X.arc(0,-len,len*0.078,0,PI2);X.strokeStyle=col;X.lineWidth=w*1.3;X.stroke();
          X.beginPath();X.arc(0,-len,1.3,0,PI2);X.fillStyle=col;X.fill();
          X.restore();
        }
      },
      meridian: {
        hour: (cx,cy,a,len,col) => { X.save();X.translate(cx,cy);X.rotate(a);X.beginPath();X.moveTo(-len*.055,len*.12);X.lineTo(len*.055,len*.12);X.lineTo(len*.018,-len*.78);X.lineTo(0,-len);X.lineTo(-len*.018,-len*.78);X.closePath();X.fillStyle=col;X.fill();X.restore(); },
        minute: (cx,cy,a,len,col) => { X.save();X.translate(cx,cy);X.rotate(a);X.beginPath();X.moveTo(-len*.035,len*.1);X.lineTo(len*.035,len*.1);X.lineTo(len*.012,-len*.82);X.lineTo(0,-len);X.lineTo(-len*.012,-len*.82);X.closePath();X.fillStyle=col;X.fill();X.restore(); }
      },
      ribbon: {
        hour: (cx,cy,a,len,col) => { X.save();X.translate(cx,cy);X.rotate(a);X.beginPath();X.moveTo(0,len*.15);X.bezierCurveTo(-len*.07,-len*.15,-len*.06,-len*.62,0,-len);X.bezierCurveTo(len*.06,-len*.62,len*.07,-len*.15,0,len*.15);X.fillStyle=col;X.fill();X.restore(); },
        minute: (cx,cy,a,len,col) => { X.save();X.translate(cx,cy);X.rotate(a);X.beginPath();X.moveTo(0,len*.13);X.bezierCurveTo(-len*.045,-len*.18,-len*.04,-len*.66,0,-len);X.bezierCurveTo(len*.04,-len*.66,len*.045,-len*.18,0,len*.13);X.fillStyle=col;X.fill();X.restore(); }
      },
      bracket: {
        hour: (cx,cy,a,len,col) => { X.save();X.translate(cx,cy);X.rotate(a);X.lineWidth=Math.max(2,len*.035);X.strokeStyle=col;X.lineCap='round';X.beginPath();X.moveTo(0,len*.12);X.lineTo(0,-len*.78);X.stroke();X.beginPath();X.arc(0,-len*.8,len*.12,0,Math.PI);X.stroke();X.restore(); },
        minute: (cx,cy,a,len,col) => { X.save();X.translate(cx,cy);X.rotate(a);X.lineWidth=Math.max(1.5,len*.024);X.strokeStyle=col;X.lineCap='round';X.beginPath();X.moveTo(0,len*.1);X.lineTo(0,-len*.84);X.stroke();X.beginPath();X.arc(0,-len*.85,len*.085,0,Math.PI);X.stroke();X.restore(); }
      },
      barley: {
        hour: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=5;
          X.beginPath();X.moveTo(0,len*0.25);
          X.quadraticCurveTo(-len*0.022,0,-len*0.022,-len*0.6);
          X.quadraticCurveTo(-len*0.045,-len*0.8,0,-len);
          X.quadraticCurveTo(len*0.045,-len*0.8,len*0.022,-len*0.6);
          X.quadraticCurveTo(len*0.022,0,0,len*0.25);
          X.closePath();
          const gr=X.createLinearGradient(0,len*0.2,0,-len);
          gr.addColorStop(0,col);gr.addColorStop(1,'rgba(255,255,255,0.45)');
          X.fillStyle=gr;X.fill();
          X.fillStyle='rgba(255,255,255,0.5)';
          for (let i=0;i<6;i++){
            const yy=len*0.1-(i+1)*len*0.14;
            X.beginPath();X.arc((i%2?len*0.02:-len*0.02),yy,len*0.007,0,PI2);X.fill();
          }
          X.restore();
        },
        minute: (cx,cy,a,len,col) => {
          X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
          X.beginPath();X.moveTo(0,len*0.25);
          X.quadraticCurveTo(-len*0.017,0,-len*0.017,-len*0.62);
          X.quadraticCurveTo(-len*0.035,-len*0.82,0,-len);
          X.quadraticCurveTo(len*0.035,-len*0.82,len*0.017,-len*0.62);
          X.quadraticCurveTo(len*0.017,0,0,len*0.25);
          X.closePath();
          const gr=X.createLinearGradient(0,len*0.2,0,-len);
          gr.addColorStop(0,col);gr.addColorStop(1,'rgba(255,255,255,0.45)');
          X.fillStyle=gr;X.fill();
          X.fillStyle='rgba(255,255,255,0.5)';
          for (let i=0;i<5;i++){
            const yy=len*0.12-(i+1)*len*0.15;
            X.beginPath();X.arc((i%2?len*0.015:-len*0.015),yy,len*0.006,0,PI2);X.fill();
          }
          X.restore();
        }
      }
    };
    const H = HANDS[hType] || HANDS.tapered;
    const M = HANDS[mType] || HANDS.tapered;
    H.hour(cx, cy, hAngle, r*0.55, hCol);
    M.minute(cx, cy, mAngle, r*0.82, mCol);
    if (sCol) {
      X.save();X.translate(cx,cy);X.rotate(sAngle);
      X.beginPath();X.moveTo(0,-r*0.88);X.lineTo(-1.2,r*0.05);X.lineTo(1.2,r*0.05);X.closePath();
      X.fillStyle=sCol;X.fill();
      if (glowSec) { X.shadowColor=sCol; X.shadowBlur=6; X.fill(); X.shadowBlur=0; }
      X.restore();
    }
    X.beginPath();X.arc(cx,cy,Math.max(3,r*0.025),0,PI2);
    X.fillStyle=hCol;X.fill();
    X.restore();
  }

  function drawNeedle(cx,cy,a,len,col,glow) {
    X.save();X.translate(cx,cy);X.rotate(a);
    X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-1.5,0);X.lineTo(0,-len);X.lineTo(1.5,0);X.closePath();
    X.fillStyle=col;X.fill();X.restore();
  }

  function _tapered(cx,cy,a,len,bw,tw,col,hollow,glowCol) {
    X.save();X.translate(cx,cy);X.rotate(a);
    X.beginPath();X.moveTo(0,len*0.1);X.lineTo(-bw,0);X.lineTo(-tw,-len*0.5);X.lineTo(0,-len);X.lineTo(tw,-len*0.5);X.lineTo(bw,0);X.closePath();
    if (hollow) { X.strokeStyle=col; X.lineWidth=1.2; X.stroke(); } else { X.fillStyle=col; X.fill(); }
    if (glowCol) { X.shadowColor=glowCol; X.shadowBlur=6; X.stroke(); X.shadowBlur=0; }
    X.restore();
  }

  function bezel(cx,cy,r,colors) {
    const grd = X.createLinearGradient(cx-r, cy-r, cx+r, cy+r);
    grd.addColorStop(0, colors[0]); grd.addColorStop(0.5, colors[1]); grd.addColorStop(1, colors[2]);
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle=grd;X.fill();
  }
  function ticks60(cx,cy,r,hCol,mCol,hW,mW) {
    for(let i=0;i<60;i++){
      const a=i*6*DEG2RAD;
      const isMajor = i%5===0;
      const ri=r*(isMajor?0.88:0.92), ro=r*0.96;
      X.beginPath();X.moveTo(cx+Math.sin(a)*ri,cy-Math.cos(a)*ri);
      X.lineTo(cx+Math.sin(a)*ro,cy-Math.cos(a)*ro);
      X.strokeStyle=isMajor?hCol:mCol;X.lineWidth=isMajor?hW:mW;X.stroke();
    }
  }
  function nums12(cx,cy,r,rFrac,font,col) {
    X.fillStyle=col;X.font=font;X.textAlign='center';X.textBaseline='middle';
    for(let i=1;i<=12;i++){
      const a=(i%12)*30*DEG2RAD;
      X.fillText(i.toString(),cx+Math.sin(a)*r*rFrac,cy-Math.cos(a)*r*rFrac);
    }
  }
  function angles(hrF,minF,secF) {
    return [
      (hrF/12)*PI2,
      (minF/60)*PI2,
      (secF/60)*PI2
    ];
  }

  /* ── WITH DIAL (25) ── */

  function drawClassic(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#2e2e38','#1b1b22','#111116']);
    X.beginPath();X.arc(cx,cy,r-0.5,0,PI2);X.strokeStyle='rgba(255,255,255,0.12)';X.lineWidth=1;X.stroke();
    const gf=X.createRadialGradient(cx,cy-r*0.2,r*0.05,cx,cy,r*0.88);
    gf.addColorStop(0,'#fff');gf.addColorStop(0.8,'#ebeef2');gf.addColorStop(1,'#ced4da');
    X.beginPath();X.arc(cx,cy,r*0.88,0,PI2);X.fillStyle=gf;X.fill();
    ticks60(cx,cy,r,'#0f172a','rgba(15,23,42,0.35)',Math.max(2,r*0.016),Math.max(0.8,r*0.005));
    nums12(cx,cy,r,0.67,'600 '+(r*0.15)+'px "Inter",sans-serif','#0f172a');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#0f172a','#1e293b',t.sec);
  }

  function drawMinimal(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor='rgba(0,0,0,0.6)';X.shadowBlur=r*0.1;
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#09090b';X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,r-1,0,PI2);X.strokeStyle=t.accent;X.lineWidth=1.5;X.stroke();
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;const s=i%3===0?Math.max(2.5,r*0.022):Math.max(1.2,r*0.01);
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.82,cy-Math.cos(a)*r*0.82,s,0,PI2);
      X.fillStyle=i%3===0?'#fff':'rgba(255,255,255,0.25)';X.fill();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','rgba(255,255,255,0.85)',t.accent,true);
  }

  function drawRoman(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor='rgba(0,0,0,0.7)';X.shadowBlur=r*0.12;
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0c0a09';X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#d97706';X.lineWidth=2.5;X.stroke();
    const rom=['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
    X.font='600 '+(r*0.13)+'px serif';X.fillStyle='#fef3c7';X.textAlign='center';X.textBaseline='middle';
    rom.forEach((n,i)=>{const a=i*30*DEG2RAD;X.fillText(n,cx+Math.sin(a)*r*0.74,cy-Math.cos(a)*r*0.74);});
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fef3c7','#fde68a','#ef4444');
  }

  function drawNeon(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#030712';X.fill();
    X.save();X.shadowColor=t.accent;X.shadowBlur=18;
    X.beginPath();X.arc(cx,cy,r-1,0,PI2);X.strokeStyle=t.accent;X.lineWidth=2;X.stroke();X.restore();
    nums12(cx,cy,r,0.68,'600 '+(r*0.12)+'px "Inter",sans-serif',t.accent);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','#ddd',t.sec,true);
  }

  function drawSkeleton(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor='rgba(0,0,0,0.8)';X.shadowBlur=r*0.1;
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0f172a';X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle=t.accent;X.lineWidth=1.5;X.stroke();
    ticks60(cx,cy,r,t.accent,'rgba(255,255,255,0.2)',1.5,0.6);
    nums12(cx,cy,r,0.56,'400 '+(r*0.13)+'px "Inter",sans-serif','rgba(255,255,255,0.7)');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.9)',t.accent,t.sec);
  }

  function drawChrono(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#27272a','#18181b','#09090b']);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD,o=r*0.85,len=r*0.08,inner=o-len;
      X.beginPath();X.moveTo(cx+Math.sin(a)*inner,cy-Math.cos(a)*inner);
      X.lineTo(cx+Math.sin(a)*o,cy-Math.cos(a)*o);X.strokeStyle='#f4f4f5';X.lineWidth=Math.max(2.5,r*0.02);X.stroke();}
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fafafa','#e4e4e7','#dc2626');
  }

  function drawBauhaus(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#f8fafc';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#0f172a';X.lineWidth=3;X.stroke();
    ticks60(cx,cy,r,'#0f172a','#0f172a',3,1);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#0f172a','#0f172a','#e11d48');
  }

  function drawSwiss(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#fafafa';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#71717a';X.lineWidth=r*0.04;X.stroke();
    ticks60(cx,cy,r,'#18181b','#52525b',3,1);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#18181b','#18181b','#dc2626');
  }

  function drawPilot(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0a0a0f';X.fill();
    ticks60(cx,cy,r,'#e2e8f0','rgba(255,255,255,0.15)',2,0.5);
    nums12(cx,cy,r,0.67,'600 '+(r*0.14)+'px "Inter",sans-serif','#e2e8f0');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#e2e8f0','#cbd5e1',t.sec);
  }

  function drawDiver(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0c1117';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#374151';X.lineWidth=r*0.06;X.stroke();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#e2e8f0','#94a3b8',t.sec);
  }

  function drawArtDeco(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#1a1814';X.fill();
    nums12(cx,cy,r,0.6,'600 '+(r*0.13)+'px serif','#d4a574');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fef3c7','#d4a574','#ef4444');
  }

  function drawSundial(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#f5f0e6';X.fill();
    const [ha,ma]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,0,'#5c4a32','#8b7355','rgba(0,0,0,0)');
  }

  function drawDashboard(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#111111';X.fill();
    nums12(cx,cy,r,0.64,'500 '+(r*0.12)+'px "Inter",sans-serif','#aaa');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','#cccccc',t.accent);
  }

  function drawDotMatrix(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0a0a12';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'rgba(255,255,255,0.7)',t.sec,true);
  }

  function drawFloatingNum(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0e0e18';X.fill();
    nums12(cx,cy,r,0.82,'500 '+(r*0.1)+'px "Inter",sans-serif',t.accent);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.8)','rgba(255,255,255,0.55)',t.sec,true);
  }

  /* NEW DIAL DESIGNS (+10) */

  function drawAstronomy(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#030712';X.fill();
    // Star map dots
    for(let i=0;i<30;i++){
      const sx=cx+(Math.sin(i*7)*0.7)*r, sy=cy+(Math.cos(i*13)*0.7)*r;
      X.beginPath();X.arc(sx,sy,Math.max(0.6,r*0.008),0,PI2);
      X.fillStyle='rgba(255,255,255,0.3)';X.fill();
    }
    nums12(cx,cy,r,0.74,'400 '+(r*0.12)+'px serif','#c084fc');
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#c084fc','#e9d5ff',t.sec,true);
  }

  function drawSubmariner(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#0284c7','#0369a1','#075985']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#f0f9ff','#bae6fd',t.sec);
  }

  function drawIndustrial(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#475569','#334155','#1e293b']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#f8fafc','#cbd5e1','#f97316');
  }

  function drawPapercraft(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#f1f5f9';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#334155','#64748b','#ef4444');
  }

  function drawRetroLCD(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#84cc16';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#1a2e05','#2d4a09','#1a2e05');
  }

  function drawZen(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#1c1917';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#e7e5e4','#a8a29e',t.sec);
  }

  function drawHologram(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#042f2e';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#2dd4bf','#99f6e4',t.sec,true);
  }

  function drawCopper(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#b45309','#92400e','#78350f']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fef3c7','#fde68a','#ef4444');
  }

  function drawMonochrome(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#000000';X.fill();
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.strokeStyle='#ffffff';X.lineWidth=4;X.stroke();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','#ffffff','#ffffff');
  }

  function drawRegatta(cx,cy,r,hrF,minF,secF,t) {
    bezel(cx,cy,r,['#1e3a8a','#1e40af','#1d4ed8']);
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ffffff','#e0e7ff','#ef4444');
  }

  /* ── UNIQUE MOTION (14) ── */

  function drawOrbit(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#020617';X.fill();
    const rH=r*0.45,rM=r*0.68,rS=r*0.88;
    [rH,rM,rS].forEach((o,i)=>{X.beginPath();X.arc(cx,cy,o,0,PI2);
      X.strokeStyle=i===2?t.glow:'rgba(255,255,255,0.08)';X.lineWidth=i===2?1.5:1;X.stroke();});
    const [ha,ma,sa]=angles(hrF,minF,secF);
    const hx=cx+Math.sin(ha)*rH,hy=cy-Math.cos(ha)*rH;
    X.beginPath();X.moveTo(cx,cy);X.lineTo(hx,hy);X.strokeStyle='rgba(255,255,255,0.4)';X.lineWidth=2;X.stroke();
    X.beginPath();X.arc(hx,hy,Math.max(5,r*0.04),0,PI2);X.fillStyle='#fff';X.fill();
    const mx=cx+Math.sin(ma)*rM,my=cy-Math.cos(ma)*rM;
    X.beginPath();X.moveTo(cx,cy);X.lineTo(mx,my);X.strokeStyle=t.accent;X.lineWidth=1.5;X.stroke();
    X.beginPath();X.arc(mx,my,Math.max(4,r*0.03),0,PI2);X.fillStyle=t.accent;X.fill();
    const sx=cx+Math.sin(sa)*rS,sy=cy-Math.cos(sa)*rS;
    X.save();X.shadowColor=t.sec;X.shadowBlur=12;
    X.beginPath();X.moveTo(cx,cy);X.lineTo(sx,sy);X.strokeStyle=t.sec;X.lineWidth=0.9;X.stroke();
    X.beginPath();X.arc(sx,sy,Math.max(3,r*0.025),0,PI2);X.fillStyle=t.sec;X.fill();X.restore();
    X.beginPath();X.arc(cx,cy,Math.max(4,r*0.03),0,PI2);X.fillStyle='#fff';X.fill();
  }

  function drawConcentric(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#050510';X.fill();
    const rings=[{f:secF/60,r:r*0.88,w:r*0.04,col:t.sec},{f:minF/60,r:r*0.68,w:r*0.06,col:t.accent},{f:hrF/12,r:r*0.45,w:r*0.08,col:'#fff'}];
    rings.forEach(ring=>{
      X.beginPath();X.arc(cx,cy,ring.r,0,PI2);X.strokeStyle='rgba(255,255,255,0.06)';X.lineWidth=ring.w;X.stroke();
      const arc=ring.f*PI2;
      X.save();X.shadowColor=ring.col;X.shadowBlur=8;
      X.beginPath();X.arc(cx,cy,ring.r,-Math.PI/2,-Math.PI/2+arc);
      X.strokeStyle=ring.col;X.lineWidth=ring.w;X.lineCap='round';X.stroke();X.restore();
    });
  }

  function drawRadar(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#020a08';X.fill();
    const sa=secF*6*DEG2RAD-Math.PI/2;
    const sweepGrad=X.createConicGradient(sa,cx,cy);
    sweepGrad.addColorStop(0,'rgba(16,185,129,0.35)');sweepGrad.addColorStop(0.15,'rgba(16,185,129,0)');
    sweepGrad.addColorStop(1,'rgba(16,185,129,0)');
    X.beginPath();X.arc(cx,cy,r*0.9,0,PI2);X.fillStyle=sweepGrad;X.fill();
  }

  function drawGradientArc(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#09090b';X.fill();
    const now=new Date();let h12=now.getHours()%12||12;
    X.font='600 '+(r*0.22)+'px "Inter",sans-serif';X.fillStyle='#fff';X.textAlign='center';X.textBaseline='middle';
    X.fillText(String(h12).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),cx,cy);
  }

  /* NEW MOTION DESIGNS (+10) */

  function drawHourglass(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0c0a09';X.fill();
    const now=new Date();let h12=now.getHours()%12||12;
    X.font='600 '+(r*0.2)+'px "Inter",sans-serif';X.fillStyle=t.accent;X.textAlign='center';X.textBaseline='middle';
    X.fillText(String(h12).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),cx,cy);
  }

  function drawSonar(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#030712';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,t.accent,'#38bdf8',t.sec,true);
  }

  function drawSine(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#09090b';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff',t.accent,t.sec,true);
  }

  function drawDNA(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#020617';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#38bdf8',t.accent,t.sec,true);
  }

  function drawPendulum(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0f172a';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#f8fafc',t.accent,t.sec);
  }

  function drawCompass(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#1c1917';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#ef4444','#f8fafc',t.sec);
  }

  function drawEclipseMotion(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#000';X.fill();
    X.save();X.shadowColor=t.accent;X.shadowBlur=20;
    X.beginPath();X.arc(cx,cy,r*0.8,0,PI2);X.strokeStyle=t.accent;X.lineWidth=4;X.stroke();X.restore();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff',t.accent,t.sec,true);
  }

  function drawMatrixRain(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#022c22';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#4ade80','#22c55e','#ef4444',true);
  }

  function drawEqualizer(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0f172a';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#38bdf8',t.accent,t.sec,true);
  }

  function drawVortex(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#090514';X.fill();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#c084fc',t.accent,t.sec,true);
  }

  // Lightweight additions to the face catalog: distinct looks without adding
  // image assets or retaining off-screen canvases in memory.
  function drawAurora(cx,cy,r,hrF,minF,secF,t) {
    const g=X.createRadialGradient(cx-r*.25,cy-r*.35,r*.08,cx,cy,r);
    g.addColorStop(0,'#1d3a4a');g.addColorStop(.58,'#102438');g.addColorStop(1,'#07131f');
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle=g;X.fill();
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;X.beginPath();X.arc(cx+Math.sin(a)*r*.79,cy-Math.cos(a)*r*.79,i%3===0?2.5:1.2,0,PI2);X.fillStyle=i%3===0?'#a7f3d0':'rgba(186,230,253,.7)';X.fill();}
    const [ha,ma,sa]=angles(hrF,minF,secF);drawHandSet(cx,cy,r,ha,ma,sa,'#ecfeff','#a5f3fc',t.sec,true);
  }
  function drawNoir(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#0b0c10';X.fill();
    X.beginPath();X.arc(cx,cy,r*.92,0,PI2);X.strokeStyle='rgba(244,63,94,.45)';X.lineWidth=1.5;X.stroke();
    ticks60(cx,cy,r,'#f8fafc','#52525b',2.2,.7);
    const [ha,ma,sa]=angles(hrF,minF,secF);drawHandSet(cx,cy,r,ha,ma,sa,'#f8fafc','#a1a1aa','#fb7185',true);
  }
  function drawLumen(cx,cy,r,hrF,minF,secF,t) {
    const g=X.createLinearGradient(cx-r,cy-r,cx+r,cy+r);g.addColorStop(0,'#f8fafc');g.addColorStop(1,'#dbeafe');
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle=g;X.fill();
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;X.beginPath();X.roundRect(cx+Math.sin(a)*r*.77-1.5,cy-Math.cos(a)*r*.77-5,3,10,1.5);X.fillStyle=i%3===0?'#1e3a8a':'#60a5fa';X.fill();}
    const [ha,ma,sa]=angles(hrF,minF,secF);drawHandSet(cx,cy,r,ha,ma,sa,'#1e3a8a','#2563eb','#f43f5e');
  }
  function drawGridline(cx,cy,r,hrF,minF,secF,t) {
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle='#07111f';X.fill();
    X.save();X.beginPath();X.arc(cx,cy,r*.94,0,PI2);X.clip();X.strokeStyle='rgba(56,189,248,.14)';X.lineWidth=1;
    for(let n=-4;n<=4;n++){X.beginPath();X.moveTo(cx-r,cy+n*r*.3);X.lineTo(cx+r,cy+n*r*.3);X.stroke();X.beginPath();X.moveTo(cx+n*r*.3,cy-r);X.lineTo(cx+n*r*.3,cy+r);X.stroke();}X.restore();
    const [ha,ma,sa]=angles(hrF,minF,secF);drawHandSet(cx,cy,r,ha,ma,sa,'#e0f2fe','#38bdf8','#f472b6',true);
  }

  /* ── Router Map (52) ── */
  const STYLES = {
    // Ghost / Hands Only (13)
    handsonly_ghost:drawGhostPure, ghost_mist:drawGhostMist, ghost_prism:drawGhostPrism,
    ghost_wireframe:drawGhostWireframe, ghost_shadow:drawGhostShadow, ghost_ember:drawGhostEmber,
    ghost_glass:drawGhostGlass, ghost_starlight:drawGhostStarlight, ghost_pulsar:drawGhostPulsar,
    ghost_cyberpunk:drawGhostCyberpunk, ghost_zenith:drawGhostZenith, handsonly_dark:drawHandsOnlyDark,
    handsonly_glow:drawHandsOnlyGlow,

    // With Dial (25)
    classic:drawClassic, minimal:drawMinimal, roman:drawRoman, neon:drawNeon,
    skeleton:drawSkeleton, chrono:drawChrono, bauhaus:drawBauhaus, swiss:drawSwiss,
    pilot:drawPilot, diver:drawDiver, artdeco:drawArtDeco, sundial:drawSundial,
    dashboard:drawDashboard, dotmatrix:drawDotMatrix, floatingnum:drawFloatingNum,
    astronomy:drawAstronomy, submariner:drawSubmariner, industrial:drawIndustrial,
    papercraft:drawPapercraft, retrodigital:drawRetroLCD, zen:drawZen,
    hologram:drawHologram, copper:drawCopper, monochrome:drawMonochrome, regatta:drawRegatta,
    aurora:drawAurora, noir:drawNoir, lumen:drawLumen, gridline:drawGridline,

    // Unique Motion (14)
    orbit:drawOrbit, concentric:drawConcentric, radar:drawRadar, gradientarc:drawGradientArc,
    hourglass:drawHourglass, sonar:drawSonar, sine:drawSine, dna:drawDNA,
    pendulum:drawPendulum, compass:drawCompass, eclipse_motion:drawEclipseMotion,
    matrix_rain:drawMatrixRain, equalizer:drawEqualizer, vortex:drawVortex
  };

  function getAnimModifier(nowTime, styleOverride) {
    const s = styleOverride || blockAnim.style || 'none';
    const spd = blockAnim.speed || 1.0;
    const t = (nowTime / 1000) * spd;
    
    const rainbowColor = (speedMult) => `hsl(${(t * speedMult * 60) % 360}, 100%, 60%)`;

    switch(s) {
      case 'pulse': return { opMul: 0.7 + 0.3 * Math.sin(t * 3), rOff: 0, blur: 0 };
      case 'glow':  return { opMul: 1, rOff: 0, blur: 6 + 6 * Math.sin(t * 2) };
      case 'breathe': return { opMul: 0.8 + 0.2 * Math.sin(t * 1.5), rOff: 3 * Math.sin(t * 1.5), blur: 0 };
      case 'shimmer': return { opMul: 0.75 + 0.25 * Math.sin(t * 5), rOff: 0, blur: 2 + 2 * Math.sin(t * 7) };
      case 'rainbow-glow': return { opMul: 1, rOff: 0, blur: 8 + 4 * Math.sin(t * 2), colorOverride: rainbowColor(1) };
      case 'rainbow-pulse': return { opMul: 0.7 + 0.3 * Math.sin(t * 3), rOff: 0, blur: 0, colorOverride: rainbowColor(2) };
      case 'disco': return { opMul: 0.8 + 0.2 * Math.sin(t * 12), rOff: 3 * Math.sin(t * 15), blur: 5, colorOverride: rainbowColor(6) };
      case 'radar-sweep': return { opMul: 0.9, rOff: 0, blur: 3 };
      case 'stripes': return { opMul: 0.85, rOff: 0, blur: 0 };
      case 'neon-flow': return { opMul: 0.9, rOff: 0, blur: 4 };
      case 'particles': return { opMul: 0.85, rOff: 0, blur: 2 };
      case 'wave-ripple': return { opMul: 0.85, rOff: 0, blur: 2 };
      case 'electric': return { opMul: 0.9, rOff: 0, blur: 5 };
      case 'aurora': return { opMul: 0.95, rOff: 0, blur: 4 };
      case 'sandglass': return { opMul: 0.88, rOff: 0, blur: 2 };
      case 'glitch': return { opMul: 0.85 + (Math.sin(t * 18) > 0.85 ? 0.25 : 0), rOff: 0, blur: 3 };
      case 'heartbeat': {
        const hb = Math.pow(Math.max(0, Math.sin(t * 3)), 16) + 0.6 * Math.pow(Math.max(0, Math.sin(t * 3 - 0.45)), 16);
        return { opMul: 0.75 + hb * 0.4, rOff: hb * 3.5, blur: hb * 10 };
      }
      case 'meteor': return { opMul: 0.85, rOff: 0, blur: 3 };
      case 'laser-grid': return { opMul: 0.88, rOff: 0, blur: 2 };
      case 'vortex-swirl': return { opMul: 0.85, rOff: 0, blur: 4 };
      case 'snowfall': return { opMul: 0.88, rOff: 0, blur: 1 };
      case 'ember-fly': return { opMul: 0.85, rOff: 0, blur: 3 };
      case 'orbit-rings': return { opMul: 0.9, rOff: 0, blur: 2 };
      case 'strobe': return { opMul: Math.sin(t * 14) > 0 ? 1 : 0.3, rOff: 0, blur: 0 };
      default: return { opMul: 1, rOff: 0, blur: 0 };
    }
  }

  function drawTimeBlockAnimEffect(cx, cy, r, startA, endA, color, style, t, opacity) {
    if (!style || style === 'none' || style === 'pulse' || style === 'glow' ||
        style === 'breathe' || style === 'shimmer' || style === 'rainbow-glow' ||
        style === 'rainbow-pulse' || style === 'disco') return;

    const angleSpan = endA - startA;
    if (angleSpan <= 0.001) return;

    X.save();
    // Clip cleanly to the sector so animation stays strictly inside the time block
    X.beginPath();
    X.moveTo(cx, cy);
    X.arc(cx, cy, r, startA, endA);
    X.closePath();
    X.clip();

    if (style === 'radar-sweep') {
      const sweepPhase = 0.5 + 0.5 * Math.sin(t * 2.2);
      const sweepA = startA + angleSpan * sweepPhase;
      const trailSpan = Math.min(angleSpan * 0.4, 0.35);
      X.beginPath();
      X.moveTo(cx, cy);
      X.arc(cx, cy, r, sweepA - trailSpan, sweepA);
      X.closePath();
      X.fillStyle = 'rgba(255,255,255,0.18)';
      X.fill();
      X.beginPath();
      X.moveTo(cx, cy);
      X.lineTo(cx + Math.cos(sweepA) * r, cy + Math.sin(sweepA) * r);
      X.strokeStyle = '#ffffff';
      X.lineWidth = 2.2;
      try { X.shadowColor = color; X.shadowBlur = 8; } catch (_) {}
      X.stroke();
      try { X.shadowBlur = 0; } catch (_) {}
    } else if (style === 'stripes') {
      const spacing = 18;
      const offset = (t * 26) % spacing;
      X.lineWidth = 6;
      X.strokeStyle = 'rgba(255,255,255,0.16)';
      const maxD = r * 1.5;
      for (let d = -maxD + offset; d < maxD; d += spacing) {
        X.beginPath();
        X.moveTo(cx + d - r, cy - r);
        X.lineTo(cx + d + r, cy + r);
        X.stroke();
      }
    } else if (style === 'neon-flow') {
      const p1 = r;
      const p2 = angleSpan * r;
      const p3 = r;
      const totalP = p1 + p2 + p3;
      const dist = (t * 140) % totalP;
      let px = cx, py = cy;
      if (dist < p1) {
        const frac = dist / p1;
        px = cx + Math.cos(startA) * (frac * r);
        py = cy + Math.sin(startA) * (frac * r);
      } else if (dist < p1 + p2) {
        const frac = (dist - p1) / p2;
        const curA = startA + frac * angleSpan;
        px = cx + Math.cos(curA) * r;
        py = cy + Math.sin(curA) * r;
      } else {
        const frac = 1 - ((dist - p1 - p2) / p3);
        px = cx + Math.cos(endA) * (frac * r);
        py = cy + Math.sin(endA) * (frac * r);
      }
      X.beginPath();
      X.arc(px, py, 4, 0, PI2);
      X.fillStyle = '#ffffff';
      try { X.shadowColor = color; X.shadowBlur = 12; } catch (_) {}
      X.fill();
      try { X.shadowBlur = 0; } catch (_) {}
    } else if (style === 'particles') {
      const count = 16;
      for (let i = 0; i < count; i++) {
        const p = ((t * 0.3 + (i / count)) % 1);
        const pAngle = startA + (((i * 73) % 100) / 100) * angleSpan;
        const pDist = p * r;
        const pAlpha = Math.sin(p * Math.PI) * 0.85;
        const px = cx + Math.cos(pAngle) * pDist;
        const py = cy + Math.sin(pAngle) * pDist;
        X.beginPath();
        X.arc(px, py, 1.5 + Math.sin(i + t * 2) * 0.8, 0, PI2);
        X.fillStyle = `rgba(255,255,255,${pAlpha.toFixed(3)})`;
        try { X.shadowColor = color; X.shadowBlur = 4; } catch (_) {}
        X.fill();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (style === 'wave-ripple') {
      const waves = 4;
      for (let k = 0; k < waves; k++) {
        const p = ((t * 0.6 + k / waves) % 1);
        const ripR = p * r;
        const alpha = (1 - p) * 0.45;
        X.beginPath();
        X.arc(cx, cy, ripR, startA, endA);
        X.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        X.lineWidth = 2.5;
        X.stroke();
      }
    } else if (style === 'electric') {
      const bolts = 3;
      for (let b = 0; b < bolts; b++) {
        const seed = Math.floor(t * 12) + b * 13;
        X.beginPath();
        const pts = 8;
        for (let j = 0; j <= pts; j++) {
          const frac = j / pts;
          const curA = startA + frac * angleSpan;
          const jitterR = r - 10 + (Math.sin(seed * 7 + j * 11) * 8);
          const jx = cx + Math.cos(curA) * jitterR;
          const jy = cy + Math.sin(curA) * jitterR;
          if (j === 0) X.moveTo(jx, jy); else X.lineTo(jx, jy);
        }
        X.strokeStyle = 'rgba(224,242,254,0.75)';
        X.lineWidth = 1.4;
        try { X.shadowColor = '#38bdf8'; X.shadowBlur = 8; } catch (_) {}
        X.stroke();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (style === 'aurora') {
      const midA = (startA + endA) * 0.5;
      const grad = X.createLinearGradient(
        cx + Math.cos(midA + t) * (r * 0.3),
        cy + Math.sin(midA + t) * (r * 0.3),
        cx + Math.cos(midA) * r,
        cy + Math.sin(midA) * r
      );
      grad.addColorStop(0, `hsla(${(t * 50) % 360}, 90%, 65%, 0.25)`);
      grad.addColorStop(0.5, `hsla(${(t * 50 + 80) % 360}, 85%, 60%, 0.35)`);
      grad.addColorStop(1, `hsla(${(t * 50 + 160) % 360}, 90%, 70%, 0.25)`);
      X.fillStyle = grad;
      X.fill();
    } else if (style === 'sandglass') {
      const p = (t * 0.5) % 1;
      const sweepA = startA + p * angleSpan;
      X.beginPath();
      X.moveTo(cx, cy);
      X.arc(cx, cy, r, startA, sweepA);
      X.closePath();
      X.fillStyle = 'rgba(255,255,255,0.14)';
      X.fill();
      X.beginPath();
      X.moveTo(cx, cy);
      X.lineTo(cx + Math.cos(sweepA) * r, cy + Math.sin(sweepA) * r);
      X.strokeStyle = 'rgba(255,255,255,0.7)';
      X.lineWidth = 1.8;
      X.stroke();
    } else if (style === 'glitch') {
      X.lineWidth = 1;
      X.strokeStyle = 'rgba(255,255,255,0.09)';
      for (let y = cy - r; y < cy + r; y += 4) {
        X.beginPath();
        X.moveTo(cx - r, y);
        X.lineTo(cx + r, y);
        X.stroke();
      }
      if (Math.sin(t * 16) > 0.6) {
        const sliceY = cy - r + ((t * 130) % (r * 2));
        X.fillStyle = (Math.sin(t * 30) > 0) ? 'rgba(56,189,248,0.3)' : 'rgba(244,63,94,0.3)';
        X.fillRect(cx - r, sliceY, r * 2, 8);
      }
    } else if (style === 'heartbeat') {
      const hb = Math.pow(Math.max(0, Math.sin(t * 3)), 16) + 0.6 * Math.pow(Math.max(0, Math.sin(t * 3 - 0.45)), 16);
      if (hb > 0.05) {
        X.beginPath();
        X.arc(cx, cy, r * (0.3 + hb * 0.65), startA, endA);
        X.strokeStyle = `rgba(255,255,255,${(hb * 0.6).toFixed(3)})`;
        X.lineWidth = 3 * hb;
        try { X.shadowColor = '#f43f5e'; X.shadowBlur = 10 * hb; } catch (_) {}
        X.stroke();
        try { X.shadowBlur = 0; } catch (_) {}
      }
    } else if (style === 'meteor') {
      // Shooting streaks racing from core to rim, fanning across the block.
      const count = 6;
      for (let b = 0; b < count; b++) {
        const p = ((t * 0.7 + b / count) % 1);
        const ang = startA + (((b * 53) % 100) / 100) * angleSpan;
        const headR = p * r;
        const tailR = headR - r * 0.22;
        const a = Math.sin(p * Math.PI) * 0.85;
        X.beginPath();
        X.moveTo(cx + Math.cos(ang) * tailR, cy + Math.sin(ang) * tailR);
        X.lineTo(cx + Math.cos(ang) * headR, cy + Math.sin(ang) * headR);
        X.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        X.lineWidth = 2.2;
        X.stroke();
        X.beginPath();
        X.arc(cx + Math.cos(ang) * headR, cy + Math.sin(ang) * headR, 2, 0, PI2);
        X.fillStyle = '#ffffff';
        X.fill();
      }
    } else if (style === 'laser-grid') {
      // Crosshatched neon grid sweeping diagonally.
      const spacing = 18;
      const off = (t * 26) % spacing;
      X.lineWidth = 1;
      X.strokeStyle = 'rgba(56,189,248,0.15)';
      const maxD = r * 1.5;
      for (let d = -maxD + off; d < maxD; d += spacing) {
        X.beginPath(); X.moveTo(cx + d - r, cy - r); X.lineTo(cx + d + r, cy + r); X.stroke();
        X.beginPath(); X.moveTo(cx + d - r, cy + r); X.lineTo(cx + d + r, cy - r); X.stroke();
      }
    } else if (style === 'vortex-swirl') {
      // Hypnotic twin spiral arms curling inward.
      const midA = (startA + endA) * 0.5;
      for (let k = 0; k < 2; k++) {
        X.beginPath();
        for (let s = 0; s <= 16; s++) {
          const frac = s / 16;
          const curR = frac * r * 0.95;
          const curA = midA + frac * 2.2 + k * Math.PI + t * 0.9;
          const px = cx + Math.cos(curA) * curR, py = cy + Math.sin(curA) * curR;
          if (s === 0) X.moveTo(px, py); else X.lineTo(px, py);
        }
        X.strokeStyle = `rgba(255,255,255,${(0.55 - k * 0.15).toFixed(3)})`;
        X.lineWidth = 1.6;
        X.stroke();
      }
    } else if (style === 'snowfall') {
      // Gentle snow drifting down with lateral sway.
      const count = 24;
      for (let i = 0; i < count; i++) {
        const px0 = ((i * 37) % 100) / 100;
        const py0 = ((i * 61) % 100) / 100;
        const y = ((py0 * r + t * 26 + i * 7) % (r * 2)) - r;
        const x = (px0 * r * 2 - r) + Math.sin(t * 0.7 + i * 1.3) * r * 0.1;
        const a = 0.4 + 0.4 * Math.sin(t + i);
        X.beginPath();
        X.arc(cx + x, cy + y, 1.3, 0, PI2);
        X.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        X.fill();
      }
    } else if (style === 'ember-fly') {
      // Embers rising toward the block's mid-angle with sparks on exit.
      const count = 18;
      const midA = (startA + endA) * 0.5;
      for (let i = 0; i < count; i++) {
        const px = ((i * 31) % 100) / 100;
        const life = ((t * 0.5 + i / count) % 1);
        const rise = life * r;
        const wob = Math.sin(t * 3 + i * 2.4) * r * 0.08;
        const y = cy + Math.sin(midA) * (r - rise);
        const x = cx + Math.cos(midA) * (r - rise) + wob;
        const a = Math.sin(life * Math.PI) * 0.9;
        X.beginPath();
        X.arc(x, y, Math.max(0.8, (1 - life) * 1.4), 0, PI2);
        X.fillStyle = `rgba(251,146,60,${a.toFixed(3)})`;
        X.fill();
        if (life > 0.88) {
          X.beginPath(); X.moveTo(x, y); X.lineTo(x - wob * 0.6, y - r * 0.06);
          X.strokeStyle = `rgba(251,146,60,${(0.6 * (1 - life)).toFixed(3)})`;
          X.lineWidth = 1; X.stroke();
        }
      }
    } else if (style === 'orbit-rings') {
      // Concentric orbiting ring arcs, dashes marching along the wedge.
      for (let k = 0; k < 3; k++) {
        X.beginPath();
        X.arc(cx, cy, r * (0.25 + k * 0.22), startA, endA);
        X.strokeStyle = `rgba(255,255,255,${(0.18 + k * 0.1).toFixed(3)})`;
        X.lineWidth = 1.5;
        X.setLineDash([6, 5]);
        try { X.lineDashOffset = -t * 40; } catch (_) {}
        X.stroke();
      }
      X.setLineDash([]);
    }

    X.restore();
  }

  function drawSessionsOverlay(cx, cy, r) {
    if (!SESSIONS_ENABLED) return;
    if (!sessions || sessions.length === 0) return;
const nowTime = performance.now();
    const realNow = Date.now();
    const spd = blockAnim.speed || 1.0;
    const t = (nowTime / 1000) * spd;
    
    X.save();
    const MS_IN_12H = 43200000;
    
    sessions.forEach(sess => {
       if (!sess) return;
       
       let sDate = new Date(sess.start);
       let startMsIn12h = (sDate.getHours() % 12) * 3600000 + sDate.getMinutes() * 60000 + sDate.getSeconds() * 1000 + sDate.getMilliseconds();
       let startAngle = (startMsIn12h / MS_IN_12H) * PI2 - (Math.PI / 2);
       
       let durationMs = sess.end - sess.start;
       let sweepAngle = (durationMs / MS_IN_12H) * PI2;
       if (sweepAngle > PI2) sweepAngle = PI2;
       let endAngle = startAngle + sweepAngle;
       
        // Calculate purely visual 12-hour cyclic elapsed time so the hour hand always splits the block
        let visDuration = Math.min(durationMs, MS_IN_12H);
        let nDate = new Date(realNow);
        let nowMsIn12h = (nDate.getHours() % 12) * 3600000 + nDate.getMinutes() * 60000 + nDate.getSeconds() * 1000 + nDate.getMilliseconds();

        let dist = nowMsIn12h - startMsIn12h;
        if (dist < 0) dist += MS_IN_12H;

        let elapsedMs = 0;
        if (dist <= visDuration) {
            // Hour hand is currently inside the block
            elapsedMs = dist;
        } else {
            // Hour hand is outside the block
            let gap = MS_IN_12H - visDuration;
            if (dist - visDuration < gap / 2) {
                elapsedMs = visDuration; // Passed recently -> fully elapsed
            } else {
                elapsedMs = 0; // Upcoming soon -> fully remaining
            }
        }

        let elapsedAngle = (elapsedMs / MS_IN_12H) * PI2;
        let currentAngle = startAngle + elapsedAngle;
       const s = sess.anim || blockAnim.style || 'none';
       const anim = getAnimModifier(nowTime, sess.anim || null);
       let drawR = r + anim.rOff;
       let activeColor = anim.colorOverride || sess.color;

       // 1) Elapsed Portion (faded, no animation)
       if (elapsedMs > 0) {
           let elColor = sess.elapsedColor || sess.color;
           let hasCustomEl = !!sess.elapsedColor;
           // Boost elapsed opacity heavily so custom colors are undeniably visible
           X.globalAlpha = hasCustomEl ? Math.min(1.0, blockOpacity * 2.5) : blockOpacity * 0.4;
           X.shadowBlur = 0; X.shadowColor = 'transparent';
           
           // Base fill
           X.beginPath();
           X.moveTo(cx, cy);
           X.arc(cx, cy, r, startAngle, currentAngle);
           X.closePath();
           X.fillStyle = elColor;
           X.fill();
           
           // Hatching pattern overlay
           if (!window.hatchPattern) {
               const hc = document.createElement('canvas');
               hc.width = 8; hc.height = 8;
               const hx = hc.getContext('2d');
               hx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
               hx.lineWidth = 1;
               hx.beginPath(); hx.moveTo(0, 8); hx.lineTo(8, 0); hx.stroke();
               window.hatchPattern = X.createPattern(hc, 'repeat');
           }
           X.globalAlpha = 0.5; // faint overlay
           X.fillStyle = window.hatchPattern;
           X.fill();
           
           X.globalAlpha = hasCustomEl ? Math.min(1.0, blockOpacity * 2.5) : blockOpacity * 0.4;
           X.beginPath();
           X.arc(cx, cy, r - 1, startAngle, currentAngle);
           X.strokeStyle = elColor;
           X.lineWidth = 1.5;
           X.stroke();
       }
       
       // 2) Remaining Portion (vibrant + animated)
       if (elapsedMs < durationMs) {
           X.shadowBlur = anim.blur;
           X.shadowColor = activeColor;
           X.globalAlpha = blockOpacity * anim.opMul; 
           X.beginPath();
           X.moveTo(cx, cy);
           X.arc(cx, cy, drawR, currentAngle, endAngle);
           X.closePath();
           X.fillStyle = activeColor;
           X.fill();
           
           // Specialized animated texture/layer for advanced styles
           drawTimeBlockAnimEffect(cx, cy, drawR, currentAngle, endAngle, activeColor, s, t, blockOpacity);

           X.globalAlpha = Math.min(1, blockOpacity * anim.opMul + 0.4);
           X.beginPath();
           X.arc(cx, cy, drawR - 1, currentAngle, endAngle);
           X.strokeStyle = activeColor;
           X.lineWidth = 1.5;
           X.stroke();
           X.shadowBlur = 0; X.shadowColor = 'transparent';
        }

        // 3) Armed-for-linking highlight: colorized pulsing outline on the wedge
        if (linkBlockId && sess.id === linkBlockId) {
            const pulse = 0.6 + 0.4 * Math.sin(nowTime / 300);
            X.save();
            X.globalAlpha = 0.55 + 0.35 * pulse;
            X.shadowColor = activeColor; X.shadowBlur = 18;
            X.beginPath();
            X.arc(cx, cy, drawR + 4, startAngle, endAngle);
            X.strokeStyle = activeColor;
            X.lineWidth = 3;
            X.stroke();
            X.restore();
        }
});
    X.restore();
  }

  function drawInteractiveKnob(cx, cy, r) {
    // DOM center converted to canvas coordinates + hover distance test.
    function nearCanvas(el, mx, my, pad) {
      if (!el) return false;
      const rc = el.getBoundingClientRect();
      const cc = canvas.getBoundingClientRect();
      const hx = rc.left + rc.width / 2 - cc.left;
      const hy = rc.top + rc.height / 2 - cc.top;
      return Math.hypot(mx - hx, my - hy) < (pad || 30);
    }
    if (!interactiveMode) {
       if (pWrapS) pWrapS.style.display = 'none';
       if (pWrapE) pWrapE.style.display = 'none';
       return;
    }
    
    if (interactiveMode.endsWith('-both')) {
       const idx = parseInt(interactiveMode.split('-')[1]);
       const sess = sessions[idx];
       if (!sess) return;
       
       const dS = new Date(sess.start);
       const aS = getAngleForDate(dS);
       const kxS = cx + Math.cos(aS) * (r - 12);
       const kyS = cy + Math.sin(aS) * (r - 12);
       
       const dE = new Date(sess.end);
       const aE = getAngleForDate(dE);
       const kxE = cx + Math.cos(aE) * (r - 12);
       const kyE = cy + Math.sin(aE) * (r - 12);

// Delete Block Button (Trash) at the wedge MIDPOINT — clear of both handles
       const midD = new Date((dS.getTime() + dE.getTime()) / 2);
       const delX = cx + Math.cos(getAngleForDate(midD)) * (r - 35);
       const delY = cy + Math.sin(getAngleForDate(midD)) * (r - 35);

       // Position the DOM color pickers inside the ring (before hover test)
       if (pWrapS) {
           pWrapS.style.left = (cx + Math.cos(aS) * (r - 50) - 11) + 'px';
           pWrapS.style.top = (cy + Math.sin(aS) * (r - 50) - 11) + 'px';
       }
       if (pWrapE) {
           pWrapE.style.left = (cx + Math.cos(aE) * (r - 50) - 11) + 'px';
           pWrapE.style.top = (cy + Math.sin(aE) * (r - 50) - 11) + 'px';
       }

// Auto-hide the whole cluster unless focused AND cursor is over it.
       const mx = lastMouseCanvas ? lastMouseCanvas.x : -999;
       const my = lastMouseCanvas ? lastMouseCanvas.y : -999;
       const overS = Math.hypot(mx - kxS, my - kyS) < 26;
       const overE = Math.hypot(mx - kxE, my - kyE) < 26;
       const overDel = Math.hypot(mx - delX, my - delY) < 14;
       // Hover over the wedge body itself keeps the cluster shown, so moving the
       // cursor across a block reveals both handles + the trash instead of hiding.
       let overWedge = false;
       const distM = Math.hypot(mx - cx, my - cy);
       if (distM <= r + 4) {
         let wa = Math.atan2(my - cy, mx - cx) + (Math.PI / 2);
         if (wa < 0) wa += PI2; if (wa >= PI2) wa -= PI2;
         const norm = (a) => { a = a % PI2; if (a < 0) a += PI2; return a; };
         const ws = norm(aS + (Math.PI / 2));
         const we = norm(aE + (Math.PI / 2));
         if (we >= ws) overWedge = (wa >= ws && wa <= we);
         else overWedge = (wa >= ws || wa <= we);
       }
       const hoverHere = windowFocused && (draggingKnob || overS || overE || overDel || overWedge ||
          nearCanvas(pWrapS, mx, my, 30) || nearCanvas(pWrapE, mx, my, 30));
       if (!hoverHere) {
           if (pWrapS) pWrapS.style.display = 'none';
           if (pWrapE) pWrapE.style.display = 'none';
           return;
       }
       
       X.save();
       // Start Handle
       X.beginPath(); X.arc(kxS, kyS, 20, 0, PI2); X.fillStyle = 'rgba(59,130,246,0.3)'; X.fill();
       X.beginPath(); X.arc(kxS, kyS, 8, 0, PI2); X.fillStyle = '#fff'; X.shadowColor = '#000'; X.shadowBlur = 8; X.fill();
       X.lineWidth = 2; X.strokeStyle = '#3b82f6'; X.stroke(); X.shadowBlur = 0;
       
       // End Handle
       X.beginPath(); X.arc(kxE, kyE, 20, 0, PI2); X.fillStyle = 'rgba(239,68,68,0.3)'; X.fill();
       X.beginPath(); X.arc(kxE, kyE, 8, 0, PI2); X.fillStyle = '#fff'; X.shadowColor = '#000'; X.shadowBlur = 8; X.fill();
       X.lineWidth = 2; X.strokeStyle = '#ef4444'; X.stroke(); X.shadowBlur = 0;
       
       // Delete Block Button (Trash)
       X.beginPath(); X.arc(delX, delY, 12, 0, PI2);
       X.fillStyle = 'rgba(10,10,20,0.8)'; X.fill();
       X.lineWidth = 1; X.strokeStyle = 'rgba(239,68,68,0.8)'; X.stroke();
       X.font = '10px sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle';
       X.fillStyle = '#ef4444';
       X.fillText('🗑️', delX, delY + 1);
       
       X.restore();
       
       // Show DOM Pickers inside the ring
       if (pWrapS && pInputS) {
           pWrapS.style.display = 'block';
           if (!pWrapS.matches(':focus-within')) pInputS.value = sess.color;
       }
       if (pWrapE && pInputE) {
           pWrapE.style.display = 'block';
           if (!pWrapE.matches(':focus-within')) pInputE.value = sess.elapsedColor || sess.color;
       }
    } else if (interactiveDate) {
       // Hide pickers while actively dragging to reduce visual noise
       if (pWrapS) pWrapS.style.display = 'none';
       if (pWrapE) pWrapE.style.display = 'none';

       const angle = getAngleForDate(interactiveDate);
       const kx = cx + Math.cos(angle) * (r - 12);
       const ky = cy + Math.sin(angle) * (r - 12);
       const isStart = interactiveMode.endsWith('start');

       X.save();
       X.beginPath();
       X.arc(kx, ky, 20, 0, PI2);
       X.fillStyle = isStart ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)';
       X.fill();

       X.beginPath();
       X.arc(kx, ky, 8, 0, PI2);
       X.fillStyle = '#fff';
       X.shadowColor = '#000';
       X.shadowBlur = 8;
       X.fill();
       
       X.lineWidth = 2;
       X.strokeStyle = isStart ? '#3b82f6' : '#ef4444';
       X.stroke();
       X.restore();
    }
  }

  let frameHandle = null;
  let renderTimer = null;
  let lastPaintAt = 0;
  // 20 FPS is visually smooth for an analog second hand and cuts idle
  // canvas work by 33% compared to 30 FPS, saving battery and memory.
  const IDLE_FRAME_MS = 1000 / 20;


  let viewMode = 'clock';
  // ── Rectangular day-board view (compact vertical timeline) ──
  // The board day starts at 8am and wraps a full 24h (8..23,0..7) so the
  // whole day stays visible. Whole 24h always fits: px-per-hour derives
  // from the visible height, so no scrollbar is ever needed.
  const BOARD_START_HR = 8;
  const boardDispHr = (h) => (((h - BOARD_START_HR) % 24) + 24) % 24; // clock hr -> display row
  const boardClockHr = (d) => (d + BOARD_START_HR) % 24; // display row -> clock hr
  function boardHrPx() {
    const h = (dayBoard && dayBoard.clientHeight) || 600;
    return h / 24;
  }
  let boardEditing = false; // true while renaming inline (skips rebuild)
  let boardResize = null; // {id, edge} while dragging a block edge
  let boardMove = null; // {id, offMs, x0, y0, active} while dragging a block body
  const viewToggleBtn = document.getElementById('view-toggle');
  const boardExitBtn = document.getElementById('board-exit-btn');
  if (boardExitBtn) boardExitBtn.addEventListener('click', e => { e.stopPropagation(); api.closeApp(); });
  
  const boardDragHandle = document.getElementById('board-drag-handle');
  if (boardDragHandle) boardDragHandle.addEventListener('mousedown', e => { if (e.button === 0) { e.stopPropagation(); api.dragStart(); } });
  // Board corner grip resizes the whole window (reuses the dial-resize IPC).
  const boardResizeGrip = document.getElementById('board-resize');
  if (boardResizeGrip) boardResizeGrip.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    resizing = true;
    api.resizeStart();
  });
  const dayBoard = document.getElementById('day-board');
  const boardTimeline = document.getElementById('board-timeline');
  const clockCanvas = document.getElementById('clock');
  
  if (viewToggleBtn) {
    viewToggleBtn.addEventListener('click', () => {
      viewMode = viewMode === 'clock' ? 'board' : 'clock';
      if (viewMode === 'board') {
        viewToggleBtn.classList.add('active');
        dayBoard.style.display = 'flex';
        clockCanvas.style.opacity = '0';
        clockCanvas.style.visibility = 'hidden';
        renderBoard();
        setTimeout(() => scrollToNow(), 100);
      } else {
        viewToggleBtn.classList.remove('active');
        dayBoard.style.display = 'none';
        clockCanvas.style.opacity = '1';
        clockCanvas.style.visibility = 'visible';
      }
    });
  }

  function scrollToNow() {
    if (!dayBoard) return;
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    const px = boardHrToY(boardDispHr(h)) - dayBoard.clientHeight / 2;
    dayBoard.scrollTo({ top: Math.max(0, px), behavior: 'smooth' });
  }

  function renderBoard() {
    if (viewMode !== 'board' || !boardTimeline || boardEditing) return;
    
    const now = Date.now();
    const msInDay = 86400000;
    const hrPx = boardHrPx();
    
    let html = '';
    
    // 24 hour rows starting at 8am, wrapping past midnight
    for (let i = 0; i < 24; i++) {
      const top = i * hrPx;
      const hh = (BOARD_START_HR + i) % 24;
      const ampm = hh < 12 ? 'AM' : 'PM';
      const hr = hh % 12 === 0 ? 12 : hh % 12;
      html += `<div class="board-hour-line" style="top:${top}px"><div class="board-hour-label">${hr}:00 ${ampm}</div></div>`;
    }
    
    // Now line (mapped into display rows)
    const dNow = new Date();
    const nowTop = boardDispHr(dNow.getHours() + dNow.getMinutes() / 60) * hrPx;
    html += `<div class="board-now-line" style="top:${nowTop}px"></div>`;
    
    // Draw Sessions (mapped into display rows; clips at the 8am wrap line)
    // Skipped entirely while time allocations are off.
    // Overlapping sessions share the time range side-by-side (partitioned columns).
    const items = [];
    if (SESSIONS_ENABLED) sessions.forEach((sess, si) => {
      if (!sess) return;
      const sD = new Date(sess.start);
      const eD = new Date(sess.end);

      const sHr = sD.getHours() + sD.getMinutes()/60 + sD.getSeconds()/3600;
      let eHr = eD.getHours() + eD.getMinutes()/60 + eD.getSeconds()/3600;
      if (eD.getTime() <= sD.getTime()) eHr += 24; // Crosses midnight
      let dS = boardDispHr(sHr), dE = boardDispHr(eHr);
      if (dE <= dS) dE += 24;

      let top = dS * hrPx;
      let height = (dE - dS) * hrPx;
      if (top + height > 24 * hrPx) height = 24 * hrPx - top; // clip at wrap
      if (height < 8) height = 8; // compact min height (keeps 24h fit tight)
      if (top >= 24 * hrPx || top + height <= 0) return; // fully outside
      items.push({ sess, si, sD, eD, top, height });
    });
    // Cluster by time overlap; greedy column assignment within each cluster.
    items.sort((a, b) => a.top - b.top);
    const layout = new Map(); // si -> {col, cols}
    let cluster = [], clusterEnd = -1;
    const flushCluster = () => {
      if (!cluster.length) return;
      const colsEnd = [];
      cluster.forEach(it => {
        let c = colsEnd.findIndex(e => e <= it.top);
        if (c === -1) { c = colsEnd.length; colsEnd.push(it.top + it.height); }
        else colsEnd[c] = it.top + it.height;
        layout.set(it.si, { col: c, cols: 0 });
      });
      const n = colsEnd.length || 1;
      cluster.forEach(it => { layout.get(it.si).cols = n; });
      cluster = []; clusterEnd = -1;
    };
    items.forEach(it => {
      if (cluster.length && it.top >= clusterEnd) flushCluster();
      cluster.push(it);
      clusterEnd = Math.max(clusterEnd, it.top + it.height);
    });
    flushCluster();
    items.forEach(({ sess, si, sD, eD, top, height }) => {
      const lay = layout.get(si) || { col: 0, cols: 1 };
      // Side-by-side lane inside the session area (CSS base is left:48px/right:12px).
      const lane = (lay.cols > 1)
        ? `left:calc(48px + (100% - 60px) * ${lay.col} / ${lay.cols});width:calc((100% - 60px) / ${lay.cols} - 3px);`
        : '';
const rel = getRelativeSessionTimes(sess, now);
      const elapsedMs = Math.max(0, Math.min(now - rel.start, rel.end - rel.start));
      const durMs = rel.end - rel.start;
      const pct = (elapsedMs / (durMs || 1)) * 100;
      
      const elColor = sess.elapsedColor || sess.color;
      
      // Collect tasks (including subtasks)
      const sessTodos = todos.filter(t => t.blockId === sess.id);
      let titleText = sessTodos.length ? sessTodos[0].text : '';
      if (!titleText) {
        for (const t of todos) {
          const st = (t.subtasks || []).find(s => s.blockId === sess.id);
          if (st) { titleText = st.text; break; }
        }
      }
      if (!titleText) titleText = (sess.tasks && sess.tasks[0] ? sess.tasks[0] : 'Time Block');
      
      const timeFmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
      const timeStr = timeFmt.format(sD) + ' - ' + timeFmt.format(eD);
      // Highlight follows LINK ARMED state (not mere selection): no glow once deactivated.
      const isArmed = linkBlockId && sess.id === linkBlockId;
      
      html += `<div class="board-session${isArmed ? ' selected' : ''}" data-id="${sess.id}" style="top:${top}px; height:${height}px; border-color:${sess.color};${lane}">
        <div class="bg-fill" style="background:${sess.color}"></div>
        <div class="elapsed-fill" style="background:${elColor}; width:${pct}%"></div>
        <div class="board-grip top"></div>
        <div class="board-session-title" data-id="${sess.id}">${escapeHtml(titleText)}</div>
        <div class="board-session-time">${timeStr}</div>
        <div class="board-grip bot"></div>
        ${isArmed ? `<button class="board-del" data-id="${sess.id}" title="Delete block">×</button>` : ''}
      </div>`;
    });
    
      boardTimeline.innerHTML = html;
  }

  // ── Board interactions: same powers as the circular clock ──
  // Click empty hour = create 1h block (15min snap, selected date).
  // Click block = select + arm todo linking. Drag top/bottom edge = resize.
  // × on a selected block deletes. Double-click title renames.
  function boardHourToDate(hr) {
    hr = Math.max(0, Math.min(23.75, hr));
    const clockHr = boardClockHr(hr);
    const yp = selectedTodoDate.split('-').map(Number);
    return new Date(yp[0], yp[1] - 1, yp[2], Math.floor(clockHr), Math.round((clockHr % 1) * 60), 0, 0);
  }
  function boardSessionIdx(id) { return sessions.findIndex(s => s && s.id === id); }
  if (boardTimeline) {
    boardTimeline.addEventListener('mousedown', e => {
      if (e.button !== 0 || boardEditing || !SESSIONS_ENABLED) return;
      // Delete FIRST (mousedown): a select here would rebuild the DOM and eat the click.
      const delFirst = e.target.closest ? e.target.closest('.board-del') : null;
      if (delFirst) {
        e.stopPropagation();
        e.preventDefault();
        const di = boardSessionIdx(delFirst.dataset.id);
        if (di >= 0 && sessions[di]) {
          unlinkBlock(delFirst.dataset.id);
          lastDisarmedArm = null;
          disarmTodoLink();
          sessions.splice(di, 1);
          save();
          interactiveMode = null;
          renderBoard();
        }
        return;
      }
      const sel = e.target.closest ? e.target.closest('.board-session') : null;
      if (!sel) {
        const tlRect = boardTimeline.getBoundingClientRect();
        const hr = Math.floor(boardYToHr(e.clientY - tlRect.top) * 4) / 4;
        const start = boardHourToDate(hr);
        const end = new Date(start.getTime() + 3600000);
        const hue = (210 + sessions.length * 137.5) % 360;
        const col = todoHsl(hue, 85, 60);
        sessions.push({ id: genId('s'), start: start.getTime(), end: end.getTime(),
          color: col, elapsedColor: deriveElapsedColor(col), type: 'custom', tasks: [] });
        save();
        interactiveMode = `edit-${sessions.length - 1}-both`;
        armTodoLink(sessions[sessions.length - 1]);
        renderBoard();
        renderTodos(); // refresh any linked-todo countdown chips immediately
        return;
      }
      const idx = boardSessionIdx(sel.dataset.id);
      if (idx < 0) return;
      const rect = sel.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (y < 12) { boardResize = { id: sel.dataset.id, edge: 'start' }; e.preventDefault(); }
      else if (y > rect.height - 12) { boardResize = { id: sel.dataset.id, edge: 'end' }; e.preventDefault(); }
      else {
        interactiveMode = `edit-${idx}-both`;
        // Second click on the armed block deactivates (banner goes away too).
        if (linkBlockId && sessions[idx] && sessions[idx].id === linkBlockId) disarmTodoLink();
        else armTodoLink(sessions[idx]);
        renderBoard();
        // Track a potential whole-block drag (activates past a 5px threshold).
        const tlR = boardTimeline.getBoundingClientRect();
        const hrPx0 = boardHrPx();
        const ptrMs = boardHourToDate(boardYToHr(e.clientY - tlR.top)).getTime();
        boardMove = { id: sel.dataset.id, offMs: ptrMs - sessions[idx].start, x0: e.clientX, y0: e.clientY, active: false };
      }
    });
    boardTimeline.addEventListener('click', e => {
      if (!SESSIONS_ENABLED) return;
      const del = e.target.closest ? e.target.closest('.board-del') : null;
      if (!del) return;
      e.stopPropagation();
      const idx = boardSessionIdx(del.dataset.id);
      if (idx < 0) return;
      unlinkBlock(del.dataset.id);
      lastDisarmedArm = null;
      disarmTodoLink();
      sessions.splice(idx, 1);
      save();
      interactiveMode = null;
      renderBoard();
    });
    boardTimeline.addEventListener('dblclick', e => {
      if (!SESSIONS_ENABLED) return;
      const title = e.target.closest ? e.target.closest('.board-session-title') : null;
      if (!title) return;
      const idx = boardSessionIdx(title.dataset.id);
      if (idx < 0 || !sessions[idx]) return;
      boardEditing = true;
      title.setAttribute('contenteditable', 'true');
      title.focus();
      try {
        const range = document.createRange();
        range.selectNodeContents(title);
        const sel2 = window.getSelection();
        sel2.removeAllRanges();
        sel2.addRange(range);
      } catch (_) {}
      const finish = (commit) => {
        title.removeAttribute('contenteditable');
        if (commit) {
          const v = (title.textContent || '').trim();
          if (!Array.isArray(sessions[idx].tasks)) sessions[idx].tasks = [];
          if (v) sessions[idx].tasks[0] = v;
          else sessions[idx].tasks.splice(0, 1);
          save();
        }
        boardEditing = false;
        renderBoard();
      };
      title.onblur = () => finish(true);
      title.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); title.blur(); }
        if (ev.key === 'Escape') { boardEditing = false; renderBoard(); }
      };
    });
    // Hover feedback: reveal resize zones on block edges (grips are deliberately hidden)
    boardTimeline.addEventListener('mousemove', e => {
      if (boardEditing || !SESSIONS_ENABLED) return;
      const sel = e.target.closest ? e.target.closest('.board-session') : null;
      if (!sel) { if (boardTimeline.style.cursor) boardTimeline.style.cursor = ''; return; }
      const y = e.clientY - sel.getBoundingClientRect().top;
      boardTimeline.style.cursor = (y < 12 || y > sel.offsetHeight - 12) ? 'ns-resize' : 'grab';
    });
    boardTimeline.addEventListener('mouseleave', () => {
      boardTimeline.style.cursor = '';
    });
  }
  window.addEventListener('mousemove', e => {
    if (boardMove && boardTimeline && !boardEditing) {
      const dx = e.clientX - boardMove.x0, dy = e.clientY - boardMove.y0;
      if (!boardMove.active && Math.hypot(dx, dy) > 5) {
        boardMove.active = true;
        if (dayBoard) dayBoard.style.cursor = 'grabbing';
      }
      if (boardMove.active) {
        const idx = boardSessionIdx(boardMove.id);
        if (idx >= 0 && sessions[idx]) {
          const s = sessions[idx];
          const dur = s.end - s.start;
          const tlRect = boardTimeline.getBoundingClientRect();
          const hr = boardYToHr(e.clientY - tlRect.top);
          let t = boardHourToDate(hr).getTime() - boardMove.offMs;
          t = Math.round(t / 900000) * 900000; // 15min snap
          const yp = selectedTodoDate.split('-').map(Number);
          const dayBase = new Date(yp[0], yp[1] - 1, yp[2], 0, 0, 0, 0).getTime();
          t = Math.max(dayBase, Math.min(dayBase + 86400000 - dur, t));
          s.start = t; s.end = t + dur;
          renderBoard();
          return;
        }
      }
    }
    if (!boardResize || !boardTimeline) return;
    const idx = boardSessionIdx(boardResize.id);
    if (idx < 0 || !sessions[idx]) { boardResize = null; return; }
    const tlRect = boardTimeline.getBoundingClientRect();
    const hr = Math.floor(boardYToHr(e.clientY - tlRect.top) * 4) / 4;
    const t = boardHourToDate(Math.max(0, Math.min(23.75, hr))).getTime();
    const s = sessions[idx];
    if (boardResize.edge === 'start') {
      if (t < s.end - 15 * 60000) s.start = t;
    } else {
      if (t > s.start + 15 * 60000) s.end = t;
    }
    renderBoard();
  });
  window.addEventListener('mouseup', () => {
    if (boardResize) { boardResize = null; save(); renderBoard(); renderTodos(); }
    if (boardMove) {
      const moved = boardMove.active;
      boardMove = null;
      if (dayBoard) dayBoard.style.cursor = '';
      if (moved) { save(); renderBoard(); renderTodos(); }
    }
  });
  window.addEventListener('resize', () => { try { renderBoard(); } catch (_) {} });

function draw() {
    frameHandle = null;
    if (!document.hidden) {
      if (viewMode === 'board') {
        // In board view, clock canvas is hidden - skip all clock drawing to save CPU
        scheduleRender();
        return;
      }
      lastPaintAt = performance.now();
      const { cx, cy, r, w, h } = clockBounds();
      const now=new Date();
      const sec=now.getSeconds(),ms=now.getMilliseconds();
      const secF=sec+ms/1000, minF=now.getMinutes()+secF/60, hrF=(now.getHours()%12)+minF/60;
      const t=THEMES[theme]||THEMES.midnight;
      X.clearRect(0,0,w,h);
      (STYLES[style]||drawGhostPure)(cx,cy,r,hrF,minF,secF,t);
      drawSessionsOverlay(cx, cy, r);
      if(Math.random() < 0.1) renderBoard(); // throttle
    drawLabelOrbit(cx, cy, r);
    syncLabels(cx, cy, r, w, h);
    drawCircularLabels(cx, cy, r);
      drawInteractiveKnob(cx, cy, r);
      drawGearIcon(cx, cy, r);
      drawGrabHandle(cx, cy, r);
      drawResizeHandle(cx, cy, r);
      drawExitButton(cx, cy, r);
      drawTooltipSizeIndicator(cx, cy, r);
      drawOrbitSpeedIndicator(cx, cy, r);
    }
    scheduleRender();
  }

  function scheduleRender() {
    if (document.hidden || frameHandle !== null || renderTimer !== null) return;
    const delay = Math.max(0, IDLE_FRAME_MS - (performance.now() - lastPaintAt));
    renderTimer = window.setTimeout(() => {
      renderTimer = null;
      if (!document.hidden) frameHandle = requestAnimationFrame(draw);
    }, delay);
  }
  function resumeRendering() {
    if (!document.hidden) scheduleRender();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frameHandle !== null) {
      cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }
    if (document.hidden && renderTimer !== null) { clearTimeout(renderTimer); renderTimer = null; }
    if (!document.hidden) resumeRendering();
  });
  resumeRendering();
})();



