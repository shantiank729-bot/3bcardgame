/**
 * セイバーメトリクス。係数はすべてゲーム内リーグの実績から計算する。
 * - 得点期待値表（RE24）→ 各イベントの得点価値 → wOBA係数（リーグwOBA = リーグ出塁率 になるようスケーリング）
 * - FIP定数 = リーグ防御率 − リーグの(13HR+3(BB+HBP−IBB)−2K)/IP
 * - パークファクター = 本拠地の1試合得点 / ビジターの1試合得点（回帰あり）
 * - WAR: 代替水準は勝率.294、野手57%・投手43%で配分（FanGraphs方式に準拠）
 */
import { addField, addLine, emptyBat, emptyField, emptyPitch, type BatLine, type FieldLine, type PitchLine } from '../engine/box';
import type { FieldPos } from '../engine/types';
import type { LeagueId } from '../league/teams';
import type { PlayerSeason, RunEnvAcc, World, ParkAcc } from '../league/world';
import type { Park } from '../engine/types';

export interface WobaWeights {
  bb: number; hbp: number; b1: number; b2: number; b3: number; hr: number; scale: number;
}

export interface LeagueContext {
  league: LeagueId | 'ALL';
  bat: BatLine;
  pitch: PitchLine;
  games: number; // チーム試合数の合計
  avg: number; obp: number; slg: number;
  era: number; ra9: number; fip: number; fipConst: number;
  rPerPA: number; rPerOut: number; rpw: number;
  woba: number; weights: WobaWeights;
  re: number[]; // 24状態の得点期待値
  runValues: Record<string, number>;
  parkFactor: Record<number, number>; // チームID→本拠地PF（1.0基準）
  repRunsPerPA: number;
  repRunsPerIP: number;
  lgSbRate: number;
  lgCsPct: number;
  posRunsPerOut: Record<string, number>;
}

const OUT_CODES = ['K', 'GO', 'FO', 'LO', 'PO', 'DP', 'FC', 'E'];

export function reMatrix(acc: RunEnvAcc): number[] {
  return acc.reCount.map((c, i) => (c > 0 ? acc.reRuns[i] / c : 0));
}

export function runValues(acc: RunEnvAcc, re: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  const reAt = (i: number) => (i >= 24 ? 0 : re[i]);
  for (const [code, e] of Object.entries(acc.ev)) {
    if (e.n === 0) continue;
    let s = e.runs;
    e.after.forEach((c, i) => (s += c * reAt(i)));
    e.before.forEach((c, i) => (s -= c * reAt(i)));
    out[code] = s / e.n;
  }
  return out;
}

function mergeAcc(a: RunEnvAcc, b: RunEnvAcc): RunEnvAcc {
  const r: RunEnvAcc = { reCount: a.reCount.map((x, i) => x + b.reCount[i]), reRuns: a.reRuns.map((x, i) => x + b.reRuns[i]), ev: {} };
  for (const src of [a, b]) for (const [k, e] of Object.entries(src.ev)) {
    const t = (r.ev[k] ??= { before: Array(24).fill(0), after: Array(25).fill(0), runs: 0, n: 0 });
    e.before.forEach((x, i) => (t.before[i] += x));
    e.after.forEach((x, i) => (t.after[i] += x));
    t.runs += e.runs;
    t.n += e.n;
  }
  return r;
}

/** 球場の事前値（能力値から推定した得点の出やすさ） */
export function parkPrior(p: Park): number {
  return 1 + (p.hrFactor - 1) * 0.32 + (p.hitFactor - 1) * 1.6 + (p.doubleFactor - 1) * 0.15;
}

export function parkFactors(teams: { id: number; park: Park }[], park: Record<number, ParkAcc>): Record<number, number> {
  const out: Record<number, number> = {};
  const K = 60; // 事前値の重み（試合数換算）
  for (const t of teams) {
    const a = park[t.id];
    const prior = parkPrior(t.park);
    if (!a || a.homeGames === 0 || a.awayGames === 0) {
      out[t.id] = prior;
      continue;
    }
    const raw = a.homeRuns / a.homeGames / (a.awayRuns / a.awayGames);
    const g = Math.min(a.homeGames, a.awayGames);
    out[t.id] = (raw * g + prior * K) / (g + K);
  }
  return out;
}

