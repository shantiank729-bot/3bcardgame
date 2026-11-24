/**
 * ドラフト会議（NPB方式）
 * - 1巡目: 全球団が同時に入札。重複したら抽選。外れた球団は残りの選手から再入札（外れ1位）
 * - 2巡目以降: ウェーバー（交流戦で勝ち越したリーグの最下位から、両リーグ交互）。奇数巡は逆順（逆ウェーバー）
 * - 支配下の指名が終わったら育成ドラフト
 * - 指名できるのはプロ志望届を出した高校・大学生と社会人（候補リストの全員）
 */
import { Rng } from '../engine/rng';
import type { FieldPos } from '../engine/types';
import { overall } from '../players/development';
import { setNextPlayerId, allocPlayerId } from '../players/generate';
import { generateDraftClass, type Prospect } from '../players/prospects';
import { IKUSEI_MIN } from './contracts';
import { computeStandings } from './standings';
import { rosterOf, teamById, type PlayerRecord, type World } from './world';

export interface DraftPick {
  tid: number;
  pid: number;
  round: number;
  ikusei: boolean;
  /** 1巡目の入札で競合した球団 */
  bidders?: number[];
  label: string;
}

export interface LotteryLog {
  pid: number;
  bidders: number[];
  winner: number;
  sub: number; // 何回目の入札か
}

export interface DraftState {
  year: number;
  date: string;
  prospects: Prospect[];
  picks: DraftPick[];
  /** r1=1巡目入札中, waiver=2巡目以降, ikusei=育成, done=終了 */
  stage: 'r1' | 'waiver' | 'ikusei' | 'done';
  /** 1巡目で今入札している回（1=1位入札, 2=外れ1位...） */
  r1Sub: number;
  lotteries: LotteryLog[];
  /** ウェーバーの基本順（2巡目） */
  order: number[];
  round: number;
  /** waiver/ikusei: 今の巡で次に指名する順番の位置 */
  cursor: number;
  /** 指名を終えた球団 */
  finished: number[];
  ikuseiFinished: number[];
  /** チームごとの見立て（スカウトの評価のぶれ）: tid -> pid -> 評価値 */
  views: Record<number, Record<number, number>>;
}

const hashSeed = (...xs: number[]) => xs.reduce((h, x) => Math.imul(h ^ x, 16777619) >>> 0, 2166136261);

/** 候補をドラフト用に作る（フェーズ6でアマチュア世界から差し替え） */
export function startDraft(w: World, date: string, supply?: (rng: Rng) => Prospect[]): DraftState {
  const rng = new Rng(hashSeed(w.seed, w.year, 555));
  setNextPlayerId(w.nextPlayerId);
  const prospects = supply ? supply(rng) : generateDraftClass(rng);
  w.nextPlayerId = allocPlayerId();
  // ウェーバー順: 交流戦で勝ち越したリーグの最下位から交互
  const inter = computeStandings(w, undefined, (k) => k === 'I');
  const cW = inter.filter((r) => teamById(w, r.tid).league === 'C').reduce((s, r) => s + r.w, 0);
  const pW = inter.filter((r) => teamById(w, r.tid).league === 'P').reduce((s, r) => s + r.w, 0);
  const first = cW >= pW ? 'C' : 'P';
  const second = first === 'C' ? 'P' : 'C';
  const A = computeStandings(w, first).map((r) => r.tid).reverse();
  const B = computeStandings(w, second).map((r) => r.tid).reverse();
  const order: number[] = [];
  for (let i = 0; i < 6; i++) order.push(A[i], B[i]);
  // 各球団の見立て（スカウトの目のぶれ）
  const views: Record<number, Record<number, number>> = {};
  for (const t of w.teams) {
    const r = new Rng(hashSeed(w.seed, w.year, t.id, 777));
    views[t.id] = {};
    for (const p of prospects) views[t.id][p.id] = prospectValue(p) + r.normal(0, 4);
  }
  return { year: w.year, date, prospects, picks: [], stage: 'r1', r1Sub: 1, lotteries: [], order, round: 2, cursor: 0, finished: [], ikuseiFinished: [], views };
}

/** 本当の価値（将来性と即戦力性） */
export function prospectValue(p: Prospect): number {
  const ovr = overall(p.player);
  const wPot = p.kind === 'HS' ? 0.7 : p.kind === 'COL' ? 0.55 : 0.4;
  return p.pot * wPot + ovr * (1 - wPot) + p.hype * 0.05;
}

