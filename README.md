<div align="center">
  <img src="https://raw.githubusercontent.com/miraj/clock/main/assets/icon.png" width="120" alt="Clock Icon" />
  <h1>ChronoCore</h1>
  <p><strong>A Next-Generation, Borderless, Highly-Customizable Desktop Clock & Time Management Tool</strong></p>
</div>

---

**ChronoCore** is a modern Electron-based desktop widget that reimagines time management. Far beyond a simple clock, it features an invisible borderless interface, 52 unique canvas-rendered dials, algorithmic dynamic colors, and a zero-friction canvas editor that lets you construct Pomodoro loops and custom schedules directly on the clock face.

## ✨ Features

- **52 Architectural Dial Designs**: From Classic Wall Clocks and Swiss Aviators to Cyberpunk Neon, Retro LCDs, Holographic Projections, and Matrix Rain.
- **10 Precision Hand Sets**: Customize your pointers (Tapered, Baton, Breguet, Skeleton, Sweeping, etc.).
- **Zero-Friction Canvas Interactions**: 
  - Click anywhere on the clock's dial to instantly spawn a new block of time.
  - Drag the fluid start/end handles to intuitively resize blocks visually.
  - Instantly delete blocks by clicking the inline floating trash icon.
- **Algorithmic Color Engine**: Spawning new tasks mathematically spaces out hues on the color wheel using the Golden Angle (137.5°), ensuring optimal contrast and beautiful complementary palettes for every block.
- **18 Continuous Task Animations**: Task labels float on the canvas with independent mathematical transforms ranging from elastic bounces and slow breathing, to rapid neon pulses and heartbeat scaling.
- **Pomodoro Engine**: Generate multiple work/break cycles instantly with dual-color visualization for elapsed vs. remaining time.
- **Transparent & Borderless UX**: A completely floating window utilizing a custom IPC drag handler that doesn't rely on restrictive CSS regions, allowing sub-pixel perfect interactions.

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)

### Installation
1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/chronocore.git
   cd chronocore
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Launch the application**
   ```bash
   npm start
   ```

## 🧠 Architecture

ChronoCore achieves extreme performance by sidestepping heavy DOM manipulation for rendering. 
- **`renderer.js`**: Drives a 60fps raw Canvas API engine handling all 52 designs, animated handles, glowing tooltips, and geometric wedge calculations.
- **`main.js`**: Orchestrates secure window configurations, dual-IPC bridges, and OS-level persistent bounds tracking.
- **Settings Panel**: An independent, transparent child window that syncs with the main thread, allowing real-time design switching and Pomodoro array building.

## 🛠️ Usage

- **Drag to Move**: Click anywhere on the clock face (where there are no handles) and drag to reposition the widget on your screen.
- **Settings Panel**: Hover over the clock to reveal the Gear Icon. Click it to open the configuration panel.
- **Add a Block**: Click on the empty space of the clock's outer ring.
- **Edit a Block**: Click an existing wedge to reveal the Red/Blue drag handles and floating color pickers.
- **Name a Task**: Click the translucent `+ Add Task` label floating outside the clock to spawn a native text input.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.
