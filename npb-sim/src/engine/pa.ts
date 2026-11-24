import type { EngineTuning } from './constants';
import type { FieldPos, Hand, Park, Player, PitcherRatings } from './types';
import type { Rng } from './rng';

export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

/**
 * 一般化 log5（オッズ比法）: 打者の率 b、投手の率 p、リーグ平均 l から対戦時の確率を返す。
 * odds = (b/(1-b)) * (p/(1-p)) / (l/(1-l))
 * エンジン内部ではこれを対数オッズの足し算として実装している（同値）。
 */
export function log5(b: number, p: number, l: number): number {
  const o = ((b / (1 - b)) * (p / (1 - p))) / (l / (1 - l));
  return o / (1 + o);
}

/** 投手の「球威」総合値(1-100): 球速と変化球の質から */
export function pitcherStuff(pit: PitcherRatings): number {
  const vel = 50 + (pit.velocity - 147) * 2.6;
  const qs = pit.pitches.map((p) => p.quality).sort((a, b) => b - a);
  const q = (i: number) => qs[i] ?? 20;
  const arsenal = q(0) * 0.5 + q(1) * 0.3 + q(2) * 0.2;
  return clamp(vel * 0.5 + arsenal * 0.5, 1, 110);
}

/** 落ちる球（フォーク・スプリット・チェンジ）は三振を、シンカー・シュートはゴロを増やす */
function pitchMix(pit: PitcherRatings) {
  let kBonus = 0;
  let gbBonus = 0;
  for (const p of pit.pitches) {
    const w = (p.quality - 50) / 50;
    if (p.type === 'FK' || p.type === 'SF') kBonus += 0.07 * w + 0.03;
    if (p.type === 'CH') kBonus += 0.03 * w;
    if (p.type === 'SI' || p.type === 'SH') gbBonus += 0.12 * w + 0.05;
    if (p.type === 'CB') gbBonus += 0.03;
  }
  return { kBonus, gbBonus };
}

/** 守備位置ごとの実効守備能力 */
export interface FielderDef {
  playerId: number;
  range: number;
  arm: number;
  hands: number;
}
export type DefenseMap = Record<FieldPos, FielderDef>;

export type BattedBall = 'GB' | 'LD' | 'FB' | 'IFFB';

export interface BipResult {
  type: BattedBall;
  /** 0=凡打, 1=単打, 2=二塁打, 3=三塁打 */
  hit: 0 | 1 | 2 | 3;
  fielder: FieldPos;
  error: boolean;
  /** 見た目用: 打球方向(度, -45=三塁線 0=中堅 +45=一塁線)と飛距離(m) */
  angle: number;
  distance: number;
  /** 平均的な野手ならアウトになっていた確率（守備評価用） */
  expOut: number;
}

export type PAKind = 'K' | 'BB' | 'HBP' | 'HR' | 'BIP';
export interface PAOutcome {
  kind: PAKind;
  bip?: BipResult;
  /** 本塁打の方向・飛距離 */
  angle?: number;
  distance?: number;
}

export interface PAContext {
  batter: Player;
  pitcher: Player;
  /** 投手の疲労 0=なし, 1=かなり疲れている */
  fatigue: number;
  /** 同じ投手と対戦するのが何巡目か(1,2,3..) */
  timesFaced: number;
  park: Park;
  defense: DefenseMap;
  tuning: EngineTuning;
  /** エンドラン中（三振が減り、ゴロ・ライナーが増える） */
  hitAndRun?: boolean;
  /** 前進守備 */
  infieldIn?: boolean;
  /** アマチュアなど能力スケールの違う世界で使う全体補正（ロジット加算） */
  offenseShift?: number;
}

export function battingSide(batter: Player, pitcherHand: Hand): Hand {
  if (batter.bats === 'S') return pitcherHand === 'R' ? 'L' : 'R';
  return batter.bats;
}

