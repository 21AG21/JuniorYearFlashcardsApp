const { chromium, devices } = require('playwright');
const BASE='http://127.0.0.1:8899/index.html';
(async()=>{
 const b=await chromium.launch();
 for (const theme of ['light','dark']) {
  const c=await b.newContext({...devices['iPhone 14 Pro'],colorScheme:theme});
  const p=await c.newPage();
  await p.goto(BASE,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
  await p.evaluate(()=>{ window.Store.setSetting('sessionSize',4); window.Store.setSetting('newPerSession',4); });
  await p.evaluate(()=>location.hash='#/study/apush/core/u7'); await p.waitForTimeout(500);
  for(let i=0;i<6;i++){ if(!(await p.locator('#card').count()))break;
    await p.click('#card'); await p.waitForTimeout(140);
    if(await p.locator('[data-grade="1"]').count()){await p.click('[data-grade="1"]');await p.waitForTimeout(200);} }
  await p.screenshot({path:`src/qa/shots/${theme}-20-complete.png`});
  await p.evaluate(()=>location.hash='#/'); await p.waitForTimeout(400);
  await p.screenshot({path:`src/qa/shots/${theme}-21-home-progress.png`});
  await p.evaluate(()=>location.hash='#/review'); await p.waitForTimeout(500);
  await p.screenshot({path:`src/qa/shots/${theme}-22-review.png`});
  await p.evaluate(()=>location.hash='#/d/french/u/vb'); await p.waitForTimeout(450);
  await p.screenshot({path:`src/qa/shots/${theme}-23-browse.png`});
  await c.close();
 }
 await b.close(); console.log('done');
})();
