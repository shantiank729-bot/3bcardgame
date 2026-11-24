import {
  BLACK, Color, FU, HAND_TYPES, KE, Move, OU, SLIDE_DIRS, STEP_DIRS, WHITE,
  canPromoteType, hasMoveFrom, inPromotionZone, makePiece, opponent, pieceColor, pieceType,
  promoteType, unpromoteType, xOf, yOf,
} from "./types";

// ---- Zobrist ハッシュ（32bit×2） ----
let seed = 0x2545f491;
function rnd() {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed;
}
const ZB1 = new Uint32Array(81 * 32), ZB2 = new Uint32Array(81 * 32);
const ZH1 = new Uint32Array(2 * 8 * 19), ZH2 = new Uint32Array(2 * 8 * 19);
for (let i = 0; i < ZB1.length; i++) { ZB1[i] = rnd(); ZB2[i] = rnd(); }
for (let i = 0; i < ZH1.length; i++) { ZH1[i] = rnd(); ZH2[i] = rnd(); }
const ZT1 = rnd(), ZT2 = rnd();
const hIdx = (c: number, t: number, n: number) => (c * 8 + t) * 19 + n;

export const STARTPOS_SFEN = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

interface Undo { move: Move; captured: number; h1: number; h2: number; }

/** 白(後手)用に方向を反転 */
const dirFor = (c: Color, d: number[]) => (c === BLACK ? d : [-d[0], -d[1]]);

export class Position {
  board = new Int8Array(81);
  hands: [Int8Array, Int8Array] = [new Int8Array(8), new Int8Array(8)];
  turn: Color = BLACK;
  /** 初期局面からの手数（SFEN の手数。次に指す手が何手目か） */
  ply = 1;
  kingSq: [number, number] = [-1, -1];
  h1 = 0;
  h2 = 0;
  private stack: Undo[] = [];

  static startpos() { return Position.fromSfen(STARTPOS_SFEN); }

