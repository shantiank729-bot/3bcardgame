// 試合エンジンのバランス確認: node tests/sim.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { console, Math, Map };
vm.createContext(ctx);
for (const f of ['data.js', 'engine.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', f), 'utf8'), ctx);
vm.runInContext(`
function run(sa, sb, n) {
  let runs = 0, hits = 0, winsA = 0, hr = 0, k=0, games=0, mercy=0;
  for (let i = 0; i < n; i++) {
    const A = makeOpponent(sa), B = makeOpponent(sb);
    const a = makeSide('A', A.players, pickStarter(A.players), false);
    const b = makeSide('B', B.players, pickStarter(B.players), false);
    const m = new Match(a, b, { mercy: true });
    m.simToEnd();
    runs += a.runs + b.runs; hits += a.hits + b.hits;
    if (m.winner() === a) winsA++;
    if (m.resultNote.includes('コールド')) mercy++;
    for (const s of m.batStats.values()) hr += s.hr;
    games++;
  }
  console.log(sa, 'vs', sb, ': 1チーム平均得点', (runs/2/n).toFixed(2), '安打', (hits/2/n).toFixed(1), 'HR', (hr/2/n).toFixed(2), 'A勝率', (winsA/n).toFixed(2), 'コールド率', (mercy/n).toFixed(2));
}
run(30, 30, 500); run(50, 50, 500); run(70, 70, 500); run(35, 50, 500); run(50, 60, 500); run(60, 75, 500);
`, ctx);
