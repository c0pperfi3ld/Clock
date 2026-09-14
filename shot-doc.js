const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const DST = process.env.ClockDoc;
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox','--force-color-profile=srgb'] });
  const p = await b.newPage();
  // Big viewport so the widget sits naturally; deviceScaleFactor 2 for crisp docs.
  await p.setViewport({ width: 1000, height: 760, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(DST, 'test-harness.html').replace(/\\/g,'/'), { waitUntil: 'networkidle0' });
  // Give the transparent widget a visible stage (the real app is borderless/transparent).
  await p.addStyleTag({ content: `html,body{background:radial-gradient(120% 120% at 50% 0%,#1e1b2e 0%,#0f0f17 60%,#08080d 100%)!important;margin:0;} #app{filter:drop-shadow(0 30px 60px rgba(0,0,0,0.55));}` });
  await new Promise(r => setTimeout(r, 1400)); // let animations settle on a frame
  const out = path.join(DST, 'clock-preview.png');
  await p.screenshot({ path: out });
  console.log('saved', out, fs.statSync(out).size, 'bytes');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
