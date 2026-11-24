import { offenseValue, pitcherValue } from '../engine/ai';
import type { BullpenRole, FieldPos, GameLineup, Hand, PitcherAvailability, Player, Pos } from '../engine/types';

const DEF_WEIGHT: Record<Exclude<FieldPos, 'P'>, number> = {
  C: 0.55, SS: 0.5, '2B': 0.4, CF: 0.42, '3B': 0.3, RF: 0.25, LF: 0.18, '1B': 0.12,
};
const FILL_ORDER: Exclude<FieldPos, 'P'>[] = ['C', 'SS', '2B', 'CF', '3B', 'RF', 'LF', '1B'];

export function defenseValueAt(p: Player, pos: FieldPos): number {
  const prof = p.bat.positions[pos] ?? 0;
  if (prof < 30) return -100;
  const base = pos === 'C' ? p.bat.fielding * 0.4 + p.bat.arm * 0.4 + p.bat.catching * 0.2 : p.bat.fielding * 0.7 + p.bat.arm * 0.2 + p.bat.catching * 0.1;
  return base - (100 - prof) * 0.5;
}

export interface LineupResult {
  order: { playerId: number; pos: Pos }[];
  bench: number[];
}

/** 自動で打順と守備位置を組む */
export function autoLineup(hitters: Player[], dh: boolean, vs?: Hand, startingPitcher?: number): LineupResult {
  const pool = hitters.filter((p) => !p.isPitcher);
  const used = new Set<number>();
  const assign: { p: Player; pos: Pos }[] = [];
  for (const pos of FILL_ORDER) {
    let best: Player | null = null;
    let bestV = -Infinity;
    for (const p of pool) {
      if (used.has(p.id)) continue;
      const d = defenseValueAt(p, pos);
      if (d < -50) continue;
      const v = offenseValue(p, vs) * (1 - DEF_WEIGHT[pos]) + d * DEF_WEIGHT[pos];
      if (v > bestV) {
        bestV = v;
        best = p;
      }
    }
    if (!best) best = pool.find((p) => !used.has(p.id)) ?? null;
    if (best) {
      used.add(best.id);
      assign.push({ p: best, pos });
    }
  }
  if (dh) {
    const rest = pool.filter((p) => !used.has(p.id)).sort((a, b) => offenseValue(b, vs) - offenseValue(a, vs));
    if (rest[0]) {
      used.add(rest[0].id);
      assign.push({ p: rest[0], pos: 'DH' });
    }
  }
  const order = battingOrder(assign, vs);
  if (!dh && startingPitcher !== undefined) order.push({ playerId: startingPitcher, pos: 'P' });
  const bench = pool.filter((p) => !used.has(p.id)).map((p) => p.id);
  return { order, bench };
}

function battingOrder(assign: { p: Player; pos: Pos }[], vs?: Hand) {
  const list = [...assign].sort((a, b) => offenseValue(b.p, vs) - offenseValue(a.p, vs));
  const top = list.slice(0, 5);
  const rest = list.slice(5);
  const take = (arr: typeof list, score: (p: Player) => number) => {
    let bi = 0;
    for (let i = 1; i < arr.length; i++) if (score(arr[i].p) > score(arr[bi].p)) bi = i;
    return arr.splice(bi, 1)[0];
  };
  const s4 = take(top, (p) => p.bat.power * 1.2 + p.bat.contact * 0.4);
  const s3 = take(top, (p) => offenseValue(p, vs));
  const s1 = take(top, (p) => p.bat.eye * 0.6 + p.bat.contact * 0.6 + p.bat.speed * 0.7);
  const s2 = take(top, (p) => p.bat.contact + p.bat.speed * 0.3);
  const s5 = top[0];
  const ordered = [s1, s2, s3, s4, s5, ...rest].filter(Boolean);
  return ordered.map((a) => ({ playerId: a.p.id, pos: a.pos }));
}

/** ブルペンの役割を能力順に割り当てる */
export function assignBullpen(relievers: Player[]): { playerId: number; role: BullpenRole }[] {
  const sorted = [...relievers].sort((a, b) => pitcherValue(b) - pitcherValue(a));
  return sorted.map((p, i) => ({
    playerId: p.id,
    role: (i === 0 ? 'CL' : i === 1 ? 'SU1' : i === 2 ? 'SU2' : p.pit!.stamina >= 45 && i >= sorted.length - 2 ? 'LONG' : 'MID') as BullpenRole,
  }));
}

/** 投手の登板記録から疲労情報（直近3日の投球数）を作る */
export class PitchLog {
  /** playerId -> day -> pitches */
  private log = new Map<number, Map<number, number>>();
  record(pid: number, day: number, pitches: number) {
    let m = this.log.get(pid);
    if (!m) this.log.set(pid, (m = new Map()));
    m.set(day, (m.get(day) ?? 0) + pitches);
  }
  availability(pid: number, today: number): PitcherAvailability {
    const m = this.log.get(pid);
    return { recent: [1, 2, 3].map((d) => m?.get(today - d) ?? 0) };
  }
  lastAppearance(pid: number): number | null {
    const m = this.log.get(pid);
    if (!m || m.size === 0) return null;
    return Math.max(...m.keys());
  }
  /** 古い記録を捨てる */
  prune(today: number) {
    for (const m of this.log.values()) for (const d of m.keys()) if (d < today - 10) m.delete(d);
  }
  toJSON() {
    return [...this.log].map(([k, v]) => [k, [...v]]);
  }
  static fromJSON(a: [number, [number, number][]][]) {
    const l = new PitchLog();
    for (const [k, v] of a) l.log.set(k, new Map(v));
    return l;
  }
}

/** ローテーションから今日の先発を選ぶ（中5日以上空いている投手を順番に） */
export function pickStarter(rotation: number[], idx: number, lastStart: Map<number, number>, today: number): { id: number; nextIdx: number } {
  for (let k = 0; k < rotation.length; k++) {
    const i = (idx + k) % rotation.length;
    const id = rotation[i];
    const last = lastStart.get(id);
    if (last === undefined || today - last >= 6) return { id, nextIdx: (i + 1) % rotation.length };
  }
  // 全員中5日未満なら最も間隔の空いた投手
  let best = rotation[idx % rotation.length];
  for (const id of rotation) if ((lastStart.get(id) ?? -99) < (lastStart.get(best) ?? -99)) best = id;
  return { id: best, nextIdx: (rotation.indexOf(best) + 1) % rotation.length };
}

export function buildGameLineup(
  hitters: Player[], starter: number, relievers: Player[], dh: boolean, vs?: Hand,
): GameLineup {
  const { order, bench } = autoLineup(hitters, dh, vs, starter);
  return { order, startingPitcher: starter, bench, bullpen: assignBullpen(relievers) };
}