/** PlayerSeason の一覧から、条件に合う成績を合計 */
function sumLines(entries: PlayerSeason[]) {
  const bat = emptyBat();
  const pitch = emptyPitch();
  const field = emptyField();
  for (const e of entries) {
    if (e.bat) addLine(bat, e.bat);
    if (e.pitch) addLine(pitch, e.pitch);
    if (e.field) addField(field, e.field);
  }
  return { bat, pitch, field };
}

const POS_ADJ_FULL: Record<string, number> = {
  C: 12.5, SS: 7.5, '2B': 2.5, '3B': 2.5, CF: 2.5, LF: -7.5, RF: -7.5, '1B': -12.5, DH: -17.5, P: 0,
};

export function leagueContext(
  w: { teams: World['teams']; season: Record<string, PlayerSeason>; runEnv: World['runEnv']; park: World['park'] },
  league: LeagueId | 'ALL',
  entries?: PlayerSeason[],
): LeagueContext {
  const tids = new Set(w.teams.filter((t) => league === 'ALL' || t.league === league).map((t) => t.id));
  const list = (entries ?? Object.values(w.season)).filter((e) => tids.has(e.tid));
  const { bat: b, pitch: p } = sumLines(list);
  const acc = league === 'ALL' ? mergeAcc(w.runEnv.C, w.runEnv.P) : w.runEnv[league];
  const re = reMatrix(acc);
  const rv = runValues(acc, re);
  let outN = 0, outV = 0;
  for (const c of OUT_CODES) {
    const e = acc.ev[c];
    if (e && rv[c] !== undefined) {
      outN += e.n;
      outV += e.n * rv[c];
    }
  }
  const outVal = outN ? outV / outN : -0.27;
  const val = (c: string, dflt: number) => (rv[c] ?? dflt) - outVal;
  const raw = { bb: val('BB', 0.31), hbp: val('HBP', 0.33), b1: val('1B', 0.46), b2: val('2B', 0.76), b3: val('3B', 1.03), hr: val('HR', 1.4) };
  const singles = b.h - b.d - b.t - b.hr;
  const ubb = b.bb - b.ibb;
  const denom = b.ab + b.bb - b.ibb + b.sf + b.hbp;
  const obp = (b.h + b.bb + b.hbp) / Math.max(1, b.ab + b.bb + b.hbp + b.sf);
  const rawWoba = (raw.bb * ubb + raw.hbp * b.hbp + raw.b1 * singles + raw.b2 * b.d + raw.b3 * b.t + raw.hr * b.hr) / Math.max(1, denom);
  const scale = rawWoba > 0 ? obp / rawWoba : 1.2;
  const weights: WobaWeights = {
    bb: raw.bb * scale, hbp: raw.hbp * scale, b1: raw.b1 * scale, b2: raw.b2 * scale, b3: raw.b3 * scale, hr: raw.hr * scale, scale,
  };
  const ip = p.outs / 3;
  const runs = p.r;
  const era = ip ? (p.er * 9) / ip : 0;
  const ra9 = ip ? (runs * 9) / ip : 0;
  const fipRaw = ip ? (13 * p.hr + 3 * (p.bb - p.ibb + p.hbp) - 2 * p.k) / ip : 0;
  const fipConst = era - fipRaw;
  const games = list.length ? [...tids].length * 0 : 0;
  void games;
  const teamGames = Object.values(w.park).length ? [...tids].reduce((s, id) => s + (w.park[id]?.homeGames ?? 0) + (w.park[id]?.awayGames ?? 0), 0) : 0;
  const rPerPA = b.pa ? b.r / b.pa : 0.11;
  const rPerOut = p.outs ? runs / p.outs : 0.13;
  const rpw = 9 * (ip ? runs / ip : 0.37) * 1.5 + 3;
  // 代替水準: チーム勝率.294 → リーグ全体の (0.5−0.294) × 試合数 勝が代替を上回る
  const warPool = (0.5 - 0.294) * teamGames;
  const repRunsPerPA = b.pa ? (warPool * 0.57 * rpw) / b.pa : 0;
  const repRunsPerIP = ip ? (warPool * 0.43 * rpw) / ip : 0;
  const lgSbRate = (b.sb + b.cs) > 0 ? b.sb / (b.sb + b.cs) : 0.7;
  const lgCsPct = (b.sb + b.cs) > 0 ? b.cs / (b.sb + b.cs) : 0.3;
  // ポジション補正: 143試合フル出場（約3861アウト）あたりの得点
  const fullOuts = 143 * 27;
  const posRunsPerOut: Record<string, number> = {};
  for (const [k, v] of Object.entries(POS_ADJ_FULL)) posRunsPerOut[k] = (v * (143 / 162)) / fullOuts;
  return {
    league, bat: b, pitch: p, games: teamGames,
    avg: b.ab ? b.h / b.ab : 0, obp, slg: b.ab ? (b.h + b.d + 2 * b.t + 3 * b.hr) / b.ab : 0,
    era, ra9, fip: era, fipConst, rPerPA, rPerOut, rpw, woba: obp, weights, re, runValues: rv,
    parkFactor: parkFactors(w.teams, w.park), repRunsPerPA, repRunsPerIP, lgSbRate, lgCsPct, posRunsPerOut,
  };
}

