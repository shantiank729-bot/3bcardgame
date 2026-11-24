// 使い方: npx vite-node scripts/tsume-check.ts -- [1手数あたりの問題数] [出力JSON(省略可)]
// 自動生成した詰将棋を、やねうら王で独立に確かめる。
// エンジンは通常の将棋のルール（王手以外の手も読む）なので手数の比較はできない。
// そこで「正解の初手を指した後、玉方が必ず詰まされる（エンジンも詰みを見つける）」ことを確かめる。
// エンジンの詰み手数は枝刈りのため最短とは限らない（長めに出ることがある）ので、手数は参考表示のみ。
// 手数ちょうど・正解が1つであることは src/tsume/solver.ts の厳密な探索で確かめている。
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mulberry32 } from "../src/engine/levels";
import { UsiEngine } from "../src/engine/usi";
import { TsumeProblem, generateTsume } from "../src/tsume/generate";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2).filter((a) => a !== "--");
const N = Number(args[0] ?? 10);
const OUT = args[1];
const LENGTHS = (args[2] ?? "1,3,5,7").split(",").map(Number);

async function main() {
  const m = await require("@mizarjp/yaneuraou.k-p")();
  const e = new UsiEngine({ send: (l) => m.postMessage(l), onLine: (cb) => m.addMessageListener(cb) });
  await e.init({ Threads: 1, USI_Hash: 64, BookFile: "no_book", PvInterval: 0 });
  const pool: TsumeProblem[] = [];
  let bad = 0;
  for (const len of LENGTHS) {
    const rng = mulberry32(1000 + len);
    let ok = 0, made = 0;
    const t0 = Date.now();
    const seen = new Set<string>();
    for (let i = 0; i < N * 3 && made < N; i++) {
      const pr = generateTsume(len, rng, 5000);
      if (!pr || seen.has(pr.id)) continue;
      seen.add(pr.id);
      made++;
      const r = await e.analyze({ position: `sfen ${pr.sfen} moves ${pr.solution[0]}`, nodes: 1_000_000 });
      const c = r.candidates[0];
      const mated = r.bestmove === "resign" || (c?.mate !== undefined && c.mate < 0);
      if (mated && c?.mate !== undefined && -c.mate > len - 1) console.log(`参考: ${len}手詰 ${pr.id} エンジンの詰み手数 ${-c.mate}（最短ではない）`);
      if (mated) { ok++; pool.push(pr); }
      else { bad++; console.log(`不一致 ${len}手: ${pr.sfen} 解=${pr.solution.join(" ")} エンジン=${r.bestmove} mate=${c?.mate}`); }
    }
    console.log(`${len}手詰: 生成 ${made}、エンジンで確認 ${ok}/${made}、1問あたり ${((Date.now() - t0) / Math.max(1, made) / 1000).toFixed(2)}秒`);
  }
  if (OUT) writeFileSync(OUT, JSON.stringify(pool) + "\n");
  process.exit(bad ? 1 : 0);
}
main();
