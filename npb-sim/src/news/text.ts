import { Rng } from '../engine/rng';

/** 見出し用の短い名前（日本人は姓、外国人は後ろの部分） */
export function shortName(full: string): string {
  if (full.includes('・')) return full.split('・').pop()!;
  return full.split(' ')[0];
}

/** {key} を置換し、候補から1つ選ぶ */
export function pick(rng: Rng, templates: string[], vars: Record<string, string | number>): string {
  const t = templates[Math.floor(rng.next() * templates.length)];
  return t.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export const kanjiNum = (n: number) => String(n);
export const ordinal = (n: number) => `${n}号`;
