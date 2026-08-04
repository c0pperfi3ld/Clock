# Floating Desktop Clock Widget 🕰️

A pure, floating, and fully customizable desktop clock widget built with Electron. Designed with a focus on modern aesthetics, performance, and flexibility. 

This widget features a transparent, frameless design that floats seamlessly on your desktop, accompanied by a dedicated persistent settings panel for real-time customization.

## Features ✨

*   **Massive Customization:**
    *   **52 Clock Designs:** Ranging from Ghost & Floating designs (Ghost Prism, Cyberpunk, Starlight), Classic Dials (Roman Luxury, Bauhaus Minimal), to Unique Motion designs (Radar Sweep, Quantum Hologram).
    *   **10 Interchangeable Hand Styles:** Including Tapered Lancet, Sword, Skeleton Hollow, and Ultra Needle.
    *   **10 Color Themes:** Carefully curated dark themes including Obsidian, Void, Abyss, and Midnight.
*   **Floating & Frameless:** Pure transparent background that blends perfectly with your desktop environment.
*   **Real-time Settings Panel:** A dedicated control panel allowing you to mix and match designs, hands, and themes with zero lag.
*   **Performance Optimized:**
    *   Precomputed trigonometric & degree-to-radian constants.
    *   Subpixel precision rendering & HiDPI scaling for crisp visuals.
    *   Single-pass canvas transformations to minimize system resource usage.

## Installation & Setup 🚀

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and npm installed on your system.

### Running Locally

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/c0pperfi3ld/Clock.git
    cd Clock
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start the application:**
    ```bash
    npm start
    ```

### Building for Production
To package the app into a standalone executable (if you have electron-builder or electron-packager configured):
```bash
npm run build
```
*(Note: Ensure your `package.json` has the appropriate build scripts configured)*

## Architecture 🏗️

The application uses a dual-window architecture:
1.  **Main Widget Window:** A transparent, click-through (optional), and frameless window rendering the clock via HTML5 Canvas (`main.js`, `index.html`, `renderer.js`).
2.  **Settings Panel:** A standard floating window for customizing the widget's appearance in real-time (`panel.html`, `preload_panel.js`).

Inter-Process Communication (IPC) is handled securely via `preload.js` scripts, ensuring safe communication between the renderer processes and the main Node.js process.

## Customization

The clock's rendering engine is highly modular. You can easily add new themes or hand styles by extending the definitions within the renderer scripts. The current state (v6) supports 5200 unique combinations!

## License
MIT License