// ---------- 選手の指標 ----------
export interface BatterMetrics {
  pa: number; avg: number; obp: number; slg: number; ops: number; iso: number; babip: number;
  kPct: number; bbPct: number; woba: number; wrcPlus: number; opsPlus: number; wraa: number;
  batRuns: number; bsrRuns: number; fldRuns: number; posRuns: number; war: number; rispAvg: number;
}

export function wobaOf(b: BatLine, wt: WobaWeights): number {
  const singles = b.h - b.d - b.t - b.hr;
  const d = b.ab + b.bb - b.ibb + b.sf + b.hbp;
  if (d === 0) return 0;
  return (wt.bb * (b.bb - b.ibb) + wt.hbp * b.hbp + wt.b1 * singles + wt.b2 * b.d + wt.b3 * b.t + wt.hr * b.hr) / d;
}

/** 選手のホームのパークファクター（半分はホーム、半分はビジター） */
export const halfPF = (pf: number) => (pf + 1) / 2;

export function batterMetrics(b: BatLine, f: FieldLine | null, ctx: LeagueContext, pf: number): BatterMetrics {
  const avg = b.ab ? b.h / b.ab : 0;
  const obpD = b.ab + b.bb + b.hbp + b.sf;
  const obp = obpD ? (b.h + b.bb + b.hbp) / obpD : 0;
  const tb = b.h + b.d + 2 * b.t + 3 * b.hr;
  const slg = b.ab ? tb / b.ab : 0;
  const babipD = b.ab - b.k - b.hr + b.sf;
  const woba = wobaOf(b, ctx.weights);
  const bpf = halfPF(pf);
  const wraa = ((woba - ctx.woba) / ctx.weights.scale) * b.pa;
  const lgRPA = ctx.rPerPA;
  const batRuns = wraa + (lgRPA - bpf * lgRPA) * b.pa;
  const wrcPlus = b.pa && lgRPA ? ((wraa / b.pa + lgRPA + (lgRPA - bpf * lgRPA)) / lgRPA) * 100 : 0;
  const opsPlus = ctx.obp && ctx.slg ? (100 * (obp / ctx.obp + slg / ctx.slg - 1)) / bpf : 0;
  // 走塁（盗塁）
  const runSB = 0.2;
  const runCS = -(2 * ctx.rPerOut + 0.075);
  const lgB = ctx.bat;
  const lgOpp = lgB.h - lgB.d - lgB.t - lgB.hr + lgB.bb + lgB.hbp - lgB.ibb;
  const lgwSB = lgOpp ? (lgB.sb * runSB + lgB.cs * runCS) / lgOpp : 0;
  const opp = b.h - b.d - b.t - b.hr + b.bb + b.hbp - b.ibb;
  const bsrRuns = b.sb * runSB + b.cs * runCS - lgwSB * opp;
  // 守備（平均的な野手と比べたアウトの増減 ×0.7点）＋捕手の盗塁阻止
  let fldRuns = 0;
  let posRuns = 0;
  if (f) {
    fldRuns = f.outsAboveAvg * 0.7;
    if (f.sbAgainst) fldRuns += (f.csBy - f.sbAgainst * ctx.lgCsPct) * 0.6;
    let fieldOuts = 0;
    for (const [pos, outs] of Object.entries(f.outsAt) as [FieldPos, number][]) {
      if (pos === 'P') continue;
      posRuns += (outs ?? 0) * (ctx.posRunsPerOut[pos] ?? 0);
      fieldOuts += outs ?? 0;
    }
    // DH出場分（守備についていない打席）
    const estOutsPlayed = (b.pa / 4.1) * 27;
    const dhOuts = Math.max(0, estOutsPlayed - fieldOuts);
    posRuns += dhOuts * ctx.posRunsPerOut.DH;
  } else if (b.pa) {
    posRuns += (b.pa / 4.1) * 27 * ctx.posRunsPerOut.DH;
  }
  const war = (batRuns + bsrRuns + fldRuns + posRuns + ctx.repRunsPerPA * b.pa) / ctx.rpw;
  return {
    pa: b.pa, avg, obp, slg, ops: obp + slg, iso: slg - avg, babip: babipD > 0 ? (b.h - b.hr) / babipD : 0,
    kPct: b.pa ? b.k / b.pa : 0, bbPct: b.pa ? b.bb / b.pa : 0, woba, wrcPlus, opsPlus, wraa,
    batRuns, bsrRuns, fldRuns, posRuns, war, rispAvg: b.rispAb ? b.rispH / b.rispAb : 0,
  };
}

