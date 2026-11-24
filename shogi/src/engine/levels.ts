// AI の強さのレベルと、候補手から指し手を選ぶ処理（純粋関数なのでテストできる）
import { Position } from "../core/position";
import { Color, Move, OU, opponent, pieceColor, pieceType } from "../core/types";
import { usiToMove } from "../core/usi";
import { Candidate, MATE_SCORE } from "./usi";

export interface LevelParams {
  level: number;
  /** 探索ノード数 */
  nodes: number;
  /** 候補手の数 */
  multipv: number;
  /** ふだんの手を選ぶときの温度（センチポーン）。小さいほど最善手に集中 */
  temperature: number;
  /** 1手ごとに「ミス」をする確率 */
  mistakeRate: number;
  /** ミスのときに選びうる最大の損（センチポーン） */
  maxLoss: number;
  /** 中盤以降に「ただで駒を取られる手」を避ける確率（序盤は常に避ける） */
  avoidHangProb: number;
}

export const MAX_LEVEL = 30;

const geo = (a: number, b: number, f: number) => a * Math.pow(b / a, f);

/** レベル 1〜30 の設定。自己対局（scripts/calibrate.ts）で強さの順を確かめている */
export function levelParams(level: number): LevelParams {
  const L = Math.min(MAX_LEVEL, Math.max(1, Math.round(level)));
  const f = (L - 1) / (MAX_LEVEL - 1); // 0..1
  return {
    level: L,
    nodes: Math.round(geo(4_000, 150_000, f)),
    multipv: L <= 15 ? 12 : 8,
    temperature: Math.round(geo(50, 10, f)),
    mistakeRate: Number(geo(0.6, 0.01, f).toFixed(3)),
    maxLoss: Math.round(geo(2000, 150, f)),
    avoidHangProb: 0.35 + 0.65 * f,
  };
}

const VALUE = [0, 1, 3, 3, 5, 6, 8, 10, 0, 6, 6, 6, 6, 10, 12];

/** 駒の価値（歩=1） */
export const pieceValue = (t: number) => VALUE[t];

/**
 * 「ただで取られる駒」の最大価値（c 側の駒について）。
 * 相手の利きがあり、かつ（自分の利きがない、または取る駒の方が安い）駒を「当たり」とみなす。
 */
export function hangingValue(pos: Position, c: Color): number {
  let worst = 0;
  const them = opponent(c);
  for (let sq = 0; sq < 81; sq++) {
    const pc = pos.board[sq];
    if (!pc || pieceColor(pc) !== c) continue;
    const t = pieceType(pc);
    if (t === OU) continue;
    const att = pos.attackers(sq, them);
    if (!att.length) continue;
    const v = VALUE[t];
    const defended = pos.attackers(sq, c).length > 0;
    const cheapest = Math.min(...att.map((s) => (pieceType(pos.board[s]) === OU ? 99 : VALUE[pieceType(pos.board[s])])));
    if (cheapest === 99 && defended) continue; // 玉しか利いていなければ、ひもが付いていれば取れない
    const loss = defended ? Math.max(0, v - cheapest) : v;
    worst = Math.max(worst, loss);
  }
  return worst;
}

/** その手で新たに駒をただで取られる形になるか（銀以上の価値） */
export function hangsPiece(pos: Position, m: Move): boolean {
  const us = pos.turn;
  const before = hangingValue(pos, us);
  const captured = m.from >= 0 && pos.board[m.to] ? VALUE[pieceType(pos.board[m.to])] : 0;
  pos.doMove(m);
  const check = pos.inCheck();
  const after = hangingValue(pos, us);
  pos.undoMove();
  if (check) return false; // 王手は相手に取る余裕がないことが多い
  return after >= 5 && after > before && after - captured >= 3;
}

/** 0..1 の乱数 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 候補手からレベルに応じて1手選ぶ。
 * - ふだんは評価値の差に応じたソフトマックス（小さい温度）で自然な手を選ぶ
 * - mistakeRate の確率で「ミス」をして、最善より100点以上悪い手（maxLoss まで）を選ぶ
 * - 序盤は駒をただで捨てる手を選ばない（中盤以降は確率で避ける）
 */
export function chooseMove(pos: Position, cands: Candidate[], p: LevelParams, rng: Rng): Candidate {
  if (!cands.length) throw new Error("候補手がありません");
  const sorted = [...cands].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  // 詰みを読み切っている場合は迷わない（弱いレベルは見落とすこともある）
  if (best.score >= MATE_SCORE - 100 && rng() < 0.5 + p.level / MAX_LEVEL) return best;
  const clamp = (s: number) => Math.max(-3000, Math.min(3000, s));
  const loss = (c: Candidate) => clamp(best.score) - clamp(c.score);
  const opening = pos.ply <= 40;
  const avoidHang = opening || rng() < p.avoidHangProb;
  const notHanging = (list: Candidate[]) => {
    if (!avoidHang) return list;
    const safe = list.filter((c) => c === best || !hangsPiece(pos, usiToMove(c.move)));
    return safe.length ? safe : list;
  };
  if (rng() < p.mistakeRate) {
    const bad = notHanging(sorted.filter((c) => loss(c) >= 100 && loss(c) <= p.maxLoss)).filter((c) => c !== best);
    if (bad.length) return bad[Math.floor(rng() * bad.length)];
  }
  const pool = notHanging(sorted.filter((c) => loss(c) < 300));
  // 序盤は少しばらつかせて毎局同じ将棋にならないようにする
  const T = Math.max(p.temperature, pos.ply <= 16 ? 25 : 1);
  const w = pool.map((c) => Math.exp(-loss(c) / T));
  const sum = w.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= w[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** AI が投了すべきか（読み切りで負け、または大差が続く） */
export function shouldResign(history: number[]): boolean {
  const n = history.length;
  if (!n) return false;
  if (history[n - 1] <= -(MATE_SCORE - 100)) return true;
  return n >= 3 && history.slice(-3).every((s) => s <= -3000);
}

