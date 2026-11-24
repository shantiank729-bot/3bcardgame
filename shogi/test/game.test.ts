import { describe, expect, it } from "vitest";
import { Game, canDeclareWin } from "../src/core/game";
import { Position } from "../src/core/position";
import { usiToMove } from "../src/core/usi";

const play = (g: Game, seq: string) => {
  for (const u of seq.split(" ")) expect(g.play(usiToMove(u)), u).toBe(true);
};

describe("終局判定", () => {
  it("詰み（頭金）", () => {
    const g = new Game("4k4/9/4P4/9/9/9/9/9/4K4 b G 1");
    play(g, "G*5b");
    expect(g.result).toEqual({ winner: 0, reason: "詰み" });
  });
  it("反則手は指せず局面が変わらない", () => {
    const g = new Game();
    expect(g.play(usiToMove("7g7e"))).toBe(false);
    expect(g.ply).toBe(0);
  });
  it("千日手（同一局面4回）は引き分け", () => {
    const g = new Game();
    const cycle = "2h3h 8b7b 3h2h 7b8b";
    play(g, cycle); play(g, cycle);
    expect(g.result).toBeNull();
    play(g, "2h3h 8b7b 3h2h");
    expect(g.result).toBeNull();
    play(g, "7b8b");
    expect(g.result).toEqual({ winner: null, reason: "千日手" });
  });
  it("連続王手の千日手（後手玉を追い続ける）", () => {
    const g = new Game("k8/9/9/9/9/9/9/9/1R2K4 b - 1");
    // 8i8a+? 飛車で王手 → 玉が逃げる、を繰り返す
    const seq = ["8i9i", "9a8a", "9i8i", "8a9a"]; // 9i: 9筋で王手, 8i: 8筋で王手
    for (let k = 0; k < 3; k++) play(g, seq.join(" "));
    expect(g.result).toEqual({ winner: 1, reason: "連続王手の千日手" });
  });
  it("投了・時間切れ", () => {
    const g = new Game();
    g.resign();
    expect(g.result).toEqual({ winner: 1, reason: "投了" });
    const h = new Game();
    play(h, "7g7f");
    h.timeout(1);
    expect(h.result).toEqual({ winner: 0, reason: "切れ負け" });
  });
  it("待った（undo）で結果も戻る", () => {
    const g = new Game("4k4/9/4P4/9/9/9/9/9/4K4 b G 1");
    play(g, "G*5b");
    expect(g.undo()).toBe(true);
    expect(g.result).toBeNull();
    expect(g.pos.hands[0][5]).toBe(1);
  });
});

describe("入玉宣言（27点法）", () => {
  it("先手28点・敵陣10枚・王手なしなら宣言勝ち", () => {
    // 先手玉 5二、敵陣に飛角 + 小駒8枚 = 10枚 (5*2+8=18点)、持ち駒 飛角 (10点) = 28点
    const sfen = "GGSS1SSGG/RB2K4/9/9/9/9/9/9/4k4 b RB 1";
    const p = Position.fromSfen(sfen);
    expect(canDeclareWin(p, 0)).toBe(true);
    const g = new Game(sfen);
    expect(g.declare()).toEqual({ winner: 0, reason: "入玉勝ち" });
  });
  it("27点では先手は宣言できない（条件不足は反則負け）", () => {
    const sfen = "GGSS1SSGG/RB2K4/9/9/9/9/9/9/4k4 b RP 1"; // 18+5+1 = 24
    expect(canDeclareWin(Position.fromSfen(sfen), 0)).toBe(false);
    const g = new Game(sfen);
    expect(g.declare()).toEqual({ winner: 1, reason: "反則負け" });
  });
  it("後手は27点で宣言できる", () => {
    const sfen = "4K4/9/9/9/9/9/9/rb2k4/ggss1ssgg w rP 1"; // 敵陣10枚: 18点 + 飛5 = 23… 足りない
    expect(canDeclareWin(Position.fromSfen(sfen), 1)).toBe(false);
    const sfen2 = "4K4/9/9/9/9/9/9/rb2k4/ggss1ssgg w rb4p 1"; // 18 + 10 + 4 = 32
    expect(canDeclareWin(Position.fromSfen(sfen2), 1)).toBe(true);
  });
  it("王手されていると宣言できない", () => {
    const sfen = "GGSS1SSGG/RB2K4/9/9/9/9/9/9/4r3k b RB 1";
    expect(canDeclareWin(Position.fromSfen(sfen), 0)).toBe(false);
  });
});
