import { describe, expect, it } from "vitest";
import { glicko2Update } from "../src/rating/glicko2";
import { INITIAL, chooseLevel, levelRating, rankOf } from "../src/rating/rank";

describe("Glicko-2", () => {
  it("Glickman の論文の計算例と一致", () => {
    const r = glicko2Update({ rating: 1500, rd: 200, vol: 0.06 }, [
      { opponent: { rating: 1400, rd: 30 }, score: 1 },
      { opponent: { rating: 1550, rd: 100 }, score: 0 },
      { opponent: { rating: 1700, rd: 300 }, score: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });
  it("RD が大きいほど1局の変動が大きい", () => {
    const opp = { opponent: { rating: 750, rd: 40 }, score: 1 };
    const big = glicko2Update({ ...INITIAL }, [opp]).rating - 750;
    const small = glicko2Update({ ...INITIAL, rd: 60 }, [opp]).rating - 750;
    expect(big).toBeGreaterThan(small * 3);
    expect(big).toBeGreaterThan(100);
  });
});

describe("段級位", () => {
  it("境界", () => {
    expect(rankOf(-50).label).toBe("15級");
    expect(rankOf(0).label).toBe("15級");
    expect(rankOf(99).label).toBe("15級");
    expect(rankOf(100).label).toBe("14級");
    expect(rankOf(750).label).toBe("8級");
    expect(rankOf(1499).label).toBe("1級");
    expect(rankOf(1500).label).toBe("初段");
    expect(rankOf(1650).label).toBe("二段");
    expect(rankOf(2100).label).toBe("五段");
    expect(rankOf(9999).label).toBe("八段");
  });
});

describe("AI レベル", () => {
  it("レベルのレーティングは単調増加で、1≒15級、30≒六段", () => {
    for (let l = 1; l < 30; l++) expect(levelRating(l + 1)).toBeGreaterThan(levelRating(l));
    expect(rankOf(levelRating(1)).label).toBe("15級");
    expect(rankOf(levelRating(30)).label).toBe("六段");
  });
  it("自分と同じくらいのレベルを選ぶ", () => {
    for (const r of [100, 750, 1500, 2200]) {
      const L = chooseLevel({ rating: r, rd: 100 });
      expect(Math.abs(levelRating(L) - r)).toBeLessThan(80);
    }
  });
});
