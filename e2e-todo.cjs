// E2E: todo links, drag reparenting, date+category restore.
// Real Electron app, isolated profile, real DOM DragEvents. Run: node e2e-todo.cjs
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');

const APP_DIR = __dirname;
const PORT = 9223;
const PROFILE = path.join(process.env.LOCALAPPDATA || process.env.TEMP, 'clock-e2e-profile');
const results = [];
const ok = (label, cond) => { results.push([cond ? 'PASS' : 'FAIL', label]); console.log((cond ? 'PASS' : 'FAIL') + ' | ' + label); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function launch() {
  const child = require('child_process').spawn(
    require('electron'),
    [APP_DIR, '--no-sandbox', '--user-data-dir=' + PROFILE, '--remote-debugging-port=' + PORT],
    { stdio: 'ignore' }
  );
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      await new Promise((res, rej) => http.get('http://127.0.0.1:' + PORT + '/json/version', r => { r.resume(); res(); }).on('error', rej));
      return child;
    } catch (_) {}
  }
  throw new Error('devtools endpoint never came up');
}
async function attach() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null });
  let page = null;
  for (let i = 0; i < 20 && !page; i++) {
    const pages = await browser.pages();
    page = pages.find(p => p.url().includes('index.html')) || null;
    if (!page) await sleep(400);
  }
  if (!page) throw new Error('clock window page not found');
  // Wait until renderer.js has finished booting (tab bar is populated at the
  // end of the script) — avoids racing the contenteditable add-box handlers.
  for (let i = 0; i < 40; i++) {
    try {
      const ready = await page.evaluate(() => document.querySelectorAll('#todo-tabs .todo-tab').length >= 1);
      if (ready) break;
    } catch (_) {}
    await sleep(300);
  }
  await sleep(300);
  return { browser, page };
}
async function addTask(page, text) {
  await page.evaluate(t => {
    const box = document.getElementById('todo-add-box');
    box.focus();
    box.innerHTML = '';
    document.execCommand('insertText', false, t);
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  }, text);
  await sleep(180);
}
async function drag(page, srcPath, dstPath, zone) {
  await page.evaluate(async (src, dst, zone) => {
    const s = document.querySelector(`.todo-item[data-path="${src}"]`);
    const d = document.querySelector(`.todo-item[data-path="${dst}"]`);
    if (!s || !d) throw new Error('drag nodes missing: ' + src + ' / ' + dst);
    const r = d.getBoundingClientRect();
    const clientX = r.left + r.width / 2;
    const clientY = r.top + r.height * (zone === 'top' ? 0.1 : zone === 'bottom' ? 0.9 : 0.5);
    const fire = (el, type) => el.dispatchEvent(new DragEvent(type, {
      bubbles: true, cancelable: true, composed: true, clientX, clientY, dataTransfer: new DataTransfer()
    }));
    fire(s, 'dragstart');
    await new Promise(r2 => requestAnimationFrame(r2));
    fire(d, 'dragover');
    fire(d, 'drop');
    fire(s, 'dragend');
  }, srcPath, dstPath, zone);
  await sleep(150);
}
const parentsSel = () => Array.from(document.querySelectorAll('.todo-item[data-id]')).map(li => li.dataset.id);
const subsOfSel = pid => Array.from(document.querySelectorAll(`.st-block[data-todoid="${pid}"]`)).map(li => li.dataset.stid);

