/**
 * 観戦用の1球ごとの投球データ。
 * 打席の結果はエンジンが先に決め、その結果と投球数に矛盾しないカウントの流れをここで作る。
 */
import type { Rng } from './rng';
import type { PitchType, Player } from './types';

export type PitchResult = 'ball' | 'called' | 'swinging' | 'foul' | 'inplay' | 'hbp';

export interface PitchInfo {
  result: PitchResult;
  type: PitchType;
  kmh: number;
  /** ストライクゾーン基準の座標（-1〜1がゾーン内、外はボール） */
  x: number;
  y: number;
  /** この球のあとのカウント */
  balls: number;
  strikes: number;
}

type Final = 'K' | 'BB' | 'HBP' | 'INPLAY' | 'BUNTK';

const SPEED_DROP: Record<PitchType, number> = { FB: 0, SL: 15, CT: 6, CB: 30, CH: 18, FK: 12, SF: 9, SI: 4, SH: 5 };

function choosePitch(rng: Rng, p: Player): { type: PitchType; kmh: number } {
  const pit = p.pit;
  if (!pit) return { type: 'FB', kmh: 110 + rng.int(0, 15) };
  const opts: { type: PitchType; w: number }[] = [{ type: 'FB', w: 1.1 }];
  for (const x of pit.pitches) opts.push({ type: x.type, w: 0.25 + x.quality / 160 });
  const total = opts.reduce((s, o) => s + o.w, 0);
  let r = rng.next() * total;
  let type: PitchType = 'FB';
  for (const o of opts) {
    r -= o.w;
    if (r < 0) {
      type = o.type;
      break;
    }
  }
  const base = pit.velocity - SPEED_DROP[type] - Math.abs(rng.normal(2.5, 2));
  return { type, kmh: Math.round(base) };
}

export function pitchSequence(rng: Rng, pitcher: Player, n: number, final: Final): PitchInfo[] {
  const m = Math.max(0, n - 1);
  let b = 0, s = 0;
  if (final === 'K' || final === 'BUNTK') {
    s = 2;
    b = rng.int(0, Math.min(3, Math.max(0, m - 2)));
  } else if (final === 'BB') {
    b = 3;
    s = Math.min(2, Math.max(0, m - 3), rng.int(0, 2));
  } else {
    b = rng.int(0, Math.min(3, m));
    s = Math.min(2, m - b);
    if (m - b - s > 0) s = 2;
  }
  // 基本の並び（ボールとストライク）をランダムに混ぜる
  const tokens: ('B' | 'S')[] = [...Array(b).fill('B'), ...Array(s).fill('S')];
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
  }
  const extraFouls = Math.max(0, m - b - s);
  // ファウルは2ストライク後に入れる
  const seq: ('B' | 'S' | 'F')[] = [];
  let sc = 0;
  let fouls = extraFouls;
  for (const t of tokens) {
    seq.push(t);
    if (t === 'S') sc++;
    if (sc === 2 && fouls > 0) {
      while (fouls > 0 && rng.chance(0.6)) {
        seq.push('F');
        fouls--;
      }
    }
  }
  while (fouls-- > 0) seq.push('F');
  const out: PitchInfo[] = [];
  let balls = 0, strikes = 0;
  const loc = (inZone: boolean) => {
    if (inZone) return { x: rng.normal(0, 0.45), y: rng.normal(0, 0.45) };
    const side = rng.int(0, 3);
    const a = 1.15 + Math.abs(rng.normal(0, 0.35));
    const o = rng.normal(0, 0.6);
    return side === 0 ? { x: -a, y: o } : side === 1 ? { x: a, y: o } : side === 2 ? { x: o, y: a } : { x: o, y: -a };
  };
  for (const t of seq) {
    const pc = choosePitch(rng, pitcher);
    let result: PitchResult;
    if (t === 'B') {
      balls++;
      result = 'ball';
    } else if (t === 'F') {
      result = 'foul';
    } else {
      strikes++;
      const r = rng.next();
      result = r < 0.4 ? 'called' : r < 0.65 ? 'swinging' : 'foul';
    }
    const l = loc(t !== 'B');
    out.push({ result, ...pc, x: l.x, y: l.y, balls, strikes });
  }
  const pc = choosePitch(rng, pitcher);
  if (final === 'K' || final === 'BUNTK') {
    strikes = 3;
    const l = loc(rng.chance(0.75));
    out.push({ result: final === 'BUNTK' ? 'foul' : rng.chance(0.68) ? 'swinging' : 'called', ...pc, x: l.x, y: l.y, balls, strikes });
  } else if (final === 'BB') {
    balls = 4;
    const l = loc(false);
    out.push({ result: 'ball', ...pc, x: l.x, y: l.y, balls, strikes });
  } else if (final === 'HBP') {
    out.push({ result: 'hbp', ...pc, x: rng.chance(0.5) ? -1.6 : 1.6, y: rng.normal(0.3, 0.3), balls, strikes });
  } else {
    const l = loc(rng.chance(0.85));
    out.push({ result: 'inplay', ...pc, x: l.x, y: l.y, balls, strikes });
  }
  return out;
}
