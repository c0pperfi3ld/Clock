# ⏱ ChronoCore

A borderless, canvas-rendered desktop clock widget with time blocks, a Pomodoro-style todo board, and a daily timeline — built on Electron.

[![Electron](https://img.shields.io/badge/Electron-35-47848F?style=flat&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/License-MIT-10b981?style=flat)](LICENSE)
[![Platform](https://img.shields.io/badge/Windows%20%7C%20macOS%20%7C%20Linux-8b5cf6?style=flat)](#)

---

## ✨ Features

- **Floating analog clock** — borderless, always-on-top, DPR-aware Canvas 2D face rendered at 60 FPS with no DOM overhead.
- **Time blocks** — click to create, drag handles to resize, dual-color elapsed/remaining wedges.
- **Priority todos** — multi-list tabs, weight arrows for top-down sorting, per-task colors, and a calendar view.
- **Board view** — a vertical day timeline from 8 AM; click an hour to create, drag edges to resize, link blocks to todos.
- **Deeply themable** — dozens of dials, hands, themes, orbit rings, and motion effects.
- **Lightweight** — a single runtime dependency (`electron`).

## 🚀 Getting started

```bash
git clone https://github.com/c0pperfi3ld/Clock.git
cd Clock
npm install
npm start
```

Open DevTools with `npm run dev`.

## 🎮 Usage

| Action | How |
| --- | --- |
| Move window | Drag the empty dial or the bottom grip |
| Resize window | Bottom-right handle (or any edge) |
| Exit | Hover the `×` (top-left of the dial) |
| Add a block | Click the outer ring, then pick colors in ⚙ |
| Edit a block | Click a wedge, drag the red/blue handles |
| Todos | `+` or type + Enter · ▲▼ weight arrows sort · click a dot to color |
| Settings | ⚙ top-right — searchable, collapsible tabs |
| Board view | Rectangle icon in the tab bar → day timeline |
| Text size | `Ctrl` + scroll · Orbit speed: `Alt` + scroll |

## 🧩 How it works

```
renderer.js   ← 60 FPS engine (dial, blocks, ring, labels, handles)
main.js       ← window + IPC bridge + JSON settings store
panel.html    ← ⚙ settings panel (Faces / Motion / Blocks / General)
index.html    ← clock window: canvas + todo panel
```

Settings persist to `userData/clock-settings.json`. The `test-harness.html` + `measure.js` files are a headless Puppeteer harness for verifying layout — not needed to run the app.

## 📄 License

MIT © 2026 c0pperfi3ld
