const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700, deviceScaleFactor: 2 });
  const url = 'file://' + path.join(__dirname, 'test-harness.html');
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1200)); // let animations settle

  // Pull the clock canvas into an image and build a clean doc screenshot.
  const shotPath = path.join(__dirname, 'docs-assets', 'clock-preview.png');
  const fs = require('fs');
  fs.mkdirSync(path.dirname(shotPath), { recursive: true });

  await page.screenshot({ path: shotPath });
  console.log('saved', shotPath, fs.statSync(shotPath).size, 'bytes');
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
