// 苦手分析: 振り返りの解析結果をためて、序盤・中盤・終盤の損、戦型ごとの勝率、練習のおすすめを出す（純粋関数）
import { Position } from "../core/position";
import { BLACK, Color, GI, HI, RY, fileOf, pieceColor, pieceType, rankOf } from "../core/types";
import { usiToMove } from "../core/usi";
import type { GameRecord } from "../db/records";
import { humanScore } from "../db/records";
import { judgeMove } from "./classify";

export type Phase = "opening" | "middle" | "endgame";
export const PHASE_LABEL: Record<Phase, string> = { opening: "序盤", middle: "中盤", endgame: "終盤" };

/** 手数で区切る（序盤: 30手目まで、中盤: 80手目まで、終盤: それ以降） */
export const phaseOf = (ply: number): Phase => (ply <= 30 ? "opening" : ply <= 80 ? "middle" : "endgame");

export interface PhaseStat { moves: number; totalLoss: number; bad: number; dubious: number }

/** 戦型（自分が指した作戦） */
export function classifyOpening(rec: GameRecord, side: Color): string {
  const p = Position.fromSfen(rec.startSfen);
  const moves = rec.moves.map(usiToMove);
  let rookFile: number | null = null;
  let boGin = false;
  const limit = Math.min(moves.length, 40);
  for (let i = 0; i < limit; i++) {
    p.doMove(moves[i]);
    // 自分の飛車の位置（最初の40手で最後にいた筋）
    for (let sq = 0; sq < 81; sq++) {
      const pc = p.board[sq];
      if (!pc || pieceColor(pc) !== side) continue;
      const t = pieceType(pc);
      // 自陣（先手は6〜9段目、後手は1〜4段目）にいる飛車の筋を見る
      const own = side === BLACK ? rankOf(sq) >= 6 : rankOf(sq) <= 4;
      if ((t === HI || t === RY) && own) rookFile = fileOf(sq);
      // 棒銀: 銀が飛車先の筋（先手2筋・1筋 / 後手8筋・9筋）を4段目付近まで進む
      if (t === GI && i < 30) {
        const f = fileOf(sq), r = rankOf(sq);
        if (side === BLACK && (f === 1 || f === 2) && r <= 6 && r >= 4) boGin = true;
        if (side !== BLACK && (f === 8 || f === 9) && r >= 4 && r <= 6) boGin = true;
      }
    }
  }
  if (rookFile === null) return "その他";
  // 先手から見た筋に直す（後手は 10 - 筋）
  const f = side === BLACK ? rookFile : 10 - rookFile;
  const furi: Record<number, string> = { 5: "中飛車", 6: "四間飛車", 7: "三間飛車", 8: "向かい飛車" };
  if (furi[f]) return furi[f];
  return boGin ? "居飛車（棒銀）" : "居飛車";
}

export interface WeaknessReport {
  analyzedGames: number;
  phases: Record<Phase, PhaseStat>;
  /** 優勢（勝率70%以上）になってから負けた対局 */
  reversals: number;
  /** 序盤で大きく不利（勝率30%以下）になった対局 */
  earlyCollapse: number;
  byOpening: { name: string; games: number; score: number }[];
  advice: { text: string; link: string; linkLabel: string }[];
}

