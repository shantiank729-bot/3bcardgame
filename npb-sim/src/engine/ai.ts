/**
 * 采配AI。試合中の判断（継投・代打・代走・守備固め・作戦）を行う。
 * GameSim から呼ばれ、GameSim の公開メソッド（changePitcher / substitute）で状態を変える。
 */
import type { GameSim, OffenseTactic, SideState } from './game';
import { pitcherStuff } from './pa';
import type { BullpenRole, FieldPos, Hand, Player } from './types';

/** 打者としての総合値（作戦判断用） */
export function offenseValue(p: Player, vs?: Hand): number {
  const b = p.bat;
  let v = b.contact * 0.36 + b.power * 0.34 + b.eye * 0.2 + b.speed * 0.1;
  if (vs) {
    const side = p.bats === 'S' ? (vs === 'R' ? 'L' : 'R') : p.bats;
    if (side === vs) v -= (side === 'L' ? 5 : 3) * (1 - ((b.platoon ?? 50) - 50) / 100);
    else v += 2;
  }
  return v;
}

export function pitcherValue(p: Player): number {
  const pit = p.pit!;
  return pitcherStuff(pit) * 0.55 + pit.control * 0.45;
}

/** 投手がこの試合に投げられるか（連投制限） */
export function relieverAvailable(side: SideState, id: number): boolean {
  if (side.used.has(id)) return false;
  const av = side.team.availability.get(id);
  if (!av) return true;
  const [d1 = 0, d2 = 0, d3 = 0] = av.recent;
  if (d1 > 0 && d2 > 0) return false; // 3連投はしない
  if (d1 >= 35) return false; // 前日に多く投げた
  if (d1 > 0 && d3 > 0 && d2 === 0 && d1 + d3 > 50) return false;
  return true;
}

function availableBullpen(side: SideState) {
  return side.bullpen.filter((b) => relieverAvailable(side, b.playerId));
}

/** 状況に応じたリリーフを選ぶ */
export function pickReliever(g: GameSim, side: SideState): { id: number; role: BullpenRole } | null {
  const lead = g.leadFor(side);
  const inn = g.inning;
  const pool = availableBullpen(side);
  if (pool.length === 0) {
    // 誰もいなければ、疲れていてもブルペンの誰か
    const fatigue = (id: number) => {
      const r = side.team.availability.get(id)?.recent ?? [];
      return (r[0] ?? 0) * 3 + (r[1] ?? 0) * 2 + (r[2] ?? 0);
    };
    const any = side.bullpen.filter((b) => !side.used.has(b.playerId)).sort((a, b) => fatigue(a.playerId) - fatigue(b.playerId))[0];
    return any ? { id: any.playerId, role: any.role } : null;
  }
  const byRole = (r: BullpenRole) => pool.find((b) => b.role === r);
  const close = lead >= 1 && lead <= 3;
  const order: BullpenRole[] = [];
  if (inn >= 9 && (close || (lead === 0 && side.isHome))) order.push('CL', 'SU1', 'SU2');
  else if (inn >= 10) order.push('SU1', 'SU2', 'CL', 'MID');
  else if (inn === 8 && (close || lead === 0)) order.push('SU1', 'SU2');
  else if (inn === 7 && close) order.push('SU2', 'SU1', 'MID');
  else if (inn <= 5) order.push('LONG', 'MID');
  else order.push('MID', 'LONG');
  for (const r of order) {
    const b = byRole(r);
    if (b) return { id: b.playerId, role: b.role };
  }
  // 勝ちパターン以外を優先して残す
  const rest = pool.filter((b) => b.role === 'MID' || b.role === 'LONG');
  const b = (rest.length ? rest : pool)[0];
  return { id: b.playerId, role: b.role };
}

/** 守備につく前（イニング開始時）の投手判断 */
export function beginDefenseHalf(g: GameSim, side: SideState) {
  const ps = side.pitcher;
  const p = side.team.players.get(ps.id)!;
  void p;
  let change = side.needPitcher;
  const lead = g.leadFor(side);
  if (!change) {
    if (ps.role === 'SP') {
      if (ps.pitches >= ps.limit * 0.92) change = true;
      else if (g.inning >= 8 && lead >= 1 && lead <= 3 && ps.pitches > ps.limit * 0.75) change = true;
      else if (g.inning >= 9 && lead >= 1 && lead <= 3 && ps.pitches > 95) change = true;
    } else {
      const innPitched = ps.outs / 3;
      if (ps.role === 'CL' || ps.role === 'SU1' || ps.role === 'SU2') change = innPitched >= 1;
      else if (ps.role === 'MID') change = innPitched >= 2 || ps.pitches > ps.limit * 0.8 || (innPitched >= 1 && g.inning >= 7 && Math.abs(lead) <= 3);
      else change = ps.pitches > ps.limit * 0.85;
    }
  }
  if (change) {
    const r = pickReliever(g, side);
    if (r) g.changePitcher(side, r.id, r.role);
    else side.needPitcher = false;
  }
}

