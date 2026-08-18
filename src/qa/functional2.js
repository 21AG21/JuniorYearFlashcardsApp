const { chromium, devices } = require('playwright');
const BASE = 'http://127.0.0.1:8899/index.html';
const ok=[],bad=[];
const check=(n,c,x)=>(c?ok:bad).push(n+(c?'':' — '+(x||'')));
(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ ...devices['iPhone 14 Pro'] });
  const p = await c.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto(BASE,{waitUntil:'networkidle'}); await p.waitForTimeout(500);

  // tab bar taps really navigate
  for (const [i,hash] of [[3,'#/stats'],[2,'#/search'],[1,'#/review'],[0,'#/']]) {
    const tab = p.locator('.lg-tab').nth(i);
    const box = await tab.boundingBox();
    await p.mouse.move(box.x+box.width/2, box.y+box.height/2);
    await p.mouse.down(); await p.waitForTimeout(60); await p.mouse.up();
    await p.waitForTimeout(400);
    check('tab '+i+' navigates to '+hash, (await p.evaluate(()=>location.hash)) === hash, await p.evaluate(()=>location.hash));
  }

  // deck row tap
  await p.click('text=AP French'); await p.waitForTimeout(400);
  check('deck row opens course', (await p.evaluate(()=>location.hash)).startsWith('#/d/french'), await p.evaluate(()=>location.hash));

  // chip navigation
  await p.click('text=High-yield only'); await p.waitForTimeout(500);
  check('chip starts a core session', (await p.locator('#card').count())===1);

  // swipe right = Good
  await p.click('#card'); await p.waitForTimeout(200);
  const before = await p.textContent('.sess-count');
  const cb = await p.locator('#card').boundingBox();
  await p.mouse.move(cb.x+cb.width/2, cb.y+40);
  await p.mouse.down();
  for (let x=0;x<=160;x+=20){ await p.mouse.move(cb.x+cb.width/2+x, cb.y+40); await p.waitForTimeout(16); }
  await p.mouse.up(); await p.waitForTimeout(450);
  const after = await p.textContent('.sess-count');
  check('swipe right grades the card', before.trim()!==after.trim(), before+' -> '+after);

  // quiz flow to completion of a few cards
  await p.evaluate(()=>location.hash='#/quiz/apush/core/u8'); await p.waitForTimeout(600);
  check('quiz renders 4 choices', (await p.locator('.choice').count())===4, String(await p.locator('.choice').count()));
  await p.locator('.choice').first().click(); await p.waitForTimeout(300);
  check('quiz marks the right answer', (await p.locator('.choice[data-state="right"]').count())===1);
  await p.click('[data-next]'); await p.waitForTimeout(350);
  check('quiz advances', (await p.locator('.choice').count())===4);

  // exit session returns
  await p.click('[data-exit]'); await p.waitForTimeout(400);
  check('exit leaves the session', (await p.locator('#card').count())===0);

  // finish a whole short session
  await p.evaluate(()=>{ window.Store.setSetting('sessionSize',3); window.Store.setSetting('newPerSession',3); });
  await p.evaluate(()=>location.hash='#/study/lang/smart'); await p.waitForTimeout(600);
  for (let i=0;i<8;i++){
    if (await p.locator('#card').count()===0) break;
    await p.click('#card'); await p.waitForTimeout(160);
    if (await p.locator('[data-grade="2"]').count()) { await p.click('[data-grade="2"]'); await p.waitForTimeout(220); }
  }
  const doneText = await p.textContent('#app');
  check('session completion screen', /Session complete/.test(doneText), doneText.slice(0,90));

  await b.close();
  ok.forEach(o=>console.log('  ✓',o));
  bad.forEach(x=>console.log('  ✗',x));
  errs.forEach(e=>console.log('  !',e));
  process.exit(bad.length||errs.length?1:0);
})();
