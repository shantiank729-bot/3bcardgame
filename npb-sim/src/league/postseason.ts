/**
 * ポストシーズン（NPB方式）
 * - CSファーストステージ: 2位 vs 3位、3試合制、全試合2位の本拠地。2勝で勝ち抜け。勝数が並べば2位が勝ち抜け
 * - CSファイナルステージ: 1位 vs 勝者、6試合制、1位に1勝のアドバンテージ。4勝で勝ち抜け。並べば1位
 * - 日本シリーズ: 4勝先取、第1・2・6・7戦は年ごとに交互の球団の本拠地。引き分けがあれば第8戦以降
 */
import { addDays, weekday } from './calendar';
import { computeStandings } from './standings';
import type { LeagueId } from './teams';
import type { GameKind, World } from './world';

export interface SeriesGame {
  id: number;
  no: number;
  date: string;
  home: number;
  away: number;
  played: boolean;
}

export interface Series {
  id: 'C1' | 'C2' | 'P1' | 'P2' | 'JS';
  kind: Extract<GameKind, 'CS1' | 'CS2' | 'JS'>;
  league: LeagueId | null;
  name: string;
  /** 上位（アドバンテージ側）、未定なら0 */
  high: number;
  low: number;
  need: number;
  advantage: number;
  wins: [number, number]; // [high, low]（アドバンテージ込み）
  ties: number;
  games: SeriesGame[];
  winner: number | null;
  status: 'waiting' | 'active' | 'done';
}

export interface PostseasonState {
  year: number;
  seeds: Record<LeagueId, number[]>;
  series: Series[];
  champion: number | null;
  nextGameId: number;
  /** ドラフト会議の日（CSと日本シリーズの間） */
  draftDate?: string;
}

function firstWeekdayOnOrAfter(d: string, wd: number) {
  while (weekday(d) !== wd) d = addDays(d, 1);
  return d;
}

export function setupPostseason(w: World): PostseasonState {
  const seeds = {
    C: computeStandings(w, 'C').slice(0, 3).map((r) => r.tid),
    P: computeStandings(w, 'P').slice(0, 3).map((r) => r.tid),
  };
  const start1 = firstWeekdayOnOrAfter(addDays(w.calendar.lastDay, 3), 6); // 土曜
  const start2 = addDays(start1, 4); // 水曜
  let id = 200000 + (w.year % 100) * 100;
  const series: Series[] = [];
  for (const lg of ['C', 'P'] as const) {
    const [s1, s2, s3] = seeds[lg];
    series.push({
      id: `${lg}1` as Series['id'], kind: 'CS1', league: lg, name: 'CSファーストステージ', high: s2, low: s3, need: 2, advantage: 0,
      wins: [0, 0], ties: 0, status: 'active', winner: null,
      games: [0, 1, 2].map((i) => ({ id: id++, no: i + 1, date: addDays(start1, i), home: s2, away: s3, played: false })),
    });
    series.push({
      id: `${lg}2` as Series['id'], kind: 'CS2', league: lg, name: 'CSファイナルステージ', high: s1, low: 0, need: 4, advantage: 1,
      wins: [1, 0], ties: 0, status: 'waiting', winner: null,
      games: [0, 1, 2, 3, 4, 5].map((i) => ({ id: id++, no: i + 1, date: addDays(start2, i), home: s1, away: 0, played: false })),
    });
  }
  series.push({
    id: 'JS', kind: 'JS', league: null, name: '日本シリーズ', high: 0, low: 0, need: 4, advantage: 0, wins: [0, 0], ties: 0,
    status: 'waiting', winner: null, games: [],
  });
  return { year: w.year, seeds, series, champion: null, nextGameId: id };
}

/** 日本シリーズの日程（第1・2戦 土日、月休み、第3〜5戦 火〜木、金休み、第6・7戦 土日、以降は翌日） */
function jsDates(start: string): string[] {
  const off = [0, 1, 3, 4, 5, 7, 8, 9, 10, 11];
  return off.map((o) => addDays(start, o));
}

function hostForGame(no: number, first: number, second: number) {
  if (no <= 2 || no === 6 || no === 7) return first;
  if (no <= 5) return second;
  return no % 2 === 0 ? second : first;
}

