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
  let todos = []; // [{id, text, done, createdAt, priority, color}]
  if (Array.isArray(saved.todos)) todos = saved.todos;
  function saveTodos() { api.saveSettings({todos}); }

  function applyOpacity() { canvas.style.opacity=opacity/100; }
  applyOpacity();
  function save() { api.saveSettings({clockStyle:style,theme,handType,opacity,sessions,blockOpacity,blockAnim,tooltipAnim,tooltipSize}); }

  api.onSetStyle(s => { style=s; save(); });
  api.onSetTheme(t => { theme=t; save(); });
  api.onSetOpacity(o => { opacity=o; applyOpacity(); save(); });
  api.onSetHands(h => { handType=h; save(); });
  api.onSetSessions(s => { sessions=s; save(); });
  api.onSetBlockOpacity(o => { blockOpacity=o; save(); });
  api.onSetBlockAnim(a => { blockAnim=a; save(); });
  api.onSetTooltipAnim(a => { tooltipAnim=a; save(); });
  if (api.onSetTooltipSize) api.onSetTooltipSize(s => { tooltipSize=s; save(); });

  // ── Tooltip font resize (Ctrl + scroll) ──
  // Add a brief size-pulse animation on the dial as feedback.
  let tooltipResizePulse = 0;
  canvas.addEventListener('wheel', e => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const step = e.deltaY < 0 ? 0.1 : -0.1;
    tooltipSize = Math.max(0.3, Math.min(5.0, (tooltipSize || 1.0) + step));
    save();
    tooltipResizePulse = performance.now();
  }, { passive: false });

  const dpr = window.devicePixelRatio||1;
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

  function resize() {
    // Canvas fills the clock wrapper (left square area). The todo panel lives
    // in the right side of the window and is HTML-based, so it has its own
    // layout. The renderer only needs to track the wrapper's size.
    const wrap = document.getElementById('clock-wrapper');
    const w = Math.max(80, wrap.clientWidth || 0);
    const h = Math.max(80, wrap.clientHeight || 0);
    canvas.width = w*dpr; canvas.height = h*dpr;
    canvas.style.width = w+'px'; canvas.style.height = h+'px';
    X.setTransform(dpr,0,0,dpr,0,0);
  }
  resize();
  // Re-run after first paint to catch any post-layout sizing adjustments
  requestAnimationFrame(resize);
  window.addEventListener('resize', resize);
  api.onWindowResized(resize);

  // ── Clock dial bounds (cached, recomputed on resize) ──
  // All drawing uses the wrapper's center, NOT the window center.
  function clockBounds() {
    const wrap = document.getElementById('clock-wrapper');
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const cx = w/2, cy = h/2;
    const r = Math.min(cx, cy) - 4;
    return { cx, cy, r, w, h };
  }

  let dragging=false;
  
  let interactiveMode = null;
  let interactiveDate = null;
  let draggingKnob = false;
  let dragIsPM = false;
  let dragLastHrs12 = null;

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
    
    // Check gear icon click first
    if (isClickOnGear(e.clientX, e.clientY)) {
       const saved = api.loadSettings() || {};
       api.showPanel({style,theme,handType,opacity,sessions});
       return;
    }
    
    const { cx, cy, r } = clockBounds();

    // Check if clicking on an active edit knob
    if (interactiveMode && interactiveMode.startsWith('edit-')) {
       const idx = parseInt(interactiveMode.split('-')[1]);
       const sess = sessions[idx];
       if (sess) {
           // First check delete block button
           if (interactiveMode.endsWith('-both')) {
               const midTime = (sess.start + sess.end) / 2;
               const midA = getAngleForDate(new Date(midTime));
               const delX = cx + Math.cos(midA) * (r - 35);
               const delY = cy + Math.sin(midA) * (r - 35);
               if (Math.hypot(e.clientX - delX, e.clientY - delY) < 18) {
                   sessions.splice(idx, 1);
                   save();
                   interactiveMode = null;
                   if (pWrapS) pWrapS.style.display = 'none';
                   if (pWrapE) pWrapE.style.display = 'none';
                   // Also clean up labels just in case
                   editingLabelIdx = -1;
                   if (editInput && editInput.parentNode) editInput.parentNode.removeChild(editInput);
                   return;
               }
           }
           
           const dStart = new Date(sess.start);
           const dEnd = new Date(sess.end);
           const aStart = getAngleForDate(dStart);
           const aEnd = getAngleForDate(dEnd);
           
           const kxS = cx + Math.cos(aStart) * (r - 12);
           const kyS = cy + Math.sin(aStart) * (r - 12);
           const kxE = cx + Math.cos(aEnd) * (r - 12);
           const kyE = cy + Math.sin(aEnd) * (r - 12);
           
           if (Math.hypot(e.clientX - kxS, e.clientY - kyS) < 30) {
               draggingKnob = true; dragIsPM = dStart.getHours() >= 12; dragLastHrs12 = dStart.getHours() % 12;
               interactiveMode = `edit-${idx}-start`; interactiveDate = dStart; return;
           }
           if (Math.hypot(e.clientX - kxE, e.clientY - kyE) < 30) {
               draggingKnob = true; dragIsPM = dEnd.getHours() >= 12; dragLastHrs12 = dEnd.getHours() % 12;
               interactiveMode = `edit-${idx}-end`; interactiveDate = dEnd; return;
           }
       }
    } else if (interactiveMode && interactiveDate) {
       // Old single-knob create logic
       const angle = getAngleForDate(interactiveDate);
       const kx = cx + Math.cos(angle) * (r - 12);
       const ky = cy + Math.sin(angle) * (r - 12);
       if (Math.hypot(e.clientX - kx, e.clientY - ky) < 30) {
          draggingKnob = true; dragIsPM = interactiveDate.getHours() >= 12; dragLastHrs12 = interactiveDate.getHours() % 12; return;
       }
    }
    
    // If not dragging knob, check if clicked ON a wedge
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    
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
           return; // Found a block, show handles, don't drag window
        } else if (dist > r - 60) {
           // Clicked empty space on the outer ring -> spawn new block
           const now = new Date();
           let totalMins = Math.round((angle / PI2) * 12 * 60);
           totalMins = Math.round(totalMins / 5) * 5; // round to 5 mins
           
           let hrs12 = Math.floor(totalMins / 60);
           let mins = totalMins % 60;
           
           if (hrs12 >= 12) hrs12 -= 12; // Modulo 12
           
           // Pick the nearest future occurrence of this 12-hour time.
           // If both today and tomorrow (in the same half) are in the past,
           // roll to the opposite half on the same day, then tomorrow.
           const cand1 = new Date(now);
           cand1.setHours(hrs12, mins, 0, 0);
           const cand2 = new Date(cand1); cand2.setHours(hrs12 + 12, mins, 0, 0);
           let start = (cand1.getTime() > now.getTime()) ? cand1 : cand2;
           if (start.getTime() <= now.getTime()) {
              // Both halves already passed today — push to the same hour tomorrow
              start = new Date(cand1);
              start.setDate(start.getDate() + 1);
           }
           
           const end = new Date(start);
           end.setHours(start.getHours() + 1); // 1 hour default
           
           if (!sessions) sessions = [];
           
           // Generate dynamic complementary color based on number of blocks
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
           
           const dynamicColor = hslToHex(hue, 85, 60);
           const dynamicElColor = hslToHex(hue, 95, 20); // Darker for elapsed
           
           sessions.push({
               start: start.getTime(),
               end: end.getTime(),
               color: dynamicColor,
               elapsedColor: dynamicElColor,
               type: 'custom',
               task: '' // Empty task creates a placeholder
           });
           
           const newIdx = sessions.length - 1;
           save(); // Persist to settings
           
           interactiveMode = `edit-${newIdx}-both`;
           return;
        }
    }
    
    interactiveMode = null;
    dragging=true; 
    api.dragStart(); 
  });

  window.addEventListener('mousemove', e => { 
    if(dragging) api.dragMove(); 
    else if (draggingKnob && interactiveMode && interactiveMode !== 'none') {
       if (interactiveMode.endsWith('-both')) return; // Just displaying both, not dragging
       const { cx, cy } = clockBounds();
       let angle = Math.atan2(e.clientY - cy, e.clientX - cx);
       if (angle < 0) angle += PI2;
       
       let clockAngle = angle + (Math.PI / 2);
       if (clockAngle < 0) clockAngle += PI2;
       if (clockAngle >= PI2) clockAngle -= PI2;
       
       let totalMins = Math.round((clockAngle / PI2) * 12 * 60);
       let hrs12 = Math.floor(totalMins / 60);
       let mins = totalMins % 60;
       
       mins = Math.round(mins / 5) * 5;
       if (mins === 60) { mins = 0; hrs12++; }
       if (hrs12 >= 12) hrs12 -= 12;
       
       if (dragLastHrs12 === 11 && hrs12 === 0) dragIsPM = !dragIsPM;
       else if (dragLastHrs12 === 0 && hrs12 === 11) dragIsPM = !dragIsPM;
       dragLastHrs12 = hrs12;
       
       let newHrs = hrs12;
       if (dragIsPM) newHrs += 12;
       if (newHrs === 24) newHrs = 0;
       
       if (interactiveMode.startsWith('edit-')) {
           const idx = parseInt(interactiveMode.split('-')[1]);
           const key = interactiveMode.split('-')[2]; // 'start' or 'end'
           const sess = sessions[idx];
           if (sess) {
              const d = new Date(sess[key]);
              d.setHours(newHrs, mins, 0, 0);
              sess[key] = d.getTime();
              // Prevent crossover
              if (key === 'start' && sess.start >= sess.end) sess.end = sess.start + 60000;
              if (key === 'end' && sess.end <= sess.start) sess.start = sess.end - 60000;
              save();
              
              // We must update the panel inputs too!
              const outTimeStr = `${newHrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;
              api.updateTimeInput({type: interactiveMode, timeStr: outTimeStr});
              interactiveDate = d; // update for draw
           }
       } else {
           interactiveDate.setHours(newHrs, mins, 0, 0);
           const timeStr = `${newHrs.toString().padStart(2,'0')}:${mins.toString().padStart(2,'0')}`;
           api.updateTimeInput({type: interactiveMode, timeStr});
       }
    }
  });

  window.addEventListener('mouseup', () => { 
    if(dragging){dragging=false;api.dragEnd();} 
    if(draggingKnob) {
      draggingKnob = false;
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
  let labelHitBoxes = [];    // [{x, y, w, h, idx, delX, delY, delR}]
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
      li.style.animationDelay = (idx * 0.04) + 's';
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

  window.addEventListener('mousemove', e => {
    lastMouseMove = Date.now();
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  // Click on label to edit, click × to delete task
  canvas.addEventListener('click', e => {
     const mx = e.clientX, my = e.clientY;
     for (const box of labelHitBoxes) {
        // Check delete button
        if (Math.hypot(mx - box.delX, my - box.delY) < box.delR + 4) {
           if (sessions[box.idx]) {
              sessions[box.idx].task = '';
              save();
           }
           return;
        }
        // Check label body
        if (mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h) {
           startEditLabel(box.idx, box);
           return;
        }
     }
  });

  function startEditLabel(idx, box) {
     if (editingLabelIdx === idx && editInput) return;
     stopEditLabel();
     editingLabelIdx = idx;
     
     editInput = document.createElement('input');
     editInput.type = 'text';
     editInput.value = sessions[idx].task || '';
     editInput.placeholder = 'Task name...';
     Object.assign(editInput.style, {
        position: 'absolute',
        left: box.x + 'px',
        top: box.y + 'px',
        width: Math.max(box.w, 80) + 'px',
        height: box.h + 'px',
        background: 'rgba(10,10,20,0.95)',
        border: '1px solid ' + (sessions[idx].color || '#3b82f6'),
        borderRadius: '10px',
        color: '#fff',
        fontSize: '10px',
        fontWeight: '600',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '0 8px',
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

  function stopEditLabel() {
     editingLabelIdx = -1;
     if (editInput && editInput.parentNode) editInput.parentNode.removeChild(editInput);
     editInput = null;
  }

  function drawTaskLabels(cx, cy, r) {
    const now = Date.now();
    const labelR = r + 16;
    const maxR = Math.min(cx, cy) - 2;
    const useR = Math.min(labelR, maxR);
    // Wrapper bounds — labels must NEVER extend past the clock area's edge
    const W = Math.max(40, cx * 2);
    const H = Math.max(40, cy * 2);
    const MARGIN = 4;

    labelHitBoxes = [];
    X.save();

    for (let i = 0; i < sessions.length; i++) {
       const sess = sessions[i];
       // 5-minute grace period so freshly-created blocks always show their label
       if (sess.end < now - 5 * 60 * 1000) continue;
       if (editingLabelIdx === i) continue;

       const isPlaceholder = !sess.task;
       // If this is a placeholder (no task yet), hide the tooltip when the
       // mouse is hovering near the dial — keep the face clean for interaction.
       if (isPlaceholder && lastMouseX !== null && lastMouseY !== null) {
          const mdx = lastMouseX - cx, mdy = lastMouseY - cy;
          if (Math.hypot(mdx, mdy) < r + 30) continue;
       }
       let drawText = isPlaceholder ? '＋ Add Task' : sess.task;

       if (!labelBirthTimes[i]) labelBirthTimes[i] = now;
       const age = now - labelBirthTimes[i];

       const midTime = (sess.start + sess.end) / 2;
       const angle = getAngleForDate(new Date(midTime));

       let tx = cx + Math.cos(angle) * useR;
       let ty = cy + Math.sin(angle) * useR;
       const isRight = Math.cos(angle) > 0;

       // Apply tooltipSize modifier + auto-shrink to keep the WHOLE text visible.
       // The minimum font size scales with the user's setting, so a bigger
       // tooltipSize actually produces a bigger font (not always 5px).
       const sizeScale = tooltipSize || 1.0;
       let fontPx = 10 * sizeScale;
       // Minimum scales: 1.0× → 4px, 1.5× → 6px, 2.0× → 8px, 2.5× → 10px
       const minFontPx = Math.max(4, sizeScale * 4);
       X.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
       const pad = 5 * sizeScale;
       const delSize = 5 * sizeScale;
       const delExtra = isPlaceholder ? 0 : delSize * 2 + 6;
       // Position clearly outside the dial so the text area never overlaps the face
       const txC = cx + Math.cos(angle) * (r + 24);
       // Available width depends on side + side clearance
       const availW = isRight ? (W - MARGIN - (txC + pad + delExtra)) : (txC - MARGIN - pad);
       let tw = X.measureText(drawText).width;
       // Shrink the font until the label fits, down to the scaled minimum
       while (tw + delExtra + pad * 2 > availW && fontPx > minFontPx) {
          fontPx -= 0.5;
          X.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
          tw = X.measureText(drawText).width;
       }
       const th = 12 * sizeScale;
       tx = txC;

       let labelX = tx, labelY = ty, align = 'center';

       if (isRight && tx + tw/2 + pad + delExtra + 4 > W - MARGIN) {
          align = 'right'; labelX = W - MARGIN - pad - delExtra - 4;
       } else if (!isRight && tx - tw/2 - pad < MARGIN) {
          align = 'left'; labelX = MARGIN + pad + 4;
       }
       labelY = Math.max(th + pad, Math.min(H - pad, labelY));

       let bgX;
       if (align === 'center') bgX = labelX - tw/2 - pad;
       else if (align === 'right') bgX = labelX - tw - pad;
       else bgX = labelX - pad;

       // Don't draw delete button on placeholder
       const bgW = tw + pad * 2 + delExtra;
       const bgH = th + pad * 1.5;
       const bgY = labelY - th/2 - pad * 0.75;
       const pillR = bgH / 2;
       
       // ── CONTINUOUS ANIMATIONS ──
       const animStyle = tooltipAnim || 'bounce';
       let animAlpha = isPlaceholder ? 0.85 : 1;
       let animScaleX = 1, animScaleY = 1, animOffX = 0, animOffY = 0, animRot = 0;
       
       const cycleDur = 2000; 
       const tCycle = (now % cycleDur) / cycleDur; // 0.0 to 1.0
       const tSine = Math.sin(tCycle * Math.PI * 2);
       const tCos = Math.cos(tCycle * Math.PI * 2);
       
       let shadowIntensity = 0;
       
       if (isPlaceholder) {
          // Gentle attention pulse so the "+ Add Task" hint is unmistakable.
          // 3.2s cycle: brighter alpha + tiny scale up + soft glow.
          const tP = (now % 3200) / 3200;
          const pulseSine = Math.sin(tP * Math.PI * 2);
          animAlpha = 0.75 + 0.2 * (pulseSine * 0.5 + 0.5);  // 0.75..0.95
          animScaleX = animScaleY = 1.0 + 0.04 * (pulseSine * 0.5 + 0.5);
          shadowIntensity = 0.6 + 0.4 * (pulseSine * 0.5 + 0.5);
       }
       
       if (!isPlaceholder) {
           switch (animStyle) {
              case 'fade': // Gentle opacity pulse
                 animAlpha = 0.6 + tSine * 0.4;
                 break;
              case 'bounce': // Smooth vertical jumping
                 animOffY = -Math.abs(tSine) * 8;
                 break;
              case 'slide': // Gentle float up/down
                 animOffY = tSine * 4;
                 break;
              case 'flip': // 3D-like flip over X axis
                 animScaleY = tCos;
                 animAlpha = Math.max(0.3, Math.abs(tCos));
                 break;
              case 'typewriter': // Retained as one-time
                 break;
              case 'glow-in': // Continuous pulsing glow
                 shadowIntensity = 0.5 + tSine * 0.5;
                 break;
              case 'scale-pop': // Single sharp pop
                 if (tCycle < 0.15) {
                    const p = tCycle / 0.15;
                    animScaleX = animScaleY = 1.0 + Math.sin(p * Math.PI) * 0.2;
                 }
                 break;
              case 'swing': // Pendulum swing
                 animRot = tSine * 12 * Math.PI / 180;
                 break;
              // --- NEW ---
              case 'wave': // Squish and stretch
                 animScaleX = 1.0 + tSine * 0.08;
                 animScaleY = 1.0 + tCos * 0.08;
                 break;
              case 'jitter': // Subtle glitch effect
                 if (Math.random() > 0.8) {
                    animOffX = (Math.random() - 0.5) * 4;
                    animOffY = (Math.random() - 0.5) * 4;
                    animAlpha = 0.7 + Math.random() * 0.3;
                 }
                 break;
              case 'orbit': // Small circular motion
                 animOffX = tCos * 3;
                 animOffY = tSine * 3;
                 break;
              case 'breathing': // Very slow deep inhale/exhale
                 animScaleX = animScaleY = 1.0 + Math.sin((now % 4000)/4000 * Math.PI * 2) * 0.06;
                 animAlpha = 0.7 + Math.sin((now % 4000)/4000 * Math.PI * 2) * 0.3;
                 break;
              case 'elastic': // Snaps out and springs back
                 if (tCycle < 0.3) {
                    // Damped sine wave
                    const p = tCycle / 0.3;
                    animScaleX = animScaleY = 1.0 + Math.sin(p * Math.PI * 5) * Math.pow(1 - p, 2) * 0.3;
                 }
                 break;
              case 'wobble': // Rotates back and forth sharply
                 if (tCycle < 0.5) {
                    animRot = Math.sin(tCycle * 2 * Math.PI * 3) * (1 - tCycle * 2) * 15 * Math.PI / 180;
                 }
                 break;
              case 'neon-pulse': // High intensity sharp flashes
                 if (tCycle < 0.1 || (tCycle > 0.15 && tCycle < 0.2)) {
                    shadowIntensity = 1.0;
                    animScaleX = animScaleY = 1.05;
                 } else {
                    shadowIntensity = 0.1;
                 }
                 break;
              case 'shiver': // Rapid tiny shakes
                 animRot = Math.sin(now / 20) * 2 * Math.PI / 180;
                 animOffX = Math.cos(now / 15) * 1;
                 break;
              case 'heartbeat': // Double-beat
                 if (tCycle < 0.1) animScaleX = animScaleY = 1.0 + Math.sin(tCycle * 10 * Math.PI) * 0.15;
                 else if (tCycle > 0.15 && tCycle < 0.25) animScaleX = animScaleY = 1.0 + Math.sin((tCycle - 0.15) * 10 * Math.PI) * 0.15;
                 break;
              case 'float-tilt': // Diagonal float with tilt
                 animOffY = tSine * 6;
                 animRot = Math.sin(tCycle * Math.PI * 2 - Math.PI/4) * 5 * Math.PI / 180;
                 break;
           }
       }
       
       X.globalAlpha = animAlpha * 0.85;
       X.save();
       
       const pivotX = bgX + bgW / 2;
       const pivotY = bgY + bgH / 2 + animOffY;
       X.translate(pivotX + animOffX, pivotY);
       X.scale(animScaleX, animScaleY);
       if (animRot) X.rotate(animRot);
       X.translate(-pivotX, -pivotY + animOffY);
       
       const drawBgY = bgY;
       
       // Pill background
       X.beginPath();
       X.moveTo(bgX + pillR, drawBgY);
       X.lineTo(bgX + bgW - pillR, drawBgY);
       X.arc(bgX + bgW - pillR, drawBgY + pillR, pillR, -Math.PI/2, Math.PI/2);
       X.lineTo(bgX + pillR, drawBgY + bgH);
       X.arc(bgX + pillR, drawBgY + pillR, pillR, Math.PI/2, -Math.PI/2);
       X.closePath();
       X.fillStyle = isPlaceholder ? 'rgba(20,20,35,0.95)' : 'rgba(10,10,20,0.8)';
       X.fill();
       X.strokeStyle = isPlaceholder ? 'rgba(167,139,250,0.7)' : sess.color;
       X.lineWidth = isPlaceholder ? 1.2 : 1;
       X.stroke();
       
       // Glow (applies to both placeholder pulse and named-block animations)
       if (shadowIntensity > 0) {
          X.shadowColor = isPlaceholder ? 'rgba(167,139,250,0.8)' : sess.color;
          X.shadowBlur = shadowIntensity * (isPlaceholder ? 14 : (animStyle === 'neon-pulse' ? 25 : 15));
          X.fill();
          X.shadowBlur = 0;
          X.shadowColor = 'transparent';
       }

       // Text
       X.textAlign = 'left';
       X.textBaseline = 'middle';
       X.fillStyle = isPlaceholder ? '#e9d5ff' : '#fff';
       
       let finalString = drawText;
       if (animStyle === 'typewriter' && !isPlaceholder) {
          const tAge = Math.min(1, age / 1000);
          const chars = Math.floor(tAge * drawText.length);
          finalString = drawText.substring(0, Math.max(1, chars));
       }
       X.fillText(finalString, bgX + pad + (isPlaceholder ? 0 : 8 * sizeScale), labelY + animOffY);
       
       // × button
       let delCx = 0, delCy = 0;
       if (!isPlaceholder) {
           delCx = bgX + bgW - pad - (2 * sizeScale);
           delCy = labelY + animOffY;
           X.globalAlpha = animAlpha * 0.5;
           X.beginPath();
           X.arc(delCx, delCy, delSize, 0, Math.PI*2);
           X.fillStyle = 'rgba(239,68,68,0.15)';
           X.fill();
           X.font = `700 ${9 * sizeScale}px sans-serif`;
           X.textAlign = 'center';
           X.fillStyle = 'rgba(239,68,68,0.7)';
           X.fillText('×', delCx, delCy + (1 * sizeScale));
       }
       
       X.restore();
       
       labelHitBoxes.push({
          x: bgX, y: bgY, w: bgW, h: bgH, idx: i,
          delX: delCx, delY: delCy, delR: isPlaceholder ? 0 : delSize
       });
    }
    
    for (const key in labelBirthTimes) {
       if (!sessions[key]) delete labelBirthTimes[key];
    }
    
    X.restore();
  }

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
    X.moveTo(bx + pr, by);
    X.lineTo(bx + bw - pr, by);
    X.arc(bx + bw - pr, by + pr, pr, -Math.PI/2, Math.PI/2);
    X.lineTo(bx + pr, by + bh);
    X.arc(bx + pr, by + pr, pr, Math.PI/2, -Math.PI/2);
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

  function drawLeafHands(cx,cy,r,ha,ma,sa,hC,mC,sC,isDark) {
    X.lineCap='round';X.lineJoin='round';
    X.save();X.translate(cx,cy);X.rotate(ha);
    X.beginPath();X.moveTo(0,r*0.1);X.quadraticCurveTo(r*0.08,-r*0.25,0,-r*0.55);X.quadraticCurveTo(-r*0.08,-r*0.25,0,r*0.1);
    X.fillStyle=hC;X.fill();X.restore();
    X.save();X.translate(cx,cy);X.rotate(ma);
    X.beginPath();X.moveTo(0,r*0.1);X.quadraticCurveTo(r*0.06,-r*0.4,0,-r*0.8);X.quadraticCurveTo(-r*0.06,-r*0.4,0,r*0.1);
    X.fillStyle=mC;X.fill();X.restore();
    drawSec(cx,cy,r,sa,sC,isDark,0.85);
  }

  function drawChronometerHands(cx,cy,r,ha,ma,sa,hC,mC,sC,isDark) {
    X.lineCap='round';X.lineJoin='miter';
    // Vintage Chronometer: precision needles with round counter-balances
    X.save();X.translate(cx,cy);X.rotate(ha);
    X.beginPath();X.moveTo(-r*0.02, r*0.15);X.lineTo(r*0.02, r*0.15);
    X.lineTo(r*0.01, -r*0.4);X.lineTo(0, -r*0.5);X.lineTo(-r*0.01, -r*0.4);X.closePath();
    X.fillStyle=hC;X.fill();
    X.beginPath();X.arc(0, r*0.15, r*0.06, 0, PI2);X.lineWidth=2;X.strokeStyle=hC;X.stroke();X.restore();
    
    X.save();X.translate(cx,cy);X.rotate(ma);
    X.beginPath();X.moveTo(-r*0.015, r*0.15);X.lineTo(r*0.015, r*0.15);
    X.lineTo(r*0.008, -r*0.7);X.lineTo(0, -r*0.85);X.lineTo(-r*0.008, -r*0.7);X.closePath();
    X.fillStyle=mC;X.fill();
    X.beginPath();X.arc(0, r*0.15, r*0.05, 0, PI2);X.lineWidth=2;X.strokeStyle=mC;X.stroke();X.restore();
    drawSec(cx,cy,r,sa,sC,isDark,0.9);
  }

  function drawLuminousHands(cx,cy,r,ha,ma,sa,hC,mC,sC,isDark) {
    X.lineCap='butt';X.lineJoin='round';
    X.save();X.translate(cx,cy);X.rotate(ha);
    X.beginPath();X.rect(-r*0.04, -r*0.5, r*0.08, r*0.6);X.fillStyle=hC;X.fill();
    X.beginPath();X.rect(-r*0.015, -r*0.45, r*0.03, r*0.4);X.fillStyle=isDark?'#fff':'#000';X.fill();X.restore();
    
    X.save();X.translate(cx,cy);X.rotate(ma);
    X.beginPath();X.rect(-r*0.03, -r*0.8, r*0.06, r*0.9);X.fillStyle=mC;X.fill();
    X.beginPath();X.rect(-r*0.01, -r*0.75, r*0.02, r*0.65);X.fillStyle=isDark?'#fff':'#000';X.fill();X.restore();
    drawSec(cx,cy,r,sa,sC,isDark,0.85);
  }

  function drawArrowHands(cx,cy,r,ha,ma,sa,hC,mC,sC,isDark) {
    X.lineCap='round';X.lineJoin='round';
    X.save();X.translate(cx,cy);X.rotate(ha);
    X.beginPath();X.moveTo(-r*0.03, 0);X.lineTo(r*0.03, 0);X.lineTo(r*0.02, -r*0.3);
    X.lineTo(r*0.08, -r*0.3);X.lineTo(0, -r*0.5);X.lineTo(-r*0.08, -r*0.3);
    X.lineTo(-r*0.02, -r*0.3);X.closePath();
    X.fillStyle=hC;X.fill();X.restore();
    
    X.save();X.translate(cx,cy);X.rotate(ma);
    X.beginPath();X.moveTo(-r*0.02, 0);X.lineTo(r*0.02, 0);X.lineTo(r*0.015, -r*0.6);
    X.lineTo(r*0.06, -r*0.6);X.lineTo(0, -r*0.85);X.lineTo(-r*0.06, -r*0.6);
    X.lineTo(-r*0.015, -r*0.6);X.closePath();
    X.fillStyle=mC;X.fill();X.restore();
    drawSec(cx,cy,r,sa,sC,isDark,0.9);
  }

  function drawMinimalistDotHands(cx,cy,r,ha,ma,sa,hC,mC,sC,isDark) {
    X.lineCap='round';
    X.save();X.translate(cx,cy);X.rotate(ha);
    X.beginPath();X.moveTo(0, r*0.1);X.lineTo(0, -r*0.4);X.lineWidth=r*0.03;X.strokeStyle=hC;X.stroke();
    X.beginPath();X.arc(0, -r*0.45, r*0.05, 0, PI2);X.fillStyle=hC;X.fill();X.restore();
    
    X.save();X.translate(cx,cy);X.rotate(ma);
    X.beginPath();X.moveTo(0, r*0.1);X.lineTo(0, -r*0.7);X.lineWidth=r*0.02;X.strokeStyle=mC;X.stroke();
    X.beginPath();X.arc(0, -r*0.75, r*0.04, 0, PI2);X.fillStyle=mC;X.fill();X.restore();
    drawSec(cx,cy,r,sa,sC,isDark,0.85);
  }

  function drawArtDecoHands(cx,cy,r,ha,ma,sa,hC,mC,sC,isDark) {
    X.lineCap='butt';X.lineJoin='miter';
    X.save();X.translate(cx,cy);X.rotate(ha);
    X.beginPath();X.moveTo(-r*0.04, r*0.1);X.lineTo(r*0.04, r*0.1);
    X.lineTo(r*0.04, -r*0.2);X.lineTo(r*0.02, -r*0.2);X.lineTo(r*0.02, -r*0.4);
    X.lineTo(0, -r*0.5);X.lineTo(-r*0.02, -r*0.4);X.lineTo(-r*0.02, -r*0.2);
    X.lineTo(-r*0.04, -r*0.2);X.closePath();
    X.fillStyle=hC;X.fill();X.restore();
    
    X.save();X.translate(cx,cy);X.rotate(ma);
    X.beginPath();X.moveTo(-r*0.03, r*0.1);X.lineTo(r*0.03, r*0.1);
    X.lineTo(r*0.03, -r*0.4);X.lineTo(r*0.015, -r*0.4);X.lineTo(r*0.015, -r*0.7);
    X.lineTo(0, -r*0.85);X.lineTo(-r*0.015, -r*0.7);X.lineTo(-r*0.015, -r*0.4);
    X.lineTo(-r*0.03, -r*0.4);X.closePath();
    X.fillStyle=mC;X.fill();X.restore();
    drawSec(cx,cy,r,sa,sC,isDark,0.9);
  }

  const HANDS = {
    tapered:drawTaperedHands, baton:drawBatonHands, breguet:drawBreguetHands,
    skeleton:drawSkeletonHands, sword:drawSwordHands, spade:drawSpadeHands,
    syringe:drawSyringeHands, snowflake:drawSnowflakeHands, dauphine:drawDauphineHands,
    leaf:drawLeafHands, chronometer:drawChronometerHands, luminous:drawLuminousHands,
    arrow:drawArrowHands, minimalist_dot:drawMinimalistDotHands, art_deco:drawArtDecoHands
  };

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
      (hrF/12)*PI2 - Math.PI/2,
      (minF/60)*PI2 - Math.PI/2,
      (secF/60)*PI2 - Math.PI/2
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

  function getAnimModifier(nowTime) {
    const s = blockAnim.style || 'none';
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
      default: return { opMul: 1, rOff: 0, blur: 0 };
    }
  }

  function drawSessionsOverlay(cx, cy, r) {
    if (!sessions || sessions.length === 0) return;
    const nowTime = Date.now();
    let needsCleanup = false;
    const anim = getAnimModifier(nowTime);
    
    X.save();
    const MS_IN_12H = 43200000;
    
    sessions.forEach(sess => {
       if (nowTime - sess.end > MS_IN_12H) { 
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
       
       let elapsedMs = 0;
       if (nowTime > sess.start) {
           elapsedMs = Math.min(nowTime - sess.start, durationMs);
       }
       let elapsedAngle = (elapsedMs / MS_IN_12H) * PI2;
       let currentAngle = startAngle + elapsedAngle;
       let drawR = r + anim.rOff;
       let activeColor = anim.colorOverride || sess.color;

       // 1) Elapsed Portion (faded, no animation)
       if (elapsedMs > 0) {
           let elColor = sess.elapsedColor || sess.color;
           let hasCustomEl = !!sess.elapsedColor;
           X.globalAlpha = hasCustomEl ? blockOpacity * 0.7 : blockOpacity * 0.25;
           X.shadowBlur = 0; X.shadowColor = 'transparent';
           X.beginPath();
           X.moveTo(cx, cy);
           X.arc(cx, cy, r, startAngle, currentAngle);
           X.closePath();
           X.fillStyle = elColor;
           X.fill();
           
           X.globalAlpha = blockOpacity * 0.4;
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
           const pxS = cx + Math.cos(aS) * (r - 38);
           const pyS = cy + Math.sin(aS) * (r - 38);
           pWrapS.style.left = (pxS - 11) + 'px';
           pWrapS.style.top = (pyS - 11) + 'px';
           if (!pWrapS.matches(':focus-within')) pInputS.value = sess.color;
       }
       if (pWrapE && pInputE) {
           pWrapE.style.display = 'block';
           const pxE = cx + Math.cos(aE) * (r - 38);
           const pyE = cy + Math.sin(aE) * (r - 38);
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
    const { cx, cy, r, w, h } = clockBounds();
    const now=new Date();
    const sec=now.getSeconds(),ms=now.getMilliseconds();
    const secF=sec+ms/1000, minF=now.getMinutes()+secF/60, hrF=(now.getHours()%12)+minF/60;
    const t=THEMES[theme]||THEMES.midnight;
    X.clearRect(0,0,w,h);
    (STYLES[style]||drawGhostPure)(cx,cy,r,hrF,minF,secF,t);
    drawSessionsOverlay(cx, cy, r);
    drawTaskLabels(cx, cy, r);
    drawInteractiveKnob(cx, cy, r);
    drawGearIcon(cx, cy, r);
    drawTooltipSizeIndicator(cx, cy, r);
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
