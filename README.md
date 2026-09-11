<div align="center">

# ⏱ ChronoCore

**A borderless, canvas-rendered desktop clock widget — time blocks, Pomodoro & todo lists built in.**

52 dials · 22 hands · 10 themes · 26 label motions · 23 orbit rings · 25 block FX · 13 todo loops

![Electron](https://img.shields.io/badge/Electron-35-47848F?style=for-the-badge&logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-8b5cf6?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)

</div>

---

## ✨ Highlights

- **Circular task labels** — task text sits on the orbit ring itself, always upright, never clipped
- **Time blocks** — click to spawn, drag the handles to resize, dual-color elapsed/remaining wedges
- **Priority todos** — multi-list tabs (dots + `+`), priority dropdown + auto-sort, per-task colors
- **60 FPS Canvas 2D** — zero-DOM face, DPR-aware, borderless always-on-top, click-through on transparent pixels
- **Fully customizable** — 52 dials × 22 hands × 10 themes, every animation speed-controlled

## 🚀 Install

```bash
git clone https://github.com/c0pperfi3ld/Clock.git
cd Clock
npm install
npm start
```

> `npm run dev` opens DevTools.

## 🎨 Design & Motion

| | |
|---|---|
| **Dials** | 13 hand-only · 25 dialed · 14 unique-motion |
| **Hands** | taper · sword · dauphine · baton · skeleton · arrow · spade · cathedral · needle · spike · alpha · chronometer · luminous · dot · art-deco · scalpel · flame · crystal · ruler · halo · barley · leaf |
| **Themes** | midnight · obsidian · charcoal · slate · eclipse · void · graphite · onyx · shadow · abyss |
| **Label motion** | 26 ring-text effects (bounce · glide · orbit · heartbeat · glitch …) |
| **Orbit rings** | 23 styles (dotted · double · comet · rainbow · saturn · ferris …) |
| **Block FX** | 25 effects (pulse · laser · aurora · snow · orbit-rings · strobe …) |
| **Todo loops** | 13 continuous card animations |

## 🎮 Usage

| Action | How |
|---|---|
| Move | Drag the empty dial or the bottom grip |
| Resize | Bottom-right handle |
| Exit | Hover × (top-left of the dial) |
| Add block | Click the outer ring → pick colors in ⚙ |
| Edit block | Click a wedge → drag red/blue handles |
| Rename task | Click the label · × clears it |
| Todos | `+` or type + Enter · click flag → priority dropdown · click dot → color |
| Settings | ⚙ top-right · searchable, collapsible tabs |
| Text size | `Ctrl+scroll` / slider · Orbit speed: `Alt+scroll` |

## 🧠 How It Works

```
renderer.js  ← 60 FPS engine (dial, blocks, ring, labels, handles)
main.js      ← window + IPC bridge + JSON settings store
panel.html   ← ⚙ settings panel (Faces / Motion / Blocks / General)
index.html   ← clock window: canvas + todo panel
```

One dependency: **electron ^35**. Settings persist to `userData/clock-settings.json`.

## 📊 At a Glance

```
Dials 52 · Hands 22 · Themes 10 · Deps 1 · 60 FPS · cold start < 1.2s
```

---

<div align="center">

**[⭐ Star](https://github.com/c0pperfi3ld/Clock)** · **[🐛 Bug](https://github.com/c0pperfi3ld/Clock/issues)** · **[💡 Feature](https://github.com/c0pperfi3ld/Clock/issues/new)**

*MIT License · © 2026 c0pperfi3ld*

</div>