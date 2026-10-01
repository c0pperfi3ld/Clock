const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const userData = path.join(process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'), 'Clock');
  const settingsPath = path.join(userData, 'clock-settings.json');
  const seed = {
    sessions: [
      { id:'s1', start: (()=>{const d=new Date();d.setHours(15,0,0,0);return d.getTime();})(),
        end:(()=>{const d=new Date();d.setHours(16,0,0,0);return d.getTime();})(),
        color:'#3b82f6', elapsedColor:'#172554', type:'custom', tasks:[] }
    ]
  };
  try { fs.writeFileSync(settingsPath, JSON.stringify(seed, null, 2)); } catch(e) {}

  const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
  const child = spawn(electronExe, ['--remote-debugging-port=9222', '.'], { stdio: ['ignore','ignore','inherit'] });
  const logs = [];
  try {
    await new Promise(r => setTimeout(r, 4000));
    const http = require('http');
    const getJson = (url) => new Promise((res, rej) => {
      http.get(url, (r) => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error', rej);
    });
    const ver = await getJson('http://127.0.0.1:9222/json/version');
    const browser = await puppeteer.connect({ browserWSEndpoint: ver.webSocketDebuggerUrl });
    const targets = await browser.targets();
    const t = targets.find(t => t.url().includes('index.html'));
    if (!t) { console.log('NO_TARGET', targets.map(x=>x.url())); child.kill(); return; }
    const page = await t.page();
    if (!page) { console.log('NO_PAGE'); child.kill(); return; }
    page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
    page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
    await page.bringToFront();
    await new Promise(r => setTimeout(r, 1000));

    // Expose a snapshot of the renderer's interactive state
    await page.exposeFunction('__snap', () => 'no-doc');

    const box = await page.evaluate(() => ({ x: window.screenX, y: window.screenY, w: window.innerWidth, h: window.innerHeight }));
    const info = await page.evaluate(() => {
      const c = document.getElementById('clock');
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    const cx = box.x + info.x + info.w / 2, cy = box.y + info.y + info.h / 2;
    const snap = () => page.evaluate(() => {
      try {
        const t = document.getElementById('link-toast');
        return { toast: t.textContent, show: t.classList.contains('show') };
      } catch(e) { return 'err:' + e.message; }
    });
    logs.push('WIN ' + JSON.stringify(box) + ' CANVAS ' + JSON.stringify(info));
    logs.push('CENTER ' + JSON.stringify({ x: cx, y: cy }));

    // Click INSIDE the ring (radius 150) -> should spawn a block (empty ring)
    const R = 150;
    logs.push('CLICK1 spawn at ' + JSON.stringify({ x: cx + R, y: cy }));
    await page.mouse.click(cx + R, cy);
    await new Promise(r => setTimeout(r, 500));
    logs.push('SNAP1 ' + JSON.stringify(await snap()));
    // Click the same spot again -> should enter edit mode on the block
    logs.push('CLICK2 edit at ' + JSON.stringify({ x: cx + R, y: cy }));
    await page.mouse.click(cx + R, cy);
    await new Promise(r => setTimeout(r, 500));
    logs.push('SNAP2 ' + JSON.stringify(await snap()));
    // Click on the start knob (r-12 = 208)
    await page.mouse.click(cx + 208, cy);
    await new Promise(r => setTimeout(r, 500));
    logs.push('SNAP3 ' + JSON.stringify(await snap()));
    await browser.disconnect();
  } catch (e) {
    logs.push('REPRO_ERR ' + e.message);
  }
  child.kill();
  console.log(logs.join('\n'));
})();