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
  let reminders = []; // [{id, time:"HH:MM", label, recurring, lastFiredDate}]
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
  if (Array.isArray(saved.reminders)) reminders=saved.reminders;
  let todos = []; // [{id, text, done, createdAt}]
  let todoFilter = 'all';
  if (Array.isArray(saved.todos)) todos = saved.todos;
  function saveTodos() { api.saveSettings({todos}); }

  function applyOpacity() { canvas.style.opacity=opacity/100; }
  applyOpacity();
  function save() { api.saveSettings({clockStyle:style,theme,handType,opacity,sessions,blockOpacity,blockAnim,tooltipAnim,tooltipSize}); }
  function saveReminders() { api.saveSettings({reminders}); }

  api.onSetStyle(s => { style=s; save(); });
  api.onSetTheme(t => { theme=t; save(); });
  api.onSetOpacity(o => { opacity=o; applyOpacity(); save(); });
  api.onSetHands(h => { handType=h; save(); });
  api.onSetSessions(s => { sessions=s; save(); });
  api.onSetBlockOpacity(o => { blockOpacity=o; save(); });
  api.onSetBlockAnim(a => { blockAnim=a; save(); });
  api.onSetTooltipAnim(a => { tooltipAnim=a; save(); });
  if (api.onSetTooltipSize) api.onSetTooltipSize(s => { tooltipSize=s; save(); });

  // ── Reminder alert state ──
  let reminderAlert = null; // { label, firedAt, duration }
  if (api.onReminderFired) {
    api.onReminderFired(data => {
      reminderAlert = {
        label: data.label || 'Reminder',
        firedAt: performance.now(),
        duration: 30 * 1000 // 30s pulse window
      };
    });
  }

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
            api.onSetSessions(sessions);
            save();
         }
     }
  });
  if (pInputE) pInputE.addEventListener('input', e => {
     if (interactiveMode && interactiveMode.startsWith('edit-')) {
         const idx = parseInt(interactiveMode.split('-')[1]);
         if (sessions[idx]) {
            sessions[idx].elapsedColor = e.target.value;
            api.onSetSessions(sessions);
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
       api.showPanel({style,theme,handType,opacity,sessions,reminders:saved.reminders||[]});
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

  // ── Todo list (HTML panel) ──
  const todoList = document.getElementById('todo-list');
  const todoInput = document.getElementById('todo-input');
  const todoForm = document.getElementById('todo-form');
  const todoCount = document.getElementById('todo-count');
  const todoClear = document.getElementById('todo-clear');
  const todoEmpty = document.getElementById('todo-empty');

  function renderTodos() {
    const filtered = todos.filter(t => {
      if (todoFilter === 'active') return !t.done;
      if (todoFilter === 'done') return t.done;
      return true;
    });
    todoList.innerHTML = '';
    filtered.forEach((t, idx) => {
      const realIdx = todos.indexOf(t);
      const li = document.createElement('li');
      li.className = 'todo-item' + (t.done ? ' done' : '');
      li.style.animationDelay = (idx * 0.04) + 's';
      li.dataset.id = t.id;
      li.innerHTML = `
        <div class="todo-check ${t.done ? 'checked' : ''}" data-action="toggle" data-id="${t.id}"></div>
        <div class="todo-text" data-action="edit" data-id="${t.id}">${escapeHtml(t.text)}</div>
        <button class="todo-del" data-action="del" data-id="${t.id}" title="Delete">×</button>
      `;
      todoList.appendChild(li);
    });
    const activeCount = todos.filter(t => !t.done).length;
    todoCount.textContent = activeCount;
    todoCount.classList.toggle('has-items', activeCount > 0);
    todoEmpty.classList.toggle('show', todos.length === 0);
  }

  function escapeHtml(s) {
    return (s || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function addTodo(text) {
    const t = (text || '').trim();
    if (!t) return;
    todos.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2,7), text: t, done: false, createdAt: Date.now() });
    saveTodos();
    renderTodos();
  }

  function removeTodo(id) {
    const li = todoList.querySelector(`.todo-item[data-id="${id}"]`);
    if (li) {
      li.classList.add('removing');
      setTimeout(() => {
        todos = todos.filter(t => t.id !== id);
        saveTodos();
        renderTodos();
      }, 240);
    } else {
      todos = todos.filter(t => t.id !== id);
      saveTodos();
      renderTodos();
    }
  }

  function toggleTodo(id) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    t.done = !t.done;
    saveTodos();
    renderTodos();
  }

  function updateTodoText(id, text) {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    const v = (text || '').trim();
    if (!v) { removeTodo(id); return; }
    t.text = v;
    saveTodos();
  }

  function clearCompleted() {
    if (!todos.some(t => t.done)) return;
    todos = todos.filter(t => !t.done);
    saveTodos();
    renderTodos();
  }

  // Form submit (Enter or + button)
  todoForm.addEventListener('submit', e => {
    e.preventDefault();
    addTodo(todoInput.value);
    todoInput.value = '';
    todoInput.focus();
  });

  // List clicks (event delegation)
  todoList.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;
    if (action === 'toggle') { toggleTodo(id); return; }
    if (action === 'del') { e.stopPropagation(); removeTodo(id); return; }
    if (action === 'edit') {
      // Make the text editable
      el.setAttribute('contenteditable', 'true');
      el.focus();
      // Select all
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

  // Filter chips
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      todoFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderTodos();
    });
  });

  // Clear completed
  todoClear.addEventListener('click', clearCompleted);

  // Initial render
  renderTodos();

  window.addEventListener('mousemove', e => {
    lastMouseMove = Date.now();
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  // Click on label to edit, click × to delete task
  // ── Reminder helpers ──
  // 24-hour mapping: 12 o'clock (top) = 00:00, 6 o'clock (bottom) = 12:00
  function timeToAngle(t) {
    const [h, m] = t.split(':').map(Number);
    return ((h + m/60) / 24) * PI2;
  }
  function angleToTime(a) {
    let norm = a; if (norm < 0) norm += PI2;
    const totalMins = Math.round((norm / PI2) * 24 * 60 / 5) * 5;
    const hrs = Math.floor(totalMins / 60) % 24;
    const mins = totalMins % 60;
    return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  }
  function reminderAngle(clientX, clientY, cx, cy) {
    const dx = clientX - cx, dy = clientY - cy;
    let a = Math.atan2(dy, dx) + Math.PI/2; // 0 at top
    if (a < 0) a += PI2; if (a >= PI2) a -= PI2;
    return a;
  }

  // Right-click on the clock face → spawn a reminder at that time
  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const { cx, cy, r } = clockBounds();
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    // Only spawn on the dial area (not way outside the clock)
    if (dist > r + 30) return;
    const a = reminderAngle(e.clientX, e.clientY, cx, cy);
    const time = angleToTime(a);
    if (!reminders) reminders = [];
    const newRem = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2,7),
      time, label: '', recurring: false
    };
    reminders.push(newRem);
    saveReminders();
    startEditReminderLabel(newRem.id);
  });

  canvas.addEventListener('click', e => {
     const mx = e.clientX, my = e.clientY;
     // Dismiss any active reminder alert first
     if (reminderAlert) {
        reminderAlert = null;
        return;
     }
     // Reminder pip interactions (delete × takes priority over select)
     for (const box of reminderHitBoxes) {
        if (box.delR > 0 && Math.hypot(mx - box.delX, my - box.delY) < box.delR + 4) {
           if (reminders[box.idx]) {
              reminders.splice(box.idx, 1);
              saveReminders();
              stopEditReminderLabel();
              return;
           }
        }
        if (Math.hypot(mx - box.x, my - box.y) < box.r + 4) {
           if (reminders[box.idx]) startEditReminderLabel(reminders[box.idx].id);
           return;
        }
     }
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
       let drawText = isPlaceholder ? '＋ Add Task' : sess.task;

       if (!labelBirthTimes[i]) labelBirthTimes[i] = now;
       const age = now - labelBirthTimes[i];

       const midTime = (sess.start + sess.end) / 2;
       const angle = getAngleForDate(new Date(midTime));

       let tx = cx + Math.cos(angle) * useR;
       let ty = cy + Math.sin(angle) * useR;
       const isRight = Math.cos(angle) > 0;

       // Apply tooltipSize modifier + auto-shrink if text would overflow wrapper
       const sizeScale = tooltipSize || 1.0;
       let fontPx = 10 * sizeScale;
       X.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
       const pad = 6 * sizeScale;
       const delSize = 6 * sizeScale;
       const delExtra = isPlaceholder ? 0 : delSize * 2 + 6;
       // Available width depends on side + side clearance
       const availW = isRight ? (W - MARGIN - (tx + pad + delExtra)) : (tx - MARGIN - pad);
       let tw = X.measureText(drawText).width;
       // Shrink the font until the label fits, down to a hard floor of 7px
       while (tw + delExtra + pad * 2 > availW && fontPx > 7) {
          fontPx -= 0.5;
          X.font = `600 ${fontPx}px Inter, system-ui, sans-serif`;
          tw = X.measureText(drawText).width;
       }
       // If even at 7px it still doesn't fit, truncate with an ellipsis
       if (tw + delExtra + pad * 2 > availW) {
          const ell = '…';
          while (drawText.length > 1 && X.measureText(drawText + ell).width + delExtra + pad * 2 > availW) {
             drawText = drawText.slice(0, -1);
          }
          drawText = drawText + ell;
          tw = X.measureText(drawText).width;
       }
       const th = 12 * sizeScale;

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
       
       // Connector line
       X.globalAlpha = animAlpha * (isPlaceholder ? 0.55 : 0.35);
       X.beginPath();
       X.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
       X.lineTo(bgX + (isRight ? 0 : bgW), labelY + animOffY);
       X.strokeStyle = isPlaceholder ? 'rgba(167,139,250,0.9)' : sess.color;
       X.lineWidth = isPlaceholder ? 1 : 0.8;
       X.setLineDash([3, 3]);
       X.stroke();
       X.setLineDash([]);
       
       // Color dot
       X.globalAlpha = animAlpha;
       if (!isPlaceholder) {
           X.beginPath();
           X.arc(bgX + pad, labelY + animOffY, 3 * sizeScale, 0, Math.PI*2);
           X.fillStyle = sess.color;
           X.fill();
       } else {
           // Placeholder: small "+" hint dot
           X.beginPath();
           X.arc(bgX + pad, labelY + animOffY, 2 * sizeScale, 0, Math.PI*2);
           X.fillStyle = 'rgba(167,139,250,0.95)';
           X.fill();
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

  // ── Reminder Alert Visual ──
  // Draws a pulsing red ring around the clock + a banner with the label.
  // Auto-clears after `duration` ms; user can click to dismiss.
  function drawReminderAlert(cx, cy, r) {
    if (!reminderAlert) return;
    const elapsedMs = performance.now() - reminderAlert.firedAt;
    if (elapsedMs > reminderAlert.duration) {
      reminderAlert = null;
      return;
    }
    const phase = elapsedMs / 1000; // seconds
    // Two pulse rings (slow + fast) for a heartbeat feel
    const pulse1 = (Math.sin(phase * 3) * 0.5 + 0.5);
    const pulse2 = (Math.sin(phase * 5 + 1.5) * 0.5 + 0.5);
    const fade = 1 - (elapsedMs / reminderAlert.duration); // 1 → 0
    X.save();
    // Outer ring
    X.beginPath();
    X.arc(cx, cy, r * (1.18 + 0.05 * pulse1), 0, PI2);
    X.strokeStyle = `rgba(239,68,68,${0.55 * fade})`;
    X.lineWidth = 4 + 4 * pulse1;
    X.shadowColor = `rgba(239,68,68,${0.9 * fade})`;
    X.shadowBlur = 22;
    X.stroke();
    // Inner ring
    X.beginPath();
    X.arc(cx, cy, r * (1.06 + 0.03 * pulse2), 0, PI2);
    X.strokeStyle = `rgba(251,191,36,${0.7 * fade})`;
    X.lineWidth = 2;
    X.shadowColor = `rgba(251,191,36,${0.8 * fade})`;
    X.shadowBlur = 14;
    X.stroke();
    X.shadowBlur = 0;
    X.shadowColor = 'transparent';
    // Banner — pill above the clock
    const text = `⏰ ${reminderAlert.label}`;
    X.font = '700 12px sans-serif';
    const tw = X.measureText(text).width;
    const padX = 12, padY = 6;
    const bw = tw + padX * 2, bh = 12 + padY * 2;
    const bx = cx - bw / 2;
    const by = cy - r - bh - 10;
    X.beginPath();
    const pr = bh / 2;
    X.moveTo(bx + pr, by);
    X.lineTo(bx + bw - pr, by);
    X.arc(bx + bw - pr, by + pr, pr, -Math.PI/2, Math.PI/2);
    X.lineTo(bx + pr, by + bh);
    X.arc(bx + pr, by + pr, pr, Math.PI/2, -Math.PI/2);
    X.closePath();
    X.fillStyle = `rgba(239,68,68,${0.92 * fade})`;
    X.fill();
    X.fillStyle = `rgba(255,255,255,${fade})`;
    X.textAlign = 'center';
    X.textBaseline = 'middle';
    X.fillText(text, cx, by + pr);
    X.restore();
  }

  // ── Reminder Pips on the clock face ──
  // Each reminder renders as a small filled circle just inside the dial at the
  // time-angle. Hover state enlarges it and shows a tooltip. Click selects it
  // (revealing a delete × + click-to-rename). Right-click spawns a new one.
  let reminderHitBoxes = []; // [{x, y, r, idx, delX, delY, delR}]
  let editingReminderId = null;
  let reminderEditInput = null;

  function stopEditReminderLabel() {
    editingReminderId = null;
    if (reminderEditInput && reminderEditInput.parentNode) reminderEditInput.parentNode.removeChild(reminderEditInput);
    reminderEditInput = null;
  }

  function startEditReminderLabel(id) {
    stopEditReminderLabel();
    const r = reminders.find(x => x.id === id);
    if (!r) return;
    editingReminderId = id;
    reminderEditInput = document.createElement('input');
    reminderEditInput.type = 'text';
    reminderEditInput.value = r.label || '';
    reminderEditInput.placeholder = 'Reminder label...';
    reminderEditInput.maxLength = 32;
    Object.assign(reminderEditInput.style, {
      position: 'absolute', zIndex: '9999',
      background: 'rgba(20,20,30,0.92)', color: '#fff',
      border: '1px solid rgba(251,191,36,0.5)', borderRadius: '6px',
      padding: '4px 8px', fontSize: '11px', fontFamily: 'sans-serif',
      outline: 'none', minWidth: '140px', textAlign: 'center'
    });
    document.body.appendChild(reminderEditInput);
    // Position near the click (just call right after start, so it lands on the body)
    const { cx: rcx, cy: rcy, r: rad } = clockBounds();
    const a = timeToAngle(r.time);
    const px = rcx + Math.cos(a - Math.PI/2) * (rad - 18);
    const py = rcy + Math.sin(a - Math.PI/2) * (rad - 18);
    reminderEditInput.style.left = (px - 70) + 'px';
    reminderEditInput.style.top  = (py - 30) + 'px';
    reminderEditInput.focus();
    reminderEditInput.select();
    reminderEditInput.addEventListener('input', () => {
      const rem = reminders.find(x => x.id === id);
      if (rem) { rem.label = reminderEditInput.value; saveReminders(); }
    });
    reminderEditInput.addEventListener('blur', () => setTimeout(stopEditReminderLabel, 150));
    reminderEditInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { reminderEditInput.blur(); }
      if (e.key === 'Escape') { stopEditReminderLabel(); }
    });
  }

  function drawReminderPips(cx, cy, r) {
    reminderHitBoxes = [];
    if (!reminders || reminders.length === 0) return;
    const now = performance.now();
    const hover = lastMouseX !== null && lastMouseY !== null;
    const pipR = 5;
    const selR = 8;
    const tol = 14; // hit tolerance
    X.save();
    for (let i = 0; i < reminders.length; i++) {
      const rem = reminders[i];
      if (!rem || !rem.time) continue;
      const a = timeToAngle(rem.time) - Math.PI/2; // canvas y is down
      const x = cx + Math.cos(a) * (r - 14);
      const y = cy + Math.sin(a) * (r - 14);
      const isHover = hover && Math.hypot(lastMouseX - x, lastMouseY - y) < tol;
      const isEditing = editingReminderId === rem.id;
      const isFiredToday = rem.lastFiredDate && rem.lastFiredDate >= new Date().toISOString().slice(0,10);
      // Pulse on hover or recently fired
      let pulse = 0;
      if (isHover) pulse = 0.3 * Math.sin(now / 100);
      if (isFiredToday) pulse += 0.4 * Math.sin(now / 250);
      // Outer halo
      X.beginPath();
      X.arc(x, y, selR + 2 + pulse, 0, PI2);
      X.fillStyle = isHover || isEditing ? 'rgba(251,191,36,0.18)' : 'rgba(251,191,36,0.08)';
      X.fill();
      // Pip body
      X.beginPath();
      X.arc(x, y, isHover || isEditing ? selR : pipR, 0, PI2);
      X.fillStyle = isFiredToday ? 'rgba(167,139,250,0.85)' : 'rgba(251,191,36,0.95)';
      X.shadowColor = 'rgba(251,191,36,0.7)';
      X.shadowBlur = isHover ? 12 : 6;
      X.fill();
      X.shadowBlur = 0;
      X.shadowColor = 'transparent';
      // Inner dot (clock-icon-like)
      X.beginPath();
      X.arc(x, y, (isHover || isEditing ? 3 : 2), 0, PI2);
      X.fillStyle = 'rgba(0,0,0,0.6)';
      X.fill();
      // Time label (always visible) — small pill outside the pip
      const labelText = rem.time + (rem.label ? ' · ' + rem.label : '');
      X.font = '600 9px sans-serif';
      const tw = X.measureText(labelText).width;
      const lx = x + 10, ly = y - 6;
      X.beginPath();
      X.moveTo(lx + 4, ly - 6);
      X.lineTo(lx + tw + 8, ly - 6);
      X.arc(lx + tw + 8, ly, 6, -Math.PI/2, Math.PI/2);
      X.lineTo(lx + 4, ly + 6);
      X.arc(lx + 4, ly, 6, Math.PI/2, -Math.PI/2);
      X.closePath();
      X.fillStyle = isHover || isEditing ? 'rgba(251,191,36,0.92)' : 'rgba(20,20,30,0.85)';
      X.fill();
      X.fillStyle = isHover || isEditing ? '#000' : '#fde68a';
      X.textAlign = 'left'; X.textBaseline = 'middle';
      X.fillText(labelText, lx + 6, ly);
      // Delete × (only when hovered/selected)
      let delX = 0, delY = 0, delR = 0;
      if (isHover || isEditing) {
        delX = lx + tw + 8 + 10;
        delY = ly;
        delR = 8;
        X.beginPath();
        X.arc(delX, delY, delR, 0, PI2);
        X.fillStyle = 'rgba(239,68,68,0.18)';
        X.fill();
        X.font = '700 11px sans-serif';
        X.textAlign = 'center';
        X.fillStyle = 'rgba(239,68,68,0.9)';
        X.fillText('×', delX, delY + 1);
      }
      reminderHitBoxes.push({ x, y, r: selR, idx: i, delX, delY, delR });
    }
    X.restore();
  }

  /* ================================================================
   *  MODULAR HAND DRAWING SYSTEM — 10 Types
   * ================================================================ */

  function drawHandSet(cx, cy, r, hAngle, mAngle, sAngle, hCol, mCol, sCol, glowSec=false, opacityScale=1) {
    X.save();
    if (opacityScale < 1) X.globalAlpha *= opacityScale;

    const fn = HANDS[handType] || HANDS.tapered;
    fn.hour(cx, cy, hAngle, r*0.50, hCol);
    fn.minute(cx, cy, mAngle, r*0.74, mCol);

    if (sCol) {
      drawNeedle(cx, cy, sAngle, r*0.84, sCol, glowSec);
      X.beginPath(); X.arc(cx,cy,Math.max(3,r*0.032),0,PI2);
      X.fillStyle=sCol; X.fill();
    }
    X.restore();
  }

  function drawNeedle(cx,cy,a,len,col,glow) {
    X.save(); X.translate(cx,cy); X.rotate(a);
    if(glow){X.shadowColor=col;X.shadowBlur=10;} else {X.shadowColor='rgba(0,0,0,0.4)';X.shadowBlur=4;}
    X.beginPath(); X.moveTo(0,len*0.22); X.lineTo(0,-len);
    X.strokeStyle=col; X.lineWidth=Math.max(0.8,len*0.008); X.lineCap='round'; X.stroke();
    X.beginPath(); X.arc(0,len*0.15,Math.max(2.5,len*0.028),0,PI2); X.fillStyle=col; X.fill();
    X.restore();
  }

  function _tapered(cx,cy,a,len,bw,tw,col,hollow,glowCol) {
    X.save(); X.translate(cx,cy); X.rotate(a);
    if(glowCol){X.shadowColor=glowCol;X.shadowBlur=8;} else {X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;X.shadowOffsetY=2;}
    const tail=len*0.15;
    X.beginPath(); X.moveTo(0,tail); X.lineTo(-bw/2,0); X.lineTo(-tw/2,-len); X.lineTo(0,-len-tw); X.lineTo(tw/2,-len); X.lineTo(bw/2,0); X.closePath();
    if(hollow){X.strokeStyle=col;X.lineWidth=1.5;X.stroke();}else{X.fillStyle=col;X.fill();}
    X.restore();
  }

  const HANDS = {
    tapered: {
      hour:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.09,len*0.03,col),
      minute:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.065,len*0.02,col)
    },
    sword: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.04;
        X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w*0.7,-len*0.4);X.lineTo(0,-len);X.lineTo(w*0.7,-len*0.4);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.03;
        X.beginPath();X.moveTo(0,len*0.12);X.lineTo(-w,0);X.lineTo(-w*0.7,-len*0.45);X.lineTo(0,-len);X.lineTo(w*0.7,-len*0.45);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    dauphine: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.05;
        X.beginPath();X.moveTo(0,len*0.1);X.lineTo(-w,0);X.lineTo(-w*0.3,-len*0.5);X.lineTo(0,-len);X.lineTo(w*0.3,-len*0.5);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.04;
        X.beginPath();X.moveTo(0,len*0.1);X.lineTo(-w,0);X.lineTo(-w*0.3,-len*0.5);X.lineTo(0,-len);X.lineTo(w*0.3,-len*0.5);X.lineTo(w,0);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    leaf: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        X.beginPath();X.moveTo(0,len*0.12);
        X.quadraticCurveTo(-len*0.06,-len*0.3,0,-len);
        X.quadraticCurveTo(len*0.06,-len*0.3,0,len*0.12);
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        X.beginPath();X.moveTo(0,len*0.12);
        X.quadraticCurveTo(-len*0.045,-len*0.35,0,-len);
        X.quadraticCurveTo(len*0.045,-len*0.35,0,len*0.12);
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    baton: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        X.beginPath();X.roundRect(-len*0.025,len*0.1,len*0.05,-len-len*0.1,len*0.012);
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        X.beginPath();X.roundRect(-len*0.018,len*0.1,len*0.036,-len-len*0.1,len*0.009);
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    skeletonH: {
      hour:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.09,len*0.03,col,true),
      minute:(cx,cy,a,len,col)=>_tapered(cx,cy,a,len,len*0.065,len*0.02,col,true)
    },
    arrow: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.035;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.7);X.lineTo(-w*1.8,-len*0.7);X.lineTo(0,-len);X.lineTo(w*1.8,-len*0.7);X.lineTo(w,-len*0.7);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.025;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.72);X.lineTo(-w*1.8,-len*0.72);X.lineTo(0,-len);X.lineTo(w*1.8,-len*0.72);X.lineTo(w,-len*0.72);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    spade: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.025;
        X.beginPath();X.moveTo(-w,len*0.12);X.lineTo(-w,-len*0.65);
        X.quadraticCurveTo(-len*0.07,-len*0.85,0,-len);
        X.quadraticCurveTo(len*0.07,-len*0.85,w,-len*0.65);
        X.lineTo(w,len*0.12);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
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
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.35)';X.shadowBlur=6;
        const w=len*0.03;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.5);
        X.arc(0,-len*0.65,w*1.5,Math.PI*0.8,Math.PI*0.2,true);
        X.lineTo(w,-len*0.5);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=5;
        const w=len*0.02;
        X.beginPath();X.moveTo(-w,len*0.1);X.lineTo(-w,-len*0.55);
        X.arc(0,-len*0.7,w*1.5,Math.PI*0.8,Math.PI*0.2,true);
        X.lineTo(w,-len*0.55);X.lineTo(w,len*0.1);X.closePath();
        X.fillStyle=col;X.fill();X.restore();
      }
    },
    needle_minimal: {
      hour:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
        X.beginPath();X.moveTo(0,len*0.15);X.lineTo(0,-len);
        X.strokeStyle=col;X.lineWidth=Math.max(1.2,len*0.015);X.lineCap='round';X.stroke();X.restore();
      },
      minute:(cx,cy,a,len,col)=>{
        X.save();X.translate(cx,cy);X.rotate(a);X.shadowColor='rgba(0,0,0,0.3)';X.shadowBlur=4;
        X.beginPath();X.moveTo(0,len*0.15);X.lineTo(0,-len);
        X.strokeStyle=col;X.lineWidth=Math.max(0.8,len*0.009);X.lineCap='round';X.stroke();X.restore();
      }
    }
  };

  /* ================================================================
   *  DIAL HELPERS
   * ================================================================ */
  function bezel(cx,cy,r,colors) {
    X.save();X.shadowColor='rgba(0,0,0,0.6)';X.shadowBlur=r*0.12;X.shadowOffsetY=r*0.04;
    const g=X.createLinearGradient(cx-r,cy-r,cx+r,cy+r);
    g.addColorStop(0,colors[0]);g.addColorStop(0.5,colors[1]);g.addColorStop(1,colors[2]);
    X.beginPath();X.arc(cx,cy,r,0,PI2);X.fillStyle=g;X.fill();X.restore();
  }

  function ticks60(cx,cy,r,hCol,mCol,hW,mW) {
    for(let i=0;i<60;i++){
      const a=i*6*DEG2RAD,isH=i%5===0;
      const o=r*0.85,len=isH?r*0.09:r*0.035,inner=o-len;
      X.beginPath();X.moveTo(cx+Math.sin(a)*inner,cy-Math.cos(a)*inner);
      X.lineTo(cx+Math.sin(a)*o,cy-Math.cos(a)*o);
      X.strokeStyle=isH?hCol:mCol;X.lineWidth=isH?hW:mW;X.lineCap='round';X.stroke();
    }
  }

  function nums12(cx,cy,r,rFrac,font,col) {
    X.font=font;X.fillStyle=col;X.textAlign='center';X.textBaseline='middle';
    for(let n=1;n<=12;n++){const a=n*30*DEG2RAD;X.fillText(n.toString(),cx+Math.sin(a)*r*rFrac,cy-Math.cos(a)*r*rFrac);}
  }

  function angles(hrF,minF,secF) {
    return [hrF*30*DEG2RAD, minF*6*DEG2RAD, secF*6*DEG2RAD];
  }

  /* ================================================================
   *  52 CLOCK DESIGNS
   * ================================================================ */

  /* ── GHOST & FLOATING (13) ── */

  function drawGhostPure(cx,cy,r,hrF,minF,secF,t) {
    const [ha,ma,sa]=angles(hrF,minF,secF);
    for(let i=0;i<12;i++){const a=i*30*DEG2RAD;
      X.beginPath();X.arc(cx+Math.sin(a)*r*0.88,cy-Math.cos(a)*r*0.88,Math.max(1.5,r*0.012),0,PI2);
      X.fillStyle='rgba(255,255,255,0.18)';X.fill();}
    drawHandSet(cx,cy,r,ha,ma,sa,'rgba(255,255,255,0.65)','rgba(255,255,255,0.45)',t.sec,false,0.7);
  }

  function drawGhostMist(cx,cy,r,hrF,minF,secF,t) {
    X.save();X.shadowColor=t.accent;X.shadowBlur=25;
    const g=X.createRadialGradient(cx,cy,0,cx,cy,r*0.7);
    g.addColorStop(0,t.glow);g.addColorStop(1,'rgba(0,0,0,0)');
    X.beginPath();X.arc(cx,cy,r*0.7,0,PI2);X.fillStyle=g;X.fill();X.restore();
    const [ha,ma,sa]=angles(hrF,minF,secF);
    drawHandSet(cx,cy,r,ha,ma,sa,'#fff','rgba(255,255,255,0.85)',t.sec,true);
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
    drawReminderPips(cx, cy, r);
    drawReminderAlert(cx, cy, r);
    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