const taken = (d: DraftState) => new Set(d.picks.map((p) => p.pid));
const available = (d: DraftState) => {
  const t = taken(d);
  return d.prospects.filter((p) => !t.has(p.id));
};

/** 球団の補強ポイント（投手・捕手・内野・外野） */
function needBonus(w: World, tid: number, p: Prospect): number {
  const roster = rosterOf(w, tid).filter((x) => x.status !== 'ikusei');
  const count = (f: (x: PlayerRecord) => boolean) => roster.filter(f).length;
  const pitchers = count((x) => x.isPitcher);
  if (p.pos === 'P') return pitchers < 34 ? 3 : 0;
  if (p.pos === 'C') return count((x) => x.primary === 'C') < 5 ? 3 : 0;
  const inf: FieldPos[] = ['1B', '2B', '3B', 'SS'];
  if (inf.includes(p.pos)) return count((x) => inf.includes(x.primary)) < 12 ? 2 : 0;
  return count((x) => ['LF', 'CF', 'RF'].includes(x.primary)) < 10 ? 2 : 0;
}

function aiChoice(w: World, d: DraftState, tid: number, pool: Prospect[], r1: boolean): Prospect | null {
  if (pool.length === 0) return null;
  const rng = new Rng(hashSeed(w.seed, w.year, tid, d.picks.length, d.r1Sub));
  let best: Prospect | null = null, bv = -Infinity;
  for (const p of pool) {
    // 1巡目は注目度の高い選手に人気が集まる
    const v = d.views[tid][p.id] + needBonus(w, tid, p) + (r1 ? p.hype * 0.12 : 0) + rng.normal(0, r1 ? 1.5 : 1);
    if (v > bv) { bv = v; best = p; }
  }
  return best;
}

/** 支配下の枠に応じて、何人指名するか */
export function targetPicks(w: World, tid: number): number {
  const shihaika = rosterOf(w, tid).filter((p) => p.status === 'active' || p.status === 'farm').length;
  const expectedOut = 7; // 戦力外・引退・FA流出の見込み
  return Math.max(3, Math.min(8, 70 - shihaika + expectedOut));
}

/** 1巡目の入札（userPick: ユーザー球団の入札先。null ならAIが決める） */
export function submitRound1(w: World, d: DraftState, userPick: number | null): LotteryLog[] {
  const have = new Set(d.picks.filter((p) => p.round === 1).map((p) => p.tid));
  const bidders = w.teams.map((t) => t.id).filter((id) => !have.has(id));
  const pool = available(d);
  const bids = new Map<number, number[]>();
  for (const tid of bidders) {
    let pid: number | undefined;
    if (tid === w.userTeamId && userPick !== null && pool.some((p) => p.id === userPick)) pid = userPick;
    else pid = aiChoice(w, d, tid, pool, true)?.id;
    if (pid === undefined) continue;
    (bids.get(pid) ?? bids.set(pid, []).get(pid)!).push(tid);
  }
  const rng = new Rng(hashSeed(w.seed, w.year, 31337, d.r1Sub));
  const logs: LotteryLog[] = [];
  for (const [pid, ts] of bids) {
    const winner = ts.length === 1 ? ts[0] : ts[rng.int(0, ts.length - 1)];
    if (ts.length > 1) logs.push({ pid, bidders: ts, winner, sub: d.r1Sub });
    d.picks.push({ tid: winner, pid, round: 1, ikusei: false, bidders: ts.length > 1 ? ts : undefined, label: d.r1Sub === 1 ? '1位' : '外れ1位' });
  }
  d.lotteries.push(...logs);
  d.r1Sub++;
  if (d.picks.filter((p) => p.round === 1).length >= w.teams.length) {
    d.stage = 'waiver';
    d.round = 2;
    d.cursor = 0;
  }
  return logs;
}

function roundOrder(d: DraftState): number[] {
  return d.round % 2 === 0 ? d.order : [...d.order].reverse();
}

/** 次に指名する球団（いなければ null） */
export function currentPicker(d: DraftState): number | null {
  if (d.stage !== 'waiver' && d.stage !== 'ikusei') return null;
  const fin = new Set(d.stage === 'waiver' ? d.finished : d.ikuseiFinished);
  const ord = roundOrder(d);
  for (let i = d.cursor; i < ord.length; i++) if (!fin.has(ord[i])) return ord[i];
  return null;
}

