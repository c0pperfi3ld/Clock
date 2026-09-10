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
     api.saveSettings({ _lastError: e.error ? e.error.stack : e.message });
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
    abyss:     { accent:'#06b6d4', sec:'#10b981', glow:'rgba(6,182,212,0.5)' }
  };

  let style='handsonly_ghost', theme='midnight', handType='tapered', opacity=100, sessions=[], blockOpacity=0.25;
  let blockAnim = { style: 'pulse', speed: 1.0 };
  let tooltipAnim = 'bounce';
  let tooltipSize = 1.0;
  let orbitSpeed = 1.0;
  let orbitStyle = 'dash';
  let todoAnim = 'float';
  let windowFitAuto = true; // grow/shrink the window so labels never clip
  // Legacy entrance-only ids map to their nearest continuous loop.
  const TODO_ANIM_LEGACY = { slide:'tide-x', 'fade-up':'float', pop:'pulse', flip:'sway', bounce:'bob', 'swing-in':'wiggle', 'roll-in':'jelly' };
  function todoAnimEff() { return TODO_ANIM_LEGACY[todoAnim] || todoAnim || 'float'; }
  const saved = api.loadSettings();
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
  let todos = []; // [{id, text, done, createdAt, priority, color}]
  if (Array.isArray(saved.todos)) todos = saved.todos;
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
  function saveTodos() { queueSave({ todos }); }
  window.addEventListener('beforeunload', flushSave);

  function applyOpacity() { canvas.style.opacity=opacity/100; }
  applyOpacity();
  function save() { queueSave({clockStyle:style,theme,handType,opacity,sessions,blockOpacity,blockAnim,tooltipAnim,tooltipSize,orbitSpeed,orbitStyle,todoAnim,windowFitAuto}); }

  api.onSetStyle(s => { style=s; save(); });
  api.onSetTheme(t => { theme=t; save(); });
  api.onSetOpacity(o => { opacity=o; applyOpacity(); save(); });
  api.onSetHands(h => { handType=h; save(); });
  api.onSetSessions(s => { sessions=s; save(); });
  api.onSetBlockOpacity(o => { blockOpacity=o; save(); });
  api.onSetBlockAnim(a => { blockAnim=a; save(); });
  api.onSetTooltipAnim(a => { tooltipAnim=a; save(); });
  if (api.onSetTooltipSize) api.onSetTooltipSize(s => { tooltipSize=s; save(); });
  if (api.onSetOrbitSpeed) api.onSetOrbitSpeed(s => { orbitSpeed=s; save(); });
  if (api.onSetOrbitStyle) api.onSetOrbitStyle(s => { orbitStyle=s; save(); });
  if (api.onSetTodoAnim) api.onSetTodoAnim(s => { todoAnim=s; applyTodoAnim(); save(); });
  if (api.onSetWindowFit) api.onSetWindowFit(v => { windowFitAuto = !!v; save(); lastFitSent = { t: -1, b: -1 }; });

  // ── Tooltip font resize (Ctrl + scroll) / Orbit speed (Alt + scroll) ──
  let tooltipResizePulse = 0;
  let orbitSpeedPulse = 0;
  canvas.addEventListener('wheel', e => {
    if (e.altKey) {
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.1 : -0.1;
      orbitSpeed = Math.max(0, Math.min(5.0, Math.round(((orbitSpeed || 0) + step) * 10) / 10));
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
    const dpr = window.devicePixelRatio || 1; // re-read: stale across monitors
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
  // Dial -> SIGNIFICANT BUFFER -> dotted orbit -> small gap -> task boxes.
  // Boxes are guaranteed strictly outside the dotted ring: nearest edge
  // sits at orbitR + OUTER_GAP, so even with +/-6px bounce/slide animation
  // they never cross back inside the dotted line.
  const ORBIT_GAP = 42;   // significant distance buffer: dial edge -> dotted ring
  const OUTER_GAP_BASE = 20; // dotted ring -> nearest box edge (covers anim inward offsets)
  function orbitRadius(r) { return r + ORBIT_GAP; }

  function applyTodoAnim() {
    const panel = document.getElementById('todo-panel');
    if (panel) panel.dataset.anim = todoAnimEff();
  }

  function clockBounds() {
    const w = wrapSize.w, h = wrapSize.h; // cached by resize()
    const cx = w/2, cy = h/2;
    // Room for: dotted orbit (42) + outer gap (20) + typical box half-size.
    // FIXED SIZE: the dial never shrinks, no matter how many labels exist.
    // Labels are HTML overlay (never clipped); each shrinks its own font
    // down to 8px to fit, then simply overflows past the window edge.
    const margin = 90;
    const r = Math.max(50, Math.min(cx, cy) - margin);
    return { cx, cy, r, w, h };
  }

  function drawLabelOrbit(cx, cy, r) {
    const or = orbitRadius(r);
    // Clockwise rotation scaled by orbitSpeed. 1.0x ~= 20px/s. 0 = paused.
    const spd = (typeof orbitSpeed === 'number' ? orbitSpeed : 1.0);
    const nowMs = performance.now();
    const rot = (nowMs / 1000) * 20 * spd;
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
    
    // Check gear icon click first
    if (isClickOnGear(mx, my)) {
        api.showPanel({style,theme,handType,opacity,sessions,blockOpacity,blockAnim,tooltipAnim,tooltipSize,orbitSpeed,orbitStyle,todoAnim,windowFitAuto});
       return;
    }
    
    const { cx, cy, r } = clockBounds();
    const dx = mx - cx, dy = my - cy;
    const dist = Math.hypot(dx, dy);

    // ── If in edit mode, check knobs / delete / dismiss ──
    if (interactiveMode && interactiveMode.startsWith('edit-')) {
       const idx = parseInt(interactiveMode.split('-')[1]);
       const sess = sessions[idx];
       if (sess) {
           // Delete block button (only in -both mode)
           if (interactiveMode.endsWith('-both')) {
               const midTime = (sess.start + sess.end) / 2;
               const midA = getAngleForDate(new Date(midTime));
               const delBtnX = cx + Math.cos(midA) * (r - 35);
               const delBtnY = cy + Math.sin(midA) * (r - 35);
               if (Math.hypot(mx - delBtnX, my - delBtnY) < 18) {
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
    if (dist <= r) {
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
               task: ''
           });
           
           save();
           interactiveMode = `edit-${sessions.length - 1}-both`;
           return;
        }
    }
    
    // Nothing interactive hit → drag window
    interactiveMode = null;
    dragging=true; 
    api.dragStart(); 
  });

  window.addEventListener('mousemove', e => { 
    if(dragging) api.dragMove(); 
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
    if(dragging){dragging=false;api.dragEnd();} 
    if(draggingKnob) {
      draggingKnob = false;
      save(); // Save once at the end of the drag
      if (interactiveMode && interactiveMode.startsWith('edit-')) {
         const idx = interactiveMode.split('-')[1];
         interactiveMode = `edit-${idx}-both`; // Return to showing both handles
      } else {
         interactiveMode = null;
      }
    }
  });
  // Canvas-drawn settings gear
  let gearOpacity = 0;
  let lastMouseMove = 0;
  let lastMouseX = null, lastMouseY = null;
  let gearX = 0, gearY = 0, gearR = 14;

  // Track label animation birth times and click regions
  let labelBirthTimes = {};  // sessionIdx -> timestamp
  let labelHitBoxes = [];    // legacy (labels are HTML overlay now)
  let editingLabelIdx = -1;
  let editInput = null;

  // ── Todo list (HTML panel) — minimal: + button, add box, task cards ──
  const todoList = document.getElementById('todo-list');
  const todoAddBox = document.getElementById('todo-add-box');
  const todoAddPlus = document.getElementById('todo-add-plus');

  // Inline SVG flag
  const FLAG_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3v18h2v-7h11l-2-4 2-4H7V3H5z"/></svg>';

  function escapeHtml(s) {
    return (s || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function renderTodos() {
    todoList.innerHTML = '';
    todos.forEach((t, idx) => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (t.done ? ' done' : '');
      // Two animations: entrance (no delay) + infinite loop (phase offset).
      li.style.animationDelay = '0s, ' + (-(idx * 0.3)).toFixed(2) + 's';
      li.dataset.id = t.id;
      const colorStyle = t.color ? `--todo-color:${t.color};background:${t.color}88;` : '';
      li.innerHTML = `
        <div class="todo-check ${t.done ? 'checked' : ''}" data-action="toggle" data-id="${t.id}"></div>
        <label class="todo-color ${t.color ? 'has-color' : ''}" data-action="color" data-id="${t.id}" style="${colorStyle}" title="Color">
          <input type="color" value="${t.color || '#8b5cf6'}" data-id="${t.id}" />
        </label>
        <div class="todo-text" data-action="edit" data-id="${t.id}">${escapeHtml(t.text)}</div>
        <button class="todo-priority" data-action="priority" data-id="${t.id}" data-priority="${t.priority || 'none'}" title="Priority: ${t.priority || 'none'} (click to cycle)">${FLAG_SVG}</button>
        <button class="todo-del" data-action="del" data-id="${t.id}" title="Delete">×</button>
      `;
      todoList.appendChild(li);
    });
  }

  function addTodo(text) {
    const t = (text || '').trim();
    if (!t) return;
    todos.unshift({
      id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
      text: t, done: false, createdAt: Date.now(),
      priority: null, color: null
    });
    saveTodos();
    renderTodos();
  }

  function removeTodo(id) {
    const li = todoList.querySelector(`.todo-item[data-id="${id}"]`);
    if (li) {
      li.classList.add('removing');
      setTimeout(() => {
        todos = todos.filter(t => t.id !== id);
        saveTodos(); renderTodos();
      }, 260);
    } else {
      todos = todos.filter(t => t.id !== id);
      saveTodos(); renderTodos();
    }
  }

  function toggleTodo(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    saveTodos(); renderTodos();
  }

  function cyclePriority(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    const order = [null, 'low', 'medium', 'high'];
    const i = order.indexOf(t.priority || null);
    t.priority = order[(i + 1) % order.length];
    saveTodos(); renderTodos();
  }

  function setColor(id, color) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    t.color = color || null;
    saveTodos(); renderTodos();
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
    // If the click landed on the color input itself, let the native picker open.
    // Do NOT swallow the event with closest('[data-action]') in that case.
    if (e.target.tagName === 'INPUT' && e.target.type === 'color') {
      return; // native color picker will open
    }
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;
    if (action === 'toggle') { toggleTodo(id); return; }
    if (action === 'del')    { e.stopPropagation(); removeTodo(id); return; }
    if (action === 'priority') { e.stopPropagation(); cyclePriority(id); return; }
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

  // Color picker — listen for input events on the hidden color inputs
  todoList.addEventListener('input', e => {
    if (e.target.matches('input[type="color"]')) {
      setColor(e.target.dataset.id, e.target.value);
    }
  });

  renderTodos();
  applyTodoAnim();

  window.addEventListener('mousemove', e => {
    lastMouseMove = Date.now();
    const rect = canvas.getBoundingClientRect();
    lastMouseX = e.clientX - rect.left;
    lastMouseY = e.clientY - rect.top;
  });

  function startEditLabel(idx, box) {
     if (editingLabelIdx === idx && editInput) return;
     stopEditLabel(true);
     editingLabelIdx = idx;
     lastLabelSig = '__editing__';
     
     const sizeScale = tooltipSize || 1.0;
     const fontPx = Math.round(11 * sizeScale);

     editInput = document.createElement('input');
     editInput.type = 'text';
     editInput.value = sessions[idx].task || '';
     editInput.placeholder = 'Task name...';
     Object.assign(editInput.style, {
        position: 'absolute',
        left: box.x + 'px',
        top: box.y + 'px',
        width: Math.max(box.w, 64) + 'px',
        height: box.h + 'px',
        background: 'rgba(10,10,20,0.96)',
        border: '1px solid ' + (sessions[idx].color || '#3b82f6'),
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
        if (sessions[idx]) {
           sessions[idx].task = editInput.value;
           save();
        }
     });
     editInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === 'Escape') stopEditLabel();
     });
     editInput.addEventListener('blur', () => setTimeout(stopEditLabel, 100));
     editInput.addEventListener('mousedown', e => e.stopPropagation());
     document.getElementById('clock-wrapper').appendChild(editInput);
     editInput.focus();
     editInput.select();
  }

  function stopEditLabel(silent) {
     editingLabelIdx = -1;
     if (editInput && editInput.parentNode) editInput.parentNode.removeChild(editInput);
     editInput = null;
     if (!silent) lastLabelSig = '__editdone__';
  }

  // ── Floating task labels (HTML overlay — never clipped by the canvas) ──
  // Labels live in #labels (overflow:visible), so east-side boxes can extend
  // over the transparent todo-panel area up to the window edge. The math below
  // still guarantees every box sits totally outside the dotted orbit ring.
  const labelsLayer = document.getElementById('labels');
  const MOTION_CLASS = {
    'bounce':'m-bounce','slide':'m-slide','fade':'m-fade','flip':'m-flip',
    'typewriter':'m-typewriter','glow-in':'m-glow-in','scale-pop':'m-scale-pop',
    'swing':'m-swing','wave':'m-wave','jitter':'m-jitter','orbit':'m-orbit',
    'breathing':'m-breathing','elastic':'m-elastic','wobble':'m-wobble',
    'neon-pulse':'m-neon-pulse','shiver':'m-shiver','heartbeat':'m-heartbeat',
    'float-tilt':'m-float-tilt','zoom-spin':'m-zoom-spin','glitch':'m-glitch',
    'flicker':'m-flicker','drift':'m-drift','pendulum':'m-pendulum',
    'snake':'m-snake','blink':'m-blink','tada':'m-tada'
  };
  let lastLabelSig = '__init__';
  let enterTimer = null; // clears the 600ms entrance state without a rebuild storm
  let labelCenters = []; // [{x, y, idx, el, ph}] wrapper-relative centers
  let lastMouseClient = null;

  function animPadFor(style, isPH) {
    let p = 4;
    if (style === 'elastic') p += 30;
    else if (style === 'scale-pop') p += 20;
    else if (style === 'heartbeat') p += 15;
    else if (style === 'breathing' || style === 'wave') p += 8;
    else if (style === 'zoom-spin') p += 12;
    else if (style === 'glitch') p += 6;
    else if (style === 'neon-pulse') p += 6;
    else if (style === 'drift' || style === 'slide' || style === 'bounce') p += 6;
    else if (style === 'pendulum') p += 12;
    else if (style === 'snake') p += 6;
    else if (style === 'tada') p += 14;
    if (isPH) p += 4;
    return p;
  }

  function labelSig(cx, cy, r, W, H) {
    return [cx|0, cy|0, r|0, W, H, tooltipSize, tooltipAnim,
      sessions.map(s => s.start + ':' + s.end + ':' + (s.task || '') + ':' + (s.color || '')).join('|'),
      editingLabelIdx].join('~');
  }

  function syncLabels(cx, cy, r, W, H) {
    // Change-driven: rebuild the DOM only when data or geometry changed.
    // (No time bucket — rebuilding restarts CSS motions and churns layout.)
    const sig = labelSig(cx, cy, r, W, H);
    if (sig === lastLabelSig) return;
    lastLabelSig = sig;
    renderLabels(cx, cy, r, W, H);
  }

  // Expired sessions drop off the dial: re-check visibility every 10s and
  // invalidate ONLY when the visible set actually changed.
  let lastVisSig = '';
  setInterval(() => {
    try {
      const now = Date.now();
      const vs = sessions.map(s => (s && s.end > now - 300000 && s.task ? '1' : '0')).join('');
      if (vs !== lastVisSig) { lastVisSig = vs; lastLabelSig = '__expiry__'; }
    } catch (_) {}
  }, 10000);

  // Ask main to grow/shrink the window so labels never clip (throttled).
  let lastFitSent = { t: -1, b: -1 }, lastFitAt = 0;
  function maybeFitWindow(needT, needB) {
    if (!windowFitAuto || !api.fitWindow) return;
    needT = Math.max(0, Math.ceil(needT)); needB = Math.max(0, Math.ceil(needB));
    const now = performance.now();
    if ((needT === lastFitSent.t && needB === lastFitSent.b) || now - lastFitAt < 800) return;
    lastFitSent = { t: needT, b: needB }; lastFitAt = now;
    try { api.fitWindow({ top: needT, bottom: needB }); } catch (_) {}
  }

  function renderLabels(cx, cy, r, W, H) {
    const now = Date.now();
    labelsLayer.innerHTML = '';
    labelCenters = [];
    const sizeScale = tooltipSize || 1.0;
    const baseFont = Math.round(11 * sizeScale);
    const padX = 10;
    const style = tooltipAnim || 'bounce';
    const mClass = MOTION_CLASS[style] || 'm-bounce';
    const orbitR = orbitRadius(r);
    const outerGap = Math.max(OUTER_GAP_BASE, Math.round(10 * sizeScale));
    const wrapRect0 = document.getElementById('clock-wrapper').getBoundingClientRect();
    const eastMax = window.innerWidth - (wrapRect0.left || 0) - 4;
    let fitMin = Infinity, fitMax = -Infinity; // label extremes for window auto-fit
    sessions.forEach((sess, i) => {
      if (!sess || sess.end < now - 5 * 60 * 1000) return;
      if (editingLabelIdx === i) return;
      const isPH = !sess.task;
      const text = isPH ? '＋ Add Task' : sess.task;
      if (!labelBirthTimes[i]) labelBirthTimes[i] = now;
      const ang = getAngleForDate(new Date((sess.start + sess.end) / 2));
      const cA = Math.cos(ang), sA = Math.sin(ang);
      const pad = animPadFor(style, isPH);
      // Shrink this label's font until it fits the WINDOW at the required
      // outside-orbit distance (east side may use the todo-panel area).
      let cur = baseFont, bW = 0, bH = 0, cdX = 0, cdY = 0;
      for (let a = 0; a < 12; a++) {
        X.font = `600 ${cur}px Inter, system-ui, sans-serif`;
        const tw = X.measureText(text).width;
        const del = isPH ? 0 : (Math.max(3.5, Math.round(cur * 0.4)) * 2 + 3 + 10);
        bW = Math.ceil(tw + padX * 2 + del);
        bH = Math.ceil(cur + 12);
        const proj = Math.abs((bW / 2) * cA) + Math.abs((bH / 2) * sA);
        const cd = orbitR + outerGap + proj + pad;
        cdX = cx + cA * cd; cdY = cy + sA * cd;
        if (cdX - bW / 2 >= 2 && cdX + bW / 2 <= eastMax &&
            cdY - bH / 2 >= 2 && cdY + bH / 2 <= H - 2) break;
        if (cur <= 8) break;
        cur -= 1;
      }
      // Motion class goes on the ANCHOR so the whole box animates together.
      const el = document.createElement('div');
      el.className = 'task-label' + (isPH ? ' placeholder hidden' : '') +
        ' ' + (isPH ? 'm-placeholder-pulse' : mClass) +
        ((now - labelBirthTimes[i] < 600) ? ' entering' : '');
      el.dataset.idx = i;
      el.style.left = cdX.toFixed(1) + 'px';
      el.style.top = cdY.toFixed(1) + 'px';
      el.style.fontSize = cur + 'px';
      el.style.setProperty('--dx', cA.toFixed(3));
      el.style.setProperty('--dy', sA.toFixed(3));
      el.style.setProperty('--lc', sess.color || '#3b82f6');
      el.title = text;
      const box = document.createElement('div');
      box.className = 'lbl-box';
      const row = document.createElement('div');
      row.className = 'lbl-row';
      const sp = document.createElement('span');
      sp.className = 'txt';
      sp.textContent = text;
      row.appendChild(sp);
      if (!isPH) {
        const xb = document.createElement('span');
        xb.className = 'x';
        xb.textContent = '×';
        const fs = Math.max(11, Math.round(cur * 0.9));
        xb.style.width = fs + 'px';
        xb.style.height = fs + 'px';
        xb.style.fontSize = fs + 'px';
        xb.dataset.idx = i;
        row.appendChild(xb);
      }
      box.appendChild(row);
      el.appendChild(box);
      labelsLayer.appendChild(el);
      labelCenters.push({ x: cdX, y: cdY, idx: i, el, ph: isPH });
      // Track extremes so the window can grow to fit (fixed dial).
      // Hidden placeholders don't reserve space.
      if (!isPH) {
        if (cdY - bH / 2 < fitMin) fitMin = cdY - bH / 2;
        if (cdY + bH / 2 > fitMax) fitMax = cdY + bH / 2;
      }
    });
    for (const key in labelBirthTimes) { if (!sessions[key]) delete labelBirthTimes[key]; }
    refreshPlaceholderVisibility(null);
    // Clear the entrance state 650ms after a batch with new labels.
    if (labelCenters.some(c => !c.ph && (now - (labelBirthTimes[c.idx] || 0) < 600)) && !enterTimer) {
      enterTimer = setTimeout(() => { enterTimer = null; lastLabelSig = '__entered__'; }, 650);
    }
    // Grow/shrink the window (not the dial) when labels overflow top/bottom.
    maybeFitWindow(4 - fitMin, fitMax - (H - 4));
  }

  function refreshPlaceholderVisibility(e) {
    let px = null, py = null;
    if (e && typeof e.clientX === 'number') { px = e.clientX; py = e.clientY; }
    else if (lastMouseClient) { px = lastMouseClient.x; py = lastMouseClient.y; }
    if (px === null) return;
    const wr = document.getElementById('clock-wrapper').getBoundingClientRect();
    for (const c of labelCenters) {
      if (!c.ph) continue;
      const d = Math.hypot(px - (wr.left + c.x), py - (wr.top + c.y));
      c.el.classList.toggle('hidden', d > 80);
    }
  }

  labelsLayer.addEventListener('click', e => {
    const xBtn = e.target.closest('.x');
    if (xBtn) {
      e.stopPropagation();
      const idx = parseInt(xBtn.dataset.idx);
      if (sessions[idx]) {
        sessions[idx].task = '';
        save();
        lastLabelSig = '__cleared__';
      }
      return;
    }
    const lab = e.target.closest('.task-label');
    if (lab) {
      e.stopPropagation();
      const idx = parseInt(lab.dataset.idx);
      // Anchor is zero-size — measure the visual box instead.
      const b = lab.querySelector('.lbl-box').getBoundingClientRect();
      const wr = document.getElementById('clock-wrapper').getBoundingClientRect();
      startEditLabel(idx, {
        x: b.left - wr.left, y: b.top - wr.top, w: b.width, h: b.height
      });
    }
  });

  window.addEventListener('mousemove', e => {
    lastMouseClient = { x: e.clientX, y: e.clientY };
    refreshPlaceholderVisibility(e);
  });

  function drawGearIcon(cx, cy, r) {
    // Position: top-right of clock circle
    gearX = cx + r * 0.65;
    gearY = cy - r * 0.65;
    
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
    }

    X.restore();
  }

  function drawSessionsOverlay(cx, cy, r) {
    if (!sessions || sessions.length === 0) return;
    const nowTime = performance.now();
    const realNow = Date.now();
    let needsCleanup = false;
    const spd = blockAnim.speed || 1.0;
    const t = (nowTime / 1000) * spd;
    
    X.save();
    const MS_IN_12H = 43200000;
    
    sessions.forEach(sess => {
       if (realNow - sess.end > MS_IN_12H) {
           needsCleanup = true; 
           return; 
       }
       
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
           X.beginPath();
           X.moveTo(cx, cy);
           X.arc(cx, cy, r, startAngle, currentAngle);
           X.closePath();
           X.fillStyle = elColor;
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
    });
    X.restore();
    
    if (needsCleanup) {
       sessions = sessions.filter(s => nowTime - s.end <= MS_IN_12H);
       save();
    }
  }

  function drawInteractiveKnob(cx, cy, r) {
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
       const midTime = (sess.start + sess.end) / 2;
       const midA = getAngleForDate(new Date(midTime));
       const delX = cx + Math.cos(midA) * (r - 35);
       const delY = cy + Math.sin(midA) * (r - 35);
       
       X.beginPath(); X.arc(delX, delY, 12, 0, PI2);
       X.fillStyle = 'rgba(10,10,20,0.8)'; X.fill();
       X.lineWidth = 1; X.strokeStyle = 'rgba(239,68,68,0.8)'; X.stroke();
       X.font = '10px sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle';
       X.fillStyle = '#ef4444';
       X.fillText('🗑️', delX, delY + 1);
       
       X.restore();
       
       // Position DOM Pickers inside the ring
       if (pWrapS && pInputS) {
           pWrapS.style.display = 'block';
           const pxS = cx + Math.cos(aS) * (r - 50);
           const pyS = cy + Math.sin(aS) * (r - 50);
           pWrapS.style.left = (pxS - 11) + 'px';
           pWrapS.style.top = (pyS - 11) + 'px';
           if (!pWrapS.matches(':focus-within')) pInputS.value = sess.color;
       }
       if (pWrapE && pInputE) {
           pWrapE.style.display = 'block';
           const pxE = cx + Math.cos(aE) * (r - 50);
           const pyE = cy + Math.sin(aE) * (r - 50);
           pWrapE.style.left = (pxE - 11) + 'px';
           pWrapE.style.top = (pyE - 11) + 'px';
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

  function draw() {
    // Hidden/minimized window: keep the loop alive but skip all paint work.
    if (!document.hidden) {
      const { cx, cy, r, w, h } = clockBounds();
      const now=new Date();
      const sec=now.getSeconds(),ms=now.getMilliseconds();
      const secF=sec+ms/1000, minF=now.getMinutes()+secF/60, hrF=(now.getHours()%12)+minF/60;
      const t=THEMES[theme]||THEMES.midnight;
      X.clearRect(0,0,w,h);
      (STYLES[style]||drawGhostPure)(cx,cy,r,hrF,minF,secF,t);
      drawSessionsOverlay(cx, cy, r);
      drawLabelOrbit(cx, cy, r);
      syncLabels(cx, cy, r, w, h);
      drawInteractiveKnob(cx, cy, r);
      drawGearIcon(cx, cy, r);
      drawTooltipSizeIndicator(cx, cy, r);
      drawOrbitSpeedIndicator(cx, cy, r);
    }
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
