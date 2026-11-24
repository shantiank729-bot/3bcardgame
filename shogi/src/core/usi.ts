import { Position, STARTPOS_SFEN } from "./position";
import { Move, fileOf, rankOf, sqOf } from "./types";

const DROP_LETTER = ["", "P", "L", "N", "S", "G", "B", "R"];
const RANK_LETTER = "abcdefghi";

const sqToUsi = (sq: number) => `${fileOf(sq)}${RANK_LETTER[rankOf(sq) - 1]}`;
const usiToSq = (s: string) => {
  const f = Number(s[0]), r = RANK_LETTER.indexOf(s[1]) + 1;
  if (!(f >= 1 && f <= 9 && r >= 1)) throw new Error(`不正なマス: ${s}`);
  return sqOf(f, r);
};

export function moveToUsi(m: Move): string {
  if (m.from < 0) return `${DROP_LETTER[m.drop]}*${sqToUsi(m.to)}`;
  return `${sqToUsi(m.from)}${sqToUsi(m.to)}${m.promote ? "+" : ""}`;
}

export function usiToMove(s: string): Move {
  if (s[1] === "*") {
    const drop = DROP_LETTER.indexOf(s[0].toUpperCase());
    if (drop <= 0) throw new Error(`不正な指し手: ${s}`);
    return { from: -1, to: usiToSq(s.slice(2, 4)), promote: false, drop };
  }
  return { from: usiToSq(s.slice(0, 2)), to: usiToSq(s.slice(2, 4)), promote: s[4] === "+", drop: 0 };
}

/** 「position startpos moves ...」「sfen ... moves ...」「SFEN文字列のみ」を読む */
export function parseUsiPosition(text: string): { sfen: string; moves: Move[] } {
  let s = text.trim().replace(/^position\s+/, "");
  let sfen = STARTPOS_SFEN;
  let movesPart = "";
  const mi = s.indexOf(" moves ");
  if (mi >= 0) { movesPart = s.slice(mi + 7); s = s.slice(0, mi); }
  else if (s.endsWith(" moves")) s = s.slice(0, -6);
  if (s === "startpos") sfen = STARTPOS_SFEN;
  else sfen = s.replace(/^sfen\s+/, "");
  const start = Position.fromSfen(sfen);
  const pos = start.clone();
  const moves: Move[] = [];
  for (const tok of movesPart.split(/\s+/).filter(Boolean)) {
    const m = usiToMove(tok);
    if (!pos.isLegal(m)) throw new Error(`${moves.length + 1}手目が反則です: ${tok}`);
    pos.doMove(m);
    moves.push(m);
  }
  return { sfen: start.sfen(), moves };
}

export function toUsiPosition(startSfen: string, moves: Move[]): string {
  const head = startSfen === STARTPOS_SFEN ? "startpos" : `sfen ${startSfen}`;
  return moves.length ? `position ${head} moves ${moves.map(moveToUsi).join(" ")}` : `position ${head}`;
}
