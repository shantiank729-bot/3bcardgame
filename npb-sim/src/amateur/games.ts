/** アマチュアの試合（エンジンの簡易モードを使う） */
import { DEFAULT_TUNING } from '../engine/constants';
import { GameSim, simulateGame, type GameResult } from '../engine/game';
import { NORM_REF, pitcherStuff, type RatingNorm } from '../engine/pa';
import { pitcherValue } from '../engine/ai';
import { NEUTRAL_PARK } from '../engine/parks';
import type { Park, TeamGameInput } from '../engine/types';
import { addDays, dayDiff } from '../league/calendar';
import { autoLineup } from '../league/roster';
import type { Amateur, AmateurWorld } from './types';

const KOSHIEN: Park = { id: 900, name: '甲子園球場', lf: 95, cf: 118, rf: 95, hrFactor: 0.85, hitFactor: 1.03, doubleFactor: 1.05, tripleFactor: 1.2, dome: false, turf: false };
const JINGU: Park = { id: 901, name: '神宮球場', lf: 97, cf: 120, rf: 97, hrFactor: 1.05, hitFactor: 1.0, doubleFactor: 1.0, tripleFactor: 1.0, dome: false, turf: true };
const LOCAL: Park = { ...NEUTRAL_PARK, id: 902, name: '県営球場', turf: false };
export const AM_PARKS = { KOSHIEN, JINGU, LOCAL };

let clubCache: { ref: object; count: number; tick: string; map: Map<number, Amateur[]> } | null = null;
let clubVersion = 0;
/** 入学・進学で所属が変わったときに呼ぶ */
export function invalidateClubs() {
  clubVersion++;
}
/** 部員（引退した3年生を除く）。学校ごとの索引をキャッシュ */
export const clubMembers = (am: AmateurWorld, sid: number) => {
  const count = clubVersion;
  if (!clubCache || clubCache.ref !== am.players || clubCache.count !== count || clubCache.tick !== am.lastTick) {
    const map = new Map<number, Amateur[]>();
    for (const p of Object.values(am.players)) (map.get(p.schoolId) ?? map.set(p.schoolId, []).get(p.schoolId)!).push(p);
    clubCache = { ref: am.players, count, tick: am.lastTick, map };
  }
  return (clubCache.map.get(sid) ?? []).filter((p) => p.schoolId === sid && !p.retiredFromClub && am.players[p.id]);
};

/** アマチュアの能力基準（エンジンは能力の平均との差で計算する） */
export function amateurNorm(am: AmateurWorld, stage: 'HS' | 'UNI' | 'SHA'): RatingNorm {
  const H: Amateur[] = [];
  const P: Amateur[] = [];
  for (const s of Object.values(am.schools)) {
    if (s.kind !== stage) continue;
    const m = clubMembers(am, s.id);
    const lu = autoLineup(m.filter((p) => !p.isPitcher), true);
    for (const o of lu.order) H.push(am.players[o.playerId]);
    const ps = m.filter((p) => p.isPitcher).sort((a, b) => pitcherValue(b) - pitcherValue(a)).slice(0, 2);
    P.push(...ps);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 50);
  // アマチュアは打者に対して投手の差が大きく出すぎないよう、投手の基準を少し甘く
  return {
    contact: avg(H.map((p) => p.bat.contact)) - NORM_REF.contact,
    power: avg(H.map((p) => p.bat.power)) - NORM_REF.power + 6,
    eye: avg(H.map((p) => p.bat.eye)) - NORM_REF.eye,
    speed: avg(H.map((p) => p.bat.speed)) - NORM_REF.speed,
    fielding: avg(H.map((p) => p.bat.fielding)) - NORM_REF.fielding + 4,
    stuff: avg(P.map((p) => pitcherStuff(p.pit!))) - NORM_REF.stuff,
    control: avg(P.map((p) => p.pit!.control)) - NORM_REF.control + 3,
  };
}

const dkey = (d: string) => String(dayDiff('2000-01-01', d));

/** 学校の試合用メンバー（エースから順に、疲労と球数制限を考える） */
export function schoolInput(am: AmateurWorld, sid: number, date: string): TeamGameInput {
  const s = am.schools[sid];
  const m = clubMembers(am, sid);
  const pitchers = m.filter((p) => p.isPitcher).sort((a, b) => pitcherValue(b) - pitcherValue(a));
  const recent = (pid: number, back: number) => am.pitchLog[pid]?.[dkey(addDays(date, -back))] ?? 0;
  const week = (pid: number) => [1, 2, 3, 4, 5, 6].reduce((t, d) => t + recent(pid, d), 0);
  // 1週間500球の制限、前日100球以上は避ける
  const sp = pitchers.find((p) => week(p.id) + 110 <= 500 && recent(p.id, 1) < 100) ?? pitchers.find((p) => week(p.id) < 500) ?? pitchers[0];
  const hitters = m.filter((p) => !p.isPitcher);
  // 野手が足りなければ投手も野手として使う（外野手として出場）
  const extra = hitters.length >= 9 ? [] : pitchers.filter((p) => p !== sp).slice(0, 9 - hitters.length).map((p) => ({ ...p, isPitcher: false, bat: { ...p.bat, positions: { ...p.bat.positions, LF: 50, RF: 50, '1B': 50 } } }));
  const lu = autoLineup([...hitters, ...extra], true, undefined, sp?.id);
  const pen = pitchers.filter((p) => p !== sp && !lu.order.some((o) => o.playerId === p.id));
  const map = new Map<number, Amateur>(m.map((p) => [p.id, p]));
  for (const e of extra) map.set(e.id, e);
  return {
    teamId: sid, name: s.name, players: map,
    lineup: { order: lu.order, startingPitcher: sp.id, bench: lu.bench, bullpen: pen.map((p, i) => ({ playerId: p.id, role: i === 0 ? 'CL' : 'MID' })) },
    availability: new Map(pitchers.map((p) => [p.id, { recent: [recent(p.id, 1), recent(p.id, 2), recent(p.id, 3)] }])),
    smallBall: s.kind === 'HS' ? 80 : 60,
  };
}

