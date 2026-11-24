export const f3 = (x: number) => (Number.isFinite(x) ? (x >= 1 ? x.toFixed(3) : x.toFixed(3).replace(/^0/, '')) : '-');
export const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '-');
export const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '-');
export const f0 = (x: number) => (Number.isFinite(x) ? Math.round(x).toString() : '-');
export const pct1 = (x: number) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : '-');
/** 投球回（アウト数 → 123.1 形式） */
export const ipStr = (outs: number) => `${Math.floor(outs / 3)}${outs % 3 ? '.' + (outs % 3) : ''}`;

/** 能力値の評価（S〜G） */
export function grade(v: number): { g: string; cls: string } {
  if (v >= 90) return { g: 'S', cls: 'gS' };
  if (v >= 80) return { g: 'A', cls: 'gA' };
  if (v >= 70) return { g: 'B', cls: 'gB' };
  if (v >= 60) return { g: 'C', cls: 'gC' };
  if (v >= 50) return { g: 'D', cls: 'gD' };
  if (v >= 40) return { g: 'E', cls: 'gE' };
  if (v >= 30) return { g: 'F', cls: 'gF' };
  return { g: 'G', cls: 'gG' };
}

export const POS_JP: Record<string, string> = {
  P: '投手', C: '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手', SS: '遊撃手', LF: '左翼手', CF: '中堅手', RF: '右翼手', DH: '指名打者',
};
export const POS_1: Record<string, string> = {
  P: '投', C: '捕', '1B': '一', '2B': '二', '3B': '三', SS: '遊', LF: '左', CF: '中', RF: '右', DH: '指',
};
export const POS_CODE_REV = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
export const handStr = (bats: string, throws: string) => `${throws === 'R' ? '右' : '左'}投${bats === 'R' ? '右' : bats === 'L' ? '左' : '両'}打`;
