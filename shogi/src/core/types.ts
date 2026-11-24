// 基本型と定数
// 座標: sq = (段-1)*9 + (9-筋)。sq=0 が 9一（先手から見て左上）、sq=80 が 1九。
// x = 9-筋 (0..8, 左→右), y = 段-1 (0..8, 上→下)。先手は y が小さくなる方向へ進む。

export type Color = 0 | 1;
export const BLACK: Color = 0; // 先手
export const WHITE: Color = 1; // 後手

export const FU = 1, KY = 2, KE = 3, GI = 4, KI = 5, KA = 6, HI = 7, OU = 8;
export const TO = 9, NY = 10, NK = 11, NG = 12, UM = 13, RY = 14;

/** 持ち駒にできる駒の種類（表示順: 飛角金銀桂香歩） */
export const HAND_TYPES = [HI, KA, KI, GI, KE, KY, FU] as const;

export interface Move {
  /** 移動元。駒打ちは -1 */
  from: number;
  to: number;
  promote: boolean;
  /** 駒打ちのときの駒種。それ以外は 0 */
  drop: number;
}

export const makePiece = (type: number, color: Color) => type | (color << 4);
export const pieceType = (pc: number) => pc & 15;
export const pieceColor = (pc: number): Color => (pc >> 4) as Color;

export const sqOf = (file: number, rank: number) => (rank - 1) * 9 + (9 - file);
export const fileOf = (sq: number) => 9 - (sq % 9);
export const rankOf = (sq: number) => Math.floor(sq / 9) + 1;
export const xOf = (sq: number) => sq % 9;
export const yOf = (sq: number) => Math.floor(sq / 9);

export const canPromoteType = (t: number) => t === FU || t === KY || t === KE || t === GI || t === KA || t === HI;
export const promoteType = (t: number) => (t <= GI ? t + 8 : t === KA ? UM : t === HI ? RY : t);
export const unpromoteType = (t: number) => (t >= TO && t <= NG ? t - 8 : t === UM ? KA : t === RY ? HI : t);
export const isPromoted = (t: number) => t >= TO;

export const opponent = (c: Color): Color => (c ^ 1) as Color;

/** 敵陣（成れる段）か */
export const inPromotionZone = (sq: number, c: Color) => (c === BLACK ? yOf(sq) <= 2 : yOf(sq) >= 6);

/** その駒がそのマスに置かれた場合、以降動けるか（行き所のない駒の判定） */
export function hasMoveFrom(t: number, sq: number, c: Color): boolean {
  const y = c === BLACK ? yOf(sq) : 8 - yOf(sq); // 自分から見た「上からの距離」
  if (t === FU || t === KY) return y >= 1;
  if (t === KE) return y >= 2;
  return true;
}

export function sameMove(a: Move, b: Move) {
  return a.from === b.from && a.to === b.to && a.promote === b.promote && a.drop === b.drop;
}

/** 駒の利き（先手視点の dx,dy）。step: 1マス、slide: 走り */
export const STEP_DIRS: number[][][] = [];
export const SLIDE_DIRS: number[][][] = [];
{
  const gold = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [0, 1]];
  const king = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const diag = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const orth = [[0, -1], [-1, 0], [1, 0], [0, 1]];
  for (let t = 0; t <= RY; t++) {
    STEP_DIRS[t] = [];
    SLIDE_DIRS[t] = [];
  }
  STEP_DIRS[FU] = [[0, -1]];
  SLIDE_DIRS[KY] = [[0, -1]];
  STEP_DIRS[KE] = [[-1, -2], [1, -2]];
  STEP_DIRS[GI] = [[-1, -1], [0, -1], [1, -1], [-1, 1], [1, 1]];
  for (const t of [KI, TO, NY, NK, NG]) STEP_DIRS[t] = gold;
  STEP_DIRS[OU] = king;
  SLIDE_DIRS[KA] = diag;
  SLIDE_DIRS[HI] = orth;
  SLIDE_DIRS[UM] = diag;
  STEP_DIRS[UM] = orth;
  SLIDE_DIRS[RY] = orth;
  STEP_DIRS[RY] = diag;
}