export interface PitcherMetrics {
  ip: number; era: number; fip: number; eraPlus: number; whip: number; k9: number; bb9: number; hr9: number;
  kPct: number; bbPct: number; kbbPct: number; babip: number; war: number; gbPct: number;
}

export function fipOf(p: PitchLine, c: number) {
  const ip = p.outs / 3;
  return ip ? (13 * p.hr + 3 * (p.bb - p.ibb + p.hbp) - 2 * p.k) / ip + c : 0;
}

export function pitcherMetrics(p: PitchLine, ctx: LeagueContext, pf: number): PitcherMetrics {
  const ip = p.outs / 3;
  const era = ip ? (p.er * 9) / ip : 0;
  const fip = fipOf(p, ctx.fipConst);
  const ppf = halfPF(pf);
  const fipAdj = fip - ctx.era * (ppf - 1);
  const raPerEra = ctx.era ? ctx.ra9 / ctx.era : 1.08;
  const runsSaved = ((ctx.era - fipAdj) * raPerEra * ip) / 9;
  const war = ip ? (runsSaved + ctx.repRunsPerIP * ip) / ctx.rpw : 0;
  const bip = p.gb + p.fb + p.ld + p.iffb;
  return {
    ip, era, fip, eraPlus: era > 0 ? (100 * ctx.era * ppf) / era : 0, whip: ip ? (p.h + p.bb) / ip : 0,
    k9: ip ? (p.k * 9) / ip : 0, bb9: ip ? (p.bb * 9) / ip : 0, hr9: ip ? (p.hr * 9) / ip : 0,
    kPct: p.bf ? p.k / p.bf : 0, bbPct: p.bf ? p.bb / p.bf : 0, kbbPct: p.bf ? (p.k - p.bb) / p.bf : 0,
    babip: p.bip ? (p.h - p.hr) / p.bip : 0, war, gbPct: bip ? p.gb / bip : 0,
  };
}

/** ピタゴラス期待勝率（指数1.83） */
export function pythag(rs: number, ra: number, exp = 1.83): number {
  if (rs + ra === 0) return 0.5;
  return rs ** exp / (rs ** exp + ra ** exp);
}

/** 規定打席・規定投球回 */
export const qualifiedPA = (teamGames: number) => Math.floor(teamGames * 3.1);
export const qualifiedIP = (teamGames: number) => teamGames;
