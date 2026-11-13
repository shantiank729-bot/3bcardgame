// ブラウザで数年分を自動プレイして例外が出ないか確認: node tests/smoke.js
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.addInitScript(() => { try { localStorage.setItem('hakkyu-road-anim', 'fast'); } catch (e) {} });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.click('#newForm button[type=submit]');
  let manualMatches = 0;
  for (let step = 0; step < 1200; step++) {
    const screen = await page.evaluate(() => document.body.dataset.screen);
    const year = await page.evaluate(() => S.year);
    if (year > 4) break;
    if (screen === 'home') {
      await page.click('.card >> nth=0');
      await page.click('[data-act=play]');
      await page.waitForFunction(() => !UI.moving);
    } else if (screen === 'tourney') {
      if (await page.$('[data-act=closeT]')) await page.click('[data-act=closeT]');
      else if (manualMatches < 3) { manualMatches++; await page.click('[data-act=startMatch]'); }
      else await page.click('[data-act=quickMatch]');
    } else if (screen === 'match') {
      if (await page.$('[data-act=finishMatch]')) { await page.click('[data-act=finishMatch]'); continue; }
      if (await page.$('[data-act=bullpen]') && Math.random() < 0.05) {
        await page.click('[data-act=bullpen]');
        const r = await page.$('[data-act=relief]');
        if (r) await r.click(); else await page.click('[data-act=bullpenClose]');
        continue;
      }
      const btns = await page.$$('[data-act=cmd]:not([disabled])');
      const choices = [];
      for (const b of btns) {
        const c = await b.getAttribute('data-c');
        if (c !== 'autoAll' && c !== 'autoHalf') choices.push(b);
      }
      await choices[Math.floor(Math.random() * choices.length)].click();
      await page.waitForFunction(() => !Anim.busy(), null, { timeout: 15000 });
    } else { console.log('unknown screen', screen); break; }
    if (errors.length) break;
  }
  const summary = await page.evaluate(() => ({
    year: S.year, week: S.week, rep: S.rep, players: S.players.length, str: teamStrength(S.players),
    totals: S.totals, hist: S.history.map((h) => `${h.year} ${h.name} ${h.label}`),
  }));
  console.log(JSON.stringify(summary, null, 1));
  const shots = process.env.SHOT_DIR;
  if (shots) {
    await page.click('[data-act=go][data-to=roster]');
    await page.click('.pl-head >> nth=0');
    await page.screenshot({ path: path.join(shots, 'roster.png'), fullPage: true });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log('horizontal overflow:', overflow);
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
