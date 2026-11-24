import { Rng } from '../engine/rng';
import { addDays, openingDay } from './calendar';
import type { LeagueId, TeamInfo } from './teams';

export interface ScheduledGame {
  id: number;
  date: string;
  away: number;
  home: number;
  /** L=リーグ戦, I=交流戦 */
  kind: 'L' | 'I';
}

export interface SeasonCalendar {
  year: number;
  opening: string;
  games: ScheduledGame[];
  interleague: { start: string; end: string };
  allStar: string[];
  lastDay: string;
}

/** 6チームの総当たり（サークル方式）: 5ラウンド×3カード */
function roundRobin6(ids: number[], rot: number): [number, number][][] {
  const rounds: [number, number][][] = [];
  const arr = [...ids];
  // 回転開始位置をずらしてカード順を毎回変える
  for (let k = 0; k < rot % 5; k++) arr.splice(1, 0, arr.pop()!);
  for (let r = 0; r < 5; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < 3; i++) pairs.push([arr[i], arr[5 - i]]);
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

/**
 * NPBらしい日程を作る
 * - 3連戦単位（火〜木、金〜日）、月曜は休み
 * - 同一リーグ: 各球団と25試合（3連戦×7 + 2連戦×2）
 * - 交流戦: 5月下旬〜6月、相手リーグ6球団と3試合ずつ（ホームは年ごとに交互）
 * - オールスター休み（7月中旬〜下旬）
 */
export function buildSchedule(teams: TeamInfo[], year: number, seed = year): SeasonCalendar {
  const rng = new Rng(seed);
  const byLeague = (l: LeagueId) => teams.filter((t) => t.league === l).map((t) => t.id);
  const C = byLeague('C');
  const P = byLeague('P');

  type Round = { pairs: { a: number; h: number }[]; len: 2 | 3; kind: 'L' | 'I' };
  const intra: Round[] = [];
  // ペアごとのホーム回数を管理し、交互に
  const homeCount = new Map<string, number>();
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  for (let cycle = 0; cycle < 9; cycle++) {
    const len: 2 | 3 = cycle === 2 || cycle === 6 ? 2 : 3;
    const rc = roundRobin6(C, cycle + rng.int(0, 4));
    const rp = roundRobin6(P, cycle + rng.int(0, 4));
    for (let r = 0; r < 5; r++) {
      const pairs: { a: number; h: number }[] = [];
      for (const [x, y] of [...rc[r], ...rp[r]]) {
        const k = key(x, y);
        const n = homeCount.get(k) ?? 0;
        homeCount.set(k, n + 1);
        const lo = Math.min(x, y);
        const hi = Math.max(x, y);
        const loHome = (n + year + lo + hi) % 2 === 0;
        pairs.push(loHome ? { a: hi, h: lo } : { a: lo, h: hi });
      }
      intra.push({ pairs, len, kind: 'L' });
    }
  }
  const inter: Round[] = [];
  for (let r = 0; r < 6; r++) {
    const pairs: { a: number; h: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const j = (i + r) % 6;
      const ceHome = (i + j + year) % 2 === 0;
      pairs.push(ceHome ? { a: P[j], h: C[i] } : { a: C[i], h: P[j] });
    }
    inter.push({ pairs, len: 3, kind: 'I' });
  }

  // スロット（3日単位）に並べる: null は休みスロット
  const slots: (Round | 'off' | 'allstar')[] = [];
  slots.push(...intra.slice(0, 17));
  slots.push(...inter);
  slots.push('off'); // 交流戦明けの調整
  slots.push(...intra.slice(17, 25));
  slots.push('off', 'allstar'); // オールスター休み
  slots.push(...intra.slice(25));

  const opening = openingDay(year);
  const games: ScheduledGame[] = [];
  let id = 1;
  let date = opening; // 金曜開始
  let interStart = '';
  let interEnd = '';
  let allStar: string[] = [];
  void rng;
  let first = true;
  for (const slot of slots) {
    // スロット開始日: 金曜 or 火曜
    if (!first) {
      // 次のスロットへ: 金→翌火(+4), 火→金(+3)
      date = new Date(date + 'T00:00:00Z').getUTCDay() === 5 ? addDays(date, 4) : addDays(date, 3);
    }
    first = false;
    if (slot === 'off') continue;
    if (slot === 'allstar') {
      // 火曜開始のスロット: 水・木にオールスター2試合
      allStar = [addDays(date, 1), addDays(date, 2)];
      continue;
    }
    if (slot.kind === 'I' && !interStart) interStart = date;
    for (let d = 0; d < slot.len; d++) {
      const day = addDays(date, d);
      for (const p of slot.pairs) games.push({ id: id++, date: day, away: p.a, home: p.h, kind: slot.kind });
      if (slot.kind === 'I') interEnd = day;
    }
  }
  return { year, opening, games, interleague: { start: interStart, end: interEnd }, allStar, lastDay: games[games.length - 1].date };
}
