// レベル同士の自己対局（較正・テスト用）。エンジンとのやりとりは UsiEngine 経由なので環境に依存しない。
import { Game } from "../core/game";
import { Color } from "../core/types";
import { toUsiPosition, usiToMove } from "../core/usi";
import { Rng, chooseMove, levelParams, shouldResign } from "./levels";
import { UsiEngine } from "./usi";

export interface SelfplayResult { winner: Color | null; plies: number; reason: string }

export async function playLevelGame(
  engines: [UsiEngine, UsiEngine], levels: [number, number], rng: Rng, maxPly = 256,
): Promise<SelfplayResult> {
  const g = new Game();
  g.maxPly = maxPly;
  const evals: [number[], number[]] = [[], []];
  while (!g.result) {
    const c = g.turn;
    const p = levelParams(levels[c]);
    const pos = toUsiPosition(g.startSfen, g.moves).replace(/^position /, "");
    const r = await engines[c].analyze({ position: pos, multipv: p.multipv, nodes: p.nodes });
    if (!r.candidates.length || r.bestmove === "resign") { g.resign(c); break; }
    if (r.bestmove === "win") { g.declare(); break; }
    evals[c].push(r.candidates[0].score);
    if (shouldResign(evals[c])) { g.resign(c); break; }
    const choice = chooseMove(g.pos, r.candidates, p, rng);
    if (!g.play(usiToMove(choice.move))) throw new Error(`エンジンが反則手: ${choice.move} @ ${pos}`);
  }
  return { winner: g.result!.winner, plies: g.ply, reason: g.result!.reason };
}

/** 勝敗表から Bradley-Terry（Elo）でレーティングを推定。引き分けは0.5勝。 */
export function fitElo(n: number, games: { a: number; b: number; scoreA: number }[], prior = 1): number[] {
  const r = new Array(n).fill(0);
  const data = [...games];
  // 隣どうしの仮想引き分けで発散を防ぐ（弱い事前分布）
  for (let i = 0; i + 1 < n; i++) for (let k = 0; k < prior; k++) data.push({ a: i, b: i + 1, scoreA: 0.5 });
  const lr = 20;
  for (let it = 0; it < 4000; it++) {
    const grad = new Array(n).fill(0);
    for (const g of data) {
      const e = 1 / (1 + Math.pow(10, (r[g.b] - r[g.a]) / 400));
      grad[g.a] += g.scoreA - e;
      grad[g.b] -= g.scoreA - e;
    }
    let maxStep = 0;
    for (let i = 1; i < n; i++) { const s = lr * grad[i]; r[i] += s; maxStep = Math.max(maxStep, Math.abs(s)); }
    if (maxStep < 0.01) break;
  }
  return r;
}
