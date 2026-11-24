import { describe, expect, it } from 'vitest';
import { buildSchedule } from '../src/league/schedule';
import { TEAMS } from '../src/league/teams';
import { weekday } from '../src/league/calendar';

describe('日程', () => {
  const cal = buildSchedule(TEAMS, 2027);
  const lg = new Map(TEAMS.map((t) => [t.id, t.league]));
  it('全球団143試合（リーグ内125・交流戦18）', () => {
    for (const t of TEAMS) {
      const g = cal.games.filter((x) => x.away === t.id || x.home === t.id);
      expect(g.length).toBe(143);
      expect(g.filter((x) => x.kind === 'L').length).toBe(125);
      expect(g.filter((x) => x.kind === 'I').length).toBe(18);
      const home = g.filter((x) => x.home === t.id).length;
      expect(Math.abs(home - 71.5)).toBeLessThanOrEqual(4.5);
    }
  });
  it('同一リーグの各球団と25試合、相手リーグの各球団と3試合', () => {
    for (const a of TEAMS) for (const b of TEAMS) {
      if (a.id >= b.id) continue;
      const n = cal.games.filter((x) => (x.away === a.id && x.home === b.id) || (x.away === b.id && x.home === a.id)).length;
      expect(n).toBe(a.league === b.league ? 25 : 3);
      if (a.league === b.league) {
        const ah = cal.games.filter((x) => x.away === b.id && x.home === a.id).length;
        expect(Math.abs(ah - 12.5)).toBeLessThanOrEqual(1.5);
      }
    }
  });
  it('1日に同じ球団は1試合まで、月曜は試合なし', () => {
    const byDay = new Map<string, number[]>();
    for (const g of cal.games) (byDay.get(g.date) ?? byDay.set(g.date, []).get(g.date)!).push(g.away, g.home);
    for (const [d, ids] of byDay) {
      expect(new Set(ids).size).toBe(ids.length);
      expect(weekday(d)).not.toBe(1);
    }
  });
  it('交流戦は5〜6月、オールスターは7月、シーズンは10月上旬までに終わる', () => {
    expect(cal.interleague.start.slice(5, 7)).toMatch(/05|06/);
    expect(cal.interleague.end.slice(5, 7)).toBe('06');
    expect(cal.allStar.length).toBe(2);
    expect(cal.allStar[0].slice(5, 7)).toBe('07');
    expect(cal.lastDay < '2027-10-10').toBe(true);
    for (const g of cal.games) if (g.kind === 'I') expect(lg.get(g.away)).not.toBe(lg.get(g.home));
  });
  it('交流戦のホームは年ごとに入れ替わる', () => {
    const next = buildSchedule(TEAMS, 2028);
    const h27 = cal.games.filter((g) => g.kind === 'I' && g.home === 1).map((g) => g.away).sort();
    const h28 = next.games.filter((g) => g.kind === 'I' && g.home === 1).map((g) => g.away).sort();
    expect(new Set([...new Set(h27), ...new Set(h28)]).size).toBe(6);
  });
});
