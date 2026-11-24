/** タイトル・表彰 */
import type { FieldPos } from '../engine/types';
import { batterRows, contexts, pitcherRows, teamGamesPlayed, type BatterRow, type PitcherRow } from '../stats/tables';
import { computeStandings } from './standings';
import type { LeagueId } from './teams';
import type { World } from './world';

export interface TitleEntry { title: string; pid: number; tid: number; value: string }
export interface PosAward { pos: string; pid: number; tid: number }

export interface SeasonAwards {
  year: number;
  leagueChamp: Record<LeagueId, number>;
  titles: Record<LeagueId, TitleEntry[]>;
  mvp: Record<LeagueId, number | null>;
  roy: Record<LeagueId, number | null>;
  bestNine: Record<LeagueId, PosAward[]>;
  goldenGlove: Record<LeagueId, PosAward[]>;
  /** 最優秀先発投手（沢村賞に相当） */
  ace: number | null;
  allStarMvp: (number | null)[];
  csMvp: Record<LeagueId, number | null>;
  jsMvp: number | null;
  champion: number | null;
}

export const ACE_AWARD_NAME = '金剛賞';

const f3 = (x: number) => x.toFixed(3).replace(/^0/, '');

function leaders<T>(rows: T[], v: (r: T) => number, asc = false): T[] {
  if (rows.length === 0) return [];
  const best = asc ? Math.min(...rows.map(v)) : Math.max(...rows.map(v));
  return rows.filter((r) => v(r) === best);
}

function mainPos(r: BatterRow, w: World): { pos: FieldPos | 'DH'; outs: number } {
  const e = Object.values(w.season).find((x) => x.pid === r.pid && x.tid === r.tid);
  const outsAt = e?.field?.outsAt ?? {};
  let best: FieldPos | 'DH' = 'DH';
  let max = 0, total = 0;
  for (const [p, o] of Object.entries(outsAt) as [FieldPos, number][]) {
    if (p === 'P') continue;
    total += o;
    if (o > max) { max = o; best = p; }
  }
  const estOuts = (r.pa / 4.1) * 27;
  if (estOuts - total > max) return { pos: 'DH', outs: estOuts - total };
  return { pos: best, outs: max };
}

