<div align="center">

# ⏱ ChronoCore

**A borderless, canvas-rendered desktop clock widget.**
52 dials · 9 hands · 10 themes · 25 animations · infinite combinations.

![Electron](https://img.shields.io/badge/Electron-35-47848F?style=flat-square&logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-8b5cf6?style=flat-square)
![License](https://img.shields.io/badge/MIT-10b981?style=flat-square)
![Node](https://img.shields.io/badge/Node-16%2B-339933?style=flat-square&logo=nodedotjs&logoColor=white)

</div>

---

## ✨ Why ChronoCore

| | |
|---|---|
| 🔴 **Zero DOM for the clock face** | 60 FPS raw Canvas 2D · DPR-aware · sub-pixel precision |
| 🟡 **52 × 9 × 10 × 25 design genome** | ~5.8M unique combinations from pure data |
| 🟢 **Invisible borderless window** | Custom IPC drag · 1:1 aspect · always-on-top |
| 🟢 **Zero-friction canvas UX** | Click-to-spawn · drag-to-resize · click-×-to-delete |
| 🟡 **Golden Angle color engine** | 137.5° hue spacing = perfect complementary palettes |
| 🟢 **Pomodoro + time blocks** | Elapsed/remaining dual-color wedges · auto-cleanup |

---

## 🚀 Install

```powershell
git clone https://github.com/c0pperfi3ld/Clock.git
cd Clock
npm install
npm start
```

> DevTools auto-opens with `npm run dev`

---

## 🎨 Design Catalog

### 52 Dial Styles
| Group | Count | Examples |
|---|---|---|
| **Hands-only (13)** | minimal, ghost, mist, prism, wireframe, shadow, ember, glass, starlight, pulsar, cyberpunk, zenith, glow |
| **With dial (25)** | classic, minimal, roman, neon, skeleton, chrono, bauhaus, swiss, pilot, diver, artdeco, sundial, dashboard, dotmatrix, floatingnum, astronomy, submariner, industrial, papercraft, retrodigital, zen, hologram, copper, monochrome, regatta |
| **Unique motion (14)** | orbit, concentric, radar, gradientarc, hourglass, sonar, sine, dna, pendulum, compass, eclipse_motion, matrix_rain, equalizer, vortex |

### 9 Hand Types — *tapered · sword · dauphine · leaf · baton · skeletonH · arrow · spade · cathedral*

### 10 Themes — *midnight · obsidian · charcoal · slate · eclipse · void · graphite · onyx · shadow · abyss*

### 18 Tooltip Animations — *fade · bounce · slide · flip · typewriter · glow-in · scale-pop · swing · wave · jitter · orbit · breathing · elastic · wobble · neon-pulse · shiver · heartbeat · float-tilt*

### 7 Block Animations — *pulse · glow · breathe · shimmer · rainbow-glow · rainbow-pulse · disco*

---

## 🖼 Visual System

### Golden Angle Color Generation
```
h_n = (n × 137.508°) mod 360°

   h₀ =    0°  ●
   h₁ =  137°  ●
   h₂ =  275°  ●
   h₃ =   52°  ●     ← wraps to most-distant slot
   h₄ =  190°  ●
   ...
```
Every new block lands on the **most perceptually distinct** hue available.

### IPC Pipeline
```
panel.html ──ipc──► main.js ──ipc──► renderer.js (60 FPS Canvas)
                     │
                     └──► userData/clock-settings.json
```

### Per-Frame Render
```
clear → dial → blocks → handles → hands → labels → tooltips → rAF
```

---

## 🎮 Usage

| Action | How |
|---|---|
| Move clock | Click empty dial · drag |
| Add block | Click outer ring |
| Edit block | Click wedge · drag red/blue handles |
| Delete block | Click × on label |
| Open settings | Click ⚙ (top-right) |
| Generate Pomodoro | Blocks tab → set work/break/cycles → Generate |

---

## 🧠 Architecture

```
Clock/
├── main.js              ← window mgmt + IPC bridge
├── preload.js           ← clock window IPC surface
├── preload_panel.js     ← panel IPC surface
├── index.html           ← clock window (canvas only)
├── panel.html           ← settings panel (3 tabs)
├── index.css            ← minimal CSS
├── renderer.js          ← 1600+ line Canvas engine
├── error-logger.js      ← frontend error capture
└── package.json         ← 1 dependency: electron@^35
```

**IPC channels** — `drag-start` · `drag-move` · `drag-end` · `show-panel` · `panel-set-{style,theme,hands,opacity,sessions,block-opacity,block-anim,tooltip-anim,tooltip-size}` · `focus-time` · `blur-time` · `clock-update-time` · `panel-set-ontop` · `panel-close` · `close-app` · `save-settings` · `load-settings`

---

## 🔧 Customization

```js
// Add a new dial
STYLES.myCustom = (ctx, cx, cy, r) => {
  ctx.strokeStyle = '#ff00ff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
};

// Add a theme
THEMES.sunset = { accent:'#ff6b6b', sec:'#ffd93d', glow:'rgba(255,107,107,0.5)' };

// Add a block animation
case 'my-effect': return { opMul: ..., rOff: ..., blur: ..., colorOverride: '...' };
```

---

## 🗺 Roadmap

- 🔴 System tray + global hotkey
- 🟡 Multi-monitor per-display settings
- 🟡 Alarm sounds
- 🟢 Theme marketplace (JSON palette packs)
- 🟢 Plugin API for third-party dials

---

## 📊 Stats

```
Lines:       ~1700    Bundle:     ~50 MB
Deps:        1        Memory:     ~80 MB runtime
Cold start:  <1.2s    Frame rate: 60 FPS
```

---

<div align="center">

**[⭐ Star](https://github.com/c0pperfi3ld/Clock)** · **[🐛 Bug](https://github.com/c0pperfi3ld/Clock/issues)** · **[💡 Feature](https://github.com/c0pperfi3ld/Clock/issues/new)**

*MIT License · © 2026 c0pperfi3ld*

</div>
