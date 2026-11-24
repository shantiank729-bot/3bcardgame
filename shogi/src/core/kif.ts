import { Position, STARTPOS_SFEN } from "./position";
import {
  BLACK, Color, HAND_TYPES, Move, WHITE, canPromoteType, fileOf, inPromotionZone, makePiece,
  pieceColor, pieceType, rankOf, sqOf,
} from "./types";

export const PIECE_KANJI = ["", "歩", "香", "桂", "銀", "金", "角", "飛", "玉", "と", "成香", "成桂", "成銀", "馬", "龍"];
/** 盤面表示用の1文字 */
export const PIECE_CHAR = ["", "歩", "香", "桂", "銀", "金", "角", "飛", "玉", "と", "杏", "圭", "全", "馬", "龍"];
const ZEN = "０１２３４５６７８９";
const KAN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

export function kanjiNum(n: number): string {
  if (n <= 10) return n === 10 ? "十" : KAN[n];
  return "十" + KAN[n - 10];
}
function parseKanjiNum(s: string): number {
  if (!s) return 1;
  if (/^\d+$/.test(s)) return Number(s);
  let n = 0;
  if (s.includes("十")) {
    const [a, b] = s.split("十");
    n = (a ? KAN.indexOf(a) : 1) * 10 + (b ? KAN.indexOf(b) : 0);
  } else n = KAN.indexOf(s);
  return n;
}

/** KIF 形式の指し手文字列（例: ７六歩(77)、同　歩(76)、５五角打） */
export function moveToKif(pos: Position, m: Move, prevTo: number | null): string {
  const dest = prevTo === m.to ? "同　" : `${ZEN[fileOf(m.to)]}${KAN[rankOf(m.to)]}`;
  if (m.from < 0) return `${dest}${PIECE_KANJI[m.drop]}打`;
  const t = pieceType(pos.board[m.from]);
  let suffix = "";
  if (m.promote) suffix = "成";
  else if (canPromoteType(t) && (inPromotionZone(m.from, pos.turn) || inPromotionZone(m.to, pos.turn))) suffix = "不成";
  return `${dest}${PIECE_KANJI[t]}${suffix}(${fileOf(m.from)}${rankOf(m.from)})`;
}

/** 画面表示用（▲７六歩 など、移動元なし） */
export function moveToDisplay(pos: Position, m: Move, prevTo: number | null): string {
  const mark = pos.turn === BLACK ? "▲" : "△";
  const k = moveToKif(pos, m, prevTo).replace(/\(\d\d\)$/, "");
  // 打は同じ駒が盤上から動けない場合のみ省略するのが正式だが、表示では常に付ける
  return mark + k;
}

