import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({headless:'new',args:['--no-sandbox']});
const page = await browser.newPage();
await page.setViewport({width:900,height:700});
const logs=[];
page.on('console',m=>logs.push('['+m.type()+'] '+m.text()));
page.on('pageerror',e=>logs.push('[pageerror] '+e.message));
// Seed a session directly into localStorage so renderer loads it
const seed = { sessionsByDate: { [new Date().toISOString().slice(0,10)]: [
  { id:'s1', start: (()=>{const d=new Date();d.setHours(15,0,0,0);return d.getTime();})(),
    end:(()=>{const d=new Date();d.setHours(16,0,0,0);return d.getTime();})(),
    color:'#3b82f6', elapsedColor:'#172554', type:'custom', tasks:[] }
]}};
await page.evaluateOnNewDocument((s)=>{ window.__seed = s; }, seed);
await page.goto('file://'+process.cwd()+'/test-harness.html');
await new Promise(r=>setTimeout(r,800));
const info = await page.evaluate(()=>{const c=document.getElementById('clock');const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
const cx=info.x+info.w/2, cy=info.y+info.h/2;
// 1) Click ON the block (3 o'clock, radius 220)
await page.mouse.click(cx+220, cy);
await new Promise(r=>setTimeout(r,250));
logs.push('TOAST1='+JSON.stringify(await page.evaluate(()=>document.getElementById('link-toast').textContent)));
// 2) Now mousedown on start knob (~3 o'clock, r-12 ~ 258) and drag it
const kx=cx+258, ky=cy;
await page.mouse.move(kx,ky);
await page.mouse.down();
await page.mouse.move(kx+60,ky+60,{steps:8});
await page.mouse.up();
await new Promise(r=>setTimeout(r,250));
logs.push('TOAST2='+JSON.stringify(await page.evaluate(()=>document.getElementById('link-toast').textContent)));
const sess = await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('clockSettings')||'{}').sessionsByDate;}catch(e){return 'err:'+e.message;}});
logs.push('SESS='+JSON.stringify(sess).slice(0,300));
await browser.close();
console.log(logs.join('\n'));
