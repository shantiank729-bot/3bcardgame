// 試合アニメーションの確認: node tests/anim.js  (SHOT_DIR を指定するとコマ画像も保存)
// 何試合分ものプレーを時間軸に変換し、全時刻で例外や NaN が出ないか調べる。
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: process.env.SCHEME || 'light' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.click('#newForm button[type=submit]');

  const report = await page.evaluate(() => {
    const kinds = {};
    const problems = [];
    let outfieldChecked = 0, singles = 0, singleDives = 0;
    const singleVariants = {};
    // 盗塁(成功・失敗)を直接作って確認
    for (let i = 0; i < 300; i++) {
      const A = makeOpponent(45), B = makeOpponent(45);
      const a = makeSide('A', A.players, pickStarter(A.players), false);
      const b = makeSide('B', B.players, pickStarter(B.players), false);
      const m = new Match(a, b, {}); m.me = a; m.opp = b;
      m.bases[i % 2] = a.order[3].p;
      m.steal();
      const lp = m.lastPlay;
      const tl = Anim._build(m, lp);
      const end = tl.at(tl.total);
      const vis = end.runners.filter((r) => r.alpha > 0.5).length;
      if (vis !== lp.after.filter(Boolean).length) problems.push('盗塁 走者数 ' + lp.text);
      kinds.STEAL = (kinds.STEAL || 0) + 1;
    }
    for (let g = 0; g < 60; g++) {
      const A = makeOpponent(45), B = makeOpponent(45);
      const a = makeSide('A', A.players, pickStarter(A.players), false);
      const b = makeSide('B', B.players, pickStarter(B.players), false);
      const m = new Match(a, b, { mercy: false });
      m.me = a; m.opp = b;
      let seq = 0, guard = 0;
      while (!m.over && guard++ < 500) {
        m.autoStep();
        const lp = m.lastPlay;
        if (!lp || lp.seq === seq) continue;
        seq = lp.seq;
        const text = lp.text.split('：').slice(1).join('：');
        const k = Anim._classify(text, lp.kind);
        kinds[k] = (kinds[k] || 0) + 1;
        const tl = Anim._build(m, lp);
        if (!(tl.total > 0 && tl.total < 14000)) problems.push(`長さ異常 ${k} ${tl.total}`);
        for (let t = 0; t <= tl.total; t += 50) {
          const st = tl.at(t);
          const nums = [];
          for (const p of Object.values(st.fielders)) nums.push(...p);
          for (const r of st.runners) nums.push(r.x, r.y, r.alpha);
          if (st.batter) nums.push(st.batter.x, st.batter.y);
          if (st.ball) nums.push(st.ball.x, st.ball.y, st.ball.z);
          if (nums.some((n) => !Number.isFinite(n))) { problems.push(`NaN ${k} t=${t} ${lp.text}`); break; }
        }
        // 終了時点の走者数 = after の走者数(アウト・生還した走者は消えている)
        const end = tl.at(tl.total);
        const visible = end.runners.filter((r) => r.alpha > 0.5).length + (end.batter && end.batter.alpha > 0.5 && lp.after.includes(lp.batter) ? 1 : 0);
        const expect = lp.after.filter(Boolean).length;
        if (visible !== expect) problems.push(`走者数 ${k} 表示${visible} 期待${expect} ${lp.text}`);
        // 外野へのヒットは外野手が処理していること(打球が止まった位置に一番近い野手が外野手)
        if (['1B', '2B', '3B'].includes(k)) {
          let first = null;
          for (let t = 0; t <= tl.total && !first; t += 25) {
            const st = tl.at(t);
            if (!st.ball || Math.hypot(st.ball.x, st.ball.y) < 150 || st.ball.z > 8) continue;
            for (const [fk, pos] of Object.entries(st.fielders)) {
              if (Math.hypot(pos[0] - st.ball.x, pos[1] - st.ball.y) < 6) { first = fk; break; }
            }
          }
          if (!first || !['LF', 'CF', 'RF'].includes(first)) problems.push(`外野ヒットを外野手が処理していない ${k} ${first} ${lp.text}`);
          outfieldChecked++;
          if (k === '1B') {
            singleVariants[tl.variant] = (singleVariants[tl.variant] || 0) + 1;
            if (tl.poses.some((p) => p.type === 'dive')) singleDives++;
            singles++;
          }
        }
        // 結果表示より前にアウト/ヒットが分かる表示が出ていないこと
        if (tl.tLabel <= 0) problems.push(`ラベル時刻異常 ${k}`);
      }
    }
    return { kinds, outfieldChecked, singleVariants, singleDiveRate: (singleDives / singles).toFixed(2), problems: problems.slice(0, 20), nProblems: problems.length };
  });
  console.log(JSON.stringify(report, null, 1));

  const dir = process.env.SHOT_DIR;
  if (dir) {
    // 実際の試合画面で数プレー分のコマを保存
    await page.evaluate(() => { startTourney('summerPref'); render(); });
    await page.click('[data-act=startMatch]');
    const want = ['HR', '2B', '1B', 'GO', 'FO', 'DP', 'IH', 'LO'];
    const got = new Set();
    for (let i = 0; i < 400 && got.size < want.length; i++) {
      const info = await page.evaluate(() => {
        const m = UI.match;
        if (m.over) return { over: true };
        const before = JSON.stringify([m.bases.map((b) => !!b), m.outs, m.offense().runs, m.offense().idx, m.top]);
        const snapM = m;
        // 次のプレーを試しに進めてみて、欲しい種類のときだけ再生する
        snapM.autoStep();
        const lp = snapM.lastPlay;
        const k = Anim._classify(lp.text.split('：').slice(1).join('：'), lp.kind);
        return { k, before, total: Anim._build(m, lp).total };
      });
      if (info.over) break;
      if (want.includes(info.k) && !got.has(info.k)) {
        got.add(info.k);
        for (const f of [-700, -250, 150]) {
          await page.evaluate((fr) => { render(); Anim._drawAt(UI.match, UI.match.lastPlay, fr); }, f);
          const el = await page.$('.stage');
          await el.screenshot({ path: path.join(dir, `anim-${info.k}-${f + 1000}.png`) });
        }
      } else {
        await page.evaluate(() => render());
      }
    }
    await page.screenshot({ path: path.join(dir, 'anim-match.png') });
  }
  console.log('errors:', errors);
  await browser.close();
  process.exit(errors.length || report.nProblems ? 1 : 0);
})();