function advanceCursor(w: World, d: DraftState) {
  const ord = roundOrder(d);
  const fin = new Set(d.stage === 'waiver' ? d.finished : d.ikuseiFinished);
  d.cursor++;
  while (d.cursor < ord.length && fin.has(ord[d.cursor])) d.cursor++;
  if (d.cursor >= ord.length) {
    d.round++;
    d.cursor = 0;
    const all = w.teams.every((t) => fin.has(t.id));
    const limit = d.stage === 'waiver' ? 10 : 16;
    if (all || d.round > limit || available(d).length === 0) {
      if (d.stage === 'waiver') {
        d.stage = 'ikusei';
        d.round = 1;
      } else d.stage = 'done';
    }
  }
}

/** 1人指名する（pid=null は「選択終了」） */
export function makePick(w: World, d: DraftState, tid: number, pid: number | null) {
  const ik = d.stage === 'ikusei';
  if (pid === null || !available(d).some((p) => p.id === pid)) {
    (ik ? d.ikuseiFinished : d.finished).push(tid);
  } else {
    const n = d.picks.filter((p) => p.tid === tid && p.ikusei === ik).length + 1;
    d.picks.push({ tid, pid, round: ik ? d.round : d.round, ikusei: ik, label: ik ? `育成${n}位` : `${d.round}位` });
  }
  advanceCursor(w, d);
}

/** AIの番を進める（ユーザーの番が来たら止まる）。stopAtUser=false ならユーザーも自動 */
export function runAiPicks(w: World, d: DraftState, stopAtUser = true) {
  let guard = 0;
  while ((d.stage === 'waiver' || d.stage === 'ikusei') && guard++ < 1000) {
    const tid = currentPicker(d);
    if (tid === null) {
      advanceCursor(w, d);
      continue;
    }
    if (tid === w.userTeamId && stopAtUser) return;
    const ik = d.stage === 'ikusei';
    const mine = d.picks.filter((p) => p.tid === tid && p.ikusei === ik).length;
    const target = ik ? 3 : targetPicks(w, tid) - 1; // 1巡目の分を除く
    if (mine >= target) {
      makePick(w, d, tid, null);
      continue;
    }
    const pool = available(d);
    // 育成は伸びしろ重視
    const choice = aiChoice(w, d, tid, ik ? pool.filter((p) => p.kind !== 'SHA') : pool, false);
    makePick(w, d, tid, choice?.id ?? null);
  }
}

/** ドラフトをすべて自動で終える（ユーザー球団もAIが指名） */
export function autoDraft(w: World, d: DraftState) {
  while (d.stage === 'r1') submitRound1(w, d, null);
  runAiPicks(w, d, false);
  d.stage = 'done';
}

/** 指名選手を入団させる（契約金は省略、年俸は順位に応じて） */
export function finalizeDraft(w: World, d: DraftState) {
  const byId = new Map(d.prospects.map((p) => [p.id, p]));
  for (const pk of d.picks) {
    const pr = byId.get(pk.pid)!;
    const p = pr.player;
    const salary = pk.ikusei ? IKUSEI_MIN + (pr.kind === 'HS' ? 0 : 60) : pk.round === 1 ? 1600 : pk.round === 2 ? 1300 : pk.round <= 4 ? 1000 : 800;
    const rec: PlayerRecord = {
      ...p, teamId: pk.tid, status: pk.ikusei ? 'ikusei' : 'farm', number: 0, primary: pr.pos, role: p.isPitcher ? (p.pit!.stamina >= 50 ? 'SP' : 'RP') : undefined,
      form: 0, pot: pr.pot, growth: pr.growth, injury: null, contract: { salary, years: pk.ikusei ? 3 : 1 }, service: 0, entry: pr.kind,
      events: [{ year: d.year, text: `ドラフト${pk.label}で${teamById(w, pk.tid).city}${teamById(w, pk.tid).nickname}が指名（${pr.school}）${pk.bidders ? `・${pk.bidders.length}球団競合` : ''}` }],
      debutYear: d.year + 1, rookie: true, pre: undefined,
    };
    w.players[rec.id] = rec;
    assignNumber(w, rec);
  }
}

export function assignNumber(w: World, p: PlayerRecord) {
  const used = new Set(rosterOf(w, p.teamId!).filter((x) => x.id !== p.id).map((x) => x.number));
  const range = p.status === 'ikusei' ? [...Array(80)].map((_, i) => 100 + i) : p.isPitcher ? [...Array(60)].map((_, i) => 11 + i) : [...Array(70)].map((_, i) => i);
  p.number = range.find((n) => !used.has(n)) ?? 199;
}

export function prospectById(d: DraftState, pid: number) {
  return d.prospects.find((p) => p.id === pid);
}
