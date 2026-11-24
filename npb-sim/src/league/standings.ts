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

/** 直接対決の残り試合数 */
function remainingBetween(world: World, a: number, b: number) {
  return world.calendar.games.filter((g) => !world.results[g.id] && ((g.away === a && g.home === b) || (g.away === b && g.home === a))).length;
}

/**
 * 優勝マジック: 首位球団が「他球団の結果に関係なく」自力で優勝を決めるのに必要な勝利数。
 * 首位が x 勝（残りは全敗）し、ライバルが残りを全勝（直接対決は首位が勝った分を除く）しても勝率で上回る最小の x。
 * 点灯しない（自力で決められない）場合は null。優勝決定なら 0。
 */
export function magicNumber(world: World, league: LeagueId): { tid: number; magic: number | null } {
  const rows = computeStandings(world, league);
  const top = rows[0];
  let need = 0;
  for (const r of rows.slice(1)) {
    const h2h = remainingBetween(world, top.tid, r.tid);
    let found: number | null = null;
    for (let x = 0; x <= top.remaining; x++) {
      const aW = top.w + x, aL = top.l + (top.remaining - x);
      const bW = r.w + r.remaining - Math.min(x, h2h), bL = r.l + Math.min(x, h2h);
      if (winPct(aW, aL) > winPct(bW, bL)) { found = x; break; }
    }
    if (found === null) return { tid: top.tid, magic: null };
    need = Math.max(need, found);
  }
  return { tid: top.tid, magic: need };
}