  static fromSfen(sfen: string): Position {
    const p = new Position();
    const parts = sfen.trim().replace(/^sfen\s+/, "").split(/\s+/);
    const [boardStr, turnStr = "b", handStr = "-", plyStr = "1"] = parts;
    const rows = boardStr.split("/");
    if (rows.length !== 9) throw new Error("SFEN の盤面が不正です");
    const typeOfLetter: Record<string, number> = { p: 1, l: 2, n: 3, s: 4, g: 5, b: 6, r: 7, k: 8 };
    for (let y = 0; y < 9; y++) {
      let x = 0;
      const row = rows[y];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (/[1-9]/.test(ch)) { x += Number(ch); continue; }
        let promoted = false;
        let c = ch;
        if (c === "+") { promoted = true; c = row[++i]; }
        const t0 = typeOfLetter[c.toLowerCase()];
        if (!t0 || x > 8) throw new Error("SFEN の盤面が不正です");
        const color: Color = c === c.toUpperCase() ? BLACK : WHITE;
        const t = promoted ? promoteType(t0) : t0;
        p.board[y * 9 + x] = makePiece(t, color);
        x++;
      }
      if (x !== 9) throw new Error("SFEN の盤面が不正です");
    }
    p.turn = turnStr === "w" ? WHITE : BLACK;
    if (handStr !== "-") {
      const re = /(\d*)([PLNSGBRplnsgbr])/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(handStr))) {
        const n = m[1] ? Number(m[1]) : 1;
        const color: Color = m[2] === m[2].toUpperCase() ? BLACK : WHITE;
        p.hands[color][typeOfLetter[m[2].toLowerCase()]] += n;
      }
    }
    p.ply = Number(plyStr) || 1;
    p.recompute();
    return p;
  }

  clone(): Position {
    const p = new Position();
    p.board.set(this.board);
    p.hands[0].set(this.hands[0]);
    p.hands[1].set(this.hands[1]);
    p.turn = this.turn;
    p.ply = this.ply;
    p.kingSq = [this.kingSq[0], this.kingSq[1]];
    p.h1 = this.h1; p.h2 = this.h2;
    return p;
  }

  private recompute() {
    this.h1 = 0; this.h2 = 0;
    this.kingSq = [-1, -1];
    for (let sq = 0; sq < 81; sq++) {
      const pc = this.board[sq];
      if (!pc) continue;
      this.h1 ^= ZB1[sq * 32 + pc]; this.h2 ^= ZB2[sq * 32 + pc];
      if (pieceType(pc) === OU) this.kingSq[pieceColor(pc)] = sq;
    }
    for (const c of [0, 1]) for (const t of HAND_TYPES) {
      const n = this.hands[c][t];
      this.h1 ^= ZH1[hIdx(c, t, n)]; this.h2 ^= ZH2[hIdx(c, t, n)];
    }
    if (this.turn === WHITE) { this.h1 ^= ZT1; this.h2 ^= ZT2; }
  }

  /** 千日手判定用の局面キー（盤・持ち駒・手番） */
  key(): string { return (this.h1 >>> 0).toString(36) + "." + (this.h2 >>> 0).toString(36); }

  sfen(withPly = true): string {
    const L = ["", "P", "L", "N", "S", "G", "B", "R", "K", "+P", "+L", "+N", "+S", "+B", "+R"];
    const rows: string[] = [];
    for (let y = 0; y < 9; y++) {
      let row = "", empty = 0;
      for (let x = 0; x < 9; x++) {
        const pc = this.board[y * 9 + x];
        if (!pc) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        const s = L[pieceType(pc)];
        row += pieceColor(pc) === BLACK ? s : s.toLowerCase();
      }
      if (empty) row += empty;
      rows.push(row);
    }
    let hand = "";
    for (const c of [BLACK, WHITE]) for (const t of HAND_TYPES) {
      const n = this.hands[c][t];
      if (!n) continue;
      const s = L[t];
      hand += (n > 1 ? n : "") + (c === BLACK ? s : s.toLowerCase());
    }
    const base = `${rows.join("/")} ${this.turn === BLACK ? "b" : "w"} ${hand || "-"}`;
    return withPly ? `${base} ${this.ply}` : base;
  }

  private setSq(sq: number, pc: number) {
    const old = this.board[sq];
    if (old) { this.h1 ^= ZB1[sq * 32 + old]; this.h2 ^= ZB2[sq * 32 + old]; }
    this.board[sq] = pc;
    if (pc) { this.h1 ^= ZB1[sq * 32 + pc]; this.h2 ^= ZB2[sq * 32 + pc]; }
  }

  private addHand(c: Color, t: number, delta: number) {
    const n = this.hands[c][t];
    this.h1 ^= ZH1[hIdx(c, t, n)]; this.h2 ^= ZH2[hIdx(c, t, n)];
    this.hands[c][t] = n + delta;
    this.h1 ^= ZH1[hIdx(c, t, n + delta)]; this.h2 ^= ZH2[hIdx(c, t, n + delta)];
  }

  /** 合法性を確認せずに手を進める */
  doMove(m: Move) {
    const us = this.turn;
    const undo: Undo = { move: m, captured: 0, h1: this.h1, h2: this.h2 };
    if (m.from < 0) {
      this.addHand(us, m.drop, -1);
      this.setSq(m.to, makePiece(m.drop, us));
    } else {
      const pc = this.board[m.from];
      const captured = this.board[m.to];
      undo.captured = captured;
      if (captured) this.addHand(us, unpromoteType(pieceType(captured)), 1);
      this.setSq(m.from, 0);
      const t = m.promote ? promoteType(pieceType(pc)) : pieceType(pc);
      this.setSq(m.to, makePiece(t, us));
      if (t === OU) this.kingSq[us] = m.to;
      if (captured && pieceType(captured) === OU) this.kingSq[opponent(us)] = -1;
    }
    this.turn = opponent(us);
    this.h1 ^= ZT1; this.h2 ^= ZT2;
    this.ply++;
    this.stack.push(undo);
  }

  undoMove() {
    const u = this.stack.pop();
    if (!u) throw new Error("戻せる手がありません");
    const m = u.move;
    this.turn = opponent(this.turn);
    const us = this.turn;
    this.ply--;
    if (m.from < 0) {
      this.board[m.to] = 0;
      this.hands[us][m.drop]++;
    } else {
      const pc = this.board[m.to];
      const t = m.promote ? unpromoteType(pieceType(pc)) : pieceType(pc);
      this.board[m.from] = makePiece(t, us);
      this.board[m.to] = u.captured;
      if (t === OU) this.kingSq[us] = m.from;
      if (u.captured) {
        this.hands[us][unpromoteType(pieceType(u.captured))]--;
        if (pieceType(u.captured) === OU) this.kingSq[opponent(us)] = m.to;
      }
    }
    this.h1 = u.h1; this.h2 = u.h2;
  }

  /** sq に color 側の駒の利きがあるか */
  isAttacked(sq: number, by: Color): boolean {
    const x0 = xOf(sq), y0 = yOf(sq);
    // 8方向の直線上で最初に当たる駒を調べる
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      let x = x0 + dx, y = y0 + dy, dist = 1;
      while (x >= 0 && x < 9 && y >= 0 && y < 9) {
        const pc = this.board[y * 9 + x];
        if (pc) {
          if (pieceColor(pc) === by) {
            // その駒から sq への方向は (-dx,-dy)
            const t = pieceType(pc);
            const v = dirFor(by, [-dx, -dy]); // 攻撃側視点のベクトル
            if (dist === 1 && STEP_DIRS[t].some((d) => d[0] === v[0] && d[1] === v[1])) return true;
            if (SLIDE_DIRS[t].some((d) => d[0] === v[0] && d[1] === v[1])) return true;
          }
          break;
        }
        x += dx; y += dy; dist++;
      }
    }
    // 桂馬
    const fy = by === BLACK ? 2 : -2; // 攻撃側の桂は sq から見て (±1, fy) の位置にいる
    for (const dx of [-1, 1]) {
      const x = x0 + dx, y = y0 + fy;
      if (x < 0 || x > 8 || y < 0 || y > 8) continue;
      const pc = this.board[y * 9 + x];
      if (pc && pieceColor(pc) === by && pieceType(pc) === KE) return true;
    }
    return false;
  }

  inCheck(c: Color = this.turn): boolean {
    const k = this.kingSq[c];
    return k >= 0 && this.isAttacked(k, opponent(c));
  }

  /** 王手放置を考えない指し手（成・不成、行き所のない駒、二歩は考慮済み） */
  pseudoMoves(): Move[] {
    const us = this.turn;
    const out: Move[] = [];
    const add = (from: number, to: number, t: number) => {
      const canPro = canPromoteType(t) && (inPromotionZone(from, us) || inPromotionZone(to, us));
      if (canPro) out.push({ from, to, promote: true, drop: 0 });
      if (hasMoveFrom(t, to, us)) out.push({ from, to, promote: false, drop: 0 });
    };
    for (let sq = 0; sq < 81; sq++) {
      const pc = this.board[sq];
      if (!pc || pieceColor(pc) !== us) continue;
      const t = pieceType(pc);
      const x0 = xOf(sq), y0 = yOf(sq);
      for (const d0 of STEP_DIRS[t]) {
        const d = dirFor(us, d0);
        const x = x0 + d[0], y = y0 + d[1];
        if (x < 0 || x > 8 || y < 0 || y > 8) continue;
        const to = y * 9 + x;
        const tp = this.board[to];
        if (tp && pieceColor(tp) === us) continue;
        add(sq, to, t);
      }
      for (const d0 of SLIDE_DIRS[t]) {
        const d = dirFor(us, d0);
        let x = x0 + d[0], y = y0 + d[1];
        while (x >= 0 && x < 9 && y >= 0 && y < 9) {
          const to = y * 9 + x;
          const tp = this.board[to];
          if (tp && pieceColor(tp) === us) break;
          add(sq, to, t);
          if (tp) break;
          x += d[0]; y += d[1];
        }
      }
    }
    // 駒打ち
    const hand = this.hands[us];
    let pawnFiles = 0;
    if (hand[FU]) {
      for (let sq = 0; sq < 81; sq++) {
        const pc = this.board[sq];
        if (pc && pieceColor(pc) === us && pieceType(pc) === FU) pawnFiles |= 1 << xOf(sq);
      }
    }
    for (const t of HAND_TYPES) {
      if (!hand[t]) continue;
      for (let to = 0; to < 81; to++) {
        if (this.board[to]) continue;
        if (!hasMoveFrom(t, to, us)) continue;
        if (t === FU && pawnFiles & (1 << xOf(to))) continue; // 二歩
        out.push({ from: -1, to, promote: false, drop: t });
      }
    }
    return out;
  }

  /** 自玉に王手がかからないか（王手放置・自殺手のチェック） */
  private leavesKingSafe(m: Move): boolean {
    const us = this.turn;
    this.doMove(m);
    const ok = !this.inCheck(us);
    this.undoMove();
    return ok;
  }

  /** 打ち歩詰めか（歩を打った結果、相手に合法手がない） */
  isPawnDropMate(m: Move): boolean {
    if (m.from >= 0 || m.drop !== FU) return false;
    const them = opponent(this.turn);
    const k = this.kingSq[them];
    if (k < 0) return false;
    const front = m.to + (this.turn === BLACK ? -9 : 9);
    if (front !== k) return false;
    this.doMove(m);
    const mated = !this.hasLegalMove();
    this.undoMove();
    return mated;
  }

  legalMoves(): Move[] {
    return this.pseudoMoves().filter((m) => this.leavesKingSafe(m) && !this.isPawnDropMate(m));
  }

  hasLegalMove(): boolean {
    for (const m of this.pseudoMoves()) {
      if (this.leavesKingSafe(m) && !this.isPawnDropMate(m)) return true;
    }
    return false;
  }

  isLegal(m: Move): boolean {
    return this.legalMoves().some((x) => x.from === m.from && x.to === m.to && x.promote === m.promote && x.drop === m.drop);
  }

  /** その手が王手になるか */
  givesCheck(m: Move): boolean {
    const us = this.turn;
    this.doMove(m);
    const c = this.inCheck(opponent(us));
    this.undoMove();
    return c;
  }

  /** 直前の手（なければ null） */
  lastMove(): Move | null {
    return this.stack.length ? this.stack[this.stack.length - 1].move : null;
  }
}

