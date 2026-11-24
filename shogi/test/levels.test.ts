import { describe, expect, it } from "vitest";
import { Position } from "../src/core/position";
import { usiToMove } from "../src/core/usi";
import { chooseMove, hangsPiece, levelParams, mulberry32, shouldResign } from "../src/engine/levels";
import { Candidate } from "../src/engine/usi";

const cand = (move: string, score: number): Candidate => ({ move, score, pv: [move], depth: 1 });

describe("レベル設定", () => {
  it("レベルが上がるほど探索量が増え、温度と許容損失が下がる", () => {
    for (let l = 1; l < 30; l++) {
      const a = levelParams(l), b = levelParams(l + 1);
      expect(b.nodes).toBeGreaterThan(a.nodes);
      expect(b.temperature).toBeLessThanOrEqual(a.temperature);
      expect(b.mistakeRate).toBeLessThan(a.mistakeRate);
      expect(b.maxLoss).toBeLessThanOrEqual(a.maxLoss);
    }
  });
});

describe("ただ捨ての判定", () => {
  it("角の利きに飛車を動かすのはただ捨て", () => {
    // 後手の角 5五（斜めに 6六・7七・8八・9九 へ利く）、先手の飛車 9八
    const p = Position.fromSfen("4k4/9/9/9/4b4/9/9/R8/4K4 b - 1");
    expect(hangsPiece(p, usiToMove("9h8h"))).toBe(true);
    expect(hangsPiece(p, usiToMove("9h9g"))).toBe(false);
  });
  it("歩の前に飛車を出すのは損（ひもがあっても飛車と歩の交換）", () => {
    const p = Position.fromSfen("4k4/9/9/6p2/9/9/9/6R2/4K4 b - 1");
    expect(hangsPiece(p, usiToMove("3h3e"))).toBe(true);
    expect(hangsPiece(p, usiToMove("3h3f"))).toBe(false);
  });
  it("駒を取る手で、取り返されても得なら除外しない", () => {
    // 先手の銀で後手の飛車を取る。銀は取り返されるが飛車の方が高い
    const p = Position.fromSfen("4k4/9/5g3/4r4/4S4/9/9/9/4K4 b - 1");
    expect(hangsPiece(p, usiToMove("5e5d"))).toBe(false);
  });
});

describe("指し手の選択", () => {
  it("強いレベルはほぼ最善手、弱いレベルは次善手も選ぶ", () => {
    const p = Position.startpos();
    p.ply = 50; // 序盤のばらつきを除く
    const cands = [cand("2g2f", 100), cand("7g7f", 60), cand("1g1f", -50), cand("9g9f", -400)];
    const count = (level: number) => {
      const rng = mulberry32(1);
      let best = 0;
      for (let i = 0; i < 500; i++) if (chooseMove(p, cands, levelParams(level), rng).move === "2g2f") best++;
      return best / 500;
    };
    expect(count(30)).toBeGreaterThan(0.9);
    expect(count(1)).toBeLessThan(0.6);
    expect(count(15)).toBeGreaterThan(count(1));
  });
  it("ミスでも maxLoss を超える手は選ばない", () => {
    const p = Position.startpos();
    p.ply = 50;
    const rng = mulberry32(2);
    const cands = [cand("2g2f", 100), cand("9g9f", -2000)];
    for (let i = 0; i < 200; i++) expect(chooseMove(p, cands, levelParams(20), rng).move).toBe("2g2f");
  });
  it("弱いレベルほどミス（100点以上悪い手）が多い", () => {
    const p = Position.startpos();
    p.ply = 50;
    const cands = [cand("2g2f", 100), cand("7g7f", 80), cand("1g1f", -150), cand("9g9f", -400)];
    const rate = (lv: number) => {
      const rng = mulberry32(3);
      let bad = 0;
      for (let i = 0; i < 2000; i++) if (["1g1f", "9g9f"].includes(chooseMove(p, cands, levelParams(lv), rng).move)) bad++;
      return bad / 2000;
    };
    expect(rate(1)).toBeGreaterThan(0.4);
    expect(rate(15)).toBeLessThan(rate(1));
    expect(rate(30)).toBeLessThan(0.05);
  });
  it("投了判定", () => {
    expect(shouldResign([-100, -29990])).toBe(true);
    expect(shouldResign([-3500, -3200, -4000])).toBe(true);
    expect(shouldResign([-3500, -200, -4000])).toBe(false);
  });
});

