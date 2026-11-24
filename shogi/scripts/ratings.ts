// 使い方: npx vite-node scripts/ratings.ts -- calibration.json
// 較正結果（Elo）を直線で近似して src/engine/level-ratings.json に保存する。
// 隣どうしの対局数は少なく誤差が大きいので、全体の傾き（1レベルあたりの Elo 差）を最小二乗で求める。
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv.slice(2).filter((a) => a !== "--")[0];
const d = JSON.parse(readFileSync(file, "utf8"));
const raw: number[] = d.table.map((t: { elo: number }) => t.elo);
let sxy = 0, sxx = 0;
raw.forEach((y, i) => { sxy += i * y; sxx += i * i; });
const slope = sxy / sxx;
const smooth = raw.map((_, i) => Math.round(slope * i));
const resid = Math.sqrt(raw.reduce((s, y, i) => s + (y - slope * i) ** 2, 0) / raw.length);
console.log(`1レベルあたり ${slope.toFixed(1)} Elo、残差 ${resid.toFixed(0)}`);
writeFileSync(new URL("../src/engine/level-ratings.json", import.meta.url), JSON.stringify({
  note: "scripts/calibrate.ts の自己対局から推定した Elo（レベル1=0）。elo は直線近似した値",
  eloPerLevel: Math.round(slope * 10) / 10,
  games: d.results.length,
  eloRaw: raw,
  elo: smooth,
}, null, 1) + "\n");
console.log(smooth.join(" "));
