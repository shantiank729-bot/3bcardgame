// 各画面のスクリーンショット: SHOT_DIR=... node tests/shots.js
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const dir = process.env.SHOT_DIR || '.';
  const browser = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: scheme });
    await page.goto('file://' + path.resolve(__dirname, '../index.html'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(dir, `title-${scheme}.png`) });
    await page.click('#newForm button[type=submit]');
    await page.click('.card >> nth=1');
    await page.screenshot({ path: path.join(dir, `home-${scheme}.png`), fullPage: true });
    await page.click('[data-act=go][data-to=roster]');
    await page.click('.pl-head >> nth=0');
    await page.screenshot({ path: path.join(dir, `roster-${scheme}.png`), fullPage: true });
    await page.evaluate(() => { startTourney('summerPref'); render(); });
    await page.screenshot({ path: path.join(dir, `tourney-${scheme}.png`), fullPage: true });
    await page.click('[data-act=startMatch]');
    for (let i = 0; i < 14; i++) {
      const b = await page.$('[data-act=cmd][data-c=normal]:not([disabled]), [data-act=cmd][data-c=pitch]');
      if (b) await b.click();
    }
    await page.screenshot({ path: path.join(dir, `match-${scheme}.png`), fullPage: true });
    await page.close();
  }
  await browser.close();
})();
