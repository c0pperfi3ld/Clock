import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const page = await browser.newPage();
await page.setViewport({width:900,height:700});
const logs=[];
page.on('console',m=>logs.push('['+m.type()+'] '+m.text()));
page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.exposeFunction('__log',(s)=>logs.push('PAGE '+s));
await page.goto('file://'+process.cwd()+'/test-harness.html');
await new Promise(r=>setTimeout(r,800));
// Instrument: wrap interactiveMode by polling via a global hook
await page.evaluate(()=>{
  const c=document.getElementById('clock');
  c.addEventListener('mousedown',()=>{ window.__md=true; },true);
});
const info = await page.evaluate(()=>{
  const c=document.getElementById('clock');
  const r=c.getBoundingClientRect();
  return {rect:{x:r.x,y:r.y,w:r.width,h:r.height}};
});
const cx = info.rect.x + info.rect.w/2;
const cy = info.rect.y + info.rect.h/2;
// Click right on the ring (hour-hand region) near 3 o'clock at radius ~ r
// Approximate r: wrapper 640x700, margin 50, clockScale 1 => r = min(320,350)-50=270
const R=200;
await page.mouse.click(cx+R, cy);
await new Promise(r=>setTimeout(r,300));
// After click, check what's drawn / interactiveMode by reading link-toast text
const toast1 = await page.evaluate(()=>document.getElementById('link-toast').textContent);
logs.push('TOAST_AFTER_DIAL '+toast1);
await browser.close();
console.log(logs.join('\n'));
