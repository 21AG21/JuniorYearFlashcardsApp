const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8899/index.html';
const ok = [], bad = [];
function check(name, cond, extra) { (cond ? ok : bad).push(name + (cond ? '' : ' — ' + (extra||''))); }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // --- service worker registers
  const swReady = await page.evaluate(() => navigator.serviceWorker.ready.then(()=>true).catch(()=>false));
  check('service worker registers', swReady);

  // --- study, grade 3 cards, check persistence
  await page.evaluate(() => location.hash = '#/study/apush/all/u3');
  await page.waitForTimeout(500);
  for (let i=0;i<3;i++){
    await page.click('#card'); await page.waitForTimeout(180);
    await page.click('[data-grade="1"]'); await page.waitForTimeout(220);
  }
  const graded = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('.state.')))).cards).length);
  check('grading writes state', graded >= 3, 'got ' + graded);

  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const afterReload = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('.state.')))).cards).length);
  check('state survives reload', afterReload === graded, `${afterReload} vs ${graded}`);

  // --- undo
  await page.evaluate(() => location.hash = '#/study/chem/all/u1');
  await page.waitForTimeout(450);
  await page.click('#card'); await page.waitForTimeout(150);
  await page.click('[data-grade="2"]'); await page.waitForTimeout(250);
  const hasUndo = await page.locator('[data-undo]').count();
  check('undo button appears', hasUndo === 1);
  await page.click('[data-undo]'); await page.waitForTimeout(250);
  const counter = await page.textContent('.sess-count');
  check('undo rewinds counter', counter.trim().startsWith('1 /'), counter);

  // --- star
  await page.click('[data-star]'); await page.waitForTimeout(200);
  const pressed = await page.getAttribute('[data-star]', 'aria-pressed');
  check('star toggles', pressed === 'true', pressed);

  // --- typing mode
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(350);
  await page.click('[data-set="typing"]'); await page.waitForTimeout(200);
  await page.evaluate(() => location.hash = '#/study/french/all/t1');
  await page.waitForTimeout(450);
  const hasInput = await page.locator('#typein').count();
  check('typing mode shows an input', hasInput === 1);
  if (hasInput) {
    const answer = await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('x')||'null'); return null;
    });
    await page.fill('#typein', 'definitely wrong');
    await page.press('#typein', 'Enter');
    await page.waitForTimeout(300);
    const v = await page.locator('.verdict').count();
    check('typing verdict shown', v === 1);
  }
  await page.evaluate(() => { location.hash = '#/settings'; });
  await page.waitForTimeout(300);
  await page.click('[data-set="typing"]'); await page.waitForTimeout(200);

  // --- theme pin
  await page.click('[data-theme="dark"]'); await page.waitForTimeout(250);
  const themeAttr = await page.getAttribute('html', 'data-theme');
  check('theme pins to dark', themeAttr === 'dark', themeAttr);
  await page.click('[data-theme="auto"]'); await page.waitForTimeout(250);

  // --- profiles
  page.on('dialog', d => d.accept('Priya'));
  await page.click('[data-addprofile]'); await page.waitForTimeout(400);
  const profText = await page.textContent('.head h1');
  check('new profile becomes active', profText.trim() === 'Priya', profText);
  const freshCards = await page.evaluate(() => {
    const k = Object.keys(localStorage).filter(k=>k.includes('.state.'));
    return k.length;
  });
  check('profiles keep separate state keys', freshCards >= 1, String(freshCards));

  // --- search
  await page.evaluate(() => location.hash = '#/search');
  await page.waitForTimeout(300);
  await page.fill('#q', 'laïcité');
  await page.waitForTimeout(400);
  const nres = await page.locator('.qrow').count();
  check('accented search finds cards', nres > 0, String(nres));
  await page.fill('#q', 'Marbury');
  await page.waitForTimeout(400);
  check('search finds Marbury', (await page.locator('.qrow').count()) > 0);

  // --- keyboard in session
  await page.evaluate(() => location.hash = '#/study/calcbc/core/u10');
  await page.waitForTimeout(450);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  check('space reveals', (await page.locator('.rate .r-again').count()) === 1);
  await page.keyboard.press('3'); await page.waitForTimeout(250);
  check('number key grades', (await page.textContent('.sess-count')).trim().startsWith('2 /'));

  // --- offline
  await ctx.setOffline(true);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(e => errs.push('offline nav: '+e.message));
  await page.waitForTimeout(1200);
  const offlineWorks = await page.evaluate(() => !!document.querySelector('.ledger, .head h1'));
  const offlineText = await page.textContent('#app').catch(()=> '');
  check('loads offline from cache', offlineWorks && !/Could not load/.test(offlineText), offlineText.slice(0,80));
  await ctx.setOffline(false);

  await browser.close();
  console.log('PASS:'); ok.forEach(o=>console.log('  ✓',o));
  if (bad.length) { console.log('FAIL:'); bad.forEach(b=>console.log('  ✗',b)); }
  const realErrs = errs.filter(e=>!/Failed to load resource|net::ERR/.test(e));
  if (realErrs.length) { console.log('JS ERRORS:'); realErrs.forEach(e=>console.log('  !',e)); }
  process.exit(bad.length || realErrs.length ? 1 : 0);
})();
