import { describe, expect, it } from "vitest";
import { Position, STARTPOS_SFEN } from "../src/core/position";
import { moveToUsi, usiToMove } from "../src/core/usi";

function perft(p: Position, d: number): number {
  if (d === 0) return 1;
  const ms = p.legalMoves();
  if (d === 1) return ms.length;
  let n = 0;
  for (const m of ms) { p.doMove(m); n += perft(p, d - 1); p.undoMove(); }
  return n;
}
const usiMoves = (p: Position) => p.legalMoves().map(moveToUsi);

describe("合法手生成", () => {
  it("初期局面の perft", () => {
    const p = Position.startpos();
    expect(perft(p, 1)).toBe(30);
    expect(perft(p, 2)).toBe(900);
    expect(perft(p, 3)).toBe(25470);
  });
  it("perft 4 (719731)", () => {
    expect(perft(Position.startpos(), 4)).toBe(719731);
  }, 60000);
  it("指し手最大局面は593手", () => {
    const p = Position.fromSfen("R8/2K1S1SSk/4B4/9/9/9/9/9/1L1L1L3 b RBGSNLP3g3n17p 1");
    expect(p.legalMoves().length).toBe(593);
  });
  it("「まつり」局面は207手", () => {
    const p = Position.fromSfen("l6nl/5+P1gk/2np1S3/p1p4Pp/3P2Sp1/1PPb2P1P/P5GS1/R8/LN4bKL w RGgsn5p 1");
    expect(p.legalMoves().length).toBe(207);
  });
  it("doMove/undoMove でハッシュと SFEN が元に戻る", () => {
    const p = Position.startpos();
    const key = p.key();
    const seq = ["7g7f", "3c3d", "8h2b+", "3a2b", "B*4e"];
    for (const u of seq) p.doMove(usiToMove(u));
    expect(p.sfen()).toBe("lnsgkg1nl/1r5s1/pppppp1pp/6p2/5B3/2P6/PP1PPPPPP/7R1/LNSGKGSNL w b 6");
    expect(Position.fromSfen(p.sfen()).key()).toBe(p.key());
    for (let i = 0; i < seq.length; i++) p.undoMove();
    expect(p.sfen()).toBe(STARTPOS_SFEN);
    expect(p.key()).toBe(key);
  });
});

describe("反則手", () => {
  it("二歩は指せない", () => {
    const p = Position.fromSfen("4k4/9/9/9/9/9/4P4/9/4K4 b P 1");
    expect(usiMoves(p).filter((m) => m.startsWith("P*5"))).toEqual([]);
    expect(usiMoves(p)).toContain("P*4e");
  });
  it("と金があっても二歩ではない", () => {
    const p = Position.fromSfen("4k4/9/9/9/9/9/4+P4/9/4K4 b P 1");
    expect(usiMoves(p)).toContain("P*5e");
  });
  it("行き所のない駒は打てない・不成で動けない", () => {
    const p = Position.fromSfen("4k4/9/9/9/9/9/9/9/4K4 b PLN 1");
    const ms = usiMoves(p);
    expect(ms.some((m) => /^P\*\da$/.test(m))).toBe(false);
    expect(ms.some((m) => /^L\*\da$/.test(m))).toBe(false);
    expect(ms.some((m) => /^N\*\d[ab]$/.test(m))).toBe(false);
    expect(ms).toContain("N*5c");
    const q = Position.fromSfen("4k4/P8/9/9/9/9/9/9/4K4 b - 1");
    expect(usiMoves(q)).toContain("9b9a+");
    expect(usiMoves(q)).not.toContain("9b9a");
    const n = Position.fromSfen("4k4/9/8N/9/9/9/9/9/4K4 b - 1");
    expect(usiMoves(n)).toEqual(expect.arrayContaining(["1c2a+"]));
    expect(usiMoves(n)).not.toContain("1c2a");
  });
  it("後手の行き所のない駒", () => {
    const p = Position.fromSfen("4k4/9/9/9/9/9/9/9/4K4 w pln 1");
    const ms = usiMoves(p);
    expect(ms.some((m) => /^P\*\di$/.test(m))).toBe(false);
    expect(ms.some((m) => /^N\*\d[hi]$/.test(m))).toBe(false);
    expect(ms).toContain("N*5g");
  });
  it("打ち歩詰めは指せない", () => {
    // 後手玉 1一、2一に先手の金の利き…歩を1二に打つと詰みになる形
    const p = Position.fromSfen("7nk/9/7G1/9/9/9/9/9/4K4 b P 1");
    expect(usiMoves(p)).not.toContain("P*1b");
  });
  it("打ち歩でも詰みでなければ打てる", () => {
    const p = Position.fromSfen("8k/9/9/9/9/9/9/9/4K4 b P 1");
    expect(usiMoves(p)).toContain("P*1b");
  });
  it("突き歩詰めは反則ではない", () => {
    const p = Position.fromSfen("7nk/9/7GP/9/9/9/9/9/4K4 b - 1");
    expect(usiMoves(p)).toContain("1c1b+");
    expect(usiMoves(p)).toContain("1c1b");
  });
  it("王手放置・ピンされた駒は動かせない", () => {
    const p = Position.fromSfen("4r4/9/9/9/9/9/9/4G4/4K4 b - 1");
    expect(usiMoves(p).filter((m) => m.startsWith("5h"))).toEqual(["5h5g"]);
    const q = Position.fromSfen("4k4/9/9/9/4r4/9/9/9/4K4 b G 1");
    // 王手されているので、合駒か玉が逃げる手だけ
    for (const m of usiMoves(q)) expect(m === "5i4i" || m === "5i6i" || m === "5i4h" || m === "5i6h" || /^G\*5[fgh]$/.test(m)).toBe(true);
  });
  it("自殺手（相手の利きに玉が入る）は指せない", () => {
    const p = Position.fromSfen("4k4/9/9/9/9/9/9/3r5/4K4 b - 1");
    expect(usiMoves(p).sort()).toEqual(["5i4i", "5i6h"]); // 6八の飛車は取れる
  });
});
