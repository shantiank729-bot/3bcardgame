import type { BatLine, FieldLine, PitchLine } from '../engine/box';
import { Rng } from '../engine/rng';
import type { FieldPos, Player } from '../engine/types';
import { allocPlayerId, generateBatter, generatePitcher, setNextPlayerId } from '../players/generate';
import { buildSchedule, type SeasonCalendar } from './schedule';
import { initContract, MIN_SALARY, SEASON_DAYS } from './contracts';
import { rollPotential } from '../players/development';
import { createAmateurWorld } from '../amateur/world';
import { initFinance } from './finance';
import { ALLSTAR_TEAMS, TEAMS, type LeagueId, type TeamInfo } from './teams';

export const SAVE_VERSION = 5;

/** active=一軍 farm=二軍(支配下) ikusei=育成 fa=所属なし(自由契約) retired=引退 mlb=海外移籍 */
export type RosterStatus = 'active' | 'farm' | 'ikusei' | 'fa' | 'retired' | 'mlb';

/** 入団経路（FA権の年数判定に使う） HS=高卒 COL=大卒 SHA=社会人 FOR=外国人 */
export type EntryRoute = 'HS' | 'COL' | 'SHA' | 'FOR';

export interface Contract {
  /** 年俸（万円） */
  salary: number;
  /** 今季を含む残り年数 */
  years: number;
}

export interface CareerEvent {
  year: number;
  text: string;
}

/** プロ入り後、このゲームの開始前までの通算成績（記録達成の判定用） */
export interface CareerBase {
  g: number; pa: number; h: number; hr: number; rbi: number; sb: number;
  pg: number; w: number; l: number; sv: number; hld: number; k: number; outs: number;
}
export const emptyCareer = (): CareerBase => ({ g: 0, pa: 0, h: 0, hr: 0, rbi: 0, sb: 0, pg: 0, w: 0, l: 0, sv: 0, hld: 0, k: 0, outs: 0 });

export interface PlayerRecord extends Player {
  teamId: number | null;
  status: RosterStatus;
  number: number;
  /** 登録ポジション（表示用） */
  primary: FieldPos;
  role?: 'SP' | 'RP';
  /** ゲーム開始前の通算 */
  pre?: CareerBase;
  /** 新人王の資格がある */
  rookie?: boolean;
  /** プロ入り年 */
  debutYear?: number;
  /** 潜在能力（総合値の上限の目安） */
  pot: number;
  /** 成長タイプ */
  growth: 'early' | 'normal' | 'late';
  /** ケガ（残り日数） */
  injury: { days: number; desc: string } | null;
  contract: Contract;
  /** 一軍登録日数の累計（145日=1シーズン） */
  service: number;
  entry: EntryRoute;
  /** 国内FA権を行使したことがある */
  faUsed?: boolean;
  /** 一軍登録を抹消された日（dayIndex）。10日間は再登録できない */
  demotedDay?: number;
  /** 経歴（ドラフト・移籍・タイトルなど） */
  events: CareerEvent[];
  /** アマチュア時代の記録 */
  amateur?: AmateurCareer;
}

export interface AmateurCareer {
  /** 出身校（高校→大学→社会人） */
  path: string[];
  /** 年度ごとの成績 [年, 区分ラベル, 所属, 打撃 or 投手] */
  lines: { year: number; label: string; school: string; bat?: number[]; pit?: number[] }[];
}

export interface PlayerSeason {
  pid: number;
  tid: number;
  bat: BatLine | null;
  pitch: PitchLine | null;
  field: FieldLine | null;
}

/** L=リーグ戦 I=交流戦 CS1/CS2=クライマックス JS=日本シリーズ AS=オールスター */
export type GameKind = 'L' | 'I' | 'CS1' | 'CS2' | 'JS' | 'AS';

