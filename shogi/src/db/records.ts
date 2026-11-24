// 対局記録とプロフィール（レーティング）
import type { GameResult } from "../core/game";
import type { Color } from "../core/types";
import type { PosEval } from "../analysis/classify";
import { Glicko, glicko2Update } from "../rating/glicko2";
import { AI_RD, INITIAL, MIN_RD, PLACEMENT_GAMES, PLACEMENT_MIN_RD, levelRating } from "../rating/rank";
import { get, getAll, put } from "./db";

export type GameMode = "rated" | "practice" | "human";

export interface GameRecord {
  id?: number;
  /** 対局開始時刻（ms） */
  date: number;
  mode: GameMode;
  startSfen: string;
  /** USI 形式の指し手 */
  moves: string[];
  /** 各手の消費時間（ms） */
  times: number[];
  /** 人が持った側（人どうしは null） */
  humanColor: Color | null;
  aiLevel: number | null;
  result: GameResult;
  names: [string, string];
  timePreset: string;
  /** レーティング対局のみ */
  rating?: { before: Glicko; after: Glicko; aiRating: number; placement: boolean };
  /** 対局後の解析。evals[k] は k 手指した後の局面の評価 */
  analysis?: { nodes: number; evals: (PosEval | null)[]; done: boolean };
}

export interface Profile {
  key: "profile";
  glicko: Glicko;
  ratedGames: number;
}

export async function loadProfile(): Promise<Profile> {
  return (await get<Profile>("kv", "profile")) ?? { key: "profile", glicko: { ...INITIAL }, ratedGames: 0 };
}

export async function saveProfile(p: Profile) { await put("kv", p); }

export const isPlacement = (p: Profile) => p.ratedGames < PLACEMENT_GAMES;

/** 人から見た得点（勝ち1、引き分け0.5、負け0） */
export function humanScore(result: GameResult, human: Color): number {
  return result.winner === null ? 0.5 : result.winner === human ? 1 : 0;
}

/** レーティング対局の結果をプロフィールに反映した新しいプロフィールを返す */
export function applyRatedGame(p: Profile, aiLevel: number, score: number): { profile: Profile; before: Glicko; after: Glicko; aiRating: number; placement: boolean } {
  const placement = isPlacement(p);
  const before = { ...p.glicko };
  const start = { ...before, rd: Math.max(before.rd, placement ? PLACEMENT_MIN_RD : MIN_RD) };
  const aiRating = levelRating(aiLevel);
  const upd = glicko2Update(start, [{ opponent: { rating: aiRating, rd: AI_RD }, score }]);
  const after = { rating: Math.round(upd.rating * 10) / 10, rd: Math.max(MIN_RD, upd.rd), vol: upd.vol };
  return { profile: { key: "profile", glicko: after, ratedGames: p.ratedGames + 1 }, before, after, aiRating, placement };
}

export async function saveGame(g: GameRecord): Promise<number> {
  return (await put("games", g)) as number;
}

export async function loadGames(): Promise<GameRecord[]> {
  const all = await getAll<GameRecord>("games");
  return all.sort((a, b) => a.date - b.date);
}

export async function loadGame(id: number): Promise<GameRecord | undefined> {
  return get<GameRecord>("games", id);
}
