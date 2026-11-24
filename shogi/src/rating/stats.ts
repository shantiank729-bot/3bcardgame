// 成長記録の集計（純粋関数）
import type { GameRecord } from "../db/records";
import { humanScore } from "../db/records";
import { rankOf, rankValue } from "./rank";

export interface RankEvent { date: number; label: string; up: boolean; rating: number }

export interface Stats {
  rated: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
  currentStreak: number;
  bestStreak: number;
  series: { date: number; rating: number; gameId?: number }[];
  rankHistory: RankEvent[];
}

/** レーティング対局（日付順）から統計を作る */
export function computeStats(games: GameRecord[]): Stats {
  const rated = games.filter((g) => g.mode === "rated" && g.rating && g.humanColor !== null).sort((a, b) => a.date - b.date);
  let wins = 0, losses = 0, draws = 0, cur = 0, best = 0;
  const series: Stats["series"] = [];
  const rankHistory: RankEvent[] = [];
  if (rated.length) series.push({ date: rated[0].date, rating: rated[0].rating!.before.rating });
  for (const g of rated) {
    const s = humanScore(g.result, g.humanColor!);
    if (s === 1) { wins++; cur++; best = Math.max(best, cur); }
    else { if (s === 0) losses++; else draws++; cur = 0; }
    const before = rankOf(g.rating!.before.rating), after = rankOf(g.rating!.after.rating);
    if (rankValue(after) !== rankValue(before)) {
      rankHistory.push({ date: g.date, label: after.label, up: rankValue(after) > rankValue(before), rating: g.rating!.after.rating });
    }
    series.push({ date: g.date, rating: g.rating!.after.rating, gameId: g.id });
  }
  const decided = wins + losses + draws;
  return { rated: rated.length, wins, losses, draws, winRate: decided ? (wins + draws / 2) / decided : null, currentStreak: cur, bestStreak: best, series, rankHistory };
}
