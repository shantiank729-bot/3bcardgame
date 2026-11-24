/** トーナメント（勝ち抜き）とリーグ戦 */
import { Rng } from '../engine/rng';
import type { GameResult } from '../engine/game';
import type { AmStage, TGame, Tourney } from './types';

/** 2のべき乗の枠に並べ、空き（不戦勝）を散らして配置 */
function slots(rng: Rng, entrants: number[], seeded: number[] = []): number[] {
  let size = 1;
  while (size < entrants.length) size *= 2;
  const teams = [...entrants].sort(() => rng.next() - 0.5);
  // シード校は空き枠の隣へ
  for (const s of seeded) {
    const i = teams.indexOf(s);
    if (i >= 0) { teams.splice(i, 1); teams.unshift(s); }
  }
  const byes = size - teams.length;
  const out: number[] = new Array(size).fill(0);
  // 空きは奇数番目に均等に
  const byePos = new Set<number>();
  for (let i = 0; i < byes; i++) byePos.add(Math.floor((i * size) / byes) | 1);
  let k = 0;
  for (let i = 0; i < size; i++) if (!byePos.has(i)) out[i] = teams[k++] ?? 0;
  return out;
}

export function makeKnockout(rng: Rng, id: string, name: string, short: string, stage: AmStage, level: Tourney['level'], year: number, entrants: number[], roundDates: string[][], area?: string, seeded?: number[]): Tourney {
  const first = slots(rng, entrants, seeded);
  const rounds = Math.round(Math.log2(first.length));
  const t: Tourney = {
    id, name, short, stage, level, year, area, entrants, games: [], rounds, reached: {}, done: false,
    bracket: [first], roundDates, leaders: level === 'national' ? {} : undefined,
  };
  for (const e of entrants) t.reached[e] = 0;
  buildRound(t, 0);
  return t;
}

/** 回戦 r の試合を組む（不戦勝は自動で勝ち上がり） */
function buildRound(t: Tourney, r: number) {
  const b = t.bracket![r];
  if (b.length === 1) {
    t.champion = b[0];
    t.done = true;
    return;
  }
  const next: number[] = [];
  const dates = t.roundDates![Math.min(r, t.roundDates!.length - 1)];
  let gi = 0;
  for (let i = 0; i < b.length; i += 2) {
    const a = b[i], c = b[i + 1];
    if (!a || !c) {
      next.push(a || c);
      continue;
    }
    t.games.push({ a, b: c, date: dates[gi++ % dates.length], round: r + 1 });
    next.push(-1); // 勝者待ち
  }
  t.bracket!.push(next);
  if (!next.includes(-1)) buildRound(t, r + 1);
}

export type PlayFn = (a: number, b: number, date: string, g: TGame) => { res: GameResult; aWins: boolean; hero: number | null };

/** その日の試合を行う */
export function playTourneyDay(t: Tourney, date: string, play: PlayFn): TGame[] {
  if (t.done) return [];
  const todays = t.games.filter((g) => g.date === date && g.winner === undefined);
  for (const g of todays) {
    const { res, aWins, hero } = play(g.a, g.b, date, g);
    g.winner = aWins ? g.a : g.b;
    g.score = [res.awayRuns, res.homeRuns];
    g.innings = res.innings;
    g.hero = hero ?? undefined;
    const loser = aWins ? g.b : g.a;
    t.reached[g.winner] = g.round;
    t.reached[loser] = g.round - 1;
    // 勝者をブラケットに入れる
    const r = g.round - 1;
    const b = t.bracket![r];
    const idx = Math.floor(Math.max(b.indexOf(g.a), b.indexOf(g.b)) / 2);
    t.bracket![r + 1][idx] = g.winner;
    if (g.round === t.rounds) {
      t.champion = g.winner;
      t.runnerUp = loser;
      t.done = true;
    }
  }
  // 回戦が終わったら次を組む
  const last = t.bracket!.length - 1;
  if (!t.done && !t.bracket![last].includes(-1)) buildRound(t, last);
  return todays;
}

/** 未消化の試合がある最後の日（日程確認用） */
export function nextDate(t: Tourney): string | null {
  const g = t.games.filter((x) => x.winner === undefined).map((x) => x.date).sort()[0];
  return g ?? null;
}

/** リーグ戦（各校と2試合） */
export function makeLeague(id: string, name: string, short: string, year: number, teams: number[], dates: string[]): Tourney {
  const games: TGame[] = [];
  const arr = [...teams];
  if (arr.length % 2) arr.push(0);
  const n = arr.length;
  let di = 0;
  for (let leg = 0; leg < 2; leg++) {
    const rot = [...arr];
    for (let r = 0; r < n - 1; r++) {
      for (let i = 0; i < n / 2; i++) {
        const a = rot[i], b = rot[n - 1 - i];
        if (a && b) games.push({ a: leg ? b : a, b: leg ? a : b, date: dates[di % dates.length], round: r + 1 });
      }
      di++;
      rot.splice(1, 0, rot.pop()!);
    }
  }
  const table: Record<number, [number, number, number]> = {};
  for (const t of teams) table[t] = [0, 0, 0];
  return { id, name, short, stage: 'UNI', level: 'league', year, entrants: teams, games, rounds: 0, reached: {}, done: false, table };
}

export function playLeagueDay(t: Tourney, date: string, play: PlayFn): TGame[] {
  if (t.done) return [];
  const todays = t.games.filter((g) => g.date === date && g.winner === undefined);
  for (const g of todays) {
    const { res, aWins, hero } = play(g.a, g.b, date, g);
    const tie = res.awayRuns === res.homeRuns;
    g.winner = tie ? 0 : aWins ? g.a : g.b;
    g.score = [res.awayRuns, res.homeRuns];
    g.hero = hero ?? undefined;
    const T = t.table!;
    if (tie) { T[g.a][2]++; T[g.b][2]++; }
    else { T[g.winner][0]++; T[aWins ? g.b : g.a][1]++; }
  }
  if (t.games.every((g) => g.winner !== undefined)) {
    t.done = true;
    const st = leagueStandings(t);
    t.champion = st[0][0];
    t.runnerUp = st[1]?.[0];
  }
  return todays;
}

export function leagueStandings(t: Tourney): [number, number, number, number][] {
  return Object.entries(t.table!).map(([k, [w, l, d]]) => [Number(k), w, l, d] as [number, number, number, number])
    .sort((a, b) => b[1] / Math.max(1, b[1] + b[2]) - a[1] / Math.max(1, a[1] + a[2]) || b[1] - a[1]);
}
