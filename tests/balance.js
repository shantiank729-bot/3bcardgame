// 数年分を高速に回して成長と大会成績を確認: node tests/balance.js
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  const out = await page.evaluate((years) => {
    const lines = [];
    newGame('テスト高');
    let guard = 0;
    while (S.year <= years && guard++ < 5000) {
      if (S.tourney) {
        const t = S.tourney;
        if (t.done) { closeTourney(); continue; }
        const starters = S.players.filter((p) => p.injury === 0);
        const fat = Math.round(starters.reduce((a, p) => a + p.fatigue, 0) / starters.length);
        const my = teamStrength(S.players);
        startMatch();
        UI.match.simToEnd();
        const m = UI.match;
        lines.push(`Y${S.year} ${t.name} ${t.rounds[t.round]} 自${my}(疲労${fat}) vs ${t.opps[t.round].strength} → ${m.me.runs}-${m.opp.runs}`);
        finishMatch();
        continue;
      }
      const i = Math.floor(Math.random() * 5);
      const card = S.hand[i];
      S.pos = (S.pos + card.v) % 24;
      finishMove(i, card);
    }
    return lines;
  }, Number(process.argv[2] || 3));
  console.log(out.join('\n'));
  await browser.close();
})();
