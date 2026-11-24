import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/league/world';
import { prepareLiveGame, recordLiveGame, simulateDay, userGameToday } from '../src/league/sim';
import { applyFrame, framesFrom, initialView } from '../src/ui/liveView';
import { pitchSequence } from '../src/engine/pitches';
import { Rng } from '../src/engine/rng';
import { generatePitcher } from '../src/players/generate';

describe('1球ごとのカウント', () => {
  const rng = new Rng(3);
  const p = generatePitcher(rng, 'SP', { level: 50 });
  it('結果と投球数に矛盾しない', () => {
    for (let i = 0; i < 3000; i++) {
      const final = (['K', 'BB', 'HBP', 'INPLAY'] as const)[i % 4];
      const n = final === 'K' ? rng.int(3, 10) : final === 'BB' ? rng.int(4, 10) : rng.int(1, 10);
      const seq = pitchSequence(rng, p, n, final);
      expect(seq.length).toBe(n);
      for (const x of seq.slice(0, -1)) {
        expect(x.balls).toBeLessThanOrEqual(3);
        expect(x.strikes).toBeLessThanOrEqual(2);
      }
      const last = seq[seq.length - 1];
      if (final === 'K') expect(last.strikes).toBe(3);
      if (final === 'BB') expect(last.balls).toBe(4);
      if (final === 'INPLAY') expect(last.result).toBe('inplay');
    }
  });
});

describe('観戦（自チームの試合）', () => {
  it('イベント列から作った表示が試合結果と一致し、記録できる', () => {
    for (let k = 0; k < 20; k++) {
      const w = newWorld(100 + k, (k % 12) + 1);
      const g = userGameToday(w)!;
      expect(g).not.toBeNull();
      const sim = prepareLiveGame(w, g.id);
      let i = 0;
      const v = initialView(sim.away.pitcher.id, sim.home.pitcher.id);
      while (sim.step()) {
        for (const f of framesFrom(sim.events.slice(i))) applyFrame(v, f, () => '');
        i = sim.events.length;
      }
      for (const f of framesFrom(sim.events.slice(i))) applyFrame(v, f, () => '');
      const r = sim.result();
      expect(v.over).toBe(true);
      expect(v.score).toEqual([r.awayRuns, r.homeRuns]);
      expect(v.line[0]).toEqual(r.lineAway);
      expect(v.line[1]).toEqual(r.lineHome);
      expect(v.hits).toEqual([r.hitsAway, r.hitsHome]);
      const total = [...r.pitch.values()].reduce((s, l) => s + l.pitches, 0);
      expect(Object.values(v.pitchCount).reduce((a, b) => a + b, 0)).toBe(total);
      recordLiveGame(w, g.id, sim);
      simulateDay(w);
      expect(Object.keys(w.results).length).toBe(w.calendar.games.filter((x) => x.date === g.date).length);
    }
  });
  it('ユーザーの作戦（バント・敬遠・投手交代・代打）が反映される', () => {
    const w = newWorld(5, 1);
    const g = userGameToday(w)!;
    const sim = prepareLiveGame(w, g.id);
    sim.manualAuto = { pitching: false, subs: false, tactics: false };
    const mine = sim.away.team.teamId === 1 ? sim.away : sim.home;
    let bunts = 0, ibbs = 0, changed = false, ph = false;
    let guard = 0;
    while (!sim.over && guard++ < 500) {
      const off = sim.offense;
      if (off === mine) {
        if ((sim.bases[0] || sim.bases[1]) && !sim.bases[2] && sim.outs === 0) sim.pendingTactic = 'bunt';
        if (!ph && sim.inning >= 6) {
          const b = mine.bench.find((id) => !mine.used.has(id));
          if (b) { sim.substitute(mine, mine.next, b, 'PH'); ph = true; }
        }
      } else {
        if (!sim.bases[0] && sim.bases[1] && sim.outs < 2) sim.pendingIBB = true;
        if (!changed && sim.inning >= 5) {
          const r = mine.bullpen[0];
          sim.changePitcher(mine, r.playerId, r.role);
          changed = true;
        }
      }
      const n = sim.events.length;
      sim.step();
      for (const e of sim.events.slice(n)) {
        if (e.t === 'pa' && e.tactic === 'bunt') bunts++;
        if (e.t === 'pa' && e.result === 'IBB') ibbs++;
      }
    }
    expect(sim.over).toBe(true);
    expect(changed).toBe(true);
    expect(mine.pitchers.length).toBeGreaterThanOrEqual(2);
    expect(bunts + ibbs).toBeGreaterThan(0);
  });
});

describe('打順の編集', () => {
  it('手動の打順と守備位置が試合で使われる', async () => {
    const { validateOrder } = await import('../src/ui/components/LineupEditor');
    const { buildTeamInput, dayIndex } = await import('../src/league/sim');
    const { autoLineup } = await import('../src/league/roster');
    const { rosterOf } = await import('../src/league/world');
    const w = newWorld(11, 2);
    const hitters = rosterOf(w, 2, 'active').filter((p) => !p.isPitcher);
    const auto = autoLineup(hitters, true).order.map((o) => ({ playerId: o.playerId, pos: o.pos as string }));
    const reversed = [...auto].reverse();
    expect(validateOrder(reversed)).toBeNull();
    expect(validateOrder([...auto.slice(0, 8), auto[0]])).not.toBeNull();
    w.teamState[2].manualOrder = reversed;
    const input = buildTeamInput(w, 2, dayIndex(w), true);
    expect(input.lineup.order.map((o) => o.playerId)).toEqual(reversed.map((o) => o.playerId));
    expect(input.lineup.bench).not.toContain(reversed[0].playerId);
  });
});
