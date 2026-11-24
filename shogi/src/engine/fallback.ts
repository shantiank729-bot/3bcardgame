// 簡易エンジン（SharedArrayBuffer が使えない環境用）。駒の損得中心の αβ 探索。
import { Position } from "../core/position";
import { BLACK, HAND_TYPES, Move, OU, pieceColor, pieceType, yOf } from "../core/types";
import { moveToUsi, parseUsiPosition } from "../core/usi";
import { AnalyzeRequest, AnalyzeResult, Candidate, MATE_SCORE } from "./usi";

const V = [0, 90, 315, 405, 495, 540, 855, 990, 0, 540, 540, 540, 540, 945, 1395];
const HAND_BONUS = [0, 15, 30, 40, 50, 55, 90, 110];

function evaluate(p: Position): number {
  let s = 0;
  for (let sq = 0; sq < 81; sq++) {
    const pc = p.board[sq];
    if (!pc) continue;
    const t = pieceType(pc);
    if (t === OU) continue;
    // 前に出た駒を少し評価
    const adv = pieceColor(pc) === BLACK ? 8 - yOf(sq) : yOf(sq);
    const v = V[t] + (t <= 5 || (t >= 9 && t <= 12) ? adv * 3 : 0);
    s += pieceColor(pc) === BLACK ? v : -v;
  }
  for (const t of HAND_TYPES) s += (p.hands[0][t] - p.hands[1][t]) * (V[t] + HAND_BONUS[t]);
  return p.turn === BLACK ? s : -s;
}

class Search {
  nodes = 0;
  constructor(private limit: number) {}
  get out() { return this.nodes >= this.limit; }

  ab(p: Position, depth: number, alpha: number, beta: number, ply: number): number {
    this.nodes++;
    if (depth <= 0) return this.quiesce(p, alpha, beta, 0);
    const moves = order(p, p.legalMoves());
    if (!moves.length) return -(MATE_SCORE - ply);
    for (const m of moves) {
      p.doMove(m);
      const v = -this.ab(p, depth - 1, -beta, -alpha, ply + 1);
      p.undoMove();
      if (v > alpha) alpha = v;
      if (alpha >= beta || this.out) break;
    }
    return alpha;
  }

  quiesce(p: Position, alpha: number, beta: number, qd: number): number {
    this.nodes++;
    const stand = evaluate(p);
    if (stand >= beta || qd > 4) return stand;
    if (stand > alpha) alpha = stand;
    const caps = order(p, p.pseudoMoves().filter((m) => m.from >= 0 && p.board[m.to]));
    for (const m of caps) {
      p.doMove(m);
      if (p.inCheck((p.turn ^ 1) as 0 | 1)) { p.undoMove(); continue; }
      const v = -this.quiesce(p, -beta, -alpha, qd + 1);
      p.undoMove();
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return alpha;
  }
}

function order(p: Position, ms: Move[]): Move[] {
  const key = (m: Move) => (m.from >= 0 && p.board[m.to] ? V[pieceType(p.board[m.to])] * 10 - V[pieceType(p.board[m.from])] : 0) + (m.promote ? 300 : 0);
  return ms.sort((a, b) => key(b) - key(a));
}

export function fallbackAnalyze(req: AnalyzeRequest): AnalyzeResult {
  const { sfen, moves } = parseUsiPosition("position " + req.position);
  const p = Position.fromSfen(sfen);
  for (const m of moves) p.doMove(m);
  const limit = Math.min(req.nodes ?? 200_000, 400_000);
  const root = p.legalMoves();
  if (!root.length) return { bestmove: "resign", candidates: [], nodes: 0 };
  const s = new Search(limit);
  let scored: Candidate[] = [];
  for (let depth = 1; depth <= (req.depth ?? 6); depth++) {
    const cur: Candidate[] = [];
    const ordered = scored.length ? scored.map((c) => root.find((m) => moveToUsi(m) === c.move)!) : order(p, root);
    for (const m of ordered) {
      p.doMove(m);
      const v = -s.ab(p, depth - 1, -MATE_SCORE, MATE_SCORE, 1);
      p.undoMove();
      const u = moveToUsi(m);
      cur.push({ move: u, score: v, pv: [u], depth });
      if (s.out) break;
    }
    if (cur.length === root.length || !scored.length) {
      // 途中で打ち切った深さは、探索済みの手だけ更新
      const merged = new Map(scored.map((c) => [c.move, c]));
      for (const c of cur) merged.set(c.move, c);
      scored = [...merged.values()].sort((a, b) => b.score - a.score);
    }
    if (s.out) break;
  }
  const candidates = scored.slice(0, req.multipv ?? 1);
  return { bestmove: candidates[0].move, candidates, nodes: s.nodes };
}
