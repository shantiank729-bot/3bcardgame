import { describe, expect, it } from "vitest";
import { Game } from "../src/core/game";
import { usiToMove } from "../src/core/usi";
import { analyzeWeakness, classifyOpening } from "../src/analysis/weakness";
import type { GameRecord } from "../src/db/records";
import { LINES } from "../src/joseki/lines";
import { STARTPOS_SFEN } from "../src/core/position";

describe("定跡データ", () => {
  for (const line of LINES) {
    it(`${line.name}: すべて合法手で、自分の手に説明がある`, () => {
      const g = new Game();
      line.steps.forEach((s, i) => {
        expect(g.play(usiToMove(s.move)), `${i + 1}手目 ${s.move}`).toBe(true);
        if (i % 2 === line.you) expect(s.why, `${i + 1}手目の説明`).toBeTruthy();
      });
      expect(g.result).toBeNull();
    });
  }
  it("id が重複しない", () => {
    expect(new Set(LINES.map((l) => l.id)).size).toBe(LINES.length);
  });
});

const rec = (moves: string[], humanColor: 0 | 1, winner: 0 | 1 | null): GameRecord => ({
  date: 0, mode: "rated", startSfen: STARTPOS_SFEN, moves, times: [], humanColor, aiLevel: 5,
  result: { winner, reason: "投了" }, names: ["a", "b"], timePreset: "none",
});
const padded = (ms: string[]) => ms; // 定跡の手順は20手未満なので、そのまま使う

describe("戦型の判定", () => {
  const byId = (id: string) => LINES.find((l) => l.id === id)!.steps.map((s) => s.move);
  it("定跡の手順から戦型がわかる", () => {
    expect(classifyOpening(rec(byId("shiken"), 0, 0), 0)).toBe("四間飛車");
    expect(classifyOpening(rec(byId("nakabisha"), 0, 0), 0)).toBe("中飛車");
    expect(classifyOpening(rec(byId("ibisha-vs-shiken"), 0, 0), 0)).toBe("居飛車");
    expect(classifyOpening(rec(byId("bougin"), 0, 0), 0)).toBe("居飛車（棒銀）");
    expect(classifyOpening(rec(byId("vs-bougin"), 1, 0), 1)).toBe("四間飛車");
    expect(classifyOpening(rec(byId("vs-bougin"), 0, 0), 0)).toBe("居飛車");
  });
  it("戦型ごとの勝率と、解析が少ないときのおすすめ", () => {
    const moves = [...padded(LINES[0].steps.map((s) => s.move)), "3a3b", "1g1f", "1c1d"];
    const games = [rec(moves, 0, 0), rec(moves, 0, 1), rec(moves, 0, 1)];
    const r = analyzeWeakness(games);
    expect(r.byOpening).toEqual([{ name: "四間飛車", games: 3, score: 1 / 3 }]);
    expect(r.analyzedGames).toBe(0);
    expect(r.advice[0].text).toContain("3局以上");
  });
  it("終盤の損が大きく逆転負けが多いと詰将棋をすすめる", () => {
    const moves = Array.from({ length: 100 }, (_, i) => (i % 2 ? "8b9b" : "2h1h"));
    // 実際の手順の合法性は問わない（解析値だけで集計する）
    const mk = (): GameRecord => {
      const evals = moves.map((_, k) => ({ score: k >= 90 ? -2000 : 0, best: "x", pv: [] }));
      evals.push({ score: 0, best: "x", pv: [] });
      // 先手(あなた)の手番 k=偶数: 終盤まで互角→終盤で大きく下がる
      for (let k = 0; k <= 100; k++) evals[k] = { score: k < 85 ? (k % 2 ? -800 : 800) : (k % 2 ? 2500 : -2500), best: "x", pv: [] };
      return { ...rec(moves, 0, 1), analysis: { nodes: 1, done: true, evals } };
    };
    const r = analyzeWeakness([mk(), mk(), mk()]);
    expect(r.analyzedGames).toBe(3);
    expect(r.reversals).toBe(3);
    expect(r.advice[0].link).toBe("#/tsume");
  });
});