export function analyzeWeakness(games: GameRecord[]): WeaknessReport {
  const phases: Record<Phase, PhaseStat> = {
    opening: { moves: 0, totalLoss: 0, bad: 0, dubious: 0 },
    middle: { moves: 0, totalLoss: 0, bad: 0, dubious: 0 },
    endgame: { moves: 0, totalLoss: 0, bad: 0, dubious: 0 },
  };
  let analyzed = 0, reversals = 0, earlyCollapse = 0;
  const op = new Map<string, { games: number; score: number }>();
  for (const g of games) {
    if (g.humanColor === null || g.mode === "human") continue;
    const me = g.humanColor;
    // 戦型ごとの勝率（解析の有無に関係なく）
    if (g.moves.length >= 20) {
      const name = classifyOpening(g, me);
      const o = op.get(name) ?? { games: 0, score: 0 };
      o.games++; o.score += humanScore(g.result, me);
      op.set(name, o);
    }
    const ev = g.analysis?.evals;
    if (!g.analysis?.done || !ev) continue;
    analyzed++;
    const startTurn = g.startSfen.split(" ")[1] === "w" ? 1 : 0;
    let maxP = 0, minEarly = 1;
    for (let k = 1; k <= g.moves.length; k++) {
      const mover = (startTurn + k - 1) % 2;
      if (mover !== me) continue;
      const j = judgeMove(ev, k, g.moves[k - 1]);
      if (!j) continue;
      const ph = phases[phaseOf(k)];
      ph.moves++; ph.totalLoss += j.drop;
      if (j.mark === "bad") ph.bad++;
      else if (j.mark === "dubious") ph.dubious++;
      maxP = Math.max(maxP, j.after);
      if (k <= 30) minEarly = Math.min(minEarly, j.after);
    }
    const lost = humanScore(g.result, me) === 0;
    if (lost && maxP >= 0.7) reversals++;
    if (minEarly <= 0.3) earlyCollapse++;
  }
  const byOpening = [...op.entries()].map(([name, o]) => ({ name, games: o.games, score: o.score / o.games })).sort((a, b) => b.games - a.games);
  return { analyzedGames: analyzed, phases, reversals, earlyCollapse, byOpening, advice: makeAdvice(analyzed, phases, reversals, earlyCollapse, byOpening) };
}

/** 1手あたりの平均損（勝率の下がり幅） */
export const avgLoss = (s: PhaseStat) => (s.moves ? s.totalLoss / s.moves : 0);

function makeAdvice(analyzed: number, ph: Record<Phase, PhaseStat>, reversals: number, early: number, byOpening: WeaknessReport["byOpening"]): WeaknessReport["advice"] {
  const out: WeaknessReport["advice"] = [];
  if (analyzed < 3) {
    out.push({ text: "分析には解析済みの対局が3局以上必要です。まずは対局を重ねましょう。", link: "#/play", linkLabel: "対局する" });
    return out;
  }
  const order = (["opening", "middle", "endgame"] as Phase[]).sort((a, b) => avgLoss(ph[b]) - avgLoss(ph[a]));
  const worst = order[0];
  if (reversals >= 2 || worst === "endgame") {
    out.push({ text: `終盤で評価を落としやすく${reversals ? `、逆転負けが${reversals}局あります` : "なっています"}。詰将棋を増やして、寄せの力をつけましょう。`, link: "#/tsume", linkLabel: "詰将棋へ" });
  }
  if (worst === "opening" || early >= 2) {
    out.push({ text: `序盤で不利になりやすい${early ? `（序盤で勝率30%以下になった対局が${early}局）` : ""}ようです。定跡練習で基本の手順を身につけましょう。`, link: "#/joseki", linkLabel: "定跡練習へ" });
  }
  if (worst === "middle") {
    out.push({ text: "中盤で損をしやすいようです。振り返りで悪手の局面の最善手を確かめ、練習対局ではヒントを使って考え方をつかみましょう。", link: "#/records", linkLabel: "対局を振り返る" });
  }
  const weak = byOpening.filter((o) => o.games >= 3 && o.score < 0.4);
  for (const o of weak.slice(0, 2)) {
    out.push({ text: `「${o.name}」の勝率が${Math.round(o.score * 100)}%と低めです。定跡練習で手順を確認しましょう。`, link: "#/joseki", linkLabel: "定跡練習へ" });
  }
  if (!out.length) out.push({ text: "大きな弱点は見つかりません。この調子で対局と詰将棋を続けましょう。", link: "#/play", linkLabel: "対局する" });
  return out;
}