/** イニング途中の継投 */
export function maybeChangePitcherMidInning(g: GameSim, side: SideState) {
  const ps = side.pitcher;
  const fat = g.pitcherFatigue(ps);
  const lead = g.leadFor(side);
  const pl = g.pitchLine(ps.id);
  let change = false;
  if (ps.role === 'SP') {
    if (ps.pitches >= ps.limit + 10) change = true;
    else if (fat > 0.9) change = true;
    else if (pl.r >= 6 && g.inning <= 7) change = true;
    else if (pl.r >= 4 && g.inning <= 4 && ps.pitches > 55 && g.bases.filter(Boolean).length >= 2) change = true;
    else if (g.inning >= 6 && lead >= -1 && lead <= 2 && fat > 0.45 && g.bases.filter(Boolean).length >= 2) change = true;
  } else {
    if (ps.pitches >= ps.limit + 8) change = true;
    else if (pl.r >= 3 && ps.role !== 'LONG') change = true;
    else if (ps.role === 'CL' && pl.r >= 2 && lead <= 0) change = true;
  }
  if (!change) return;
  const r = pickReliever(g, side);
  if (r) g.changePitcher(side, r.id, r.role);
}

function benchPlayers(side: SideState): Player[] {
  return side.bench.filter((id) => !side.used.has(id)).map((id) => side.team.players.get(id)!);
}

/** 代打 */
export function maybePinchHit(g: GameSim, side: SideState) {
  const idx = side.next;
  const slot = side.order[idx];
  const batter = side.team.players.get(slot.playerId)!;
  const def = side === g.away ? g.home : g.away;
  const vs = def.team.players.get(def.pitcher.id)!.throws;
  const bench = benchPlayers(side).filter((p) => !p.isPitcher);
  if (bench.length === 0) return;
  const lead = g.leadFor(side);
  const best = bench.reduce((a, b) => (offenseValue(b, vs) > offenseValue(a, vs) ? b : a));
  if (slot.pos === 'P') {
    // DHなしで投手の打席
    const ps = side.pitcher;
    const tired = ps.role !== 'SP' || ps.pitches > ps.limit * 0.8 || g.inning >= 7;
    const chance = g.bases[1] || g.bases[2];
    if ((tired && g.inning >= 5 && (lead <= 2 || chance)) || (g.inning >= 7 && Math.abs(lead) <= 4)) {
      g.substitute(side, idx, best.id, 'PH');
    }
    return;
  }
  if (g.inning < 7 || side.phUsed >= 3 || Math.abs(lead) > 3) return;
  const gain = offenseValue(best, vs) - offenseValue(batter, vs);
  if (gain > 10 || (gain > 6 && (g.bases[1] || g.bases[2]) && g.inning >= 8)) {
    side.phUsed++;
    g.substitute(side, idx, best.id, 'PH');
  }
}

/** 代走 */
export function maybePinchRun(g: GameSim, side: SideState) {
  if (g.inning < 8) return;
  const lead = g.leadFor(side);
  if (lead < -1 || lead > 0) return;
  const bench = benchPlayers(side).filter((p) => !p.isPitcher && p.bat.speed >= 70);
  if (bench.length === 0) return;
  for (const i of [1, 0] as const) {
    const r = g.bases[i];
    if (!r) continue;
    const runner = side.team.players.get(r.id)!;
    if (runner.bat.speed >= 45 || runner.isPitcher) continue;
    const fast = bench.sort((a, b) => b.bat.speed - a.bat.speed)[0];
    const slotIdx = side.order.findIndex((s) => s.playerId === r.id);
    if (slotIdx < 0) continue;
    g.substitute(side, slotIdx, fast.id, 'PR');
    return;
  }
}

/** 守備固め（終盤リード時） */
export function defensiveSubs(g: GameSim, side: SideState) {
  if (g.inning < 8) return;
  const lead = g.leadFor(side);
  if (lead < 1 || lead > 3) return;
  let n = 0;
  for (let i = 0; i < 9 && n < 2; i++) {
    const slot = side.order[i];
    if (slot.pos === 'DH' || slot.pos === 'P' || slot.pos === 'C') continue;
    const pos = slot.pos as FieldPos;
    const cur = side.team.players.get(slot.playerId)!;
    const curVal = cur.bat.fielding - (100 - (cur.bat.positions[pos] ?? 0)) * 0.5;
    const cand = benchPlayers(side)
      .filter((p) => !p.isPitcher && (p.bat.positions[pos] ?? 0) >= 80)
      .sort((a, b) => b.bat.fielding - a.bat.fielding)[0];
    if (cand && cand.bat.fielding - curVal >= 18 && offenseValue(cur) < 62) {
      g.substitute(side, i, cand.id, 'DEF', pos);
      n++;
    }
  }
}

