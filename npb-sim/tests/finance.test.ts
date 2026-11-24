import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/league/world';
import { autoSeason, runToOffseason } from '../src/league/auto';
import { simulateUntil } from '../src/league/sim';
import { attendanceFor } from '../src/league/finance';
import { farmStandings, FARM_DIVISIONS } from '../src/league/farm';
import { allCareers, championsByYear, franchiseHistory, SEASON_CATS, seasonRecords } from '../src/league/records';
import { Rng } from '../src/engine/rng';
import { historyFarm } from '../src/league/pack';

describe('二軍と財政（1シーズン）', () => {
  const w = newWorld(71, 6);
  runToOffseason(w);
  it('二軍の試合が両地区で行われ、成績が残る', () => {
    const st = farmStandings(w);
    expect(st.length).toBe(2);
    const games = st.flatMap((d) => d.rows).reduce((s, r) => s + r.w + r.l + r.t, 0) / 2;
    expect(games).toBeGreaterThan(400);
    expect(Object.keys(w.farm!.stats).length).toBeGreaterThan(300);
    for (const d of FARM_DIVISIONS) for (const t of d.teams) expect(w.farm!.table[t][0] + w.farm!.table[t][1]).toBeGreaterThan(60);
  });
  it('観客動員と収支がNPBらしい範囲', () => {
    let total = 0, games = 0;
    for (const t of w.teams) {
      const c = w.finance[t.id].current;
      expect(c.closed).toBe(true);
      expect(c.homeGames).toBeGreaterThanOrEqual(70);
      total += c.attendance;
      games += c.homeGames;
      const rev = c.ticket + c.broadcast + c.sponsor + c.merch + c.postseason;
      expect(rev).toBeGreaterThan(700000); // 70億円以上
      expect(rev).toBeLessThan(3000000);
      expect(Math.abs(c.profit)).toBeLessThan(800000);
    }
    const avg = total / games;
    expect(avg).toBeGreaterThan(22000);
    expect(avg).toBeLessThan(40000);
  });
  it('チケットを高くすると観客は減る', () => {
    const rng = () => new Rng(1);
    const f = w.finance[1];
    f.pricing = -1;
    const cheap = attendanceFor(w, 1, '2027-06-02', 'L', rng());
    f.pricing = 1;
    const exp = attendanceFor(w, 1, '2027-06-02', 'L', rng());
    expect(cheap).toBeGreaterThan(exp);
    f.pricing = 0;
  });
  it('新シーズンで収支が記録され、予算が決まる', () => {
    autoSeason(w);
    for (const t of w.teams) {
      expect(w.finance[t.id].history.length).toBe(1);
      expect(w.budget[t.id]).toBeGreaterThanOrEqual(180000);
    }
    expect(historyFarm(w.history[2027]).length).toBeGreaterThan(300);
  });
});

describe('歴代記録', () => {
  const w = newWorld(72, 1);
  autoSeason(w);
  simulateUntil(w, '2028-06-30');
  it('シーズン記録・通算記録・優勝の歴史・球団の歴史', () => {
    for (const c of SEASON_CATS) {
      const r = seasonRecords(w, c, 5);
      expect(r.length).toBe(5);
      for (let i = 1; i < r.length; i++) expect(c.asc ? r[i].value >= r[i - 1].value : r[i].value <= r[i - 1].value).toBe(true);
    }
    const cs = allCareers(w);
    expect(cs.length).toBeGreaterThan(500);
    const ch = championsByYear(w);
    expect(ch[0].year).toBe(2027);
    expect(ch[0].a.champion).not.toBeNull();
    expect(ch[0].koshien).toBeDefined();
    const fh = franchiseHistory(w, 1);
    expect(fh.map((r) => r.year)).toEqual([2028, 2027]);
  });
});
