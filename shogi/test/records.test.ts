import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { exportAll, importAll } from "../src/db/db";
import { GameRecord, applyRatedGame, loadGames, loadProfile, saveGame, saveProfile } from "../src/db/records";
import { INITIAL, PLACEMENT_GAMES, chooseLevel } from "../src/rating/rank";
import { computeStats } from "../src/rating/stats";

const rec = (date: number, winner: 0 | 1 | null, before: number, after: number): GameRecord => ({
  date, mode: "rated", startSfen: "x", moves: [], times: [], humanColor: 0, aiLevel: 9,
  result: { winner, reason: winner === null ? "千日手" : "投了" }, names: ["あなた", "AI"], timePreset: "none",
  rating: { before: { rating: before, rd: 100, vol: 0.06 }, after: { rating: after, rd: 100, vol: 0.06 }, aiRating: 700, placement: false },
});

describe("レーティング対局の反映", () => {
  it("棋力判定中は変動が大きく、その後は小さい", () => {
    let p = { key: "profile" as const, glicko: { ...INITIAL }, ratedGames: 0 };
    const deltas: number[] = [];
    for (let i = 0; i < 10; i++) {
      // アプリと同じく、毎局そのときのレーティングに合ったレベルと対局して勝つ
      const r = applyRatedGame(p, chooseLevel(p.glicko), 1);
      deltas.push(r.after.rating - r.before.rating);
      expect(r.placement).toBe(i < PLACEMENT_GAMES);
      p = r.profile;
    }
    expect(deltas[0]).toBeGreaterThan(100);
    for (let i = 0; i < PLACEMENT_GAMES; i++) expect(deltas[i]).toBeGreaterThan(70);
    expect(deltas[9]).toBeLessThan(deltas[4]);
  });
  it("負ければ下がる", () => {
    const p = { key: "profile" as const, glicko: { ...INITIAL }, ratedGames: 10 };
    const r = applyRatedGame(p, 9, 0);
    expect(r.after.rating).toBeLessThan(r.before.rating);
  });
});

describe("成長記録の集計", () => {
  it("勝率・連勝・昇級の履歴", () => {
    const games = [rec(1, 0, 750, 790), rec(2, 0, 790, 820), rec(3, 1, 820, 790), rec(4, 0, 790, 805), rec(5, 0, 805, 830), rec(6, 0, 830, 860)];
    const s = computeStats(games);
    expect(s.rated).toBe(6);
    expect(s.wins).toBe(5);
    expect(s.winRate).toBeCloseTo(5 / 6);
    expect(s.bestStreak).toBe(3);
    expect(s.currentStreak).toBe(3);
    expect(s.series.map((x) => x.rating)).toEqual([750, 790, 820, 790, 805, 830, 860]);
    expect(s.rankHistory.map((e) => `${e.label}${e.up ? "↑" : "↓"}`)).toEqual(["7級↑", "8級↓", "7級↑"]);
  });
});

describe("IndexedDB", () => {
  it("保存・読み込み・書き出し・読み込み直し", async () => {
    await saveGame(rec(10, 0, 750, 790));
    await saveGame(rec(5, 1, 790, 760));
    const p = await loadProfile();
    expect(p.glicko.rating).toBe(INITIAL.rating);
    await saveProfile({ ...p, ratedGames: 2, glicko: { rating: 760, rd: 200, vol: 0.06 } });
    const games = await loadGames();
    expect(games.map((g) => g.date)).toEqual([5, 10]);
    const json = await exportAll();
    await saveGame(rec(20, 0, 1, 2));
    expect((await loadGames()).length).toBe(3);
    expect((await importAll(json)).games).toBe(2);
    expect((await loadGames()).length).toBe(2);
    expect((await loadProfile()).glicko.rating).toBe(760);
    await expect(importAll("{}")).rejects.toThrow();
  });
});
