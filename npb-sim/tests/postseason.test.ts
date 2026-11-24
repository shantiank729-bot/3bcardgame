import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/league/world';
import { simulateUntil } from '../src/league/sim';
import { applySeriesResult, setupPostseason, type Series } from '../src/league/postseason';
import { computeStandings, magicNumber } from '../src/league/standings';
import { deserializeWorld, serializeWorld } from '../src/save/serialize';

function freshPost(seed = 1) {
  const w = newWorld(seed, 1);
  // 日程を消化したことにせず、ポストシーズンの仕組みだけを試す
  w.post = setupPostseason(w);
  return w;
}
const play = (w: ReturnType<typeof freshPost>, s: Series, highWins: boolean | null) => {
  const g = s.games.find((x) => !x.played)!;
  const homeIsHigh = g.home === s.high;
  const hr = highWins === null ? 3 : highWins === homeIsHigh ? 5 : 1;
  const ar = highWins === null ? 3 : highWins === homeIsHigh ? 1 : 5;
  applySeriesResult(w, s, g.id, hr, ar);
};

describe('クライマックスシリーズのルール', () => {
  it('ファーストステージ: 2位の本拠地で3試合、2勝で突破', () => {
    const w = freshPost();
    const s = w.post!.series.find((x) => x.id === 'C1')!;
    expect(s.games.every((g) => g.home === s.high)).toBe(true);
    play(w, s, false);
    play(w, s, false);
    expect(s.winner).toBe(s.low);
    expect(s.games.length).toBe(2);
    // 勝者がファイナルへ
    expect(w.post!.series.find((x) => x.id === 'C2')!.low).toBe(s.low);
  });
  it('ファーストステージ: 1勝1敗1分なら上位が突破', () => {
    const w = freshPost();
    const s = w.post!.series.find((x) => x.id === 'P1')!;
    play(w, s, true);
    play(w, s, false);
    expect(s.winner).toBeNull();
    play(w, s, null);
    expect(s.winner).toBe(s.high);
  });
  it('ファイナルステージ: 1位に1勝のアドバンテージ、3勝で突破可能', () => {
    const w = freshPost();
    const s1 = w.post!.series.find((x) => x.id === 'C1')!;
    play(w, s1, true); play(w, s1, true);
    const s = w.post!.series.find((x) => x.id === 'C2')!;
    expect(s.wins).toEqual([1, 0]);
    play(w, s, true); play(w, s, true); play(w, s, true);
    expect(s.winner).toBe(s.high);
    expect(s.games.length).toBe(3);
  });
  it('ファイナルステージ: 下位は4勝が必要', () => {
    const w = freshPost();
    const s1 = w.post!.series.find((x) => x.id === 'C1')!;
    play(w, s1, true); play(w, s1, true);
    const s = w.post!.series.find((x) => x.id === 'C2')!;
    for (let i = 0; i < 3; i++) play(w, s, false);
    expect(s.winner).toBeNull();
    play(w, s, false);
    expect(s.winner).toBe(s.low);
  });
  it('日本シリーズ: 4勝先取、引き分けがあれば第8戦', () => {
    const w = freshPost();
    for (const lg of ['C', 'P']) {
      const s1 = w.post!.series.find((x) => x.id === `${lg}1`)!;
      play(w, s1, true); play(w, s1, true);
      const s2 = w.post!.series.find((x) => x.id === `${lg}2`)!;
      play(w, s2, true); play(w, s2, true); play(w, s2, true);
    }
    const js = w.post!.series.find((x) => x.id === 'JS')!;
    expect(js.status).toBe('active');
    expect(js.games.length).toBe(7);
    // 第1・2・6・7戦は同じ球団の本拠地
    expect(new Set([0, 1, 5, 6].map((i) => js.games[i].home)).size).toBe(1);
    expect(new Set([2, 3, 4].map((i) => js.games[i].home)).size).toBe(1);
    play(w, js, null);
    for (let i = 0; i < 3; i++) { play(w, js, true); play(w, js, false); }
    expect(js.winner).toBeNull();
    expect(js.games.length).toBe(8);
    play(w, js, true);
    expect(js.winner).toBe(js.high);
    expect(w.post!.champion).toBe(js.high);
  });
});

describe('1シーズン通し（オールスター・CS・日本シリーズ・表彰・新聞）', () => {
  const w = newWorld(21, 3);
  simulateUntil(w, '2099-01-01');
  it('日本一が決まりオフシーズンへ', () => {
    expect(w.phase).toBe('offseason');
    expect(w.post!.champion).not.toBeNull();
    for (const lg of ['C', 'P'] as const) expect(w.post!.seeds[lg]).toEqual(computeStandings(w, lg).slice(0, 3).map((r) => r.tid));
  });
  it('オールスター2試合とMVP', () => {
    expect(w.allStar!.games.length).toBe(2);
    expect(w.allStar!.mvp.length).toBe(2);
    for (const g of w.allStar!.games) expect(g.innings).toBeLessThanOrEqual(9);
  });
  it('表彰がそろう', () => {
    const a = w.awards[2027];
    expect(a.champion).toBe(w.post!.champion);
    for (const lg of ['C', 'P'] as const) {
      expect(a.mvp[lg]).not.toBeNull();
      const titles = new Set(a.titles[lg].map((t) => t.title));
      for (const t of ['首位打者', '本塁打王', '打点王', '盗塁王', '最優秀防御率', '最多勝', '最多奪三振', '最多セーブ']) expect(titles.has(t)).toBe(true);
      expect(a.bestNine[lg].filter((x) => x.pos === 'OF').length).toBe(3);
      expect(a.goldenGlove[lg].length).toBeGreaterThanOrEqual(8);
    }
    expect(a.jsMvp).not.toBeNull();
  });
  it('新聞: 試合のある日は毎日発行され、1面は最も重要な記事', () => {
    const gameDates = new Set(Object.values(w.results).map((g) => g.date));
    for (const d of gameDates) {
      const issue = w.news[d];
      expect(issue, d).toBeDefined();
      for (let i = 1; i < issue.stories.length; i++) expect(issue.stories[i - 1].score).toBeGreaterThanOrEqual(issue.stories[i].score);
    }
    const all = Object.values(w.news).flatMap((i) => i.stories);
    expect(all.some((s) => s.kind === 'clinch')).toBe(true);
    expect(all.some((s) => s.kind === 'jsWin')).toBe(true);
    const lastIssue = w.news[Object.keys(w.news).sort().pop()!];
    expect(lastIssue.stories[0].kind).toBe('jsWin');
    // 見出しのバリエーション（同じ見出しばかりにならない）
    const heads = all.map((s) => s.headline);
    expect(new Set(heads).size / heads.length).toBeGreaterThan(0.7);
  });
  it('セーブ・読込でポストシーズンや新聞も保たれる', () => {
    const back = deserializeWorld(serializeWorld(w));
    expect(back.post!.champion).toBe(w.post!.champion);
    expect(Object.keys(back.news).length).toBe(Object.keys(w.news).length);
  });
});

describe('優勝マジック', () => {
  it('首位が優勝を決めたら0', () => {
    const w = newWorld(4, 1);
    simulateUntil(w, '2027-09-30');
    for (const lg of ['C', 'P'] as const) {
      const m = magicNumber(w, lg);
      expect(m.magic).toBe(0);
    }
  });
});
