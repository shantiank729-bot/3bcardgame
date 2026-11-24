// 使い方: npx vite-node scripts/blunders.ts -- [1レベルあたりの局数]
// 各レベルの指し手を強い設定（参照エンジン）で採点し、序盤/中盤/終盤の悪手率を出す。
import { createRequire } from "node:module";
import { Game } from "../src/core/game";
import { toUsiPosition, usiToMove } from "../src/core/usi";
import { chooseMove, levelParams, mulberry32, shouldResign } from "../src/engine/levels";
import { UsiEngine } from "../src/engine/usi";

const require = createRequire(import.meta.url);
const GAMES = Number(process.argv.slice(2).filter((a) => a !== "--")[0] ?? 4);
const LEVELS = [1, 3, 5, 8, 10, 15, 20, 25, 30];
const REF_NODES = 30_000;

async function newEngine() {
  const m = await require("@mizarjp/yaneuraou.k-p")();
  const e = new UsiEngine({ send: (l) => m.postMessage(l), onLine: (cb) => m.addMessageListener(cb) });
  await e.init({ Threads: 1, USI_Hash: 16, BookFile: "no_book", PvInterval: 0 });
  return e;
}
const clamp = (s: number) => Math.max(-2000, Math.min(2000, s));
const phase = (ply: number) => (ply <= 30 ? 0 : ply <= 80 ? 1 : 2);

async function main() {
  const jobs = LEVELS.flatMap((lv) => Array.from({ length: GAMES }, (_, i) => ({ lv, seed: lv * 100 + i })));
  const stats = new Map<number, { n: number[]; loss: number[]; bad: number[]; hang: number }>();
  for (const lv of LEVELS) stats.set(lv, { n: [0, 0, 0], loss: [0, 0, 0], bad: [0, 0, 0], hang: 0 });
  let next = 0;
  const worker = async () => {
    const [play, ref] = [await newEngine(), await newEngine()];
    while (next < jobs.length) {
      const { lv, seed } = jobs[next++];
      const rng = mulberry32(seed);
      const g = new Game();
      g.maxPly = 200;
      const evals: [number[], number[]] = [[], []];
      const st = stats.get(lv)!;
      while (!g.result) {
        const p = levelParams(lv);
        const pos = toUsiPosition(g.startSfen, g.moves).replace(/^position /, "");
        const r = await play.analyze({ position: pos, multipv: p.multipv, nodes: p.nodes });
        if (!r.candidates.length) { g.resign(); break; }
        evals[g.turn].push(r.candidates[0].score);
        if (shouldResign(evals[g.turn])) { g.resign(); break; }
        const choice = chooseMove(g.pos, r.candidates, p, rng);
        // 参照: 指す前の最善の評価 と 指した後の評価（相手から見た値を反転）
        const before = await ref.analyze({ position: pos, nodes: REF_NODES });
        const after = await ref.analyze({ position: `${pos.includes(" moves ") ? pos : pos + " moves"} ${choice.move}`, nodes: REF_NODES });
        const b = before.candidates[0]?.score ?? 0;
        const a = after.candidates.length ? -after.candidates[0].score : 30000;
        const loss = Math.max(0, clamp(b) - clamp(a));
        const ph = phase(g.ply + 1);
        st.n[ph]++; st.loss[ph] += loss; if (loss >= 300) st.bad[ph]++;
        g.play(usiToMove(choice.move));
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log("レベル | 平均損失(序/中/終) | 悪手率%(損失300以上: 序/中/終)");
  for (const lv of LEVELS) {
    const s = stats.get(lv)!;
    const f = (i: number) => (s.n[i] ? (s.loss[i] / s.n[i]).toFixed(0) : "-");
    const b = (i: number) => (s.n[i] ? ((100 * s.bad[i]) / s.n[i]).toFixed(1) : "-");
    console.log(`Lv${String(lv).padStart(2)} | ${f(0)}/${f(1)}/${f(2)} | ${b(0)}/${b(1)}/${b(2)}  (手数 ${s.n.join("/")})`);
  }
  process.exit(0);
}
main();
