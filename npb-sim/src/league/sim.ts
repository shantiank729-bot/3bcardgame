import { addLine, addField, emptyBat, emptyField, emptyPitch } from '../engine/box';
import { GameSim, simulateGame, type GameResult, type PAObserver } from '../engine/game';
import type { TeamGameInput } from '../engine/types';
import { Rng } from '../engine/rng';
import { dayDiff, addDays } from './calendar';
import { assignBullpen, autoLineup } from './roster';
import type { LeagueId } from './teams';
import { rosterOf, teamById, type GameSummary, type RunEnvAcc, type World } from './world';

export function dayIndex(w: World, date = w.date) {
  return dayDiff(w.calendar.opening, date);
}

function hashSeed(...xs: number[]) {
  let h = 2166136261;
  for (const x of xs) {
    h ^= x;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** その日の先発を決める（中6日ローテ） */
export function chooseStarter(w: World, tid: number, today: number): number {
  const ts = w.teamState[tid];
  const rot = ts.rotation.filter((id) => w.players[id]?.teamId === tid && w.players[id].status === 'active');
  if (rot.length === 0) {
    const any = rosterOf(w, tid, 'active').filter((p) => p.isPitcher);
    return any[0].id;
  }
  for (let k = 0; k < rot.length; k++) {
    const i = (ts.rotIdx + k) % rot.length;
    const last = ts.lastStart[rot[i]];
    if (last === undefined || today - last >= 6) return rot[i];
  }
  // 中5日以下しかいなければ最も間隔が空いた投手
  return [...rot].sort((a, b) => (ts.lastStart[a] ?? -99) - (ts.lastStart[b] ?? -99))[0];
}

export function buildTeamInput(w: World, tid: number, today: number, dh: boolean, vsHand?: 'L' | 'R', starter?: number): TeamGameInput {
  const ts = w.teamState[tid];
  const team = teamById(w, tid);
  const active = rosterOf(w, tid, 'active');
  const sp = starter ?? chooseStarter(w, tid, today);
  const hitters = active.filter((p) => !p.isPitcher);
  let lineup = autoLineup(hitters, dh, vsHand, sp);
  if (ts.manualOrder && tid === w.userTeamId) {
    const valid = ts.manualOrder.every((s) => s.pos === 'P' || active.some((p) => p.id === s.playerId));
    const hasDH = ts.manualOrder.some((s) => s.pos === 'DH');
    if (valid && hasDH === dh) {
      const order = ts.manualOrder.map((s) => (s.pos === 'P' ? { playerId: sp, pos: 'P' as const } : { playerId: s.playerId, pos: s.pos as never }));
      const inOrder = new Set(order.map((o) => o.playerId));
      lineup = { order, bench: hitters.filter((p) => !inOrder.has(p.id)).map((p) => p.id) };
    }
  }
  const rotSet = new Set(ts.rotation);
  const relievers = active.filter((p) => p.isPitcher && !rotSet.has(p.id) && p.id !== sp);
  const availability = new Map(
    active.filter((p) => p.isPitcher).map((p) => [p.id, { recent: [1, 2, 3].map((d) => ts.pitchLog[p.id]?.[today - d] ?? 0) }]),
  );
  return {
    teamId: tid,
    name: team.nickname,
    players: new Map(active.map((p) => [p.id, p])),
    lineup: { order: lineup.order, startingPitcher: sp, bench: lineup.bench, bullpen: assignBullpen(relievers) },
    availability,
    smallBall: team.smallBall,
  };
}

/** RE24・線形加重の集計用オブザーバ */
export function runEnvObserver(acc: RunEnvAcc): PAObserver {
  return {
    onPA(code, ob, bb, oa, ba, runs) {
      let e = acc.ev[code];
      if (!e) acc.ev[code] = e = { before: Array(24).fill(0), after: Array(25).fill(0), runs: 0, n: 0 };
      e.before[ob * 8 + bb]++;
      e.after[oa >= 3 ? 24 : oa * 8 + ba]++;
      e.runs += runs;
      e.n++;
    },
    onHalfInning(states) {
      for (const s of states) {
        const i = s.outs * 8 + s.bases;
        acc.reCount[i]++;
        acc.reRuns[i] += s.runsToEnd;
      }
    },
  };
}

function seasonEntry(w: World, pid: number, tid: number) {
  const k = `${pid}-${tid}`;
  let e = w.season[k];
  if (!e) w.season[k] = e = { pid, tid, bat: null, pitch: null, field: null };
  return e;
}

/** 試合結果を成績・順位に反映する */
export function recordGame(w: World, g: { id: number; date: string; away: number; home: number; kind: 'L' | 'I' }, res: GameResult, today: number) {
  const homeIds = new Set(res.appeared.get(g.home) ?? []);
  const tidOf = (pid: number) => (homeIds.has(pid) ? g.home : g.away);
  for (const [pid, l] of res.bat) {
    const e = seasonEntry(w, pid, tidOf(pid));
    e.bat = addLine(e.bat ?? emptyBat(), l);
  }
  for (const [pid, l] of res.pitch) {
    const e = seasonEntry(w, pid, tidOf(pid));
    e.pitch = addLine(e.pitch ?? emptyPitch(), l);
  }
  for (const [pid, l] of res.field) {
    const e = seasonEntry(w, pid, tidOf(pid));
    e.field = addField(e.field ?? emptyField(), l);
  }
  for (const [pid, n] of res.pitchCounts) {
    const ts = w.teamState[tidOf(pid)];
    (ts.pitchLog[pid] ??= {})[today] = n;
  }
  for (const [tid, sp] of [[g.away, res.startersAway], [g.home, res.startersHome]] as const) {
    const ts = w.teamState[tid];
    ts.lastStart[sp] = today;
    const i = ts.rotation.indexOf(sp);
    if (i >= 0) ts.rotIdx = (i + 1) % ts.rotation.length;
  }
  // 球場（パークファクター用）
  let hrAway = 0, hrHome = 0;
  const hrs: { pid: number; tid: number; n: number }[] = [];
  for (const [pid, l] of res.bat) if (l.hr) {
    hrs.push({ pid, tid: tidOf(pid), n: l.hr });
    if (tidOf(pid) === g.home) hrHome += l.hr;
    else hrAway += l.hr;
  }
  const ph = w.park[g.home];
  ph.homeGames++;
  ph.homeRuns += res.awayRuns + res.homeRuns;
  ph.homeHR += hrAway + hrHome;
  const pa = w.park[g.away];
  pa.awayGames++;
  pa.awayRuns += res.awayRuns + res.homeRuns;
  pa.awayHR += hrAway + hrHome;

  const POS_CODE: Record<string, number> = { P: 1, C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9, DH: 10 };
  const order: [number[], number[]] = [res.appearancesAway.map((a) => a.pid), res.appearancesHome.map((a) => a.pid)];
  const boxBat: number[][] = [];
  for (const [list, tid] of [[res.appearancesAway, g.away], [res.appearancesHome, g.home]] as const) {
    const sorted = [...list].map((a, i) => ({ ...a, i })).sort((x, y) => x.slot - y.slot || x.i - y.i);
    for (const a of sorted) {
      const l = res.bat.get(a.pid);
      if (!l) continue;
      // 列: pid, tid, 守備位置コード(+100で途中出場), 打順, 打数, 得点, 安打, 打点, 四死球, 三振, 本塁打
      boxBat.push([a.pid, tid, POS_CODE[a.pos] + (a.sub ? 100 : 0), a.slot + 1, l.ab, l.r, l.h, l.rbi, l.bb + l.hbp, l.k, l.hr]);
    }
  }
  const boxPitch: number[][] = [];
  for (const [pid, l] of res.pitch) boxPitch.push([pid, tidOf(pid), l.outs, l.h, l.r, l.er, l.bb + l.hbp, l.k, l.pitches, l.hr]);
  const summary: GameSummary = {
    id: g.id, date: g.date, away: g.away, home: g.home, kind: g.kind, awayRuns: res.awayRuns, homeRuns: res.homeRuns,
    innings: res.innings, tie: res.tie, lineAway: res.lineAway, lineHome: res.lineHome,
    hits: [res.hitsAway, res.hitsHome], errors: [res.errorsAway, res.errorsHome],
    wp: res.winningPitcher, lp: res.losingPitcher, sv: res.savePitcher, sp: [res.startersAway, res.startersHome],
    hr: hrs, walkoff: res.walkoff, boxBat, boxPitch, order,
  };
  w.results[g.id] = summary;
  return summary;
}

/** 調子の波（毎日少しずつ変わる） */
function updateForm(w: World, rng: Rng) {
  for (const p of Object.values(w.players)) {
    if (p.status !== 'active') continue;
    const f = (p.form ?? 0) * 0.92 + rng.normal(0, 0.09);
    p.form = Math.max(-1, Math.min(1, f));
  }
}

export interface DayReport {
  date: string;
  games: GameSummary[];
  seasonOver: boolean;
}

/** その日の自チームの試合（未消化）*/
export function userGameToday(w: World) {
  if (w.phase !== 'regular') return null;
  return w.calendar.games.find((g) => g.date === w.date && !w.results[g.id] && (g.away === w.userTeamId || g.home === w.userTeamId)) ?? null;
}

/** 観戦用に試合を準備する（自チームは手動采配が可能） */
export function prepareLiveGame(w: World, gameId: number): GameSim {
  const g = w.calendar.games.find((x) => x.id === gameId)!;
  const today = dayIndex(w);
  const home = teamById(w, g.home);
  const dh = w.settings.dh[home.league as LeagueId];
  const awaySP = chooseStarter(w, g.away, today);
  const homeSP = chooseStarter(w, g.home, today);
  const ai = buildTeamInput(w, g.away, today, dh, w.players[homeSP].throws, awaySP);
  const hi = buildTeamInput(w, g.home, today, dh, w.players[awaySP].throws, homeSP);
  const sim = new GameSim(ai, hi, home.park, { dh, seed: hashSeed(w.seed, w.year, g.id, 991), log: true });
  sim.observer = runEnvObserver(w.runEnv[home.league]);
  sim.manualTeam = w.userTeamId;
  return sim;
}

/** 観戦した試合を記録する */
export function recordLiveGame(w: World, gameId: number, sim: GameSim) {
  const g = w.calendar.games.find((x) => x.id === gameId)!;
  return recordGame(w, g, sim.result(), dayIndex(w));
}

/** 現在の日付の試合をすべて行い、日付を1日進める */
export function simulateDay(w: World, opts: { keepEvents?: (gameId: number) => boolean } = {}): DayReport {
  const date = w.date;
  const today = dayIndex(w);
  const rng = new Rng(hashSeed(w.seed, w.year, today, 77));
  const games = w.calendar.games.filter((g) => g.date === date && !w.results[g.id]);
  const out: GameSummary[] = [];
  for (const g of games) {
    const home = teamById(w, g.home);
    const dh = w.settings.dh[home.league as LeagueId];
    const awaySP = chooseStarter(w, g.away, today);
    const homeSP = chooseStarter(w, g.home, today);
    const ai = buildTeamInput(w, g.away, today, dh, w.players[homeSP].throws, awaySP);
    const hi = buildTeamInput(w, g.home, today, dh, w.players[awaySP].throws, homeSP);
    const res = simulateGame(ai, hi, home.park, { dh, seed: hashSeed(w.seed, w.year, g.id), log: true }, runEnvObserver(w.runEnv[home.league]));
    out.push(recordGame(w, g, res, today));
    void opts;
  }
  updateForm(w, rng);
  // 古い登板記録を整理
  for (const ts of Object.values(w.teamState)) for (const pid in ts.pitchLog) {
    for (const d in ts.pitchLog[pid]) if (Number(d) < today - 7) delete ts.pitchLog[pid][d];
  }
  const seasonOver = date >= w.calendar.lastDay;
  if (seasonOver) w.phase = 'postseason';
  else w.date = addDays(date, 1);
  return { date, games: out, seasonOver };
}

/** 指定日まで（その日を含む）進める */
export function simulateUntil(w: World, until: string, onDay?: (r: DayReport) => void) {
  while (w.phase === 'regular' && w.date <= until) {
    const r = simulateDay(w);
    onDay?.(r);
    if (r.seasonOver) break;
  }
}
