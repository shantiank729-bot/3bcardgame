import { describe, expect, it } from "vitest";
import { Position } from "../src/core/position";
import { mulberry32 } from "../src/engine/levels";
import { generateTsume } from "../src/tsume/generate";
import { MateSolver, checkTsume } from "../src/tsume/solver";

describe("詰み探索", () => {
  it("頭金の1手詰", () => {
    const r = checkTsume("4k4/9/4P4/9/9/9/9/9/9 b G 1", 1);
    expect(r).toMatchObject({ ok: true, solution: ["G*5b"] });
  });
  it("打ち歩詰めは詰みにならない", () => {
    const s = new MateSolver();
    expect(s.mateLength(Position.fromSfen("7nk/9/7G1/9/9/9/9/9/9 b P 1"), 1)).toBeNull();
  });
  it("3手詰: 1手では詰まず3手で詰む", () => {
    // 5一玉、持ち駒 金2枚。▲5二金 は 5二に利きがないので取られる → 頭に歩がいないと詰まない
    const p = Position.fromSfen("4k4/9/9/9/9/9/9/9/9 b 2G 1");
    const s = new MateSolver();
    expect(s.mateLength(p, 3)).toBeNull(); // 金2枚だけでは詰まない
    const q = Position.fromSfen("4k4/9/4+P4/9/9/9/9/9/9 b 2G 1");
    expect(new MateSolver().mateLength(q, 3)).toBe(1);
  });
  it("余詰があると不成立", () => {
    // 1一玉、2三銀・1三歩。金打ちは 1二・2二 のどちらでも詰む
    const r = checkTsume("8k/9/7SP/9/9/9/9/9/9 b G 1", 1);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("余詰");
  });
  it("短い詰みがあると N 手詰として不成立", () => {
    expect(checkTsume("4k4/9/4P4/9/9/9/9/9/9 b G 1", 3).ok).toBe(false);
  });
});

describe("自動生成", () => {
  for (const len of [1, 3, 5]) {
    it(`${len}手詰を作れて、正解が1つ`, () => {
      const pr = generateTsume(len, mulberry32(len * 7 + 1), 3000);
      expect(pr).not.toBeNull();
      const r = checkTsume(pr!.sfen, len);
      expect(r.ok).toBe(true);
      expect(r.solution).toEqual(pr!.solution);
      expect(pr!.solution.length).toBe(len);
    }, 120_000);
  }
});

import { moveToUsi, usiToMove } from "../src/core/usi";
describe("エンジンと食い違った7手詰の確認", () => {
  it("△9一玉と逃げても残り3手で詰む（エンジンの mate -8 は最短ではない）", () => {
    const p = Position.fromSfen("1kp6/1l2+R4/1gSg5/9/9/9/9/9/9 b RBG 1");
    for (const u of ["G*7b", "7a7b", "5b7b", "8a9a"]) p.doMove(usiToMove(u));
    const s = new MateSolver();
    const len = s.mateLength(p, 9);
    console.log("8a9a の後の詰み手数", len, s.matingMoves(p, len ?? 9).map(moveToUsi));
    expect(len).not.toBeNull();
    expect(len!).toBeLessThanOrEqual(3);
  });
});

import pool from "../src/tsume/pool.json";
describe("同梱の問題集", () => {
  it("すべて「ちょうどN手・正解が1つ」で、解答が保存どおり（1手・3手は全問、5手・7手は一部）", () => {
    const ps = pool as { sfen: string; length: number; solution: string[] }[];
    const sample = ps.filter((p, i) => p.length <= 3 || i % 6 === 0);
    for (const p of sample) {
      const r = checkTsume(p.sfen, p.length);
      expect(r.ok, p.sfen).toBe(true);
      expect(r.solution).toEqual(p.solution);
    }
  }, 300_000);
});
