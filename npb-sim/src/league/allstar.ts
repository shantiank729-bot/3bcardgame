/** オールスターゲーム（2試合） */
import { simulateGame, type GameResult } from '../engine/game';
import type { TeamGameInput } from '../engine/types';
import { autoLineup } from './roster';
import type { LeagueId, TeamInfo } from './teams';
import type { GameSummary, World } from './world';
import { batterRows, contexts, pitcherRows } from '../stats/tables';

export { ALLSTAR_TEAMS } from './teams';
import { ALLSTAR_TEAMS } from './teams';

export interface AllStarState {
  year: number;
  rosters: Record<LeagueId, number[]>;
  games: GameSummary[];
  mvp: (number | null)[];
}

/** 成績上位からポジション別に選出（各球団から最低1人） */
export function selectAllStars(w: World, lg: LeagueId): number[] {
  const ctx = contexts(w);
  const bats = batterRows(w, lg, ctx).filter((r) => r.pa >= 60).sort((a, b) => b.war - a.war);
  const pits = pitcherRows(w, lg, ctx).filter((r) => r.p.outs >= 30).sort((a, b) => b.war - a.war);
  const chosen = new Set<number>();
  const byPos = (pos: string) => bats.find((r) => !chosen.has(r.pid) && w.players[r.pid]?.primary === pos);
  for (const pos of ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'C', 'SS']) {
    const r = byPos(pos);
    if (r) chosen.add(r.pid);
  }
  for (const r of bats) if (chosen.size < 17 && !chosen.has(r.pid)) chosen.add(r.pid);
  const sp = pits.filter((r) => r.p.gs > r.p.g / 2).slice(0, 7);
  const rp = pits.filter((r) => r.p.gs <= r.p.g / 2).slice(0, 7);
  for (const r of [...sp, ...rp]) chosen.add(r.pid);
  // 各球団から最低1人
  for (const t of w.teams.filter((t) => t.league === lg)) {
    if ([...chosen].some((pid) => w.players[pid].teamId === t.id)) continue;
    const best = bats.find((r) => r.tid === t.id) ?? pits.find((r) => r.tid === t.id);
    if (best) chosen.add(best.pid);
  }
  return [...chosen];
}

function allStarInput(w: World, lg: LeagueId, ids: number[], dh: boolean): TeamGameInput {
  const team = ALLSTAR_TEAMS.find((t) => t.league === lg)!;
  const ps = ids.map((id) => w.players[id]);
  const hitters = ps.filter((p) => !p.isPitcher);
  const pitchers = ps.filter((p) => p.isPitcher).sort((a, b) => (b.role === 'SP' ? 1 : 0) - (a.role === 'SP' ? 1 : 0));
  const sp = pitchers[0];
  const lu = autoLineup(hitters, dh, undefined, sp.id);
  return {
    teamId: team.id, name: team.city, players: new Map(ps.map((p) => [p.id, p])),
    lineup: { order: lu.order, startingPitcher: sp.id, bench: lu.bench, bullpen: pitchers.slice(1).map((p) => ({ playerId: p.id, role: 'MID' as const })) },
    availability: new Map(), smallBall: 20,
  };
}

export function playAllStarGame(w: World, gameNo: number, date: string, seed: number): { res: GameResult; parkTeam: TeamInfo; away: number; home: number } {
  if (!w.allStar || w.allStar.year !== w.year) {
    w.allStar = { year: w.year, rosters: { C: selectAllStars(w, 'C'), P: selectAllStars(w, 'P') }, games: [], mvp: [] };
  }
  const as = w.allStar;
  // 第1戦はセの球場、第2戦はパの球場（年ごとに持ち回り）
  const lg: LeagueId = gameNo === 1 ? 'C' : 'P';
  const parks = w.teams.filter((t) => t.league === lg);
  const parkTeam = parks[(w.year + gameNo) % parks.length];
  const homeLg: LeagueId = lg;
  const awayLg: LeagueId = lg === 'C' ? 'P' : 'C';
  const away = allStarInput(w, awayLg, as.rosters[awayLg], true);
  const home = allStarInput(w, homeLg, as.rosters[homeLg], true);
  void date;
  const res = simulateGame(away, home, parkTeam.park, { dh: true, seed, log: true, maxInnings: 9, exhibition: true });
  return { res, parkTeam, away: away.teamId, home: home.teamId };
}

/** 試合のヒーロー（打撃と投球の貢献点が最大の選手） */
export function gameHero(res: GameResult, onlyTeamPlayers?: Set<number>): number | null {
  let best: number | null = null;
  let bestV = -Infinity;
  for (const [pid, l] of res.bat) {
    if (onlyTeamPlayers && !onlyTeamPlayers.has(pid)) continue;
    const v = l.h + l.d + 2 * l.t + 3 * l.hr + l.rbi * 1.2 + l.bb * 0.3 + l.sb * 0.5;
    if (v > bestV) { bestV = v; best = pid; }
  }
  for (const [pid, l] of res.pitch) {
    if (onlyTeamPlayers && !onlyTeamPlayers.has(pid)) continue;
    const v = l.outs / 3 * 0.8 + l.k * 0.3 - l.er * 1.2 + (l.w ? 1 : 0);
    if (v > bestV) { bestV = v; best = pid; }
  }
  return best;
}
