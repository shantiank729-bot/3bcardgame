import type { FieldPos } from './types';

export interface BatLine {
  g: number; pa: number; ab: number; r: number; h: number; d: number; t: number; hr: number; rbi: number;
  bb: number; ibb: number; hbp: number; k: number; sh: number; sf: number; sb: number; cs: number; gidp: number;
  rispAb: number; rispH: number;
  /** 打球の内訳（BABIPや打球傾向用） */
  gb: number; fb: number; ld: number; iffb: number;
}
export interface PitchLine {
  g: number; gs: number; w: number; l: number; sv: number; hld: number; cg: number; sho: number;
  outs: number; bf: number; h: number; r: number; er: number; hr: number; bb: number; ibb: number;
  hbp: number; k: number; pitches: number; wp: number; gb: number; fb: number; ld: number; iffb: number;
  /** 被打球(BABIP用): 本塁打以外のフェア打球 */
  bip: number; sf: number;
}
export interface FieldLine {
  /** 守備位置ごとの守備イニング（アウト数） */
  outsAt: Partial<Record<FieldPos, number>>;
  /** 守備機会と、平均的な野手に対するアウト増減（守備得点の元） */
  chances: number;
  outsAboveAvg: number;
  e: number;
  /** 捕手: 盗塁企図・阻止 */
  sbAgainst: number; csBy: number;
  /** 補殺（外野の走者アウト） */
  assists: number;
}

export const emptyBat = (): BatLine => ({
  g: 0, pa: 0, ab: 0, r: 0, h: 0, d: 0, t: 0, hr: 0, rbi: 0, bb: 0, ibb: 0, hbp: 0, k: 0, sh: 0, sf: 0,
  sb: 0, cs: 0, gidp: 0, rispAb: 0, rispH: 0, gb: 0, fb: 0, ld: 0, iffb: 0,
});
export const emptyPitch = (): PitchLine => ({
  g: 0, gs: 0, w: 0, l: 0, sv: 0, hld: 0, cg: 0, sho: 0, outs: 0, bf: 0, h: 0, r: 0, er: 0, hr: 0, bb: 0,
  ibb: 0, hbp: 0, k: 0, pitches: 0, wp: 0, gb: 0, fb: 0, ld: 0, iffb: 0, bip: 0, sf: 0,
});
export const emptyField = (): FieldLine => ({ outsAt: {}, chances: 0, outsAboveAvg: 0, e: 0, sbAgainst: 0, csBy: 0, assists: 0 });

/** 数値フィールドを足し合わせる（成績の集計用） */
export function addLine<T extends object>(into: T, from: T): T {
  for (const k in from) {
    const v = (from as Record<string, unknown>)[k];
    if (typeof v === 'number') (into as Record<string, number>)[k] = ((into as Record<string, number>)[k] ?? 0) + v;
  }
  return into;
}
export function addField(into: FieldLine, from: FieldLine): FieldLine {
  into.chances += from.chances;
  into.outsAboveAvg += from.outsAboveAvg;
  into.e += from.e;
  into.sbAgainst += from.sbAgainst;
  into.csBy += from.csBy;
  into.assists += from.assists;
  for (const p in from.outsAt) {
    const k = p as FieldPos;
    into.outsAt[k] = (into.outsAt[k] ?? 0) + (from.outsAt[k] ?? 0);
  }
  return into;
}