(async () => {
  fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });

  // ══ PHASE 1 — today date, list 1: add + link checks ══
  let child = await launch();
  let { browser, page } = await attach();
  await addTask(page, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ official video');
  await addTask(page, 'Read https://github.com/torvalds/linux/blob/master/Documentation/process/coding-style.rst');
  await addTask(page, 'Plain task C');

  const yt = await page.evaluate(() => {
    const li = Array.from(document.querySelectorAll('.todo-item')).find(l => l.querySelector('a[href*="youtube"]'));
    if (!li) return null;
    const a = li.querySelector('a.todo-link');
    return { svg: !!a.querySelector('svg.yt-icon'), href: a.getAttribute('href'), label: a.textContent,
             raw: li.querySelector('.todo-text').textContent };
  });
  ok('F1 youtube link present', !!yt);
  ok('F1 yt logo svg inside link', !!(yt && yt.svg));
  ok('F1 label shortened with middle dots', !!(yt && yt.label.includes('/.../') && yt.label.length <= 40));
  ok('F1 href keeps FULL url', !!(yt && yt.href === 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'));

  const gh = await page.evaluate(() => {
    const a = document.querySelector('a.todo-link[href*="github"]');
    return a ? { label: a.textContent, noYt: !a.querySelector('svg'), href: a.getAttribute('href') } : null;
  });
  ok('F1 generic link shortened, no yt logo', !!gh && gh.label.includes('/.../') && gh.noYt && gh.href.includes('coding-style.rst'));

  // click link must not open editor
  await page.evaluate(() => {
    const a = document.querySelector('.todo-item a.todo-link[href*="youtube"]');
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await sleep(120);
  ok('F1 link click does not start edit', !(await page.evaluate(() => !!document.querySelector('.todo-item [contenteditable="true"]'))));

  // edit a linked task: raw text restored (no shortened corruption)
  const editRaw = await page.evaluate(async () => {
    const li = Array.from(document.querySelectorAll('.todo-item')).find(l => l.querySelector('a[href*="youtube"]'));
    const ed = li.querySelector('.todo-text');
    ed.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 60));
    const box = document.querySelector('.todo-item [contenteditable="true"].todo-text');
    const txt = box ? box.textContent : '';
    if (box) box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return txt;
  });
  ok('F1 edit restores RAW url text', editRaw.includes('watch?v=dQw4w9WgXcQ official video') && !editRaw.includes('/.../'));

  // subtask under task C, then subtask drag moves
  const ps = await page.evaluate(parentsSel);          // unshift order: [C, gh, yt]
  await page.evaluate(p => {
    document.querySelector(`.todo-item[data-path="${p}"] .st-add-trigger`).click();
  }, ps[0]);
  await sleep(200);
  await page.evaluate(() => {
    const el = document.querySelector('.st-text[contenteditable="true"]');
    if (!el) return;
    el.textContent = 'sub c1';
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await sleep(200);
  const subInfo = await page.evaluate(p => ({
    subs: Array.from(document.querySelectorAll(`.st-block[data-todoid="${p}"]`)).map(e => e.dataset.path),
  }), ps[0]);
  const c1Path = subInfo.subs[0];
  ok('F2 subtask c1 created under C (ps[0])', !!c1Path);

  // drag ytTask (ps[2]) -> C middle => demote to subtask of C
  await drag(page, ps[2], ps[0], 'middle');
  let st = await page.evaluate(c => ({
    parents: document.querySelectorAll('.todo-item[data-id]').length,
    subsOfC: Array.from(document.querySelectorAll(`.st-block[data-todoid="${c}"]`)).length,
  }), ps[0]);
  ok('F2 parent demoted into C (2 parents, 2 subs)', st.parents === 2 && st.subsOfC === 2);

  // find the moved node's new path (youtube href now inside a subtask of C)
  const movedPath = await page.evaluate(c => {
    const li = Array.from(document.querySelectorAll(`.st-block[data-todoid="${c}"]`)).find(e => e.querySelector('a[href*="youtube"]'));
    return li ? li.dataset.path : null;
  }, ps[0]);
  ok('F2 moved node is now a subtask of C', !!movedPath);
  // drag it back OUT: drop onto gh-task (ps[1]) TOP edge => promoted, inserted before gh
  await drag(page, movedPath, ps[1], 'top');
  const movedId = movedPath.split(',').pop();
  st = await page.evaluate(m => ({
    parents: document.querySelectorAll('.todo-item[data-id]').length,
    topHasMoved: !!document.querySelector(`.todo-item[data-id="${m}"]`),
    order: Array.from(document.querySelectorAll('.todo-item[data-id]')).map(li => li.dataset.id),
  }), movedId);
  ok('F2 vice versa: subtask promoted to top-level, before gh', st.parents === 3 && st.topHasMoved && st.order.indexOf(movedId) < st.order.indexOf(ps[1]));

  // drag subtask c1 into gh task middle => subtask moves between parents
  await drag(page, c1Path, ps[1], 'middle');
  const movedIntoGh = await page.evaluate(gh => Array.from(document.querySelectorAll(`.st-block[data-todoid="${gh}"]`)).length, ps[1]);
  ok('F2 subtask moved between parents (gh has 1 sub)', movedIntoGh === 1);

  // F3 prep: open calendar, switch to an earlier non-today date
  await page.evaluate(() => document.getElementById('todo-cal-toggle').click());
  await sleep(160);
  const clicked = await page.evaluate(() => {
    const days = Array.from(document.querySelectorAll('.todo-cal-day'));
    const other = days.find(d => !d.classList.contains('sel') && !d.classList.contains('future'));
    if (!other) return null;
    other.click();
    return other.getAttribute('title').split(' ')[0];
  });
  await sleep(200);
  ok('F3 prep switched to non-today date', !!clicked);

  // new category tab + a linked task there, activate it
  await page.evaluate(() => document.getElementById('todo-tab-add').click());
  await sleep(250);
  const tabActive = await page.evaluate(() => {
    const t = document.querySelectorAll('#todo-tabs .todo-tab');
    let idx = -1; t.forEach((el, i) => { if (el.classList.contains('active')) idx = i; });
    return { count: t.length, active: idx };
  });
  await addTask(page, 'alt date https://youtu.be/abcdefghijk');
  ok('F3 prep second category active on alt date', tabActive.count >= 2 && tabActive.active === 1);

  // flush + kill
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await sleep(600);
  child.kill();
  await sleep(2500);
  try { browser.disconnect(); } catch (_) {}

  // ══ PHASE 2 — relaunch same profile: restore checks ══
  child = await launch();
  ({ browser, page } = await attach());
  await sleep(900);

  const r2 = await page.evaluate(() => ({
    items: document.querySelectorAll('.todo-item[data-id]').length,
    tabs: Array.from(document.querySelectorAll('#todo-tabs .todo-tab')).map((el, i) => ({ i, active: el.classList.contains('active') })),
    ytSvg: document.querySelectorAll('a.todo-link svg.yt-icon').length,
    firstLabel: (document.querySelector('a.todo-link') || {}).textContent || '',
  }));
  ok('F3 reopened on alt date (its task visible)', r2.items >= 1);
  ok('F3 last category restored (tab 2 active)', !!(r2.tabs.find(t => t.active) || {}).active);
  ok('F3 link+yt logo rendered on alt date', r2.ytSvg >= 1);

  // calendar: selection badge = alt date
  await page.evaluate(() => {
    const w = document.getElementById('todo-cal-wrap');
    if (!w || !w.classList.contains('open')) document.getElementById('todo-cal-toggle').click();
  });
  await sleep(160);
  const selDay = await page.evaluate(() => {
    const s = document.querySelector('.todo-cal-day.sel');
    return s ? s.getAttribute('title').split(' ')[0] : null;
  });
  ok('F3 last opened DATE restored', selDay === clicked);

  // go back to today: full todo state survived (links + subtask nest)
  await page.evaluate(() => { const t = document.getElementById('todo-cal-today'); if (t) t.click(); });
  await sleep(220);
  const back = await page.evaluate(p => ({
    parents: document.querySelectorAll('.todo-item[data-id]').length,
    ghSubs: document.querySelectorAll('.st-block').length,
    links: document.querySelectorAll('a.todo-link').length,
    yt: document.querySelectorAll('a.todo-link svg.yt-icon').length,
  }), null);
  ok('F3 today state intact (3 parents, 1 subtask moved, links)', back.parents === 3 && back.ghSubs >= 1 && back.links >= 2 && back.yt >= 1);

  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await sleep(250);
  child.kill();
  try { browser.disconnect(); } catch (_) {}
  fs.rmSync(PROFILE, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });

  const fails = results.filter(r => r[0] === 'FAIL');
  console.log('\n==== E2E SUMMARY: ' + (results.length - fails.length) + '/' + results.length + ' passed ====');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('E2E ERROR:', e.message); process.exit(2); });
