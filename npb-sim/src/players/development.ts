/**
 * 選手の総合力・成長・衰え。
 * - 若い選手は潜在能力（pot）に向かって伸びる。伸び方は年齢と成長タイプ（早熟・普通・晩成）で変わる
 * - ピークは野手28歳前後・投手27歳前後。走力は早く、選球眼は遅くまで伸びる
 * - 30歳を過ぎると少しずつ衰え、35歳を過ぎると急に落ちる。球速は30歳から毎年少しずつ落ちる
 */
import { Rng } from '../engine/rng';
import { pitcherStuff } from '../engine/pa';
import type { BatterRatings, Player } from '../engine/types';

const clamp = (x: number, lo = 1, hi = 100) => (x < lo ? lo : x > hi ? hi : x);

export function batterOverall(p: Player): number {
  const b = p.bat;
  const off = b.contact * 0.3 + b.power * 0.3 + b.eye * 0.15 + b.speed * 0.1;
  const prim = Object.entries(b.positions).sort((x, y) => (y[1] ?? 0) - (x[1] ?? 0))[0]?.[0];
  const defW = prim === 'C' || prim === 'SS' ? 0.25 : prim === '2B' || prim === 'CF' ? 0.2 : prim === '1B' ? 0.08 : 0.15;
  const def = b.fielding * 0.6 + b.arm * 0.25 + b.catching * 0.15;
  return off / 0.85 * (1 - defW) + def * defW;
}

export function pitcherOverall(p: Player): number {
  const pit = p.pit!;
  const base = pitcherStuff(pit) * 0.55 + pit.control * 0.45;
  // 先発はスタミナも価値
  return base + (pit.stamina - 50) * 0.08;
}

export const overall = (p: Player) => (p.isPitcher && p.pit ? pitcherOverall(p) : batterOverall(p));

/** 能力の伸び率（年齢・成長タイプ） */
function growthRate(age: number, type: 'early' | 'normal' | 'late'): number {
  const shift = type === 'early' ? -2 : type === 'late' ? 2 : 0;
  const a = age - shift;
  if (a <= 20) return 0.24;
  if (a <= 23) return 0.22;
  if (a <= 26) return 0.18;
  if (a <= 28) return 0.1;
  return 0.03;
}

/** 衰え（総合値で何ポイント落ちるか） */
function declineAmount(age: number, type: 'early' | 'normal' | 'late', pitcher: boolean): number {
  const shift = type === 'early' ? -2 : type === 'late' ? 2 : 0;
  const start = (pitcher ? 30 : 31) + shift;
  if (age < start) return 0;
  const y = age - start + 1;
  return 0.6 + y * 0.55 + (age >= 36 + shift ? 1.5 : 0);
}

export interface DevResult {
  before: number;
  after: number;
}

/**
 * 1年分の成長・衰え（年齢はすでに+1されている前提）
 * bonus: 一軍で多く出場した若手・練習環境などによる上積み（総合値ポイント）
 */
export function developPlayer(rng: Rng, p: Player & { pot: number; growth: 'early' | 'normal' | 'late' }, bonus = 0): DevResult {
  const before = overall(p);
  const gap = Math.max(0, p.pot - before);
  const grow = gap * growthRate(p.age, p.growth) + (gap > 0 ? bonus : 0) + rng.normal(0, 1.2);
  const dec = declineAmount(p.age, p.growth, p.isPitcher);
  const delta = grow - dec;
  if (p.isPitcher && p.pit) {
    const pit = p.pit;
    const w = () => 1 + rng.normal(0, 0.35);
    pit.control = clamp(pit.control + delta * w());
    pit.stamina = clamp(pit.stamina + (p.age <= 25 ? 1.2 : p.age >= 33 ? -1.5 : 0) + rng.normal(0, 1.5));
    // 球速: 若いうちは伸び、30歳から落ちる
    const kmh = p.age <= 24 ? Math.max(0, delta) * 0.45 + rng.normal(0.3, 0.6) : p.age >= 30 ? -0.4 - (p.age - 30) * 0.15 + rng.normal(0, 0.5) : rng.normal(0, 0.5) + delta * 0.15;
    pit.velocity = Math.round(Math.min(165, Math.max(118, pit.velocity + kmh)) * 10) / 10;
    for (const x of pit.pitches) x.quality = clamp(x.quality + delta * w() + rng.normal(0, 1));
    // 新しい変化球を覚えることがある
    if (p.age <= 27 && pit.pitches.length < 5 && rng.chance(0.06)) {
      const types = (['SL', 'CT', 'CB', 'CH', 'FK', 'SF', 'SI', 'SH'] as const).filter((t) => !pit.pitches.some((x) => x.type === t));
      pit.pitches.push({ type: rng.pick(types), quality: clamp(30 + rng.int(0, 15)) });
    }
  } else {
    const b: BatterRatings = p.bat;
    const w = () => 1 + rng.normal(0, 0.35);
    // 能力ごとのピークの違い
    const age = p.age;
    const spd = age <= 24 ? delta * 0.5 : age >= 28 ? -0.8 - Math.max(0, age - 30) * 0.4 : delta * 0.2;
    const eye = delta * w() + (age >= 28 && age <= 33 ? 0.8 : 0);
    b.contact = clamp(b.contact + delta * w());
    b.power = clamp(b.power + delta * w() + (age >= 24 && age <= 29 ? 0.4 : 0));
    b.eye = clamp(b.eye + eye);
    b.speed = clamp(b.speed + spd + rng.normal(0, 1));
    b.fielding = clamp(b.fielding + delta * 0.7 * w() + (age >= 30 ? -0.8 : 0));
    b.arm = clamp(b.arm + (age <= 24 ? Math.max(0, delta) * 0.4 : age >= 31 ? -0.7 : 0) + rng.normal(0, 0.8));
    b.catching = clamp(b.catching + delta * 0.5 * w());
    for (const k of Object.keys(b.positions) as (keyof typeof b.positions)[]) {
      // 守備位置の適性は練習で少し伸びる
      if ((b.positions[k] ?? 0) < 100 && p.age <= 28) b.positions[k] = clamp((b.positions[k] ?? 0) + rng.int(0, 3));
    }
  }
  return { before, after: overall(p) };
}

/** 生成時に潜在能力と成長タイプを決める */
export function rollPotential(rng: Rng, p: Player, current = overall(p)) {
  // 伸びしろ: 多くの選手は小さく、一部の選手だけが大きく伸びる
  const room = Math.max(0, 27 - p.age);
  const u = rng.next();
  const pot = clamp(current + room * (0.3 + 1.7 * u * u) + rng.normal(0, 1.5), current, 99);
  const r = rng.next();
  return { pot: Math.round(pot), growth: (r < 0.2 ? 'early' : r > 0.8 ? 'late' : 'normal') as 'early' | 'normal' | 'late' };
}