/** 打席の各段階で使うロジット補正をまとめて計算（テストやUIの期待値表示にも使う） */
export function paLogits(ctx: PAContext) {
  const b = ctx.batter.bat;
  const pit = ctx.pitcher.pit!;
  const t = ctx.tuning;
  const side = battingSide(ctx.batter, ctx.pitcher.throws);
  const sameSide = side === ctx.pitcher.throws;
  const platoonMag = 1 - ((b.platoon ?? 50) - 50) / 100;
  // 同じ側（右対右・左対左）は打者不利。左打者対左投手の方が影響が大きい。
  const pl = (sameSide ? (side === 'L' ? 1.25 : 0.9) : -0.55) * platoonMag;
  const form = (ctx.batter.form ?? 0) - (ctx.pitcher.form ?? 0) * 0.8;
  const f = ctx.fatigue;
  const stuff = pitcherStuff(pit) - 18 * f;
  const control = pit.control - 15 * f;
  const mix = pitchMix(pit);
  const tto = ctx.timesFaced >= 3 ? 0.06 * (ctx.timesFaced - 2) : 0;
  const shift = ctx.offenseShift ?? 0;
  return {
    sameSide,
    stuff,
    hbp: logit(t.hbp) - 0.012 * (control - 50),
    bb: logit(t.bb) + 0.017 * (b.eye - 50) - 0.019 * (control - 50) - 0.08 * pl + 0.06 * form + 0.15 * f + shift * 0.5,
    k:
      logit(t.k) - 0.02 * (b.contact - 50) - 0.005 * (b.eye - 50) + 0.017 * (stuff - 50) + mix.kBonus +
      0.13 * pl - 0.1 * form - tto - (ctx.hitAndRun ? 0.35 : 0) - shift,
    hr:
      logit(t.hr) + 0.032 * (b.power - 50) - 0.009 * (stuff - 50) - 0.011 * pit.groundball - mix.gbBonus * 0.5 +
      Math.log(ctx.park.hrFactor) - 0.14 * pl + 0.12 * form + 0.25 * f + tto - (ctx.hitAndRun ? 0.4 : 0) + shift,
    gb: logit(t.gb) - 0.009 * (b.power - 50) + 0.016 * pit.groundball + mix.gbBonus + (ctx.hitAndRun ? 0.4 : 0),
    ld: logit(t.ld) + 0.006 * (b.contact - 50) - 0.003 * (stuff - 50),
    iffb: logit(t.iffb) + 0.01 * (stuff - 50) - 0.008 * (b.power - 50) + 0.1 * pl,
    hitAdj: 0.0085 * (b.contact - 50) - 0.004 * (stuff - 50) - 0.05 * pl + 0.08 * form + 0.12 * f + tto * 0.5 + shift * 0.6,
    side,
  };
}

const GB_R: [FieldPos, number][] = [['3B', 0.25], ['SS', 0.31], ['2B', 0.22], ['1B', 0.14], ['P', 0.08]];
const GB_L: [FieldPos, number][] = [['1B', 0.24], ['2B', 0.3], ['SS', 0.25], ['3B', 0.13], ['P', 0.08]];
const OF_R: [FieldPos, number][] = [['LF', 0.38], ['CF', 0.36], ['RF', 0.26]];
const OF_L: [FieldPos, number][] = [['RF', 0.38], ['CF', 0.36], ['LF', 0.26]];
const IF_LD: [FieldPos, number][] = [['3B', 0.25], ['SS', 0.27], ['2B', 0.27], ['1B', 0.21]];
const IFFB: [FieldPos, number][] = [['C', 0.12], ['1B', 0.18], ['2B', 0.2], ['SS', 0.2], ['3B', 0.25], ['P', 0.05]];

function pickPos(rng: Rng, table: [FieldPos, number][]): FieldPos {
  let r = rng.next();
  for (const [p, w] of table) {
    r -= w;
    if (r < 0) return p;
  }
  return table[table.length - 1][0];
}

const POS_ANGLE: Record<FieldPos, number> = {
  P: 0, C: 0, '1B': 38, '2B': 15, SS: -15, '3B': -38, LF: -28, CF: 0, RF: 28,
};
export const isOutfield = (p: FieldPos) => p === 'LF' || p === 'CF' || p === 'RF';