/** レギュラーシーズン終了時の表彰 */
export function regularSeasonAwards(w: World): SeasonAwards {
  const ctx = contexts(w);
  const a: SeasonAwards = {
    year: w.year, leagueChamp: { C: computeStandings(w, 'C')[0].tid, P: computeStandings(w, 'P')[0].tid },
    titles: { C: [], P: [] }, mvp: { C: null, P: null }, roy: { C: null, P: null }, bestNine: { C: [], P: [] }, goldenGlove: { C: [], P: [] },
    ace: null, allStarMvp: w.allStar?.mvp ?? [], csMvp: { C: null, P: null }, jsMvp: null, champion: null,
  };
  const acePool: PitcherRow[] = [];
  for (const lg of ['C', 'P'] as const) {
    const bats = batterRows(w, lg, ctx);
    const pits = pitcherRows(w, lg, ctx);
    const q = bats.filter((r) => r.qualified);
    const qp = pits.filter((r) => r.qualified);
    const T = a.titles[lg];
    const add = (title: string, rows: (BatterRow | PitcherRow)[], val: (r: never) => string) => {
      for (const r of rows) T.push({ title, pid: r.pid, tid: r.tid, value: val(r as never) });
    };
    add('首位打者', leaders(q, (r) => r.avg), (r: BatterRow) => f3(r.avg));
    add('本塁打王', leaders(bats, (r) => r.b.hr), (r: BatterRow) => `${r.b.hr}本`);
    add('打点王', leaders(bats, (r) => r.b.rbi), (r: BatterRow) => `${r.b.rbi}打点`);
    add('盗塁王', leaders(bats, (r) => r.b.sb), (r: BatterRow) => `${r.b.sb}盗塁`);
    add('最高出塁率', leaders(q, (r) => r.obp), (r: BatterRow) => f3(r.obp));
    add('最多安打', leaders(bats, (r) => r.b.h), (r: BatterRow) => `${r.b.h}安打`);
    add('最優秀防御率', leaders(qp, (r) => r.era, true), (r: PitcherRow) => r.era.toFixed(2));
    add('最多勝', leaders(pits, (r) => r.p.w), (r: PitcherRow) => `${r.p.w}勝`);
    add('最多奪三振', leaders(pits, (r) => r.p.k), (r: PitcherRow) => `${r.p.k}奪三振`);
    add('最高勝率', leaders(pits.filter((r) => r.p.w >= 13), (r) => r.p.w / Math.max(1, r.p.w + r.p.l)), (r: PitcherRow) => f3(r.p.w / (r.p.w + r.p.l)));
    add('最多セーブ', leaders(pits, (r) => r.p.sv), (r: PitcherRow) => `${r.p.sv}セーブ`);
    const hp = (r: PitcherRow) => r.p.hld + (r.p.gs === 0 ? r.p.w : 0);
    add('最優秀中継ぎ', leaders(pits.filter((r) => r.p.gs === 0), hp), (r: PitcherRow) => `${hp(r)}HP`);

    // MVP: WAR に優勝チームの選手を少し加点
    const champ = a.leagueChamp[lg];
    const cand = [...bats.map((r) => ({ pid: r.pid, v: r.war + (r.tid === champ ? 1.5 : 0) })), ...pits.map((r) => ({ pid: r.pid, v: r.war * 1.05 + (r.tid === champ ? 1.5 : 0) }))];
    a.mvp[lg] = cand.sort((x, y) => y.v - x.v)[0]?.pid ?? null;
    // 新人王
    const rook = [
      ...bats.filter((r) => w.players[r.pid]?.rookie && r.pa >= 100).map((r) => ({ pid: r.pid, v: r.war })),
      ...pits.filter((r) => w.players[r.pid]?.rookie && r.p.outs >= 90).map((r) => ({ pid: r.pid, v: r.war })),
    ].sort((x, y) => y.v - x.v);
    a.roy[lg] = rook[0]?.pid ?? null;
    // ベストナイン・ゴールデングラブ
    const games = Math.max(...w.teams.filter((t) => t.league === lg).map((t) => teamGamesPlayed(w, t.id)));
    const withPos = bats.map((r) => ({ r, ...mainPos(r, w) }));
    const half = games * 27 * 0.45;
    for (const pos of ['C', '1B', '2B', '3B', 'SS'] as const) {
      const c = withPos.filter((x) => x.pos === pos && x.outs >= half * 0.6);
      const best = c.sort((x, y) => y.r.war - x.r.war)[0];
      if (best) a.bestNine[lg].push({ pos, pid: best.r.pid, tid: best.r.tid });
      const gg = withPos.filter((x) => x.pos === pos && x.outs >= half).sort((x, y) => y.r.fldRuns + w.players[y.r.pid].bat.fielding * 0.05 - (x.r.fldRuns + w.players[x.r.pid].bat.fielding * 0.05))[0];
      if (gg) a.goldenGlove[lg].push({ pos, pid: gg.r.pid, tid: gg.r.tid });
    }
    const of = withPos.filter((x) => (x.pos === 'LF' || x.pos === 'CF' || x.pos === 'RF') && x.outs >= half * 0.6);
    for (const x of [...of].sort((p, q) => q.r.war - p.r.war).slice(0, 3)) a.bestNine[lg].push({ pos: 'OF', pid: x.r.pid, tid: x.r.tid });
    for (const x of of.filter((y) => y.outs >= half).sort((p, q) => q.r.fldRuns - p.r.fldRuns).slice(0, 3)) a.goldenGlove[lg].push({ pos: 'OF', pid: x.r.pid, tid: x.r.tid });
    const dh = withPos.filter((x) => x.pos === 'DH' && x.r.pa >= 250).sort((p, q) => q.r.war - p.r.war)[0];
    if (dh) a.bestNine[lg].push({ pos: 'DH', pid: dh.r.pid, tid: dh.r.tid });
    const bp = [...pits].sort((x, y) => y.war - x.war)[0];
    if (bp) a.bestNine[lg].unshift({ pos: 'P', pid: bp.pid, tid: bp.tid });
    const gp = pits.filter((r) => r.p.outs >= games * 3 * 0.8).sort((x, y) => w.players[y.pid].bat.fielding - w.players[x.pid].bat.fielding)[0];
    if (gp) a.goldenGlove[lg].unshift({ pos: 'P', pid: gp.pid, tid: gp.tid });
    acePool.push(...pits.filter((r) => r.p.gs >= 15));
  }
  // 最優秀先発投手（沢村賞相当）: 15勝・150奪三振・10完投・防御率2.50・200回・25登板・勝率.600 のうち多く満たした投手
  const crit = (r: PitcherRow) =>
    [r.p.w >= 15, r.p.k >= 150, r.p.cg >= 10, r.era <= 2.5, r.p.outs >= 600, r.p.g >= 25, r.p.w / Math.max(1, r.p.w + r.p.l) >= 0.6].filter(Boolean).length;
  const ace = acePool.map((r) => ({ r, c: crit(r) })).sort((x, y) => y.c - x.c || y.r.war - x.r.war)[0];
  a.ace = ace && ace.c >= 4 ? ace.r.pid : null;
  return a;
}

export function aceCriteria(): string {
  return '15勝・150奪三振・10完投・防御率2.50以下・200投球回・25登板・勝率.600のうち4項目以上を満たした先発投手から選出';
}
