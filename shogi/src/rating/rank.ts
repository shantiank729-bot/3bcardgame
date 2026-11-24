// 段級位、AI レベルのレーティング、次の対局レベルの決め方
import levelData from "../engine/level-ratings.json";
import { MAX_LEVEL } from "../engine/levels";
import { Glicko, expectedScore } from "./glicko2";

/** 初期値（8級相当）。棋力判定中は RD を大きくして早く実力に合わせる */
export const INITIAL: Glicko = { rating: 750, rd: 350, vol: 0.06 };
/** 最初の何局を「棋力判定」とするか */
export const PLACEMENT_GAMES = 5;
/** 判定後も変動が止まらないよう RD の下限を設ける */
export const MIN_RD = 60;
/** 棋力判定中の RD の下限（変動を大きく保つ） */
export const PLACEMENT_MIN_RD = 200;
/** AI のレーティングの不確かさ（固定） */
export const AI_RD = 40;

const KANJI = ["", "初", "二", "三", "四", "五", "六", "七", "八", "九"];

export interface Rank { kind: "kyu" | "dan"; n: number; label: string; floor: number; next: number | null }

/** 15級=0〜99、…、1級=1400〜1499、初段=1500〜、以降150点ごとに昇段（八段まで） */
export function rankOf(rating: number): Rank {
  if (rating < 1500) {
    const n = Math.min(15, Math.max(1, 15 - Math.floor(Math.max(0, rating) / 100)));
    const floor = (15 - n) * 100;
    return { kind: "kyu", n, label: `${n}級`, floor: n === 15 ? -Infinity : floor, next: floor + 100 };
  }
  const n = Math.min(8, 1 + Math.floor((rating - 1500) / 150));
  const floor = 1500 + (n - 1) * 150;
  return { kind: "dan", n, label: `${KANJI[n]}段`, floor, next: n === 8 ? null : floor + 150 };
}

/** 段級位の比較用の数値（大きいほど上） */
export const rankValue = (r: Rank) => (r.kind === "kyu" ? 15 - r.n : 14 + r.n);

/** 自己対局の Elo を人間の目盛りに。レベル1≒15級(50)、レベル30≒六段(2300) */
const ELO: number[] = levelData.elo;
const K = (2300 - 50) / ELO[ELO.length - 1];
export function levelRating(level: number): number {
  const L = Math.min(MAX_LEVEL, Math.max(1, level));
  return Math.round(50 + ELO[L - 1] * K);
}

/** 期待勝率が50%に一番近いレベル */
export function chooseLevel(p: { rating: number; rd: number }): number {
  let best = 1, bestDiff = Infinity;
  for (let L = 1; L <= MAX_LEVEL; L++) {
    const d = Math.abs(expectedScore(p, { rating: levelRating(L), rd: AI_RD }) - 0.5);
    if (d < bestDiff) { bestDiff = d; best = L; }
  }
  return best;
}
