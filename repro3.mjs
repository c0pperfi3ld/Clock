import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const page = await browser.newPage();
await page.setViewport({width:900,height:700});
const logs=[];
page.on('console',m=>logs.push('['+m.type()+'] '+m.text()));
page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
await page.goto('file://'+process.cwd()+'/test-harness.html');
await new Promise(r=>setTimeout(r,800));
const info = await page.evaluate(()=>{
  const c=document.getElementById('clock');
  const r=c.getBoundingClientRect();
  // compute r from clockBounds via a test: just return rect; r ~ min(w,h)/2 - 50
  return {rect:{x:r.x,y:r.y,w:r.width,h:r.height}};
});
const cx = info.rect.x + info.rect.w/2, cy = info.rect.y + info.rect.h/2;
// r ~ min(640,700)/2 - 50 = 320-50=270. Spawn ring band: radius 240.
// angle ~ straight right (3 o'clock) but offset a bit so it's an outer-ring click
await page.mouse.click(cx+240, cy);
await new Promise(r=>setTimeout(r,300));
const t1 = await page.evaluate(()=>document.getElementById('link-toast').textContent);
const s1 = await page.evaluate(()=>{ try { return (JSON.parse(localStorage.getItem('clockSettings')||'{}').sessions||[]).length; } catch(e){ return 'err:'+e.message; } });
logs.push('AFTER_SPAWN toast='+JSON.stringify(t1)+' sessions='+s1);
// Now click on the spawned block (it's at the clicked angle, ~3oclock). Click near its center wedge.
await new Promise(r=>setTimeout(r,200));
const t2 = await page.evaluate(()=>document.getElementById('link-toast').textContent);
logs.push('TOAST_NOW '+JSON.stringify(t2));
await browser.close();
console.log(logs.join('\n'));