export interface GameSummary {
  id: number;
  date: string;
  away: number;
  home: number;
  kind: GameKind;
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
  /** 観客数 */
  attendance?: number;
  /** シリーズ内の第何戦か・会場（ポストシーズン・球宴用） */
  label?: string;
  parkName?: string;
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
  /** ポストシーズン（CS・日本シリーズ） */
  post: import('./postseason').PostseasonState | null;
  /** ポストシーズンの個人成績（今季） */
  postStats: Record<string, PlayerSeason>;
  /** オールスター（今季） */
  allStar: import('./allstar').AllStarState | null;
  /** 表彰（年ごと） */
  awards: Record<number, import('./awards').SeasonAwards>;
  /** スポーツ新聞（日付ごと） */
  news: Record<string, import('../news/types').NewsIssue>;
  /** 自チームへのお知らせ（ケガ・入れ替え・オファーなど） */
  inbox: import('./rosterOps').Inbox[];
  /** ドラフト会議（今年） */
  draft: import('./draft').DraftState | null;
  /** オフシーズンの進行 */
  off: import('./offseason').OffseasonState | null;
  /** トレードの記録 */
  trades: import('./trade').TradeRecord[];
  /** 二軍（今季） */
  farm?: import('./farm').FarmState;
  /** 財政（球団ごと） */
  finance: Record<number, import('./finance').TeamFinance>;
  /** 高校・大学・社会人野球 */
  amateur: import('../amateur/types').AmateurWorld;
  /** リーグ基準補正（能力の平均のずれ） */
  norm?: import('../engine/pa').RatingNorm;
  /** 直近のキャンプでの成長（自チーム） */
  devReport?: { pid: number; before: number; after: number }[];
  /** 球団の予算（年俸総額の目安、万円） */
  budget: Record<number, number>;
  /** 一度だけ記事にする出来事の記録（マジック点灯・記録達成など） */
  flags: Record<string, true>;
  /** 過去シーズンの選手成績（年 → 一覧） */
  history: Record<number, {
    /** 成績（新しい年は展開した形、古い年は packed に詰めて保存） */
    season?: PlayerSeason[];
    packed?: import('./pack').PackedRow[];
    packedFarm?: import('./pack').PackedRow[];
    standings: { tid: number; w: number; l: number; t: number }[];
    /** 二軍の個人成績 */
    farm?: PlayerSeason[];
    /** その年のリーグ係数（セイバー指標の再計算用） */
    ctx?: Record<LeagueId, import('../stats/saber').LeagueContext>;
  }>;
}

export const emptyPark = (): ParkAcc => ({ homeGames: 0, homeRuns: 0, homeHR: 0, awayGames: 0, awayRuns: 0, awayHR: 0 });

function rec(p: Player, teamId: number, status: RosterStatus, primary: FieldPos, role?: 'SP' | 'RP'): PlayerRecord {
  return {
    ...p, teamId, status, number: 0, primary, role, form: 0, pot: 50, growth: 'normal', injury: null,
    contract: { salary: MIN_SALARY, years: 1 }, service: 0, entry: p.foreign ? 'FOR' : 'HS', events: [],
  };
}

