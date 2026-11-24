import { addLine, emptyBat, emptyPitch, type BatLine, type PitchLine } from '../src/engine/box';
import { simulateGame, type GameResult } from '../src/engine/game';
import { NEUTRAL_PARK } from '../src/engine/parks';
import { Rng } from '../src/engine/rng';
import type { Park, Player, TeamGameInput } from '../src/engine/types';
import { generateTeamRoster } from '../src/players/generate';
import { buildGameLineup, PitchLog, pickStarter } from '../src/league/roster';

export interface TestTeam {
  id: number;
  players: Player[];
  rotation: number[];
  relievers: Player[];
  rotIdx: number;
  lastStart: Map<number, number>;
  log: PitchLog;
  park: Park;
}

export function makeTeams(seed: number, n = 12, parks?: Park[]): TestTeam[] {
  const rng = new Rng(seed);
  const teams: TestTeam[] = [];
  for (let i = 0; i < n; i++) {
    const players = generateTeamRoster(rng);
    const sps = players.filter((p) => p.isPitcher && p.pit!.stamina >= 50).slice(0, 6);
    const rps = players.filter((p) => p.isPitcher && !sps.includes(p));
    teams.push({
      id: i + 1, players, rotation: sps.map((p) => p.id), relievers: rps, rotIdx: 0, lastStart: new Map(),
      log: new PitchLog(), park: parks?.[i] ?? NEUTRAL_PARK,
    });
  }
  return teams;
}

export function teamInput(t: TestTeam, day: number, dh: boolean, vsHand?: 'L' | 'R'): TeamGameInput {
  const { id: sp, nextIdx } = pickStarter(t.rotation, t.rotIdx, t.lastStart, day);
  t.rotIdx = nextIdx;
  t.lastStart.set(sp, day);
  const hitters = t.players.filter((p) => !p.isPitcher);
  const lineup = buildGameLineup(hitters, sp, t.relievers, dh, vsHand);
  const availability = new Map(t.players.filter((p) => p.isPitcher).map((p) => [p.id, t.log.availability(p.id, day)]));
  return { teamId: t.id, name: `T${t.id}`, players: new Map(t.players.map((p) => [p.id, p])), lineup, availability };
}

export interface SeasonTotals {
  games: number;
  bat: BatLine;
  pitch: PitchLine;
  runs: number;
  ties: number;
  extra: number;
  errors: number;
  teams: TestTeam[];
  appearDays: Map<number, number[]>;
  starts: Map<number, number[]>;
  results: GameResult[];
}

/** 簡易シーズン: 毎日ランダムに6試合を組み、各チーム143試合 */
export function quickSeason(seed: number, dh = true, days = 143, keepResults = false): SeasonTotals {
  const teams = makeTeams(seed);
  const rng = new Rng(seed ^ 0xabcdef);
  const bat = emptyBat();
  const pitch = emptyPitch();
  let runs = 0;
  let games = 0;
  let ties = 0;
  let extra = 0;
  let errors = 0;
  const results: GameResult[] = [];
  const appearDays = new Map<number, number[]>();
  const starts = new Map<number, number[]>();
  const push = (m: Map<number, number[]>, k: number, d: number) => (m.get(k) ?? m.set(k, []).get(k)!).push(d);
  for (let day = 0; day < days; day++) {
    const order = [...teams].sort(() => rng.next() - 0.5);
    for (let i = 0; i < order.length; i += 2) {
      const a = order[i];
      const h = order[i + 1];
      const ai = teamInput(a, day, dh);
      const hi = teamInput(h, day, dh);
      const res = simulateGame(ai, hi, h.park, { dh, seed: rng.int(1, 2 ** 31) });
      for (const [pid, n] of res.pitchCounts) {
        (a.players.some((p) => p.id === pid) ? a : h).log.record(pid, day, n);
        push(appearDays, pid, day);
      }
      push(starts, res.startersAway, day);
      push(starts, res.startersHome, day);
      for (const l of res.bat.values()) addLine(bat, l);
      for (const l of res.pitch.values()) addLine(pitch, l);
      runs += res.awayRuns + res.homeRuns;
      errors += res.errorsAway + res.errorsHome;
      games++;
      if (res.tie) ties++;
      if (res.innings > 9) extra++;
      if (keepResults) results.push(res);
    }
  }
  return { games, bat, pitch, runs, ties, extra, errors, teams, appearDays, starts, results };
}

export function summarize(t: SeasonTotals) {
  const b = t.bat;
  const teamGames = t.games * 2;
  const avg = b.h / b.ab;
  const obp = (b.h + b.bb + b.hbp) / (b.ab + b.bb + b.hbp + b.sf);
  const tb = b.h + b.d + 2 * b.t + 3 * b.hr;
  const slg = tb / b.ab;
  const ip = t.pitch.outs / 3;
  return {
    avg, obp, slg, ops: obp + slg,
    runsPerTeamGame: t.runs / teamGames,
    hrPerTeamGame: b.hr / teamGames,
    era: (t.pitch.er * 9) / ip,
    ra9: (t.pitch.r * 9) / ip,
    kPct: b.k / b.pa,
    bbPct: b.bb / b.pa,
    hbpPct: b.hbp / b.pa,
    babip: (b.h - b.hr) / (b.ab - b.k - b.hr + b.sf),
    dblPerTeamGame: b.d / teamGames,
    triPerTeamGame: b.t / teamGames,
    sbPerTeamGame: b.sb / teamGames,
    csPerTeamGame: b.cs / teamGames,
    shPerTeamGame: b.sh / teamGames,
    sfPerTeamGame: b.sf / teamGames,
    gidpPerTeamGame: b.gidp / teamGames,
    ibbPerTeamGame: b.ibb / teamGames,
    paPerTeamGame: b.pa / teamGames,
    pitchesPerTeamGame: t.pitch.pitches / teamGames,
    errorsPerTeamGame: t.errors / teamGames,
    tieRate: t.ties / t.games,
    extraRate: t.extra / t.games,
    cgPerTeamGame: t.pitch.cg / teamGames,
    svPerTeamGame: t.pitch.sv / teamGames,
  };
}
