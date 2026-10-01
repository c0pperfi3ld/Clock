import puppeteer from 'puppeteer';
const electron = require('child_process').spawn('node', ['node_modules/electron/dist/electron/cli.js','.'], {stdio:['ignore','ignore','ignore']});
const logs=[];
await new Promise(r=>setTimeout(r,3500));
const conn = await puppeteer.connect({transport:'cdp', endpoint:'http://127.0.0.1:9222'});
const targets = await conn.targets();
const clockTarget = targets.find(t=>t.url().includes('index.html'));
const logs2=[];
if(!clockTarget){ logs2.push('NO_TARGET '+targets.map(t=>t.url())); }
else {
  const p = await clockTarget.page();
  await p.setViewport({width:900,height:700});
  const b0 = await p.evaluate(()=>({x:window.screenX||0,y:window.screenY||0,w:window.innerWidth,h:window.innerHeight}));
  logs2.push('WIN0 '+JSON.stringify(b0));
  const cx=b0.x+b0.w/2, cy=b0.y+b0.h/2;
  await p.mouse.click(cx, cy);
  await new Promise(r=>setTimeout(r,200));
  const b1 = await p.evaluate(()=>({x:window.screenX||0,y:window.screenY||0,w:window.innerWidth,h:window.innerHeight}));
  logs2.push('AFTER_CENTER_CLICK '+JSON.stringify(b1));
}
await conn.disconnect();
electron.kill();
console.log(logs2.join('\n'));
