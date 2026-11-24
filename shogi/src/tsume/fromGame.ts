// 自分の対局の局面から詰将棋を作る（解析で「手番側に詰みあり」と出た局面）
import { Position } from "../core/position";
import { WHITE, makePiece, pieceColor, pieceType } from "../core/types";
import { usiToMove } from "../core/usi";
import type { GameRecord } from "../db/records";
import { MATE_SCORE } from "../engine/usi";
import { TsumeProblem } from "./generate";
import { MateSolver, checkTsume } from "./solver";

/** 盤を180度回して先後を入れ替える（攻め方を先手にそろえるため） */
export function flipSfen(sfen: string): string {
  const p = Position.fromSfen(sfen);
  const q = new Position();
  for (let s = 0; s < 81; s++) {
    const pc = p.board[s];
    if (pc) q.board[80 - s] = makePiece(pieceType(pc), (pieceColor(pc) ^ 1) as 0 | 1);
  }
  q.hands[0].set(p.hands[1]);
  q.hands[1].set(p.hands[0]);
  return Position.fromSfen(q.sfen(false).replace(/ [bw] /, p.turn === WHITE ? " b " : " w ") + " 1").sfen();
}

/** 対局の解析結果から、あなたの手番で詰み（7手以内）があった局面を詰将棋にする */
export function candidatesFromGame(rec: GameRecord): string[] {
  const evals = rec.analysis?.evals;
  if (!evals || rec.humanColor === null) return [];
  const out: string[] = [];
  const p = Position.fromSfen(rec.startSfen);
  const moves = rec.moves.map(usiToMove);
  for (let k = 0; k <= moves.length; k++) {
    if (k > 0) p.doMove(moves[k - 1]);
    const e = evals[k];
    if (!e || p.turn !== rec.humanColor || e.score < MATE_SCORE - 9) continue;
    const s = p.sfen(false) + " 1";
    out.push(p.turn === WHITE ? flipSfen(s) : s);
  }
  return out;
}

/** 候補局面を詰将棋のルール（王手の連続）で確かめて問題にする */
export function problemFromPosition(sfen: string, maxLen = 7): TsumeProblem | null {
  const solver = new MateSolver(400_000);
  const len = solver.mateLength(Position.fromSfen(sfen), maxLen);
  if (len === null) return null;
  const r = checkTsume(sfen, len, 1_000_000);
  if (!r.ok) return null;
  return { id: "g_" + sfen.split(" ").slice(0, 3).join("_"), sfen, length: len, solution: r.solution!, source: "game" };
}
