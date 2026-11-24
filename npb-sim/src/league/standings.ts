import type { LeagueId } from './teams';
import type { World } from './world';

export interface StandingRow {
  tid: number;
  g: number;
  w: number;
  l: number;
  t: number;
  pct: number;
  gb: number | null;
  rs: number;
  ra: number;
  home: [number, number, number];
  away: [number, number, number];
  last10: string;
  streak: string;
  /** 交流戦の成績 */
  inter: [number, number, number];
  remaining: number;
}

/** 勝率 = 勝 /(勝+敗)。引き分けは除いて計算する（NPB方式） */
export const winPct = (w: number, l: number) => (w + l === 0 ? 0 : w / (w + l));

export function computeStandings(world: World, league?: LeagueId, filter?: (kind: 'L' | 'I') => boolean): StandingRow[] {
  const rows = new Map<number, StandingRow>();
  const seq = new Map<number, string[]>();
  for (const t of world.teams) {
    if (league && t.league !== league) continue;
    rows.set(t.id, { tid: t.id, g: 0, w: 0, l: 0, t: 0, pct: 0, gb: null, rs: 0, ra: 0, home: [0, 0, 0], away: [0, 0, 0], last10: '', streak: '', inter: [0, 0, 0], remaining: 0 });
    seq.set(t.id, []);
  }
  const games = world.calendar.games;
  for (const g of games) {
    const r = world.results[g.id];
    for (const [tid, isHome] of [[g.away, false], [g.home, true]] as const) {
      const row = rows.get(tid);
      if (!row) continue;
      if (filter && !filter(g.kind)) continue;
      if (!r) {
        row.remaining++;
        continue;
      }
      const my = isHome ? r.homeRuns : r.awayRuns;
      const op = isHome ? r.awayRuns : r.homeRuns;
      const res = my > op ? 0 : my < op ? 1 : 2;
      row.g++;
      row.rs += my;
      row.ra += op;
      if (res === 0) row.w++;
      else if (res === 1) row.l++;
      else row.t++;
      (isHome ? row.home : row.away)[res]++;
      if (g.kind === 'I') row.inter[res]++;
      seq.get(tid)!.push(['W', 'L', 'T'][res]);
    }
  }
  const list = [...rows.values()];
  for (const r of list) {
    r.pct = winPct(r.w, r.l);
    const s = seq.get(r.tid)!;
    const l10 = s.slice(-10);
    r.last10 = `${l10.filter((x) => x === 'W').length}-${l10.filter((x) => x === 'L').length}-${l10.filter((x) => x === 'T').length}`;
    let k = s.length - 1;
    while (k >= 0 && s[k] === 'T') k--;
    if (k >= 0) {
      const c = s[k];
      let n = 0;
      while (k >= 0 && (s[k] === c || s[k] === 'T')) {
        if (s[k] === c) n++;
        k--;
      }
      r.streak = `${n}${c === 'W' ? '連勝' : '連敗'}`;
    }
  }
  list.sort((a, b) => b.pct - a.pct || b.w - a.w || a.l - b.l);
  const top = list[0];
  for (const r of list) r.gb = r === top ? null : (top.w - top.l - (r.w - r.l)) / 2;
  return list;
}