/** 1打席を解決する（作戦・走者の処理は game.ts 側） */
export function resolvePA(ctx: PAContext, rng: Rng): PAOutcome {
  const L = paLogits(ctx);
  const t = ctx.tuning;
  if (rng.chance(sigmoid(L.hbp))) return { kind: 'HBP' };
  if (rng.chance(sigmoid(L.bb))) return { kind: 'BB' };
  if (rng.chance(sigmoid(L.k))) return { kind: 'K' };
  const right = L.side === 'R';
  if (rng.chance(sigmoid(L.hr))) {
    const pull = rng.chance(0.62);
    const base = pull ? (right ? -22 : 22) : rng.normal(0, 14);
    return { kind: 'HR', angle: clamp(base + rng.normal(0, 9), -44, 44), distance: 105 + Math.abs(rng.normal(12, 9)) };
  }
  // 打球の種類
  let type: BattedBall;
  if (rng.chance(sigmoid(L.gb))) type = 'GB';
  else if (rng.chance(sigmoid(L.ld))) type = 'LD';
  else type = rng.chance(sigmoid(L.iffb)) ? 'IFFB' : 'FB';

  let fielder: FieldPos;
  if (type === 'GB') fielder = pickPos(rng, right ? GB_R : GB_L);
  else if (type === 'IFFB') fielder = pickPos(rng, IFFB);
  else if (type === 'LD' && rng.chance(0.27)) fielder = pickPos(rng, IF_LD);
  else fielder = pickPos(rng, right ? OF_R : OF_L);

  const d = ctx.defense[fielder];
  const b = ctx.batter.bat;
  const baseHit = type === 'GB' ? t.hitGB : type === 'LD' ? t.hitLD : type === 'FB' ? t.hitFB : t.hitIFFB;
  let x = logit(baseHit) + L.hitAdj;
  if (type === 'GB') {
    x += 0.011 * (b.speed - 50) + (ctx.park.turf ? 0.05 : -0.03) + (ctx.infieldIn ? 0.45 : 0);
  }
  if (type !== 'IFFB') x += Math.log(ctx.park.hitFactor);
  if (type === 'LD' && !isOutfield(fielder)) x -= 0.9; // 内野へのライナーはほぼアウト
  const defAdj = -0.008 * (d.range - 50) * (type === 'IFFB' ? 0.2 : 1);
  const pHitAvg = sigmoid(x);
  const pHit = sigmoid(x + defAdj);
  let hit: 0 | 1 | 2 | 3 = 0;
  let error = false;
  if (rng.chance(pHit)) {
    hit = 1;
    const ofHit = isOutfield(fielder) || (type === 'LD' && rng.chance(0.5));
    if (ofHit && type !== 'GB') {
      const dbase = type === 'LD' ? t.dblLD : t.dblFB;
      const xd = logit(dbase) + 0.022 * (b.power - 50) + 0.008 * (b.speed - 50) - 0.006 * (d.arm - 50) +
        Math.log(ctx.park.doubleFactor) + (fielder === 'CF' ? 0.1 : 0);
      if (rng.chance(sigmoid(xd))) {
        hit = 2;
        const xt = logit(t.triple) + 0.045 * (b.speed - 50) + Math.log(ctx.park.tripleFactor) +
          (fielder === 'CF' || fielder === 'RF' ? 0.3 : -0.4) + (ctx.park.cf - 122) * 0.04;
        if (rng.chance(sigmoid(xt))) hit = 3;
      }
    } else if (type === 'GB' && (fielder === '3B' || fielder === '1B')) {
      if (rng.chance(t.dblGB * 2 * (0.6 + b.power / 100))) hit = 2;
    }
  } else {
    // 凡打 → 失策判定
    const em = type === 'GB' ? 1.45 : type === 'IFFB' ? 0.25 : type === 'LD' ? 0.3 : 0.45;
    const pe = t.error * em * Math.exp(-0.03 * (d.hands - 50)) * (fielder === 'P' ? 0.7 : 1);
    error = rng.chance(pe);
  }
  // 見た目用の方向と距離
  const angle = clamp(POS_ANGLE[fielder] + rng.normal(0, fielder === 'CF' ? 9 : 6), -44, 44);
  let distance: number;
  if (type === 'GB') distance = hit ? 45 + rng.next() * 25 : 22 + rng.next() * 18;
  else if (type === 'IFFB') distance = 15 + rng.next() * 30;
  else if (type === 'LD') distance = isOutfield(fielder) ? (hit >= 2 ? 85 + rng.next() * 25 : 55 + rng.next() * 25) : 30 + rng.next() * 10;
  else distance = hit >= 2 ? 95 + rng.next() * 22 : hit ? 62 + rng.next() * 18 : 68 + rng.next() * 32;
  return { kind: 'BIP', bip: { type, hit, fielder, error, angle, distance, expOut: 1 - pHitAvg } };
}
