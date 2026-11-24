/**
 * 年俸・契約・FA権
 * 年俸の単位は万円。支配下の最低年俸は440万円、育成は240万円。
 */
import { overall } from '../players/development';
import type { Rng } from '../engine/rng';
import type { PlayerRecord } from './world';

export const MIN_SALARY = 440;
export const IKUSEI_MIN = 240;
/** 1シーズンとみなす一軍登録日数 */
export const SEASON_DAYS = 145;

export const seasonsOf = (p: PlayerRecord) => p.service / SEASON_DAYS;

/** 国内FA権: 8シーズン（大卒・社会人出身は7シーズン）、海外FA権: 9シーズン */
export function domesticFA(p: PlayerRecord) {
  if (p.foreign) return false;
  const need = p.entry === 'COL' || p.entry === 'SHA' ? 7 : 8;
  return seasonsOf(p) >= need;
}
export function overseasFA(p: PlayerRecord) {
  return !p.foreign && seasonsOf(p) >= 9;
}

/** 能力と実績から見た「相場」の年俸 */
export function marketSalary(p: PlayerRecord, war?: number): number {
  const ovr = overall(p);
  let base = 5000 * Math.exp((ovr - 50) / 10.5);
  if (war !== undefined) base = base * 0.5 + Math.max(0, 800 + war * 6000) * 0.5;
  if (p.status === 'ikusei') return IKUSEI_MIN + Math.max(0, ovr - 30) * 5;
  // 年功（若手・経験の浅い選手は安い）
  const s = p.foreign ? 1.15 : Math.min(1, 0.22 + seasonsOf(p) * 0.11);
  // ベテランは少し割安
  const vet = p.age >= 35 ? 0.8 : 1;
  return Math.max(MIN_SALARY, Math.round((base * s * vet) / 10) * 10);
}

export function initContract(rng: Rng, p: PlayerRecord) {
  const salary = Math.round(marketSalary(p) * (0.85 + rng.next() * 0.3) / 10) * 10;
  const years = p.foreign ? rng.int(1, 2) : salary >= 20000 && rng.chance(0.5) ? rng.int(2, 4) : 1;
  return { salary: p.status === 'ikusei' ? Math.max(IKUSEI_MIN, Math.min(salary, 600)) : Math.max(MIN_SALARY, salary), years };
}

/** 契約更改で選手が求める年俸（前年からの変動。減額制限: 1億円超は40%、以下は25%まで） */
export function renewalAsk(p: PlayerRecord, war: number): number {
  const old = p.contract.salary;
  const target = marketSalary(p, war);
  let ask = old * 0.45 + target * 0.55;
  const floor = old * (old > 10000 ? 0.6 : 0.75);
  if (ask < floor) ask = floor;
  if (p.status === 'ikusei') ask = Math.max(IKUSEI_MIN, Math.min(ask, 700));
  return Math.max(p.status === 'ikusei' ? IKUSEI_MIN : MIN_SALARY, Math.round(ask / 10) * 10);
}

/** 球団の提示額。成績が良ければ満額近く、悪ければ減額 */
export function teamOffer(p: PlayerRecord, war: number): number {
  const ask = renewalAsk(p, war);
  const target = marketSalary(p, war);
  return Math.max(p.status === 'ikusei' ? IKUSEI_MIN : MIN_SALARY, Math.round(Math.min(ask, ask * 0.5 + target * 0.5) / 10) * 10);
}

export const yen = (man: number) => (man >= 10000 ? `${(man / 10000).toFixed(man % 10000 === 0 ? 0 : 2).replace(/\.?0+$/, '')}億円` : `${man.toLocaleString('ja-JP')}万円`);