const fmtTime = (ms: number, total: number) => {
  const s = Math.floor(ms / 1000), t = Math.floor(total / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `(${String(Math.floor(s / 60)).padStart(2, " ")}:${pad(s % 60)}/${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)})`;
};

export interface KifData {
  startSfen: string;
  moves: Move[];
  /** 各手の消費時間（ミリ秒）。省略可 */
  times?: number[];
  black?: string;
  white?: string;
  startedAt?: Date;
  /** 終局理由の文字列（投了、詰み、千日手、持将棋、切れ負け、反則負け、入玉勝ち、中断 など） */
  endReason?: string;
  /** 勝者。引き分けは null、未定は undefined */
  winner?: Color | null;
}

function bod(pos: Position): string {
  const handStr = (c: Color) => {
    const parts: string[] = [];
    for (const t of HAND_TYPES) {
      const n = pos.hands[c][t];
      if (n) parts.push(PIECE_KANJI[t] + (n > 1 ? kanjiNum(n) : ""));
    }
    return parts.length ? parts.join("　") + "　" : "なし";
  };
  const lines = [`後手の持駒：${handStr(WHITE)}`, "  ９ ８ ７ ６ ５ ４ ３ ２ １", "+---------------------------+"];
  for (let y = 0; y < 9; y++) {
    let row = "|";
    for (let x = 0; x < 9; x++) {
      const pc = pos.board[y * 9 + x];
      if (!pc) row += " ・";
      else row += (pieceColor(pc) === WHITE ? "v" : " ") + PIECE_CHAR[pieceType(pc)];
    }
    lines.push(row + "|" + KAN[y + 1]);
  }
  lines.push("+---------------------------+", `先手の持駒：${handStr(BLACK)}`);
  if (pos.turn === WHITE) lines.push("後手番");
  return lines.join("\n");
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function exportKif(d: KifData): string {
  const out: string[] = ["#KIF version=2.0 encoding=UTF-8"];
  const dt = d.startedAt ?? new Date();
  out.push(`開始日時：${dt.getFullYear()}/${pad2(dt.getMonth() + 1)}/${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(dt.getSeconds())}`);
  const start = Position.fromSfen(d.startSfen);
  if (d.startSfen === STARTPOS_SFEN) out.push("手合割：平手");
  else out.push(bod(start));
  out.push(`先手：${d.black ?? "先手"}`, `後手：${d.white ?? "後手"}`);
  out.push("手数----指手---------消費時間--");
  const pos = start.clone();
  let prevTo: number | null = null;
  const totals = [0, 0];
  d.moves.forEach((m, i) => {
    const t = d.times?.[i] ?? 0;
    totals[pos.turn] += t;
    const s = moveToKif(pos, m, prevTo);
    // 全角文字の幅を考慮して揃える
    const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 0xff ? 2 : 1), 0);
    out.push(`${String(i + 1).padStart(4, " ")} ${s}${" ".repeat(Math.max(1, 14 - w))}${fmtTime(t, totals[pos.turn])}`);
    prevTo = m.to;
    pos.doMove(m);
  });
  const n = d.moves.length;
  if (d.endReason) {
    const KIF_END: Record<string, string> = { "詰み": "詰み", "投了": "投了", "千日手": "千日手", "持将棋": "持将棋", "切れ負け": "切れ負け", "反則負け": "反則負け", "入玉勝ち": "入玉勝ち", "中断": "中断" };
    const word = KIF_END[d.endReason] ?? d.endReason;
    if (word !== "詰み") out.push(`${String(n + 1).padStart(4, " ")} ${word}`);
    if (d.winner === null) out.push(`まで${n}手で${d.endReason === "千日手" ? "千日手" : "引き分け"}`);
    else if (d.winner !== undefined) {
      const side = d.winner === BLACK ? "先手" : "後手";
      const why = d.endReason === "反則負け" ? "の反則勝ち" : d.endReason === "入玉勝ち" ? "の入玉勝ち" : "の勝ち";
      out.push(`まで${n}手で${side}${why}`);
    } else out.push(`まで${n}手で中断`);
  }
  return out.join("\n") + "\n";
}

const PIECE_BY_NAME: Record<string, number> = {
  "歩": 1, "香": 2, "桂": 3, "銀": 4, "金": 5, "角": 6, "飛": 7, "玉": 8, "王": 8,
  "と": 9, "成香": 10, "杏": 10, "成桂": 11, "圭": 11, "成銀": 12, "全": 12, "馬": 13, "龍": 14, "竜": 14,
};

function parseHandLine(s: string, pos: Position, c: Color) {
  s = s.trim();
  if (!s || s === "なし") return;
  for (const tok of s.split(/[\s　]+/).filter(Boolean)) {
    const t = PIECE_BY_NAME[tok[0]];
    if (!t || t > 7) throw new Error(`持ち駒が読めません: ${tok}`);
    pos.hands[c][t] += parseKanjiNum(tok.slice(1));
  }
}

function parseBod(lines: string[]): Position | null {
  const top = lines.findIndex((l) => /^\+-+\+/.test(l.trim()));
  if (top < 0) return null;
  const pos = new Position();
  for (let y = 0; y < 9; y++) {
    const l = lines[top + 1 + y];
    const body = l.slice(l.indexOf("|") + 1, l.lastIndexOf("|"));
    const cells = [...body];
    // 2文字ずつ（先頭が v か空白）
    let x = 0;
    for (let i = 0; i < cells.length && x < 9; ) {
      const pre = cells[i], ch = cells[i + 1];
      i += 2;
      if (ch === "・") { x++; continue; }
      const t = PIECE_BY_NAME[ch];
      if (!t) throw new Error(`盤面が読めません: ${l}`);
      pos.board[y * 9 + x] = makePiece(t, pre === "v" ? WHITE : BLACK);
      x++;
    }
  }
  for (const l of lines) {
    let m = l.match(/^後手の持駒：(.*)$/);
    if (m) parseHandLine(m[1], pos, WHITE);
    m = l.match(/^先手の持駒：(.*)$/);
    if (m) parseHandLine(m[1], pos, BLACK);
  }
  const white = lines.some((l) => l.trim() === "後手番");
  return Position.fromSfen(pos.sfen(false).replace(/ [bw] /, white ? " w " : " b ") + " 1");
}

const ZEN_TO_NUM = (ch: string) => {
  const i = ZEN.indexOf(ch);
  if (i >= 0) return i;
  if (/[1-9]/.test(ch)) return Number(ch);
  const k = KAN.indexOf(ch);
  return k > 0 ? k : -1;
};

