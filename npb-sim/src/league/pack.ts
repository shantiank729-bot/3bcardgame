/**
 * 過去の成績を数字の並びに詰めて保存する（セーブデータを小さくするため）。
 * 読むときは historySeason() で元の形に戻す（結果はキャッシュ）。
 */
import { emptyBat, emptyField, emptyPitch, type BatLine, type FieldLine, type PitchLine } from '../engine/box';
import type { FieldPos } from '../engine/types';
import type { PlayerSeason, World } from './world';

const BK = Object.keys(emptyBat()) as (keyof BatLine)[];
const PK = Object.keys(emptyPitch()) as (keyof PitchLine)[];
const FK = ['chances', 'outsAboveAvg', 'e', 'sbAgainst', 'csBy', 'assists'] as const;
const POS: FieldPos[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

export type PackedRow = [number, number, number[] | 0, number[] | 0, number[] | 0];

export function packSeason(list: PlayerSeason[]): PackedRow[] {
  return list.map((e) => [
    e.pid, e.tid,
    e.bat ? BK.map((k) => e.bat![k]) : 0,
    e.pitch ? PK.map((k) => e.pitch![k]) : 0,
    e.field ? [...FK.map((k) => Math.round(e.field![k] * 100) / 100), ...POS.map((p) => e.field!.outsAt[p] ?? 0)] : 0,
  ]);
}

export function unpackSeason(rows: PackedRow[]): PlayerSeason[] {
  return rows.map(([pid, tid, b, p, f]) => {
    let bat: BatLine | null = null, pitch: PitchLine | null = null, field: FieldLine | null = null;
    if (b) { bat = emptyBat(); BK.forEach((k, i) => (bat![k] = b[i] ?? 0)); }
    if (p) { pitch = emptyPitch(); PK.forEach((k, i) => (pitch![k] = p[i] ?? 0)); }
    if (f) {
      field = emptyField();
      FK.forEach((k, i) => ((field as unknown as Record<string, number>)[k] = f[i] ?? 0));
      POS.forEach((pos, i) => { const v = f[FK.length + i]; if (v) field!.outsAt[pos] = v; });
    }
    return { pid, tid, bat, pitch, field };
  });
}

const cache = new WeakMap<object, PlayerSeason[]>();

/** 過去シーズンの成績一覧 */
export function historySeason(h: World['history'][number]): PlayerSeason[] {
  if (h.season) return h.season;
  if (!h.packed) return [];
  let c = cache.get(h);
  if (!c) cache.set(h, (c = unpackSeason(h.packed)));
  return c;
}
export function historyFarm(h: World['history'][number]): PlayerSeason[] {
  if (h.farm) return h.farm;
  if (!h.packedFarm) return [];
  const key = h.packedFarm as unknown as object;
  let c = cache.get(key);
  if (!c) cache.set(key, (c = unpackSeason(h.packedFarm)));
  return c;
}

/** 保存前に過去の成績を詰める */
export function packHistory(w: World) {
  for (const h of Object.values(w.history)) {
    if (h.season) { h.packed = packSeason(h.season); delete h.season; }
    if (h.farm) { h.packedFarm = packSeason(h.farm); delete h.farm; }
  }
}
