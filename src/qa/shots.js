const { chromium, devices } = require('playwright');

const BASE = 'http://127.0.0.1:8899/index.html';
const iphone = { ...devices['iPhone 14 Pro'] };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const shots = [];

  async function session(theme, tag) {
    const ctx = await browser.newContext({ ...iphone, colorScheme: theme });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    async function shot(name) {
      const f = `src/qa/shots/${tag}-${name}.png`;
      await page.screenshot({ path: f });
      shots.push(f);
    }
    await shot('01-home');

    // course
    await page.click('text=AP Chemistry');
    await page.waitForTimeout(350); await shot('02-course');

    // unit
    await page.click('text=Kinetics');
    await page.waitForTimeout(350); await shot('03-unit');

    // study
    await page.click('text=Study this unit');
    await page.waitForTimeout(450); await shot('04-card-front');
    await page.click('#card');
    await page.waitForTimeout(350); await shot('05-card-back');
    await page.click('[data-grade="1"]');
    await page.waitForTimeout(300);
    await page.click('#card'); await page.waitForTimeout(250);
    await page.click('[data-grade="0"]'); await page.waitForTimeout(300);
    await shot('06-card-next');

    // quiz
    await page.evaluate(() => { location.hash = '#/quiz/calcbc/all/u10'; });
    await page.waitForTimeout(500); await shot('07-quiz');
    await page.click('.choice'); await page.waitForTimeout(350); await shot('08-quiz-answered');

    // french card (accents) + math card
    await page.evaluate(() => { location.hash = '#/study/french/all/vb'; });
    await page.waitForTimeout(450);
    await page.click('#card'); await page.waitForTimeout(250); await shot('09-french');

    await page.evaluate(() => { location.hash = '#/study/calcbc/all/u6'; });
    await page.waitForTimeout(450);
    await page.click('#card'); await page.waitForTimeout(250); await shot('10-math');

    // search
    await page.evaluate(() => { location.hash = '#/search'; });
    await page.waitForTimeout(350);
    await page.fill('#q', 'entropy');
    await page.waitForTimeout(400); await shot('11-search');

    // stats
    await page.evaluate(() => { location.hash = '#/stats'; });
    await page.waitForTimeout(350); await shot('12-stats');

    // settings
    await page.evaluate(() => { location.hash = '#/settings'; });
    await page.waitForTimeout(350); await shot('13-settings');

    // review
    await page.evaluate(() => { location.hash = '#/review'; });
    await page.waitForTimeout(400); await shot('14-review');

    await ctx.close();
  }

  await session('light', 'light');
  await session('dark', 'dark');
  await browser.close();
  console.log(shots.join('\n'));
  if (errors.length) { console.log('\nERRORS:\n' + errors.join('\n')); process.exit(2); }
  else console.log('\nno console errors');
})();
