const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 480, height: 340, deviceScaleFactor: 1 }); // short window
  const url = 'file://' + path.join(__dirname, 'test-harness.html');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 500));
  const d = await page.evaluate(() => {
    const list = document.getElementById('todo-list');
    const items = [...document.querySelectorAll('.todo-item')];
    const lb = list.getBoundingClientRect();
    const cs = getComputedStyle(list);
    const rows = items.map(it => {
      const b = it.getBoundingClientRect();
      return { top: Math.round(b.top - lb.top), bottom: Math.round(b.bottom - lb.top), mb: getComputedStyle(it).marginBottom, cls: it.className };
    });
    return {
      listBox: { top: Math.round(lb.top), height: Math.round(lb.height) },
      listPadding: cs.paddingTop + ' / ' + cs.paddingBottom,
      listScrollH: list.scrollHeight, listClientH: list.clientHeight,
      scrollTop: list.scrollTop,
      firstRow: rows[0], lastRow: rows[rows.length-1], rowCount: rows.length,
      allRows: rows
    };
  });
  console.log(JSON.stringify(d, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
