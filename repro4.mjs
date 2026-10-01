import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const page = await browser.newPage();
await page.setViewport({width:900,height:700});
const logs=[];
page.on('console',m=>logs.push('['+m.type()+'] '+m.text()));
page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
// Seed a session BEFORE loading renderer by patching harness-stub loadSettings
await page.evaluateOnNewDocument(()=>{
  const orig = window.clockAPI;
  window.__seed.sessionsByDate = { [Object.keys(window.__seed.todosByDate)[0]]: [
    { id:'s1', start: (()=>{const d=new Date(); d.setHours(15,0,0,0); return d.getTime();})(),
      end: (()=>{const d=new Date(); d.setHours(16,0,0,0); return d.getTime();})(),
      color:'#3b82f6', elapsedColor:'#172554', type:'custom', tasks:[] }
  ]};
});
await page.goto('file://'+process.cwd()+'/test-harness.html');
await new Promise(r=>setTimeout(r,800));
const info = await page.evaluate(()=>{
  const c=document.getElementById('clock'); const r=c.getBoundingClientRect();
  return {rect:{x:r.x,y:r.y,w:r.width,h:r.height}};
});
const cx = info.rect.x + info.rect.w/2, cy = info.rect.y + info.rect.h/2;
// Block is at 15:00->16:00 => 3 o'clock direction, radius mid. Click on it at angle 0, radius 220
await page.mouse.click(cx+220, cy);
await new Promise(r=>setTimeout(r,300));
const t1 = await page.evaluate(()=>document.getElementById('link-toast').textContent);
const im1 = await page.evaluate(()=>{ /* read interactiveMode via a global if exposed */ return (window.__im!==undefined)?window.__im:'NA'; });
logs.push('AFTER_BLOCK_CLICK toast='+JSON.stringify(t1));
await browser.close();
console.log(logs.join('\n'));
