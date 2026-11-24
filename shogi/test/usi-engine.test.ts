import { describe, expect, it } from "vitest";
import { MATE_SCORE, UsiEngine, parseInfo } from "../src/engine/usi";

describe("USI info の解析", () => {
  it("評価値と読み筋", () => {
    const i = parseInfo("info depth 6 seldepth 7 score cp 68 multipv 2 nodes 16588 nps 414700 time 40 pv 2g2f 4a3b 2f2e")!;
    expect(i).toMatchObject({ move: "2g2f", score: 68, multipv: 2, depth: 6, nodes: 16588, pv: ["2g2f", "4a3b", "2f2e"] });
  });
  it("詰みの表記", () => {
    expect(parseInfo("info depth 3 score mate 3 pv G*5b")!.score).toBe(MATE_SCORE - 3);
    expect(parseInfo("info depth 3 score mate -2 pv 5a4a")!.score).toBe(-(MATE_SCORE - 2));
    expect(parseInfo("info depth 3 score mate + pv G*5b")!.score).toBe(MATE_SCORE);
  });
  it("pv のない行は無視", () => {
    expect(parseInfo("info string hello")).toBeNull();
  });
});

describe("UsiEngine", () => {
  it("MultiPV の結果を評価順に返す（偽エンジン）", async () => {
    let listener: (l: string) => void = () => {};
    const reply = (l: string) => setTimeout(() => listener(l), 0);
    const e = new UsiEngine({
      onLine: (cb) => { listener = cb; },
      send: (l) => {
        if (l === "usi") reply("usiok");
        if (l === "isready") reply("readyok");
        if (l.startsWith("go")) {
          reply("info depth 1 score cp 10 multipv 1 nodes 5 pv 7g7f");
          reply("info depth 1 score cp 30 multipv 2 nodes 5 pv 2g2f");
          reply("bestmove 7g7f");
        }
      },
    });
    await e.init({});
    const r = await e.analyze({ position: "startpos", multipv: 2, nodes: 10 });
    expect(r.bestmove).toBe("7g7f");
    expect(r.candidates.map((c) => c.move)).toEqual(["2g2f", "7g7f"]);
  });
});
