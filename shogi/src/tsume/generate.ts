// 詰将棋の自動生成。ランダムな終盤の形を作り、詰み探索で「ちょうど N 手・正解が1つ」を確かめる。
// 生成した問題は余分な駒を取り除いて、すっきりした形にする。
// ルール: 攻め方は先手。玉方（後手）の持ち駒はなし（無駄合いの問題を避けるため）。
import { Position } from "../core/position";
import { BLACK, FU, GI, HI, KA, KE, KI, KY, OU, WHITE, hasMoveFrom, makePiece, pieceColor, pieceType } from "../core/types";
import { Rng } from "../engine/levels";
import { checkTsume } from "./solver";

export interface TsumeProblem {
  id: string;
  sfen: string;
  length: number;
  solution: string[];
  source: "random" | "game";
}

const ATTACK_HAND = [HI, KA, KI, KI, GI, GI, KE, KY, FU];
const ATTACK_BOARD = [HI, KA, KI, GI, GI, KE, KY, FU, 13, 14, 9]; // 13=馬, 14=龍, 9=と
const DEFEND = [KI, GI, FU, KY, KE, KI, GI];

const pick = <T>(rng: Rng, xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
const sq = (x: number, y: number) => y * 9 + x;

/** ランダムな詰将棋の候補局面（SFEN）を1つ作る */
export function randomCandidate(rng: Rng, size: number): string | null {
  const p = new Position();
  // 玉は1〜3段目、端に寄りやすく
  const kx = rng() < 0.5 ? pick(rng, [0, 1, 7, 8]) : Math.floor(rng() * 9);
  const ky = rng() < 0.6 ? 0 : rng() < 0.7 ? 1 : 2;
  p.board[sq(kx, ky)] = makePiece(OU, WHITE);
  const near = (r: number): number | null => {
    for (let t = 0; t < 20; t++) {
      const x = kx + Math.floor(rng() * (2 * r + 1)) - r, y = ky + Math.floor(rng() * (2 * r + 1)) - r;
      if (x < 0 || x > 8 || y < 0 || y > 8 || p.board[sq(x, y)]) continue;
      return sq(x, y);
    }
    return null;
  };
  const nDef = Math.floor(rng() * (size + 1));
  for (let i = 0; i < nDef; i++) {
    const s = near(2); if (s === null) continue;
    const t = pick(rng, DEFEND);
    if (!hasMoveFrom(t, s, WHITE)) continue;
    p.board[s] = makePiece(t, WHITE);
  }
  const nAtt = 1 + Math.floor(rng() * size);
  for (let i = 0; i < nAtt; i++) {
    const s = near(3); if (s === null) continue;
    const t = pick(rng, ATTACK_BOARD);
    if (!hasMoveFrom(t, s, BLACK)) continue;
    p.board[s] = makePiece(t, BLACK);
  }
  const nHand = 1 + Math.floor(rng() * Math.min(3, size));
  for (let i = 0; i < nHand; i++) p.hands[BLACK][pick(rng, ATTACK_HAND)]++;
  // 二歩を避ける
  for (const c of [BLACK, WHITE]) {
    const files = new Set<number>();
    for (let s = 0; s < 81; s++) {
      const pc = p.board[s];
      if (pc && pieceColor(pc) === c && pieceType(pc) === FU) {
        if (files.has(s % 9)) p.board[s] = 0; else files.add(s % 9);
      }
    }
  }
  if (p.hands[BLACK][FU] && [...Array(9).keys()].every(() => false)) return null;
  const sfen = Position.fromSfen(p.sfen(false).replace(/ [bw] /, " b ") + " 1").sfen();
  const q = Position.fromSfen(sfen);
  if (q.inCheck(WHITE)) return null; // 初形で王手はなし
  // 持ち駒の歩を打つ筋に自分の歩があっても良いが、打ち場所が全くない局面は除く
  return sfen;
}

/** 解に影響しない攻め方の駒・持ち駒を取り除く */
export function simplify(sfen: string, length: number): { sfen: string; solution: string[] } | null {
  let cur = checkTsume(sfen, length);
  if (!cur.ok) return null;
  let best = { sfen, solution: cur.solution! };
  let changed = true;
  while (changed) {
    changed = false;
    const p = Position.fromSfen(best.sfen);
    const tries: string[] = [];
    for (let s = 0; s < 81; s++) {
      const pc = p.board[s];
      if (!pc || pieceType(pc) === OU) continue;
      const q = p.clone(); q.board[s] = 0;
      tries.push(Position.fromSfen(q.sfen()).sfen());
    }
    for (const c of [BLACK, WHITE]) for (let t = 1; t <= 7; t++) {
      if (!p.hands[c][t]) continue;
      const q = p.clone(); q.hands[c][t]--;
      tries.push(Position.fromSfen(q.sfen()).sfen());
    }
    for (const t of tries) {
      cur = checkTsume(t, length, 500_000);
      if (cur.ok) { best = { sfen: t, solution: cur.solution! }; changed = true; break; }
    }
  }
  return best;
}

/** 指定手数の問題を1問作る（attempts 回まで試す） */
export function generateTsume(length: number, rng: Rng, attempts = 400): TsumeProblem | null {
  const size = length <= 1 ? 2 : length <= 3 ? 3 : 4;
  for (let i = 0; i < attempts; i++) {
    const cand = randomCandidate(rng, size);
    if (!cand) continue;
    const r = checkTsume(cand, length, length <= 3 ? 300_000 : 1_000_000);
    if (!r.ok) continue;
    const s = simplify(cand, length);
    if (!s) continue;
    return { id: s.sfen.split(" ").slice(0, 3).join("_"), sfen: s.sfen, length, solution: s.solution, source: "random" };
  }
  return null;
}
