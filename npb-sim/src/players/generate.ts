import { Rng } from '../engine/rng';
import type { BatSide, FieldPos, Hand, Pitch, PitchType, Player } from '../engine/types';
import { FOREIGN_FIRST, FOREIGN_LAST, GIVEN, SURNAMES } from './names';

const clamp = (x: number, lo = 1, hi = 100) => Math.round(x < lo ? lo : x > hi ? hi : x);

let nextId = 1;
export function setNextPlayerId(n: number) {
  nextId = n;
}
export function allocPlayerId() {
  return nextId++;
}

export function randomName(rng: Rng, foreign = false): string {
  if (foreign) return `${rng.pick(FOREIGN_FIRST)}・${rng.pick(FOREIGN_LAST)}`;
  return `${rng.pick(SURNAMES)} ${rng.pick(GIVEN)}`;
}

/** ポジション別の能力の傾向（平均からのずれ） */
const POS_PROFILE: Record<Exclude<FieldPos, 'P'>, { con: number; pow: number; spd: number; fld: number; arm: number }> = {
  C: { con: -4, pow: -2, spd: -14, fld: 0, arm: 8 },
  '1B': { con: 2, pow: 10, spd: -10, fld: -8, arm: -8 },
  '2B': { con: 2, pow: -6, spd: 6, fld: 6, arm: -4 },
  '3B': { con: 0, pow: 5, spd: -3, fld: 0, arm: 6 },
  SS: { con: -2, pow: -6, spd: 8, fld: 10, arm: 6 },
  LF: { con: 2, pow: 6, spd: 0, fld: -6, arm: -4 },
  CF: { con: 1, pow: -2, spd: 12, fld: 8, arm: 2 },
  RF: { con: 0, pow: 6, spd: 0, fld: -2, arm: 8 },
};

const SECONDARY: Record<Exclude<FieldPos, 'P'>, FieldPos[]> = {
  C: ['1B'], '1B': ['LF', '3B', 'RF'], '2B': ['SS', '3B'], '3B': ['1B', 'SS', '2B'],
  SS: ['2B', '3B'], LF: ['RF', '1B', 'CF'], CF: ['LF', 'RF'], RF: ['LF', 'CF', '1B'],
};

function batSide(rng: Rng, throws: Hand): BatSide {
  const r = rng.next();
  if (throws === 'L') return r < 0.9 ? 'L' : 'R';
  return r < 0.58 ? 'R' : r < 0.93 ? 'L' : 'S';
}

export interface GenOptions {
  /** 能力の中心（プロ一軍=50、二軍≈40、高校生≈20 など） */
  level: number;
  spread?: number;
  age?: number;
  foreign?: boolean;
}

export function generateBatter(rng: Rng, pos: Exclude<FieldPos, 'P'>, o: GenOptions): Player {
  const sd = o.spread ?? 11;
  const t = o.level + rng.normal(0, sd * 0.6);
  const prof = POS_PROFILE[pos];
  const throws: Hand = pos === 'C' || pos === '2B' || pos === 'SS' || pos === '3B' ? 'R' : rng.chance(0.75) ? 'R' : 'L';
  const positions: Partial<Record<FieldPos, number>> = { [pos]: 100 };
  for (const s of SECONDARY[pos]) {
    if (throws === 'L' && (s === 'SS' || s === '2B' || s === '3B')) continue;
    if (rng.chance(0.4)) positions[s] = clamp(55 + rng.next() * 35);
  }
  const contact = t + prof.con + rng.normal(0, sd * 0.8);
  const power = t + prof.pow + rng.normal(0, sd);
  return {
    id: allocPlayerId(),
    name: randomName(rng, o.foreign),
    age: o.age ?? rng.int(22, 34),
    bats: batSide(rng, throws),
    throws,
    isPitcher: false,
    foreign: o.foreign,
    bat: {
      contact: clamp(contact),
      power: clamp(power),
      eye: clamp(t + rng.normal(0, sd)),
      speed: clamp(o.level + prof.spd + rng.normal(0, sd * 1.1)),
      fielding: clamp(o.level + prof.fld + rng.normal(0, sd)),
      arm: clamp(o.level + prof.arm + rng.normal(0, sd)),
      catching: clamp(o.level + rng.normal(0, sd)),
      positions,
      platoon: clamp(rng.normal(50, 15)),
    },
  };
}

const BREAKING: PitchType[] = ['SL', 'CT', 'CB', 'CH', 'FK', 'SF', 'SI', 'SH'];
const BREAK_W = [0.3, 0.12, 0.14, 0.1, 0.14, 0.06, 0.08, 0.06];

export function generatePitcher(rng: Rng, role: 'SP' | 'RP', o: GenOptions): Player {
  const sd = o.spread ?? 11;
  const t = o.level + rng.normal(0, sd * 0.5);
  const throws: Hand = rng.chance(0.7) ? 'R' : 'L';
  const n = role === 'SP' ? rng.int(3, 5) : rng.int(2, 3);
  const pitches: Pitch[] = [];
  const types = new Set<PitchType>();
  while (types.size < n) types.add(rng.weighted(BREAKING, BREAK_W));
  for (const ty of types) pitches.push({ type: ty, quality: clamp(t + rng.normal(0, sd * 1.1) - (pitches.length ? 6 : 0)) });
  const velBase = 147 + (o.level - 50) * 0.22 + (role === 'RP' ? 1.5 : 0);
  return {
    id: allocPlayerId(),
    name: randomName(rng, o.foreign),
    age: o.age ?? rng.int(22, 34),
    bats: throws === 'L' ? 'L' : rng.chance(0.85) ? 'R' : 'L',
    throws,
    isPitcher: true,
    foreign: o.foreign,
    bat: {
      contact: clamp(rng.normal(14, 6)), power: clamp(rng.normal(14, 8)), eye: clamp(rng.normal(14, 6)),
      speed: clamp(rng.normal(38, 10)), fielding: clamp(rng.normal(45, 10)), arm: clamp(rng.normal(60, 10)),
      catching: clamp(rng.normal(50, 10)), positions: { P: 100 }, platoon: 50,
    },
    pit: {
      velocity: Math.round(Math.min(165, Math.max(120, velBase + rng.normal(0, 3.6)))),
      control: clamp(t + rng.normal(0, sd)),
      stamina: clamp(role === 'SP' ? 65 + rng.normal(0, 9) : 32 + rng.normal(0, 9)),
      groundball: Math.round(Math.max(-50, Math.min(50, rng.normal(0, 15)))),
      pitches,
    },
  };
}

/** テスト・初期リーグ用の1球団分の選手（一軍28人＋α） */
export function generateTeamRoster(rng: Rng, level = 50): Player[] {
  const out: Player[] = [];
  const posList: Exclude<FieldPos, 'P'>[] = ['C', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'SS', '2B', 'LF', 'CF', '3B', 'RF', '1B'];
  posList.forEach((p, i) => out.push(generateBatter(rng, p, { level: i < 9 ? level + 3 : level - 6 })));
  for (let i = 0; i < 7; i++) out.push(generatePitcher(rng, 'SP', { level: i < 6 ? level + 1 : level - 6 }));
  for (let i = 0; i < 8; i++) out.push(generatePitcher(rng, 'RP', { level: i < 4 ? level + 2 : level - 3 }));
  return out;
}
