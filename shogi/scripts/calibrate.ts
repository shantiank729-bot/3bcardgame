// 使い方: npx vite-node scripts/calibrate.ts -- [1局あたりの組数] [並列数]
// レベル L と L+1..L+3 を先後入れ替えて対局させ、Elo を推定して JSON に保存する。
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { MAX_LEVEL, mulberry32 } from "../src/engine/levels";
import { fitElo, playLevelGame } from "../src/engine/selfplay";
import { UsiEngine } from "../src/engine/usi";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2).filter((a) => a !== "--");
const GAMES_PER_PAIR = Number(args[0] ?? 8);
const PARALLEL = Number(args[1] ?? 4);
const MAX_GAP = Number(args[2] ?? 3);
const OUT = args[3] ?? "calibration.json";
/** 指定すると、そのレベルどうし（例 "1,5,10"）の隣接ペアだけを対局させる */
const ONLY = args[4] ? args[4].split(",").map(Number) : null;

async function newEngine(): Promise<UsiEngine> {
  const Y = require("@mizarjp/yaneuraou.k-p");
  const m = await Y();
  const e = new UsiEngine({ send: (l) => m.postMessage(l), onLine: (cb) => m.addMessageListener(cb) });
  await e.init({ Threads: 1, USI_Hash: 16, BookFile: "no_book", PvInterval: 0, MaxMovesToDraw: 0 });
  return e;
}

async function main() {
  const jobs: { a: number; b: number; aBlack: boolean; seed: number }[] = [];
  let seed = 1;
  if (ONLY) {
    for (let i = 0; i + 1 < ONLY.length; i++)
      for (let k = 0; k < GAMES_PER_PAIR; k++) jobs.push({ a: ONLY[i], b: ONLY[i + 1], aBlack: k % 2 === 0, seed: 10_000 + seed++ });
  } else {
    for (let a = 1; a <= MAX_LEVEL; a++)
      for (let d = 1; d <= MAX_GAP && a + d <= MAX_LEVEL; d++)
        for (let k = 0; k < GAMES_PER_PAIR; k++) jobs.push({ a, b: a + d, aBlack: k % 2 === 0, seed: seed++ });
  }
  console.log(`対局数 ${jobs.length}、並列 ${PARALLEL}`);
  const results: { a: number; b: number; scoreA: number; plies: number; reason: string }[] = [];
  const t0 = Date.now();
  let next = 0;
  const worker = async () => {
    const engines: [UsiEngine, UsiEngine] = [await newEngine(), await newEngine()];
    while (next < jobs.length) {
      const j = jobs[next++];
      const levels: [number, number] = j.aBlack ? [j.a, j.b] : [j.b, j.a];
      const r = await playLevelGame(engines, levels, mulberry32(j.seed));
      const aColor = j.aBlack ? 0 : 1;
      const scoreA = r.winner === null ? 0.5 : r.winner === aColor ? 1 : 0;
      results.push({ a: j.a, b: j.b, scoreA, plies: r.plies, reason: r.reason });
      if (results.length % 20 === 0) console.log(`${results.length}/${jobs.length} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  };
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  const elo = fitElo(MAX_LEVEL, results.map((r) => ({ a: r.a - 1, b: r.b - 1, scoreA: r.scoreA })));
  const table = elo.map((e, i) => {
    const lv = i + 1;
    const vsNext = results.filter((r) => r.a === lv && r.b === lv + 1);
    return { level: lv, elo: Math.round(e), scoreVsNext: vsNext.length ? vsNext.reduce((s, r) => s + r.scoreA, 0) / vsNext.length : null };
  });
  if (ONLY) {
    // 隣接ペアごとの勝率と95%信頼区間（正規近似）
    for (let i = 0; i + 1 < ONLY.length; i++) {
      const rs = results.filter((r) => r.a === ONLY[i] && r.b === ONLY[i + 1]);
      const n = rs.length, sc = rs.reduce((s, r) => s + r.scoreA, 0) / n;
      const ci = 1.96 * Math.sqrt((sc * (1 - sc)) / n);
      console.log(`Lv${ONLY[i]} 対 Lv${ONLY[i + 1]}: 下位の勝率 ${(sc * 100).toFixed(1)}% ±${(ci * 100).toFixed(1)}%（${n}局）`);
    }
  } else console.table(table);
  const avgPlies = results.reduce((s, r) => s + r.plies, 0) / results.length;
  console.log(`平均手数 ${avgPlies.toFixed(1)}、所要 ${((Date.now() - t0) / 1000).toFixed(0)}秒`);
  writeFileSync(OUT, JSON.stringify({ gamesPerPair: GAMES_PER_PAIR, table, results }, null, 1));
  process.exit(0);
}
main();