export interface AmGameOpts {
  park: Park;
  seed: number;
  norm: RatingNorm;
  stage: 'HS' | 'UNI' | 'SHA';
  log?: boolean;
}

function gameOptions(o: AmGameOpts) {
  return {
    dh: true, seed: o.seed, log: !!o.log, maxInnings: null, norm: o.norm,
    tuning: { ...DEFAULT_TUNING, error: o.stage === 'HS' ? 0.05 : 0.036 }, offenseShift: o.stage === 'HS' ? 0.08 : 0.03,
  };
}

export function playAmateurGame(am: AmateurWorld, a: number, b: number, date: string, o: AmGameOpts): GameResult {
  return simulateGame(schoolInput(am, a, date), schoolInput(am, b, date), o.park, gameOptions(o));
}

/** 観戦用（同じ入力・同じ乱数なので、あとで自動計算しても同じ結果になる） */
export function liveAmateurGame(am: AmateurWorld, a: number, b: number, date: string, o: AmGameOpts): GameSim {
  return new GameSim(schoolInput(am, a, date), schoolInput(am, b, date), o.park, { ...gameOptions(o), log: true });
}

/** 試合結果を個人成績・注目度・登板記録に反映 */
export function recordAmateurGame(am: AmateurWorld, res: GameResult, date: string, key: string, hypeW: number, leaders?: Record<number, number[]>) {
  const k = dkey(date);
  for (const [pid, l] of res.bat) {
    const p = am.players[pid];
    if (!p) continue;
    for (const kk of [key.slice(0, 4), key]) {
      const a = (p.sbat[kk] ??= [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      const add = [1, l.ab, l.h, l.d, l.t, l.hr, l.rbi, l.bb + l.hbp, l.k, l.sb];
      add.forEach((v, i) => (a[i] += v));
      if (kk === key.slice(0, 4) && key.length === 4) break;
    }
    p.hype = Math.round(Math.min(100, p.hype + (l.h * 0.6 + l.hr * 3 + l.rbi * 0.4) * hypeW) * 10) / 10;
    if (leaders) {
      const L = (leaders[pid] ??= [0, 0, 0, 0, 0, 0, 0]);
      L[0] += l.h; L[1] += l.ab; L[2] += l.hr; L[3] += l.rbi;
    }
  }
  for (const [pid, l] of res.pitch) {
    const p = am.players[pid];
    if (!p) continue;
    for (const kk of [key.slice(0, 4), key]) {
      const a = (p.spit[kk] ??= [0, 0, 0, 0, 0, 0, 0, 0]);
      [1, l.outs, l.h, l.er, l.bb + l.hbp, l.k, l.w, l.l].forEach((v, i) => (a[i] += v));
      if (kk === key.slice(0, 4) && key.length === 4) break;
    }
    (am.pitchLog[pid] ??= {})[k] = l.pitches;
    p.hype = Math.round(Math.max(0, Math.min(100, p.hype + (l.k * 0.35 + l.outs / 9 - l.er * 0.3 + (l.w ? 1.5 : 0)) * hypeW)) * 10) / 10;
    if (leaders) {
      const L = (leaders[pid] ??= [0, 0, 0, 0, 0, 0, 0]);
      L[4] += l.k; L[5] += l.outs; L[6] += l.er;
    }
  }
}

export function prunePitchLog(am: AmateurWorld, date: string) {
  const lim = Number(dkey(date)) - 10;
  for (const pid in am.pitchLog) {
    for (const k in am.pitchLog[pid]) if (Number(k) < lim) delete am.pitchLog[pid][k];
    if (Object.keys(am.pitchLog[pid]).length === 0) delete am.pitchLog[pid];
  }
}

export function heroOf(res: GameResult, winnerSide: 'home' | 'away', homeIds: Set<number>): number | null {
  let best: number | null = null, bv = -1e9;
  for (const [pid, l] of res.bat) {
    if ((winnerSide === 'home') !== homeIds.has(pid)) continue;
    const v = l.h + l.hr * 3 + l.rbi * 1.2 + l.d;
    if (v > bv) { bv = v; best = pid; }
  }
  for (const [pid, l] of res.pitch) {
    if ((winnerSide === 'home') !== homeIds.has(pid)) continue;
    const v = l.outs / 3 * 0.9 + l.k * 0.35 - l.er;
    if (v > bv) { bv = v; best = pid; }
  }
  return best;
}
