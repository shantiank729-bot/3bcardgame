/**
 * 二軍（ファーム）。一軍の試合がある日に、東西2地区で簡易的に試合を行う。
 * 二軍の選手と育成選手（1試合5人まで）が出場し、成績は昇格判断や若手の成長に使う。
 */
import { simulateGame } from '../engine/game';
import { pitcherValue } from '../engine/ai';
import { NEUTRAL_PARK } from '../engine/parks';
import { Rng } from '../engine/rng';
import type { TeamGameInput } from '../engine/types';
import { addLine, addField, emptyBat, emptyField, emptyPitch } from '../engine/box';
import { autoLineup } from './roster';
import { rosterOf, type PlayerRecord, type PlayerSeason, type World } from './world';

export const FARM_DIVISIONS: { name: string; teams: number[] }[] = [
  { name: 'ファーム東地区', teams: [1, 2, 6, 8, 9, 10, 11] },
  { name: 'ファーム西地区', teams: [3, 4, 5, 7, 12] },
];

export interface FarmState {
  year: number;
  /** 順位表 tid -> [勝, 敗, 分] */
  table: Record<number, [number, number, number]>;
  /** 二軍の個人成績 */
  stats: Record<string, PlayerSeason>;
  /** 二軍の投手の登板記録 pid -> {dayIndex: pitches} */
  pitchLog: Record<number, Record<number, number>>;
  games: number;
}

export function emptyFarm(year: number): FarmState {
  const table: FarmState['table'] = {};
  for (const d of FARM_DIVISIONS) for (const t of d.teams) table[t] = [0, 0, 0];
  return { year, table, stats: {}, pitchLog: {}, games: 0 };
}

function farmInput(w: World, tid: number, today: number): TeamGameInput | null {
  const f = w.farm!;
  const farm = rosterOf(w, tid, 'farm').filter((p) => !p.injury);
  // 育成選手は1試合5人まで（伸びしろの大きい順）
  const ik = rosterOf(w, tid, 'ikusei').filter((p) => !p.injury).sort((a, b) => b.pot - a.pot).slice(0, 5);
  const all: PlayerRecord[] = [...farm, ...ik];
  const pitchers = all.filter((p) => p.isPitcher);
  const hitters = all.filter((p) => !p.isPitcher);
  if (pitchers.length < 3 || hitters.length < 9) return null;
  const rec = (pid: number, d: number) => f.pitchLog[pid]?.[today - d] ?? 0;
  const rested = (pid: number) => [1, 2, 3, 4, 5].every((d) => rec(pid, d) === 0);
  // 先発: 中5日以上空いたスタミナのある投手（若手を優先して経験を積ませる）
  const sps = pitchers.filter((p) => p.pit!.stamina >= 45 && rested(p.id)).sort((a, b) => a.age - b.age + (pitcherValue(b) - pitcherValue(a)) * 0.05);
  const sp = sps[0] ?? pitchers.sort((a, b) => rec(a.id, 1) - rec(b.id, 1))[0];
  const lu = autoLineup(hitters, true, undefined, sp.id);
  return {
    teamId: tid, name: 'farm', players: new Map(all.map((p) => [p.id, p])),
    lineup: { order: lu.order, startingPitcher: sp.id, bench: lu.bench, bullpen: pitchers.filter((p) => p !== sp).map((p) => ({ playerId: p.id, role: 'MID' as const })) },
    availability: new Map(pitchers.map((p) => [p.id, { recent: [rec(p.id, 1), rec(p.id, 2), rec(p.id, 3)] }])),
    smallBall: 50,
  };
}

function entry(store: Record<string, PlayerSeason>, pid: number, tid: number) {
  const k = `${pid}-${tid}`;
  return (store[k] ??= { pid, tid, bat: null, pitch: null, field: null });
}

/** その日の二軍戦 */
export function playFarmDay(w: World, today: number, seed: number) {
  if (!w.farm || w.farm.year !== w.year) w.farm = emptyFarm(w.year);
  const f = w.farm;
  const rng = new Rng(seed);
  for (const div of FARM_DIVISIONS) {
    const order = [...div.teams].sort(() => rng.next() - 0.5);
    for (let i = 0; i + 1 < order.length; i += 2) {
      const a = order[i], h = order[i + 1];
      const ai = farmInput(w, a, today), hi = farmInput(w, h, today);
      if (!ai || !hi) continue;
      const res = simulateGame(ai, hi, NEUTRAL_PARK, { dh: true, seed: rng.int(1, 2 ** 30), log: false, maxInnings: 10, norm: w.norm });
      const homeIds = new Set(res.appeared.get(h) ?? []);
      const tidOf = (pid: number) => (homeIds.has(pid) ? h : a);
      for (const [pid, l] of res.bat) { const e = entry(f.stats, pid, tidOf(pid)); e.bat = addLine(e.bat ?? emptyBat(), l); }
      for (const [pid, l] of res.pitch) { const e = entry(f.stats, pid, tidOf(pid)); e.pitch = addLine(e.pitch ?? emptyPitch(), l); }
      for (const [pid, l] of res.field) { const e = entry(f.stats, pid, tidOf(pid)); e.field = addField(e.field ?? emptyField(), l); }
      for (const [pid, n] of res.pitchCounts) (f.pitchLog[pid] ??= {})[today] = n;
      const r = res.homeRuns > res.awayRuns ? 0 : res.homeRuns < res.awayRuns ? 1 : 2;
      if (r === 2) { f.table[a][2]++; f.table[h][2]++; }
      else { f.table[r === 0 ? h : a][0]++; f.table[r === 0 ? a : h][1]++; }
      f.games++;
    }
  }
  for (const pid in f.pitchLog) for (const d in f.pitchLog[pid]) if (Number(d) < today - 7) delete f.pitchLog[pid][d];
}

/** 二軍の成績の目安（OPS・防御率） */
export function farmLine(w: World, pid: number) {
  let ab = 0, h = 0, bb = 0, hbp = 0, sf = 0, tb = 0, outs = 0, er = 0, pa = 0;
  const p = w.players[pid];
  const direct = p?.teamId ? w.farm?.stats[`${pid}-${p.teamId}`] : undefined;
  for (const e of direct ? [direct] : Object.values(w.farm?.stats ?? {})) {
    if (e.pid !== pid) continue;
    if (e.bat) { ab += e.bat.ab; h += e.bat.h; bb += e.bat.bb; hbp += e.bat.hbp; sf += e.bat.sf; pa += e.bat.pa; tb += e.bat.h + e.bat.d + 2 * e.bat.t + 3 * e.bat.hr; }
    if (e.pitch) { outs += e.pitch.outs; er += e.pitch.er; }
  }
  const obp = (h + bb + hbp) / Math.max(1, ab + bb + hbp + sf);
  return { pa, ops: obp + tb / Math.max(1, ab), avg: h / Math.max(1, ab), ip: outs / 3, era: outs ? (er * 27) / outs : 0 };
}

export function farmStandings(w: World) {
  const f = w.farm;
  return FARM_DIVISIONS.map((d) => ({
    name: d.name,
    rows: d.teams.map((t) => ({ tid: t, w: f?.table[t]?.[0] ?? 0, l: f?.table[t]?.[1] ?? 0, t: f?.table[t]?.[2] ?? 0 }))
      .sort((x, y) => y.w / Math.max(1, y.w + y.l) - x.w / Math.max(1, x.w + x.l)),
  }));
}
