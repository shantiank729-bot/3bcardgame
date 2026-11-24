import type { BatLine, FieldLine, PitchLine } from '../engine/box';
import { Rng } from '../engine/rng';
import type { FieldPos, Player } from '../engine/types';
import { allocPlayerId, generateBatter, generatePitcher, setNextPlayerId } from '../players/generate';
import { buildSchedule, type SeasonCalendar } from './schedule';
import { TEAMS, type LeagueId, type TeamInfo } from './teams';

export const SAVE_VERSION = 1;

export type RosterStatus = 'active' | 'farm' | 'ikusei';

export interface PlayerRecord extends Player {
  teamId: number | null;
  status: RosterStatus;
  number: number;
  /** 登録ポジション（表示用） */
  primary: FieldPos;
  role?: 'SP' | 'RP';
}

export interface PlayerSeason {
  pid: number;
  tid: number;
  bat: BatLine | null;
  pitch: PitchLine | null;
  field: FieldLine | null;
}

export interface GameSummary {
  id: number;
  date: string;
  away: number;
  home: number;
  kind: 'L' | 'I';
  awayRuns: number;
  homeRuns: number;
  innings: number;
  tie: boolean;
  lineAway: number[];
  lineHome: number[];
  hits: [number, number];
  errors: [number, number];
  wp: number | null;
  lp: number | null;
  sv: number | null;
  sp: [number, number];
  hr: { pid: number; tid: number; n: number }[];
  walkoff: boolean;
  /** 簡易ボックススコア: 打者 [pid, tid, pos(+100=途中), slot, ab, r, h, rbi, bb, k, hr] / 投手 [pid, tid, outs, h, r, er, bb, k, pitches, hr] */
  boxBat: number[][];
  boxPitch: number[][];
  /** 打順通りの出場（打順順）*/
  order: [number[], number[]];
}

/** RE24・線形加重用の集計（リーグ別） */
export interface RunEnvAcc {
  reCount: number[]; // 24状態
  reRuns: number[];
  /** イベント別: 前状態の出現数・後状態の出現数・プレー中の得点・回数 */
  ev: Record<string, { before: number[]; after: number[]; runs: number; n: number }>;
}
export const emptyRunEnv = (): RunEnvAcc => ({ reCount: Array(24).fill(0), reRuns: Array(24).fill(0), ev: {} });

export interface ParkAcc {
  homeGames: number;
  homeRuns: number; // 両チーム合計
  homeHR: number;
  awayGames: number;
  awayRuns: number;
  awayHR: number;
}

export interface TeamState {
  id: number;
  rotation: number[];
  rotIdx: number;
  lastStart: Record<number, number>;
  /** 投手の登板記録 pid -> {dayIndex: pitches} */
  pitchLog: Record<number, Record<number, number>>;
  /** ユーザーが組んだ打順（null で自動） */
  manualOrder: { playerId: number; pos: string }[] | null;
}

export interface Settings {
  dh: Record<LeagueId, boolean>;
}

export interface World {
  version: number;
  seed: number;
  year: number;
  date: string;
  phase: 'regular' | 'postseason' | 'offseason';
  userTeamId: number;
  teams: TeamInfo[];
  teamState: Record<number, TeamState>;
  players: Record<number, PlayerRecord>;
  nextPlayerId: number;
  calendar: SeasonCalendar;
  results: Record<number, GameSummary>;
  season: Record<string, PlayerSeason>;
  runEnv: Record<LeagueId, RunEnvAcc>;
  park: Record<number, ParkAcc>;
  settings: Settings;
  /** 過去シーズンの選手成績（年 → 一覧） */
  history: Record<number, {
    season: PlayerSeason[];
    standings: { tid: number; w: number; l: number; t: number }[];
    /** その年のリーグ係数（セイバー指標の再計算用） */
    ctx?: Record<LeagueId, import('../stats/saber').LeagueContext>;
  }>;
}

export const emptyPark = (): ParkAcc => ({ homeGames: 0, homeRuns: 0, homeHR: 0, awayGames: 0, awayRuns: 0, awayHR: 0 });

function rec(p: Player, teamId: number, status: RosterStatus, primary: FieldPos, role?: 'SP' | 'RP'): PlayerRecord {
  return { ...p, teamId, status, number: 0, primary, role, form: 0 };
}