/** 年齢と能力から、ゲーム開始前の通算成績をそれらしく作る */
export function seedCareer(rng: Rng, p: PlayerRecord, year: number) {
  const entryAge = p.foreign ? 25 : rng.pick([18, 18, 22, 22, 23]);
  const years = Math.max(0, p.age - entryAge - (p.foreign ? 0 : 1));
  const c = emptyCareer();
  // 若手・二軍は出場が少ない
  const share = p.status === 'active' ? 1 : p.status === 'farm' ? 0.25 : 0;
  for (let i = 0; i < years; i++) {
    const ramp = Math.min(1, (i + 1) / 4) * share * (0.5 + rng.next() * 0.6);
    if (p.isPitcher && p.pit) {
      const sp = p.role === 'SP';
      const ip = (sp ? 140 : 50) * ramp;
      const q = (p.pit.control + p.pit.velocity - 147 + 50) / 100;
      c.pg += Math.round((sp ? 22 : 45) * ramp);
      c.outs += Math.round(ip * 3);
      c.k += Math.round(ip * (0.6 + q * 0.4) * (0.8 + rng.next() * 0.4));
      c.w += Math.round((sp ? 8 : 3) * ramp * (0.6 + q * 0.6));
      c.l += Math.round((sp ? 7 : 3) * ramp);
      if (!sp) {
        c.sv += Math.round((p.pit.velocity > 150 ? 15 : 2) * ramp * rng.next());
        c.hld += Math.round(12 * ramp * rng.next());
      }
    } else {
      const pa = 480 * ramp;
      const avg = 0.21 + p.bat.contact / 1000;
      c.g += Math.round(pa / 4);
      c.pa += Math.round(pa);
      c.h += Math.round(pa * 0.88 * avg);
      c.hr += Math.round(pa * (0.004 + p.bat.power / 2600));
      c.rbi += Math.round(pa * (0.07 + p.bat.power / 1500));
      c.sb += Math.round(pa * Math.max(0, p.bat.speed - 45) / 2500);
    }
  }
  p.pre = c;
  p.debutYear = year - years;
  if (!p.foreign) p.entry = entryAge === 18 ? 'HS' : entryAge === 22 ? 'COL' : 'SHA';
  // 一軍登録日数（FA権）: 一軍定着度に応じて
  const reg = p.status === 'active' ? 0.75 : p.status === 'farm' ? 0.2 : 0;
  p.service = Math.round(Math.max(0, years - 1) * SEASON_DAYS * reg * (0.6 + rng.next() * 0.6));
  const pr = rollPotential(rng, p);
  p.pot = pr.pot;
  p.growth = pr.growth;
  p.contract = initContract(rng, p);
  p.events = [{ year: p.debutYear ?? year, text: p.foreign ? '来日・入団' : `入団（${p.entry === 'HS' ? '高卒' : p.entry === 'COL' ? '大卒' : '社会人'}）` }];
  p.rookie = !p.foreign && (p.isPitcher ? c.outs < 90 : c.pa < 60) && years <= 5;
}

