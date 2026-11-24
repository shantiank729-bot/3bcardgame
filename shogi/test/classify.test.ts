import { describe, expect, it } from "vitest";
import { PosEval, blackScore, judgeMove, winProb } from "../src/analysis/classify";

const ev = (score: number, best = "x", second?: number): PosEval => ({ score, best, pv: [best], second });

describe("勝率", () => {
  it("0点は50%、詰みは0/100%", () => {
    expect(winProb(0)).toBe(0.5);
    expect(winProb(29995)).toBe(1);
    expect(winProb(-29995)).toBe(0);
    expect(winProb(600)).toBeGreaterThan(0.7);
  });
});

describe("悪手・疑問手・好手", () => {
  it("駒をただで渡すような大きな下落は悪手", () => {
    // 指す前 +100（手番側）、指した後 相手から見て +1200
    const j = judgeMove([ev(100, "7g7f"), ev(1200)], 1, "2g2f")!;
    expect(j.mark).toBe("bad");
    expect(j.drop).toBeGreaterThan(0.2);
  });
  it("中くらいの下落は疑問手", () => {
    const j = judgeMove([ev(100, "7g7f"), ev(250)], 1, "2g2f")!;
    expect(j.mark).toBe("dubious");
  });
  it("小さな差は印なし", () => {
    expect(judgeMove([ev(100, "7g7f"), ev(-60)], 1, "2g2f")!.mark).toBeNull();
  });
  it("最善手で、次善との差が大きいと好手", () => {
    expect(judgeMove([ev(400, "5e5d", -100), ev(-380)], 1, "5e5d")!.mark).toBe("good");
    expect(judgeMove([ev(400, "5e5d", 350), ev(-380)], 1, "5e5d")!.mark).toBeNull();
  });
  it("最善手は評価のぶれがあっても悪手にしない", () => {
    expect(judgeMove([ev(100, "7g7f"), ev(900)], 1, "7g7f")!.mark).toBeNull();
  });
  it("勝負が決まった局面では印を付けない", () => {
    expect(judgeMove([ev(5000, "a"), ev(-2500)], 1, "b")!.mark).toBeNull();
    expect(judgeMove([ev(-5000, "a"), ev(6000)], 1, "b")!.mark).toBeNull();
  });
  it("未解析なら null", () => {
    expect(judgeMove([ev(0), null], 1, "a")).toBeNull();
  });
});

describe("先手視点の評価値", () => {
  it("手番に応じて符号を反転", () => {
    const e = [ev(100), ev(-80), ev(50)];
    expect(blackScore(e, 0, 0)).toBe(100);
    expect(blackScore(e, 1, 0)).toBe(80);
    expect(blackScore(e, 2, 0)).toBe(50);
    expect(blackScore(e, 0, 1)).toBe(-100);
  });
});