/** 試合結果をシリーズに反映 */
export function applySeriesResult(w: World, s: Series, gameId: number, homeRuns: number, awayRuns: number) {
  const g = s.games.find((x) => x.id === gameId)!;
  g.played = true;
  const winnerTid = homeRuns > awayRuns ? g.home : awayRuns > homeRuns ? g.away : 0;
  if (winnerTid === 0) s.ties++;
  else if (winnerTid === s.high) s.wins[0]++;
  else s.wins[1]++;
  const remaining = s.games.filter((x) => !x.played).length;
  const [hw, lw] = s.wins;
  if (s.kind === 'JS') {
    if (hw >= 4) s.winner = s.high;
    else if (lw >= 4) s.winner = s.low;
    else if (remaining === 0) {
      // 引き分けがあって決着しない → 第8戦以降
      const no = s.games.length + 1;
      const date = addDays(s.games[s.games.length - 1].date, 1);
      const home = hostForGame(no, s.high, s.low);
      s.games.push({ id: w.post!.nextGameId++, no, date, home, away: home === s.high ? s.low : s.high, played: false });
    }
  } else {
    if (hw >= s.need) s.winner = s.high;
    else if (lw >= s.need) s.winner = s.low;
    else if (remaining === 0 || lw + remaining <= hw) s.winner = lw > hw ? s.low : s.high;
    // 上位が残りを全敗しても勝数で並ばれない → 下位が勝ち抜けを決められない場合は上位
    else if (hw + remaining < lw && hw + remaining < s.need) s.winner = s.low;
  }
  if (s.winner) {
    s.status = 'done';
    s.games = s.games.filter((x) => x.played); // 残りの試合は行わない
    progress(w);
  }
}

/** 次のシリーズを組む */
function progress(w: World) {
  const post = w.post!;
  const get = (id: Series['id']) => post.series.find((s) => s.id === id)!;
  for (const lg of ['C', 'P'] as const) {
    const s1 = get(`${lg}1` as Series['id']);
    const s2 = get(`${lg}2` as Series['id']);
    if (s1.status === 'done' && s2.status === 'waiting') {
      s2.low = s1.winner!;
      for (const g of s2.games) g.away = s2.low;
      s2.status = 'active';
    }
  }
  const js = get('JS');
  const c2 = get('C2'), p2 = get('P2');
  if (js.status === 'waiting' && c2.status === 'done' && p2.status === 'done') {
    const lastCS = [...c2.games, ...p2.games].filter((g) => g.played).map((g) => g.date).sort().pop()!;
    const start = firstWeekdayOnOrAfter(addDays(lastCS, 3), 6);
    // 奇数年はパ・リーグ優勝球団、偶数年はセ・リーグ優勝球団が第1戦を主催
    const first = w.year % 2 === 1 ? p2.winner! : c2.winner!;
    const second = first === p2.winner ? c2.winner! : p2.winner!;
    js.high = first;
    js.low = second;
    js.games = jsDates(start).slice(0, 7).map((date, i) => {
      const home = hostForGame(i + 1, first, second);
      return { id: post.nextGameId++, no: i + 1, date, home, away: home === first ? second : first, played: false };
    });
    js.status = 'active';
    post.draftDate = addDays(start, -2);
  }
  if (js.status === 'done') post.champion = js.winner;
}

export function postseasonGamesOn(w: World, date: string) {
  const out: { s: Series; g: SeriesGame }[] = [];
  if (!w.post) return out;
  for (const s of w.post.series) {
    if (s.status !== 'active') continue;
    const g = s.games.find((x) => !x.played);
    if (g && g.date === date) out.push({ s, g });
  }
  return out;
}

export function postseasonDone(w: World) {
  return !!w.post && w.post.series.find((s) => s.id === 'JS')!.status === 'done';
}

/** シリーズの状況（例: "3勝1敗（アドバンテージ1勝含む）"） */
export function seriesStatus(s: Series): string {
  const [h, l] = s.wins;
  return `${h}勝${l}敗${s.ties ? s.ties + '分' : ''}`;
}
