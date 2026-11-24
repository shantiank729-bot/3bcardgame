import { describe, expect, it } from "vitest";
import { exportKif, importKif } from "../src/core/kif";
import { Position, STARTPOS_SFEN } from "../src/core/position";
import { moveToUsi, parseUsiPosition, toUsiPosition, usiToMove } from "../src/core/usi";


describe("SFEN / USI", () => {
  it("SFEN 読み書き往復", () => {
    for (const s of [STARTPOS_SFEN, "l6nl/5+P1gk/2np1S3/p1p4Pp/3P2Sp1/1PPb2P1P/P5GS1/R8/LN4bKL w RGgsn5p 1"]) {
      expect(Position.fromSfen(s).sfen()).toBe(s);
    }
  });
  it("position コマンドの往復", () => {
    const text = "position startpos moves 7g7f 3c3d 8h2b+";
    const { sfen, moves } = parseUsiPosition(text);
    expect(toUsiPosition(sfen, moves)).toBe(text);
  });
  it("反則を含む手順はエラー", () => {
    expect(() => parseUsiPosition("position startpos moves 7g7f 7g7e")).toThrow();
  });
  it("USI 指し手の往復", () => {
    for (const u of ["7g7f", "8h2b+", "P*5e", "N*1c"]) expect(moveToUsi(usiToMove(u))).toBe(u);
  });
});

describe("KIF", () => {
  const validMoves = () => {
    const p = Position.startpos();
    const ms = [];
    for (const u of ["7g7f", "3c3d", "8h2b+", "3a2b", "B*4e", "8c8d", "4e3d", "2b3c", "3d2c+"]) {
      const m = usiToMove(u);
      expect(p.isLegal(m), u).toBe(true);
      p.doMove(m); ms.push(m);
    }
    return ms;
  };
  it("書き出し → 読み込みで同じ手順", () => {
    const moves = validMoves();
    const kif = exportKif({ startSfen: STARTPOS_SFEN, moves, times: moves.map(() => 3000), endReason: "投了", winner: 0, black: "あなた", white: "AI" });
    expect(kif).toContain("   1 ７六歩(77)");
    expect(kif).toContain("   3 ２二角成(88)");
    expect(kif).toContain("   4 同　銀(31)");
    expect(kif).toContain("   5 ４五角打");
    expect(kif).toContain("まで9手で先手の勝ち");
    const d = importKif(kif);
    expect(d.moves.map(moveToUsi)).toEqual(moves.map(moveToUsi));
    expect(d.endReason).toBe("投了");
    expect(d.winner).toBe(0);
    expect(d.black).toBe("あなた");
  });
  it("盤面図つき KIF の往復", () => {
    const sfen = "l6nl/5+P1gk/2np1S3/p1p4Pp/3P2Sp1/1PPb2P1P/P5GS1/R8/LN4bKL w RGgsn5p 1";
    const kif = exportKif({ startSfen: sfen, moves: [] });
    expect(kif).toContain("後手の持駒：金　銀　桂　歩五");
    expect(importKif(kif).startSfen).toBe(sfen);
  });
  it("不成・他ソフト形式（▲付き、時間なし）の読み込み", () => {
    const text = `手合割：平手\n手数----指手---------消費時間--\n1 ▲７六歩(77)\n2 △３四歩(33)\n3 ▲２二角不成(88)\n4 △同　銀(31)\n5 投了\n`;
    const d = importKif(text);
    expect(d.moves.map(moveToUsi)).toEqual(["7g7f", "3c3d", "8h2b", "3a2b"]);
    expect(d.winner).toBe(1);
  });
});