/** 1球団分の選手を作る（一軍31・二軍34・育成8） */
export function generateFranchise(rng: Rng, team: TeamInfo): PlayerRecord[] {
  const out: PlayerRecord[] = [];
  const age = () => Math.round(Math.min(38, Math.max(19, rng.normal(27.5, 4))));
  // 一軍野手 18: C3, 1B2, 2B2, 3B2, SS2, LF2, CF2, RF2, + 外国人野手2（1B/LF など）
  const activeBat: Exclude<FieldPos, 'P'>[] = ['C', 'C', 'C', '1B', '2B', '2B', '3B', '3B', 'SS', 'SS', 'LF', 'CF', 'CF', 'RF', 'RF', 'LF'];
  activeBat.forEach((pos, i) => {
    const lvl = i < 12 ? 56 : 50;
    const reg = [0, 3, 4, 6, 8, 10, 11, 13].includes(i);
    out.push(rec(generateBatter(rng, pos, { level: reg ? 58 : lvl - 3, age: age() }), team.id, 'active', pos));
  });
  for (const pos of ['1B', 'LF'] as const) {
    out.push(rec(generateBatter(rng, pos, { level: 61, age: rng.int(26, 33), foreign: true }), team.id, 'active', pos));
  }
  // 一軍投手 13: 先発6（外国人1）、救援7（外国人1）
  for (let i = 0; i < 6; i++) out.push(rec(generatePitcher(rng, 'SP', { level: i === 0 ? 61 : 56, age: age(), foreign: i === 5 }), team.id, 'active', 'P', 'SP'));
  for (let i = 0; i < 7; i++) out.push(rec(generatePitcher(rng, 'RP', { level: i < 3 ? 59 : 53, age: age(), foreign: i === 1 }), team.id, 'active', 'P', 'RP'));
  // 二軍
  const farmBat: Exclude<FieldPos, 'P'>[] = ['C', 'C', '1B', '2B', '3B', 'SS', 'SS', 'LF', 'CF', 'RF', '2B', '3B', 'CF', 'RF', 'LF', '1B'];
  for (const pos of farmBat) out.push(rec(generateBatter(rng, pos, { level: 46, age: rng.int(19, 30) }), team.id, 'farm', pos));
  out.push(rec(generateBatter(rng, 'RF', { level: 53, age: rng.int(25, 31), foreign: true }), team.id, 'farm', 'RF'));
  for (let i = 0; i < 7; i++) out.push(rec(generatePitcher(rng, 'SP', { level: 47, age: rng.int(19, 30) }), team.id, 'farm', 'P', 'SP'));
  for (let i = 0; i < 10; i++) out.push(rec(generatePitcher(rng, 'RP', { level: 47, age: rng.int(19, 31) }), team.id, 'farm', 'P', 'RP'));
  // 育成
  for (let i = 0; i < 4; i++) out.push(rec(generateBatter(rng, rng.pick(['C', 'SS', 'CF', '3B'] as const), { level: 36, age: rng.int(18, 23) }), team.id, 'ikusei', 'SS'));
  for (let i = 0; i < 4; i++) out.push(rec(generatePitcher(rng, 'RP', { level: 36, age: rng.int(18, 23) }), team.id, 'ikusei', 'P', 'RP'));
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
    for (const p of roster) {
      seedCareer(rng, p, year);
      players[p.id] = p;
    }
    teamState[t.id] = {
      id: t.id,
      rotation: roster.filter((p) => p.status === 'active' && p.role === 'SP').map((p) => p.id),
      rotIdx: 0, lastStart: {}, pitchLog: {}, manualOrder: null,
    };
  }
  const amw = createAmateurWorld(seed, year, allocPlayerId());
  const nextPlayerId = amw.nextId;
  const calendar = buildSchedule(TEAMS, year, seed + year);
  const park: Record<number, ParkAcc> = {};
  for (const t of TEAMS) park[t.id] = emptyPark();
  return {
    version: SAVE_VERSION, seed, year, date: calendar.opening, phase: 'regular', userTeamId,
    teams: TEAMS.map((t) => ({ ...t, park: { ...t.park } })), teamState, players, nextPlayerId, calendar,
    results: {}, season: {}, runEnv: { C: emptyRunEnv(), P: emptyRunEnv() }, park, settings: defaultSettings(), history: {},
    amateur: amw.am, finance: initFinance(TEAMS), post: null, postStats: {}, allStar: null, awards: {}, news: {}, flags: {}, inbox: [], draft: null, off: null, trades: [],
    budget: Object.fromEntries(TEAMS.map((t) => [t.id, Math.round((Object.values(players).filter((p) => p.teamId === t.id).reduce((s, p) => s + p.contract.salary, 0) * 1.08) / 1000) * 1000])),
  };
}

export const teamById = (w: World, id: number): TeamInfo =>
  w.teams.find((t) => t.id === id) ?? ALLSTAR_TEAMS.find((t) => t.id === id)!;
/**
 * 所属選手の候補（引退・海外移籍の選手を除いた一覧）。日付か選手数が変わったら作り直す。
 * 実際の所属は呼び出し時に teamId / status で確かめるので、途中で移籍・引退しても正しい。
 */
let rosterCache: { ref: object; count: number; date: string; list: PlayerRecord[] } | null = null;
function livePlayers(w: World): PlayerRecord[] {
  // 新しい選手が加わると nextPlayerId が進むので、それを目印にする
  const count = w.nextPlayerId;
  if (!rosterCache || rosterCache.ref !== w.players || rosterCache.count !== count || rosterCache.date !== w.date) {
    rosterCache = { ref: w.players, count, date: w.date, list: Object.values(w.players).filter((p) => p.status !== 'retired' && p.status !== 'mlb') };
  }
  return rosterCache.list;
}

export const rosterOf = (w: World, tid: number, status?: RosterStatus) =>
  livePlayers(w).filter((p) => p.teamId === tid && (!status || p.status === status));
