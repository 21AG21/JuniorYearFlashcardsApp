/* unitshots.js <course> <unit> — screenshots a merged unit: its page at 390 and 1280, the free-response page, one explain-why card, and reports page errors and overflow. */
const { chromium } = require('/home/user/JuniorYearFlashcardsApp/node_modules/playwright');
const [course, unit] = process.argv.slice(2);
const BASE = 'http://127.0.0.1:8897/index.html';
const OUT = '<GEN_DIR>/shots/';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const out = [];
  for (const W of [390, 1280]) {
    const c = await b.newContext({ viewport: { width: W, height: W === 390 ? 844 : 800 }, serviceWorkers: 'block' }); const p = await c.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.goto(BASE, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    await p.evaluate(h => { location.hash = h; }, '#/d/' + course + '/u/' + unit); await p.waitForTimeout(900);
    const over = () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const seps = await p.evaluate(() => [...document.querySelectorAll('.tsep .ulabel')].filter(e => !e.closest('.pane-l')).map(e => e.textContent.trim()));
    const modes = await p.evaluate(() => [...document.querySelectorAll('.modes .mode .mlab')].filter(e => !e.closest('.pane-l')).map(e => e.textContent));
    const excl = await p.evaluate(() => [...document.querySelectorAll('.excl li')].length);
    const frame = await p.evaluate(() => (document.querySelector('.dblurb.frame') || {}).textContent || '');
    out.push({ W, seps: seps.length, firstSep: seps[0], modes, excl, frame, overUnit: await over() });
    await p.screenshot({ path: OUT + course + '-' + unit + '-unit-' + W + '.png', fullPage: W === 390 });
    await p.evaluate(h => { location.hash = h; }, '#/d/' + course + '/u/' + unit + '/frq'); await p.waitForTimeout(900);
    await p.locator('.frq .fpart').first().click().catch(() => {}); await p.waitForTimeout(300);
    out[out.length - 1].frqs = await p.evaluate(() => document.querySelectorAll('.frq').length);
    out[out.length - 1].overFrq = await over();
    await p.screenshot({ path: OUT + course + '-' + unit + '-frq-' + W + '.png', fullPage: W === 390 });
    await p.evaluate(h => { location.hash = h; }, '#/cram/' + course + '/' + unit + '/j'); await p.waitForTimeout(900);
    await p.locator('[data-reveal]').waitFor({ timeout: 5000 }).catch(() => {}); await p.locator('[data-reveal]').click().catch(() => {}); await p.waitForTimeout(500);
    out[out.length - 1].scope = await p.evaluate(() => (document.querySelector('.sess-top .scope') || {}).textContent || '');
    out[out.length - 1].jx = await p.evaluate(() => document.querySelectorAll('#card .jx').length);
    out[out.length - 1].meta = await p.evaluate(() => (document.querySelector('#card .meta') || {}).textContent || '');
    out[out.length - 1].overCard = await over();
    await p.screenshot({ path: OUT + course + '-' + unit + '-jcard-' + W + '.png', fullPage: W === 390 });
    out[out.length - 1].errs = errs;
    await c.close();
  }
  await b.close();
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.log('CRASH', e); process.exit(1); });
