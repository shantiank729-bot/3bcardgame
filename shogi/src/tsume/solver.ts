// 詰将棋の詰み探索（攻め方 = 手番側。攻め方は王手しか指せない）
// 短手数（〜9手）向けの AND/OR 探索 + 置換表。
import { Position } from "../core/position";
import { Move } from "../core/types";
import { moveToUsi } from "../core/usi";

export class MateSolver {
  /** key → 詰みが証明された最小の残り手数 */
  private proven = new Map<string, number>();
  /** key → 詰まないことが分かっている最大の残り手数 */
  private disproven = new Map<string, number>();
  nodes = 0;
  constructor(public nodeLimit = 2_000_000) {}

  get exhausted() { return this.nodes >= this.nodeLimit; }

  /** 王手になる合法手（取る手・成る手・駒打ちの順） */
  checks(p: Position): Move[] {
    const out: Move[] = [];
    for (const m of p.legalMoves()) if (p.givesCheck(m)) out.push(m);
    const score = (m: Move) => (m.from >= 0 && p.board[m.to] ? 4 : 0) + (m.promote ? 2 : 0) + (m.from < 0 ? 1 : 0);
    return out.sort((a, b) => score(b) - score(a));
  }

  /** 玉方の応手（玉が動く手→取る手→合駒） */
  evasions(p: Position): Move[] {
    const ms = p.legalMoves();
    const k = p.kingSq[p.turn];
    const score = (m: Move) => (m.from === k ? 4 : 0) + (m.from >= 0 && p.board[m.to] ? 2 : 0) + (m.from < 0 ? -1 : 0);
    return ms.sort((a, b) => score(b) - score(a));
  }

  /** 攻め方の手番で、depth 手以内（奇数）に詰むか */
  mates(p: Position, depth: number): boolean {
    if (depth < 1) return false;
    const key = p.key();
    const pr = this.proven.get(key);
    if (pr !== undefined && pr <= depth) return true;
    const dp = this.disproven.get(key);
    if (dp !== undefined && dp >= depth) return false;
    this.nodes++;
    if (this.exhausted) return false;
    let ok = false;
    for (const m of this.checks(p)) {
      p.doMove(m);
      const r = this.defended(p, depth - 1);
      p.undoMove();
      if (!r) { ok = true; break; }
      if (this.exhausted) return false;
    }
    if (ok) this.proven.set(key, Math.min(depth, pr ?? Infinity));
    else if (!this.exhausted) this.disproven.set(key, Math.max(depth, dp ?? -1));
    return ok;
  }

  /** 玉方の手番で、残り depth 手（偶数）で逃れられるか */
  private defended(p: Position, depth: number): boolean {
    const ev = this.evasions(p);
    if (!ev.length) return false; // 詰み
    if (depth < 2) return true;
    for (const m of ev) {
      p.doMove(m);
      const mated = this.mates(p, depth - 1);
      p.undoMove();
      if (!mated) return true;
      if (this.exhausted) return true;
    }
    return false;
  }

  /** 最短の詰み手数（maxDepth まで。なければ null） */
  mateLength(p: Position, maxDepth: number): number | null {
    for (let d = 1; d <= maxDepth; d += 2) {
      if (this.mates(p, d)) return d;
      if (this.exhausted) return null;
    }
    return null;
  }

  /** depth 手以内に詰む初手の一覧 */
  matingMoves(p: Position, depth: number): Move[] {
    const out: Move[] = [];
    for (const m of this.checks(p)) {
      p.doMove(m);
      const r = this.defended(p, depth - 1);
      p.undoMove();
      if (!r) out.push(m);
    }
    return out;
  }

  /** 玉方の最長の抵抗（同じ長さなら駒を取る手・玉が動く手を優先）。詰みまでの残り手数も返す */
  bestDefense(p: Position, depth: number): { move: Move; remain: number } | null {
    let best: { move: Move; remain: number; pref: number } | null = null;
    for (const m of this.evasions(p)) {
      p.doMove(m);
      const len = this.mateLength(p, depth - 1) ?? Infinity;
      p.undoMove();
      const pref = (m.from === p.kingSq[p.turn] ? 2 : 0) + (m.from >= 0 && p.board[m.to] ? 1 : 0) - (m.from < 0 ? 1 : 0);
      if (!best || len > best.remain || (len === best.remain && pref > best.pref)) best = { move: m, remain: len, pref };
    }
    return best ? { move: best.move, remain: best.remain } : null;
  }
}

export interface TsumeCheck {
  ok: boolean;
  reason?: string;
  length?: number;
  /** 本手順（USI） */
  solution?: string[];
}

/**
 * 詰将棋として成立するか:
 * - ちょうど length 手で詰み、より短い詰みがない
 * - 本手順の攻め方の各手で、残り手数以内に詰む手が1つだけ（余詰なし）
 */
export function checkTsume(sfen: string, length: number, nodeLimit = 3_000_000): TsumeCheck {
  const p = Position.fromSfen(sfen);
  if (p.inCheck((p.turn ^ 1) as 0 | 1)) return { ok: false, reason: "初形で王手がかかっている" };
  const s = new MateSolver(nodeLimit);
  const len = s.mateLength(p, length);
  if (s.exhausted) return { ok: false, reason: "探索の上限" };
  if (len !== length) return { ok: false, reason: len === null ? "詰まない" : `${len}手で詰む` };
  const solution: string[] = [];
  let remain = length;
  while (remain > 0) {
    const ms = s.matingMoves(p, remain);
    if (ms.length !== 1) return { ok: false, reason: ms.length ? `余詰（${solution.length + 1}手目に${ms.length}通り）` : "詰まない" };
    solution.push(moveToUsi(ms[0]));
    p.doMove(ms[0]);
    remain--;
    if (remain === 0) break;
    const d = s.bestDefense(p, remain);
    if (!d) break;
    if (d.remain !== remain - 1) return { ok: false, reason: "手数が合わない" };
    solution.push(moveToUsi(d.move));
    p.doMove(d.move);
    remain--;
  }
  if (s.exhausted) return { ok: false, reason: "探索の上限" };
  return { ok: true, length, solution };
}

