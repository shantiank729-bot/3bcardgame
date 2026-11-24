import { Position } from "./position";
import { BLACK, Color, KA, HI, Move, OU, RY, UM, inPromotionZone, opponent, pieceColor, pieceType, sameMove } from "./types";

export type EndReason = "詰み" | "投了" | "千日手" | "連続王手の千日手" | "持将棋" | "入玉勝ち" | "切れ負け" | "反則負け";

export interface GameResult {
  /** 勝者。引き分けは null */
  winner: Color | null;
  reason: EndReason;
}

/** 27点法（CSA 入玉宣言法）で宣言勝ちできるか */
export function canDeclareWin(pos: Position, c: Color = pos.turn): boolean {
  if (pos.turn !== c) return false;
  const k = pos.kingSq[c];
  if (k < 0 || !inPromotionZone(k, c)) return false; // 玉が敵陣三段目以内
  if (pos.inCheck(c)) return false; // 王手がかかっていない
  let count = 0, points = 0;
  for (let sq = 0; sq < 81; sq++) {
    const pc = pos.board[sq];
    if (!pc || pieceColor(pc) !== c || !inPromotionZone(sq, c)) continue;
    const t = pieceType(pc);
    if (t === OU) continue;
    count++;
    points += t === KA || t === HI || t === UM || t === RY ? 5 : 1;
  }
  if (count < 10) return false; // 玉以外に10枚以上が敵陣
  const h = pos.hands[c];
  points += (h[KA] + h[HI]) * 5;
  for (let t = 1; t <= 5; t++) points += h[t];
  return points >= (c === BLACK ? 28 : 27);
}

/** 宣言用の点数（表示用） */
export function declarePoints(pos: Position, c: Color): { points: number; inZone: number } {
  let inZone = 0, points = 0;
  for (let sq = 0; sq < 81; sq++) {
    const pc = pos.board[sq];
    if (!pc || pieceColor(pc) !== c || !inPromotionZone(sq, c)) continue;
    const t = pieceType(pc);
    if (t === OU) continue;
    inZone++;
    points += t === KA || t === HI || t === UM || t === RY ? 5 : 1;
  }
  const h = pos.hands[c];
  points += (h[KA] + h[HI]) * 5 + h[1] + h[2] + h[3] + h[4] + h[5];
  return { points, inZone };
}

/**
 * 対局の進行と終局判定。
 * 千日手: 同一局面（盤・持ち駒・手番）が4回 → 引き分け。
 * ただしその間の一方の指し手がすべて王手なら、王手をかけ続けた側の負け。
 */
export class Game {
  readonly startSfen: string;
  pos: Position;
  moves: Move[] = [];
  /** keys[i] = i手指した後の局面キー（keys[0] は開始局面） */
  keys: string[] = [];
  /** checks[i] = i+1 手目が王手だったか */
  checks: boolean[] = [];
  result: GameResult | null = null;

  constructor(sfen?: string) {
    this.pos = sfen ? Position.fromSfen(sfen) : Position.startpos();
    this.startSfen = this.pos.sfen();
    this.keys.push(this.pos.key());
    this.checkNoMoves();
  }

  get ply() { return this.moves.length; }
  get turn() { return this.pos.turn; }

  legalMoves() { return this.result ? [] : this.pos.legalMoves(); }

  /** 合法手なら指して true。反則手なら何もせず false */
  play(m: Move): boolean {
    if (this.result) return false;
    const legal = this.pos.legalMoves().find((x) => sameMove(x, m));
    if (!legal) return false;
    this.pos.doMove(legal);
    this.moves.push(legal);
    this.checks.push(this.pos.inCheck());
    this.keys.push(this.pos.key());
    this.checkRepetition();
    if (!this.result) this.checkNoMoves();
    return true;
  }

  private checkNoMoves() {
    if (!this.pos.hasLegalMove()) this.result = { winner: opponent(this.pos.turn), reason: "詰み" };
  }

  private checkRepetition() {
    const key = this.keys[this.keys.length - 1];
    const idx: number[] = [];
    this.keys.forEach((k, i) => { if (k === key) idx.push(i); });
    if (idx.length < 4) return;
    // 最初の出現から現在までの指し手（idx[0]+1 手目 〜 現在）
    const first = idx[idx.length - 4];
    const now = this.keys.length - 1;
    const allChecksBy = (c: Color) => {
      let any = false;
      for (let i = first; i < now; i++) {
        // i 番目の指し手（0始まり）を指した側
        const mover: Color = ((this.startTurn() + i) % 2) as Color;
        if (mover !== c) continue;
        any = true;
        if (!this.checks[i]) return false;
      }
      return any;
    };
    const blackChecks = allChecksBy(0), whiteChecks = allChecksBy(1);
    if (blackChecks && !whiteChecks) this.result = { winner: 1, reason: "連続王手の千日手" };
    else if (whiteChecks && !blackChecks) this.result = { winner: 0, reason: "連続王手の千日手" };
    else this.result = { winner: null, reason: "千日手" };
  }

  private startTurn(): Color {
    return this.startSfen.split(" ")[1] === "w" ? 1 : 0;
  }

  /** 手番側が入玉宣言する。条件を満たせば勝ち、満たさなければ反則負け */
  declare(): GameResult | null {
    if (this.result) return null;
    const c = this.pos.turn;
    this.result = canDeclareWin(this.pos, c)
      ? { winner: c, reason: "入玉勝ち" }
      : { winner: opponent(c), reason: "反則負け" };
    return this.result;
  }

  resign(c: Color = this.pos.turn) {
    if (!this.result) this.result = { winner: opponent(c), reason: "投了" };
  }

  timeout(c: Color) {
    if (!this.result) this.result = { winner: opponent(c), reason: "切れ負け" };
  }

  /** 引き分け（持将棋）として終える。両者合意や手数上限で使う */
  impasseDraw() {
    if (!this.result) this.result = { winner: null, reason: "持将棋" };
  }

  /** 1手戻す（待った） */
  undo(): boolean {
    if (!this.moves.length) return false;
    this.pos.undoMove();
    this.moves.pop();
    this.checks.pop();
    this.keys.pop();
    this.result = null;
    return true;
  }

  /** n手目までの局面（0 = 開始局面） */
  positionAt(n: number): Position {
    const p = Position.fromSfen(this.startSfen);
    for (let i = 0; i < n && i < this.moves.length; i++) p.doMove(this.moves[i]);
    return p;
  }
}