/** 1球団分の選手を作る（一軍31・二軍34・育成8） */
export function generateFranchise(rng: Rng, team: TeamInfo): PlayerRecord[] {
  const out: PlayerRecord[] = [];
  const age = () => Math.round(Math.min(38, Math.max(19, rng.normal(27.5, 4))));
  // 一軍野手 18: C3, 1B2, 2B2, 3B2, SS2, LF2, CF2, RF2, + 外国人野手2（1B/LF など）
  const activeBat: Exclude<FieldPos, 'P'>[] = ['C', 'C', 'C', '1B', '2B', '2B', '3B', '3B', 'SS', 'SS', 'LF', 'CF', 'CF', 'RF', 'RF', 'LF'];
  activeBat.forEach((pos, i) => {
    const lvl = i < 12 ? 50 : 44;
    const reg = [0, 3, 4, 6, 8, 10, 11, 13].includes(i);
    out.push(rec(generateBatter(rng, pos, { level: reg ? 52 : lvl - 3, age: age() }), team.id, 'active', pos));
  });
  for (const pos of ['1B', 'LF'] as const) {
    out.push(rec(generateBatter(rng, pos, { level: 55, age: rng.int(26, 33), foreign: true }), team.id, 'active', pos));
  }
  // 一軍投手 13: 先発6（外国人1）、救援7（外国人1）
  for (let i = 0; i < 6; i++) out.push(rec(generatePitcher(rng, 'SP', { level: i === 0 ? 55 : 50, age: age(), foreign: i === 5 }), team.id, 'active', 'P', 'SP'));
  for (let i = 0; i < 7; i++) out.push(rec(generatePitcher(rng, 'RP', { level: i < 3 ? 53 : 47, age: age(), foreign: i === 1 }), team.id, 'active', 'P', 'RP'));
  // 二軍
  const farmBat: Exclude<FieldPos, 'P'>[] = ['C', 'C', '1B', '2B', '3B', 'SS', 'SS', 'LF', 'CF', 'RF', '2B', '3B', 'CF', 'RF', 'LF', '1B'];
  for (const pos of farmBat) out.push(rec(generateBatter(rng, pos, { level: 40, age: rng.int(19, 30) }), team.id, 'farm', pos));
  out.push(rec(generateBatter(rng, 'RF', { level: 47, age: rng.int(25, 31), foreign: true }), team.id, 'farm', 'RF'));
  for (let i = 0; i < 7; i++) out.push(rec(generatePitcher(rng, 'SP', { level: 41, age: rng.int(19, 30) }), team.id, 'farm', 'P', 'SP'));
  for (let i = 0; i < 10; i++) out.push(rec(generatePitcher(rng, 'RP', { level: 41, age: rng.int(19, 31) }), team.id, 'farm', 'P', 'RP'));
  // 育成
  for (let i = 0; i < 4; i++) out.push(rec(generateBatter(rng, rng.pick(['C', 'SS', 'CF', '3B'] as const), { level: 30, age: rng.int(18, 23) }), team.id, 'ikusei', 'SS'));
  for (let i = 0; i < 4; i++) out.push(rec(generatePitcher(rng, 'RP', { level: 30, age: rng.int(18, 23) }), team.id, 'ikusei', 'P', 'RP'));
  for (const p of out) if (p.status === 'ikusei') p.primary = (Object.keys(p.bat.positions)[0] as FieldPos) ?? 'SS';
  assignNumbers(rng, out);
  return out;
}

function assignNumbers(rng: Rng, ps: PlayerRecord[]) {
  const used = new Set<number>();
  const take = (pref: number[]) => {
    const cands = pref.filter((n) => !used.has(n));
    const n = cands.length ? rng.pick(cands) : [...Array(100).keys()].find((x) => !used.has(x))!;
    used.add(n);
    return n;
  };
  const range = (a: number, b: number) => [...Array(b - a + 1)].map((_, i) => a + i);
  for (const p of ps) {
    if (p.status === 'ikusei') p.number = 100 + ps.filter((x) => x.status === 'ikusei').indexOf(p) * 3 + rng.int(0, 2);
    else if (p.isPitcher) p.number = take(p.status === 'active' ? [...range(11, 21), ...range(28, 30), ...range(41, 70)] : range(40, 99));
    else p.number = take(p.status === 'active' ? [...range(0, 10), ...range(22, 27), ...range(31, 40), 44, 55] : range(40, 99));
  }
}

export function defaultSettings(): Settings {
  // 2027年からセ・リーグもDH制（両リーグDH）
  return { dh: { C: true, P: true } };
}

export function newWorld(seed: number, userTeamId: number, year = 2027): World {
  const rng = new Rng(seed);
  setNextPlayerId(1);
  const players: Record<number, PlayerRecord> = {};
  const teamState: Record<number, TeamState> = {};
  for (const t of TEAMS) {
    const roster = generateFranchise(rng, t);
    for (const p of roster) players[p.id] = p;
    teamState[t.id] = {
      id: t.id,
      rotation: roster.filter((p) => p.status === 'active' && p.role === 'SP').map((p) => p.id),
      rotIdx: 0, lastStart: {}, pitchLog: {}, manualOrder: null,
    };
  }
  const nextPlayerId = allocPlayerId();
  const calendar = buildSchedule(TEAMS, year, seed + year);
  const park: Record<number, ParkAcc> = {};
  for (const t of TEAMS) park[t.id] = emptyPark();
  return {
    version: SAVE_VERSION, seed, year, date: calendar.opening, phase: 'regular', userTeamId,
    teams: TEAMS.map((t) => ({ ...t, park: { ...t.park } })), teamState, players, nextPlayerId, calendar,
    results: {}, season: {}, runEnv: { C: emptyRunEnv(), P: emptyRunEnv() }, park, settings: defaultSettings(), history: {},
  };
}

export const teamById = (w: World, id: number) => w.teams.find((t) => t.id === id)!;
export const rosterOf = (w: World, tid: number, status?: RosterStatus) =>
  Object.values(w.players).filter((p) => p.teamId === tid && (!status || p.status === status));