const END_WORDS: Record<string, string> = {
  "投了": "投了", "詰み": "詰み", "千日手": "千日手", "持将棋": "持将棋", "切れ負け": "切れ負け",
  "反則負け": "反則負け", "反則勝ち": "反則勝ち", "入玉勝ち": "入玉勝ち", "中断": "中断", "宣言勝ち": "入玉勝ち",
};

export function importKif(text: string): KifData {
  const lines = text.replace(/\r/g, "").split("\n");
  const handi = lines.find((l) => l.startsWith("手合割："));
  if (handi && !/平手/.test(handi) && !lines.some((l) => /^\+-+\+/.test(l.trim())))
    throw new Error("平手以外の手合割（盤面図なし）には未対応です");
  const start = parseBod(lines) ?? Position.startpos();
  const d: KifData = { startSfen: start.sfen(), moves: [], times: [] };
  const header = (k: string) => lines.find((l) => l.startsWith(k + "："))?.slice(k.length + 1).trim();
  d.black = header("先手") ?? header("下手");
  d.white = header("後手") ?? header("上手");
  const pos = start.clone();
  let prevTo: number | null = null;
  for (const raw of lines) {
    const l = raw.trim();
    if (l.startsWith("変化：")) break; // 分岐は読まない
    const m = l.match(/^(\d+)\s+(.+?)(?:[ \t]+\(\s*(\d+):(\d+)\/[^)]*\))?[ \t+]*$/);
    if (!m) continue;
    const text = m[2].replace(/[ \t]+.*$/, "");
    const endWord = Object.keys(END_WORDS).find((w) => text.startsWith(w));
    if (endWord) {
      d.endReason = END_WORDS[endWord];
      const loser = pos.turn;
      if (["投了", "詰み", "切れ負け", "反則負け"].includes(d.endReason)) d.winner = (loser ^ 1) as Color;
      else if (d.endReason === "反則勝ち" || d.endReason === "入玉勝ち") d.winner = loser;
      else if (d.endReason === "千日手" || d.endReason === "持将棋") d.winner = null;
      break;
    }
    const mv = parseKifMove(pos, text, prevTo);
    if (!mv) throw new Error(`${m[1]}手目が読めません: ${text}`);
    d.times!.push(m[3] ? (Number(m[3]) * 60 + Number(m[4])) * 1000 : 0);
    d.moves.push(mv);
    prevTo = mv.to;
    pos.doMove(mv);
  }
  if (!d.endReason && !pos.hasLegalMove()) { d.endReason = "詰み"; d.winner = (pos.turn ^ 1) as Color; }
  return d;
}

function parseKifMove(pos: Position, text: string, prevTo: number | null): Move | null {
  let s = text.replace(/^[▲△☗☖]/, "");
  let to: number;
  if (s.startsWith("同")) {
    if (prevTo === null) return null;
    to = prevTo;
    s = s.slice(1).replace(/^[\s　]+/, "");
  } else {
    const f = ZEN_TO_NUM(s[0]), r = ZEN_TO_NUM(s[1]);
    if (f < 1 || r < 1) return null;
    to = sqOf(f, r);
    s = s.slice(2);
  }
  const fromMatch = s.match(/\((\d)(\d)\)$/);
  const from = fromMatch ? sqOf(Number(fromMatch[1]), Number(fromMatch[2])) : null;
  if (fromMatch) s = s.slice(0, s.length - 4);
  let drop = false, promote = false;
  if (s.endsWith("打")) { drop = true; s = s.slice(0, -1); }
  if (s.endsWith("不成")) s = s.slice(0, -2);
  else if (s.endsWith("成") && !(s in PIECE_BY_NAME)) { promote = true; s = s.slice(0, -1); }
  // 「右」「左」「上」「引」「寄」「直」などの補助記号は無視して候補から絞る
  const name = s.replace(/[右左上引寄直行入]/g, "");
  const t = PIECE_BY_NAME[name];
  if (!t) return null;
  const legal = pos.legalMoves().filter((m) => m.to === to && m.promote === promote);
  const cands = legal.filter((m) => {
    if (drop) return m.from < 0 && m.drop === t;
    if (m.from < 0) return from === null && m.drop === t;
    if (from !== null) return m.from === from;
    return pieceType(pos.board[m.from]) === t;
  });
  // 駒打ちと盤上の移動が両方可能で「打」がない場合は盤上の移動
  const boardMoves = cands.filter((m) => m.from >= 0);
  if (boardMoves.length === 1) return boardMoves[0];
  if (boardMoves.length === 0 && cands.length === 1) return cands[0];
  return null;
}

