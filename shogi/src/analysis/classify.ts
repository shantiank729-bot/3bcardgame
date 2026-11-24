// 解析結果から各手の評価（悪手・疑問手・好手）を付ける。純粋関数。
import { MATE_SCORE } from "../engine/usi";

export interface PosEval {
  /** 手番側から見た評価値（cp。詰みは ±(30000-手数)） */
  score: number;
  /** 最善手（USI）。終局局面では空 */
  best: string;
  pv: string[];
  /** 2番目の候補の評価値（好手の判定用） */
  second?: number;
}

export type MoveMark = "bad" | "dubious" | "good" | null;
export const MARK_LABEL: Record<Exclude<MoveMark, null>, string> = { bad: "悪手", dubious: "疑問手", good: "好手" };
export const MARK_SYMBOL: Record<Exclude<MoveMark, null>, string> = { bad: "✕", dubious: "？", good: "！" };

/** 評価値 → 手番側の勝率（やねうら王系でよく使う係数 600） */
export function winProb(cp: number): number {
  if (cp >= MATE_SCORE - 1000) return 1;
  if (cp <= -(MATE_SCORE - 1000)) return 0;
  return 1 / (1 + Math.exp(-cp / 600));
}

export interface MoveJudge {
  /** 指した側から見た、指す前と後の勝率 */
  before: number;
  after: number;
  /** 勝率の下がり幅（0..1） */
  drop: number;
  mark: MoveMark;
}

export const THRESHOLDS = { bad: 0.2, dubious: 0.1, good: 0.12 };

/**
 * i 手目（1始まり）の評価。evals[k] は k 手指した後の局面の評価（手番側視点）。
 */
export function judgeMove(evals: (PosEval | null)[], i: number, played: string): MoveJudge | null {
  const pre = evals[i - 1], post = evals[i];
  if (!pre || !post) return null;
  const before = winProb(pre.score);
  const after = 1 - winProb(post.score);
  const isBest = played === pre.best;
  const drop = isBest ? 0 : Math.max(0, before - after);
  let mark: MoveMark = null;
  // 勝負が決まっている局面での上下は印を付けない
  const decided = (before > 0.97 && after > 0.9) || before < 0.03;
  if (!decided) {
    if (drop >= THRESHOLDS.bad) mark = "bad";
    else if (drop >= THRESHOLDS.dubious) mark = "dubious";
    else if (isBest && pre.second !== undefined && before - winProb(pre.second) >= THRESHOLDS.good) mark = "good";
  }
  return { before, after, drop, mark };
}

/** k 手指した後の局面の評価を先手から見た値に（グラフ用） */
export function blackScore(evals: (PosEval | null)[], k: number, startTurn: 0 | 1): number | null {
  const e = evals[k];
  if (!e) return null;
  const turn = (startTurn + k) % 2;
  return turn === 0 ? e.score : -e.score;
}