/** 代打・代走の選手が守れない位置にいたら整える */
export function fixDefense(g: GameSim, side: SideState) {
  // 捕手がいなければ控え捕手を入れる
  for (let i = 0; i < 9; i++) {
    const slot = side.order[i];
    if (slot.pos === 'DH' || slot.pos === 'P') continue;
    const pos = slot.pos as FieldPos;
    const p = side.team.players.get(slot.playerId)!;
    const prof = p.bat.positions[pos] ?? 0;
    if (prof >= 40) continue;
    const cand = benchPlayers(side)
      .filter((b) => !b.isPitcher && (b.bat.positions[pos] ?? 0) >= 60)
      .sort((a, b) => (b.bat.positions[pos] ?? 0) + b.bat.fielding - ((a.bat.positions[pos] ?? 0) + a.bat.fielding))[0];
    if (cand) g.substitute(side, i, cand.id, 'DEF', pos);
  }
  // 守備位置の再計算
  for (const s of side.order) if (s.pos !== 'DH' && s.pos !== 'P') side.defense[s.pos as FieldPos] = s.playerId;
}

/** 攻撃の作戦 */
export function chooseTactic(g: GameSim, side: SideState): OffenseTactic {
  const rng = g.rng;
  const [b1, b2, b3] = g.bases;
  const lead = g.leadFor(side);
  const batter = side.team.players.get(side.order[side.next].playerId)!;
  const small = (side.team.smallBall ?? 50) / 50;
  const ov = offenseValue(batter);
  const late = g.inning >= 7;
  const close = Math.abs(lead) <= 1 || (lead < 0 && lead >= -2 && late);

  // スクイズ
  if (b3 && g.outs === 1 && late && close && ov < 50 && rng.chance(0.12 * small)) return 'squeeze';
  // 送りバント
  if ((b1 || b2) && !b3 && g.outs === 0) {
    if (batter.isPitcher) return rng.chance(0.85) ? 'bunt' : 'none';
    let p = late && close ? 0.6 : g.inning <= 2 ? 0.22 : 0.25;
    if (Math.abs(lead) >= 4) p = 0.01;
    const slotIdx = side.next;
    if (slotIdx >= 2 && slotIdx <= 5) p *= 0.15; // クリーンアップは打たせる
    if (ov > 60) p *= 0.2;
    else if (ov < 42) p *= 1.6;
    if (b2 && !b1) p *= 0.55;
    if (rng.chance(p * small)) return 'bunt';
  }
  if (batter.isPitcher && (b1 || b2) && g.outs === 1 && rng.chance(0.5)) return 'bunt';
  // 盗塁
  if (b1 && !b2 && Math.abs(lead) <= 4) {
    const r = side.team.players.get(b1.id)!;
    const s = r.bat.speed;
    if (s >= 52) {
      const p = Math.pow((s - 45) / 55, 1.4) * 0.65 * small * (g.outs === 2 ? 0.8 : 1);
      if (rng.chance(p)) return 'steal';
    }
    // エンドラン
    if (g.outs < 2 && batter.bat.contact >= 55 && rng.chance(0.03 * small)) return 'hitrun';
  }
  if (b2 && !b3 && g.outs < 2) {
    const r = side.team.players.get(b2.id)!;
    if (r.bat.speed >= 75 && rng.chance(0.025 * small)) return 'steal3';
  }
  return 'none';
}

/** 敬遠するか */
export function shouldIBB(g: GameSim, def: SideState, off: SideState): boolean {
  const [b1, b2, b3] = g.bases;
  if (b1 || !(b2 || b3)) return false;
  const lead = g.leadFor(def);
  const batter = off.team.players.get(off.order[off.next].playerId)!;
  const nextP = off.team.players.get(off.order[(off.next + 1) % 9].playerId)!;
  const vb = offenseValue(batter);
  const vn = offenseValue(nextP);
  if (nextP.isPitcher && g.outs === 2 && g.inning <= 6 && vb > 35 && g.rng.chance(0.35)) return true;
  if (g.inning >= 7 && lead >= -1 && lead <= 1 && vb >= 48 && vn < vb - 4 && g.rng.chance(0.6)) return true;
  if (g.outs >= 1 && vb >= 56 && vn < vb - 8 && lead >= -2 && lead <= 2 && g.rng.chance(0.35)) return true;
  return false;
}

export function infieldIn(g: GameSim, def: SideState): boolean {
  if (!g.bases[2] || g.outs >= 2) return false;
  const lead = g.leadFor(def);
  return g.inning >= 7 && lead >= 0 && lead <= 1;
}
