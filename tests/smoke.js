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
  if (process.env.TRACE) await page.evaluate(() => {
    window.__trace = [];
    const wrap = (name) => { const f = window[name]; window[name] = function (...a) { window.__trace.push(name + ' paused=' + UI.flow.paused + ' req=' + UI.flow.timeReq + '\n' + new Error().stack.split('\n').slice(2, 6).join('\n')); return f.apply(this, a); }; };
    ['startFlow', 'pauseFlow', 'matchCmd'].forEach(wrap);
  });
  let manualMatches = 0, timeouts = 0, commands = 0;
  const hudMismatch = [];
  for (let step = 0; step < 6000; step++) {
    const screen = await page.evaluate(() => document.body.dataset.screen);
    const year = await page.evaluate(() => S.year);
    if (year > 4) break;
    if (screen === 'home') {
      await page.click('.card >> nth=0');
      await page.click('[data-act=play]');
      await page.waitForFunction(() => !UI.moving);
    } else if (screen === 'tourney') {
      if (await page.$('[data-act=closeT]')) await page.click('[data-act=closeT]');
      else if (manualMatches < 2) { manualMatches++; await page.click('[data-act=startMatch]'); }
      else await page.click('[data-act=quickMatch]');
    } else if (screen === 'match') {
      // 試合は自動で進む。ときどきタイムをかけて指示を出す
      if (await page.$('[data-act=finishMatch]')) { await page.click('[data-act=finishMatch]'); continue; }
      if (await page.$('[data-act=cmd][data-c=resume]')) {
        timeouts++;
        if (await page.$('[data-act=bullpen]') && Math.random() < 0.2) {
          await page.click('[data-act=bullpen]');
          const r = await page.$('[data-act=relief]');
          if (r) await r.click();
          else if (await page.$('[data-act=bullpenClose]')) await page.click('[data-act=bullpenClose]');
          else {
            const st = await page.evaluate(() => ({ paused: UI.flow.paused, show: UI.showBullpen, batting: userIsBatting(UI.match), busy: Anim.busy(), acts: [...document.querySelectorAll('[data-act]')].map((x) => x.dataset.act + ':' + (x.dataset.c || '')).join(' ') }));
            errors.push('投手交代の画面が出ない ' + JSON.stringify(st));
            errors.push(await page.evaluate(() => (window.__trace || []).slice(-4).join('\n----\n')));
          }
          continue;
        }
        const btns = await page.$$('.cmds [data-act=cmd]:not([disabled])');
        const choices = [];
        for (const b of btns) { const c = await b.getAttribute('data-c'); if (c !== 'autoAll') choices.push(b); }
        await choices[Math.floor(Math.random() * choices.length)].click();
        commands++;
        continue;
      }
      // 画面の回・アウト表示が試合の状態と一致していること(再生中は前のプレーの表示なので除く)
      const shown = await page.evaluate(() => {
        if (Anim.busy() || !UI.match || UI.match.over) return null;
        const m = UI.match;
        const hud = document.querySelector('.stage-hud .sit-inn');
        const want = `${m.inning}回${m.top ? '表' : '裏'}`;
        return hud && hud.textContent !== want ? `表示「${hud.textContent}」 実際「${want}」` : null;
      });
      if (shown) hudMismatch.push(shown);
      const r = Math.random();
      if (r < 0.15 && await page.$('[data-act=timeout]:not([disabled])')) await page.click('[data-act=timeout]');
      else if (r < 0.9 && await page.evaluate(() => Anim.busy())) await page.click('#fieldCanvas');
      await page.waitForTimeout(120);
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
  console.log('timeouts:', timeouts, 'commands:', commands, 'HUD不一致:', hudMismatch.length, hudMismatch.slice(0, 3));
  if (hudMismatch.length) errors.push('画面の回表示が更新されていない');
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
