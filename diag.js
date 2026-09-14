const puppeteer = require('puppeteer');
const path = require('path');
const DST = process.env.ClockDoc;
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('CON: ' + m.text()); });
  await p.goto('file://' + path.join(DST, 'test-harness.html').replace(/\\/g,'/'), { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));
  const d = await p.evaluate(() => {
    const c = document.getElementById('clock');
    const ctx = c.getContext('2d');
    let nt = 0;
    try { const img = ctx.getImageData(0,0,c.width,c.height).data; for (let i=3;i<img.length;i+=4){ if(img[i]>0) nt++; } }
    catch(e){ return { err: e.message }; }
    return { hasAPI: typeof window.clockAPI, w:c.width, h:c.height, nonTransparent:nt, todoItems: document.querySelectorAll('.todo-item').length };
  });
  console.log(JSON.stringify(d));
  console.log('ERRORS:\n' + (errs.join('\n') || 'none'));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
