import { describe, expect, it } from "vitest";
import { fallbackAnalyze } from "../src/engine/fallback";

describe("簡易エンジン", () => {
  it("1手詰めを見つける", () => {
    const r = fallbackAnalyze({ position: "sfen 4k4/9/4P4/9/9/9/9/9/4K4 b G 1", nodes: 20000, depth: 3 });
    expect(r.bestmove).toBe("G*5b");
    expect(r.candidates[0].score).toBeGreaterThan(29000);
  });
  it("ただの駒を取る", () => {
    const r = fallbackAnalyze({ position: "sfen 4k4/9/9/9/4r4/9/9/4R4/4K4 b - 1", nodes: 20000, depth: 3 });
    expect(r.bestmove).toBe("5h5e");
  });
  it("MultiPV で複数の候補を返す", () => {
    const r = fallbackAnalyze({ position: "startpos", nodes: 5000, multipv: 5, depth: 2 });
    expect(r.candidates.length).toBe(5);
  });
});
