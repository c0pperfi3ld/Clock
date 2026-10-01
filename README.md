<div align="center">

<br>

<img src="assets/icon.png" alt="ChronoCore" width="140">

<br><br>

# ChronoCore

### The Desktop Clock That Does Everything

A borderless, GPU-free analog clock widget with time tracking, task management,<br>and an absurd amount of customization — all in a single Electron window.

<br>

[![Electron](https://img.shields.io/badge/Electron_35-191919?style=flat-square&logo=electron&logoColor=9feaf9)](https://www.electronjs.org/)
[![MIT](https://img.shields.io/badge/MIT-191919?style=flat-square)](LICENSE)
[![Win/Mac/Linux](https://img.shields.io/badge/Win_·_Mac_·_Linux-191919?style=flat-square)](#)
[![v2](https://img.shields.io/badge/v2.0-191919?style=flat-square)](#-v2-changelog)

</div>

<br>

---

<br>

> **56** faces × **25** hands × **16** themes × **58** orbits × **45** tooltip FX × **44** block FX × **20** border FX

<br>

## At a Glance

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   🕐  60 FPS canvas clock — no DOM, pure math           │
│   📌  Priority todos with drag & drop nesting           │
│   📋  Day timeline board (8 AM → 7 PM)                  │
│   📅  Per-date task lists with calendar nav              │
│   🎨  Settings panel with 200+ visual combos            │
│   ⚡  One dependency. No build step. npm start.          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

<br>

## Quick Start

```bash
git clone https://github.com/c0pperfi3ld/Clock.git && cd Clock
npm install
npm start          # launch the clock
npm run dev        # launch with DevTools open
```

<br>

## How It Works

**The Clock** — A borderless, always-on-top, DPR-aware Canvas 2D face. Pick from 56 designs: ghost (transparent hands only), classic dial faces, or animated motion styles like radar sweeps, DNA helices, and matrix rain. Every face pairs with 25 hand styles (sword, dauphine, cathedral, flame…) and 16 dark color themes.

**Time Blocks** — Click the outer ring to create a time allocation. Dual-color wedges show elapsed vs. remaining. Drag the handles to resize. 44 animation effects (pulse, aurora, glitch, meteor…) make them pop.

**Todos** — A built-in task manager sits beside the clock. Multiple list tabs, weight-arrow priority sorting, per-task colors, subtask nesting via drag & drop. Paste a URL and it auto-shortens (YouTube links get a ▶ icon). Everything persists.

**Board View** — Flip to a vertical day timeline. Click an hour slot to create a block, drag edges to resize, link blocks to todos.

**Calendar** — Navigate dates with a mini calendar. Each day has its own task list. State restores on restart — same date, same tab, same scroll position.

**The Orbit Ring** — A decorative ring around the dial with 58 animated styles: `celtic-knot`, `particle-collider`, `aurora-band`, `quantum-tunnel`, `runic-circle`…

**Borders & Shine** — 20 border animations (pulse, plasma, morse, heartbeat…) plus a configurable shine sweep with angle, width, color, easing, and direction controls.

<br>

## Controls

| | |
|:---|:---|
| **Move** | Drag empty dial / bottom grip |
| **Resize** | Any edge or corner |
| **Close** | `×` on hover (top-left) |
| **Time block** | Click outer ring → pick colors |
| **Edit block** | Click wedge → drag handles |
| **New todo** | `+` or type + `Enter` |
| **Reorder** | ▲▼ arrows or drag & drop |
| **Subtask** | Drag onto middle of another task |
| **Settings** | ⚙ top-right |
| **Board** | Rectangle icon in tab bar |
| **Calendar** | 📅 button |
| **Text size** | `Ctrl` + scroll |
| **Orbit speed** | `Alt` + scroll |
| **Collapse todos** | Toggle button beside panel |

<br>

## Files

```
renderer.js ···· Canvas engine: 56 faces, blocks, orbit, todos, drag, links, anims
main.js ········ Electron main: windows, IPC, settings store, screen bounds
panel.html ····· Settings panel: faces / hands / themes / motion / blocks / general
index.html ····· Clock window: canvas + todo panel + resize handles
preload.js ····· contextBridge: renderer ↔ main
preload_panel.js contextBridge: settings ↔ main
index.css ······ Styles: clock, todos, drag indicators, border anims, shine
```

All settings save to `userData/clock-settings.json`. v2 is backward-compatible with v1 data.

<br>

---

<br>

## 🆕 v2 Changelog

<br>

### New Capabilities

| | |
|:---|:---|
| **Drag & Drop** | Grab tasks to reorder or nest. Drop in middle = subtask, top/bottom = reorder. Subtrees move as a unit. |
| **URL Links** | Pasted URLs auto-detect and shorten to ~35 chars. YouTube → ▶ icon. Click opens default browser. |
| **Panel Collapse** | One-click collapse/expand for the todo panel. Persists across sessions. |
| **Background Opacity** | 0–100% app transparency via `--bgA` CSS variable. |
| **Fade Mask** | Gradient fade (0–120px) at the bottom of the todo scroll. |
| **Shine Effect** | Border shine sweep — 10 parameters: angle, width, opacity, color, easing, delay, direction, fade, repeat. |
| **Clock Scale** | Independent dial size multiplier, decoupled from window size. |
| **Padding Control** | Adjustable inset between border and content. |
| **% Label** | Remaining-time readout: toggle visibility, font size, color, position (below/right/inline). |
| **Calendar Anim** | Entrance animation for the mini calendar. |

<br>

### Numbers

```
                        v1          v2
                     ─────────   ─────────
  Orbit rings           38    →     58      (+20)
  Tooltip anims         25    →     45      (+20)
  Block effects         24    →     44      (+20)
  Border anims           0    →     20      (new)
                     ─────────   ─────────
  Lines changed      ——————     +3,302 / -384 across 20 files
```

<br>

### New Orbit Rings

> `aurora-band` · `beacon` · `binary-orbit` · `celtic-knot` · `chrono-compass` · `cosmic-web` · `crystal-lattice` · `cyber-scan` · `eclipse-corona` · `hex-shield` · `hyper-warp` · `laser-sweep` · `magnetic-field` · `molecular-bond` · `neutron-star` · `particle-collider` · `photon-torpedo` · `quantum-tunnel` · `runic-circle` · `solar-prominence`

<br>

### Tests Added

| File | What |
|:---|:---|
| `e2e-todo.cjs` | 19-assertion E2E test against a real Electron instance (isolated profile) |
| `test-move-engine.cjs` | 11-case unit test for drag & drop move logic |
| `test-harness.html` | Headless Puppeteer layout verification |

<br>

---

<br>

## Full Catalog

<details>
<summary><b>56 Clock Faces</b></summary>
<br>

**Ghost (13)** — `ghost` `mist` `prism` `wireframe` `shadow` `ember` `glass` `starlight` `pulsar` `cyberpunk` `zenith` `dark` `glow`

**Dial (29)** — `classic` `minimal` `roman` `neon` `skeleton` `chrono` `bauhaus` `swiss` `pilot` `diver` `artdeco` `sundial` `dashboard` `dotmatrix` `floatingnum` `astronomy` `submariner` `industrial` `papercraft` `retrodigital` `zen` `hologram` `copper` `monochrome` `regatta` `aurora` `noir` `lumen` `gridline`

**Motion (14)** — `orbit` `concentric` `radar` `gradientarc` `hourglass` `sonar` `sine` `dna` `pendulum` `compass` `eclipse` `matrix_rain` `equalizer` `vortex`
</details>

<details>
<summary><b>25 Hand Styles</b></summary>
<br>

`tapered` `sword` `dauphine` `leaf` `baton` `skeleton` `arrow` `spade` `cathedral` `needle` `spike` `alpha` `chronometer` `luminous` `minimalist_dot` `art_deco` `scalpel` `flame` `crystal` `ruler` `halo` `meridian` `ribbon` `bracket` `barley`
</details>

<details>
<summary><b>16 Color Themes</b></summary>
<br>

`midnight` `obsidian` `charcoal` `slate` `eclipse` `void` `graphite` `onyx` `shadow` `abyss` `glacier` `orchid` `ember` `forest` `solar` `ocean`
</details>

<details>
<summary><b>58 Orbit Ring Styles</b></summary>
<br>

`astrolabe` `aurora-band` `aurora-ring` `beacon` `binary-orbit` `bounce-dots` `celtic-knot` `chains` `chrono-compass` `comet` `constellation` `cosmic-web` `crystal-lattice` `cyber-scan` `dna-helix` `double` `double-helix` `eclipse-corona` `ferris` `fireflies` `gear-teeth` `glow` `hex-shield` `hyperspace` `hyper-warp` `laser-sweep` `lightning` `magnetic-field` `matrix-rain` `molecular-bond` `neon-chase` `neon-pulse` `neutron-star` `number` `ouroboros` `particle-collider` `particles` `photon-torpedo` `plasma-ring` `prism-spectrum` `pulse-ring` `pulse-wave` `quantum` `quantum-tunnel` `rainbow` `rainbow-flow` `runic-circle` `saturn` `shockwave` `solar-prominence` `sound-frequency` `sparkle` `stargate` `star-trail` `super-nova` `tide` `vortex` `wave-ring`
</details>

<details>
<summary><b>20 Border Animations</b></summary>
<br>

`pulse` `glow` `breathe` `shimmer` `rainbow` `scan` `dash-flow` `corner-pulse` `neon-flicker` `elastic` `gradient-shift` `ghost` `trace` `plasma` `morse` `wave` `electric` `aurora` `geiger` `dna` `meteor` `heartbeat`
</details>

<br>

---

<br>

## Testing

```bash
node e2e-todo.cjs          # E2E — real Electron, isolated profile
node test-move-engine.cjs   # unit — drag logic, 11 cases
```

<br>

---

<div align="center">

MIT © 2026 Miraj Khan

</div>
