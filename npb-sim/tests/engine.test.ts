import { describe, expect, it } from 'vitest';
import { GameSim, simulateGame } from '../src/engine/game';
import { log5, logit, paLogits, resolvePA, sigmoid, type DefenseMap } from '../src/engine/pa';
import { NEUTRAL_PARK } from '../src/engine/parks';
import { Rng } from '../src/engine/rng';
import { DEFAULT_TUNING } from '../src/engine/constants';
import { FIELD_POSITIONS, type Player } from '../src/engine/types';
import { generateBatter, generatePitcher } from '../src/players/generate';
import { makeTeams, teamInput } from './helpers';

describe('log5 / オッズ比法', () => {
  it('打者も投手もリーグ平均ならリーグ平均になる', () => {
    expect(log5(0.2, 0.2, 0.2)).toBeCloseTo(0.2, 10);
  });
  it('既知の例: 打率.300の打者 vs 被打率.250の投手 (リーグ.260)', () => {
    // odds = (.3/.7)*(.25/.75)/(.26/.74) = 0.4066 → p = .2891
    expect(log5(0.3, 0.25, 0.26)).toBeCloseTo(0.2891, 3);
  });
  it('ロジットの足し算と同値', () => {
    const b = 0.31, p = 0.22, l = 0.25;
    expect(sigmoid(logit(b) + logit(p) - logit(l))).toBeCloseTo(log5(b, p, l), 12);
  });
});

describe('乱数', () => {
  it('同じシードなら同じ列', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
});

function flatDefense(v: number, ids: Player[]): DefenseMap {
  const m = {} as DefenseMap;
  FIELD_POSITIONS.forEach((p, i) => (m[p] = { playerId: ids[i % ids.length].id, range: v, arm: v, hands: v }));
  return m;
}

describe('打席モデルの補正', () => {
  const rng = new Rng(7);
  const bat = generateBatter(rng, 'LF', { level: 50 });
  bat.bats = 'L';
  const pitR = generatePitcher(rng, 'SP', { level: 50 });
  pitR.throws = 'R';
  const pitL = { ...pitR, id: 9999, throws: 'L' as const };
  const ctx = (o: Partial<Parameters<typeof resolvePA>[0]> = {}) => ({
    batter: bat, pitcher: pitR, fatigue: 0, timesFaced: 1, park: NEUTRAL_PARK,
    defense: flatDefense(50, [bat]), tuning: DEFAULT_TUNING, ...o,
  });
  const sample = (c: ReturnType<typeof ctx>, n = 40000) => {
    const r = new Rng(123);
    let hits = 0, hr = 0, k = 0, bip = 0, bipHits = 0;
    for (let i = 0; i < n; i++) {
      const o = resolvePA(c, r);
      if (o.kind === 'HR') { hits++; hr++; }
      if (o.kind === 'K') k++;
      if (o.kind === 'BIP') { bip++; if (o.bip!.hit) { hits++; bipHits++; } }
    }
    return { hits: hits / n, hr: hr / n, k: k / n, babip: bipHits / bip };
  };
  it('左打者は左投手を苦手にする（三振増・安打減）', () => {
    const vsR = sample(ctx());
    const vsL = sample(ctx({ pitcher: pitL }));
    expect(vsL.k).toBeGreaterThan(vsR.k);
    expect(vsL.hits).toBeLessThan(vsR.hits);
    expect(paLogits(ctx({ pitcher: pitL })).sameSide).toBe(true);
  });
  it('守備が上手いと被BABIPが下がる', () => {
    const good = sample(ctx({ defense: flatDefense(80, [bat]) }));
    const bad = sample(ctx({ defense: flatDefense(20, [bat]) }));
    expect(good.babip).toBeLessThan(bad.babip - 0.02);
  });
  it('本塁打の出やすい球場では本塁打が増える', () => {
    const big = sample(ctx({ park: { ...NEUTRAL_PARK, hrFactor: 1.3 } }));
    const small = sample(ctx({ park: { ...NEUTRAL_PARK, hrFactor: 0.75 } }));
    expect(big.hr).toBeGreaterThan(small.hr * 1.3);
  });
  it('投手が疲れると打たれやすい', () => {
    const fresh = sample(ctx());
    const tired = sample(ctx({ fatigue: 1 }));
    expect(tired.hits).toBeGreaterThan(fresh.hits);
    expect(tired.k).toBeLessThan(fresh.k);
  });
  it('パワーのある打者ほど本塁打が多く、ミートの高い打者ほど三振が少ない', () => {
    const slugger = { ...bat, bat: { ...bat.bat, power: 85 } };
    const weak = { ...bat, bat: { ...bat.bat, power: 20 } };
    expect(sample(ctx({ batter: slugger })).hr).toBeGreaterThan(sample(ctx({ batter: weak })).hr * 3);
    const contact = { ...bat, bat: { ...bat.bat, contact: 85 } };
    const swing = { ...bat, bat: { ...bat.bat, contact: 20 } };
    expect(sample(ctx({ batter: contact })).k).toBeLessThan(sample(ctx({ batter: swing })).k * 0.6);
  });
});

describe('1試合', () => {
  const play = (seed: number, dh = true) => {
    const t = makeTeams(5, 2);
    return simulateGame(teamInput(t[0], 0, dh), teamInput(t[1], 0, dh), NEUTRAL_PARK, { dh, seed, log: true });
  };
  it('同じシードなら同じ結果（再現性）', () => {
    const a = play(99), b = play(99);
    expect([a.awayRuns, a.homeRuns, a.innings]).toEqual([b.awayRuns, b.homeRuns, b.innings]);
    expect(a.events.length).toBe(b.events.length);
  });
  it('スコア・成績の整合性（100試合）', () => {
    for (let s = 1; s <= 100; s++) {
      const dh = s % 2 === 0;
      const r = play(s, dh);
      const awayIds = new Set(r.appeared.get(1)!);
      expect(r.lineAway.reduce((a, b) => a + b, 0)).toBe(r.awayRuns);
      expect(r.lineHome.reduce((a, b) => a + b, 0)).toBe(r.homeRuns);
      // 延長は12回まで、引き分けは同点のみ
      expect(r.innings).toBeLessThanOrEqual(12);
      if (r.tie) expect(r.innings).toBe(12);
      if (r.innings < 9) throw new Error('9回未満で終了');
      let runsAway = 0, runsHome = 0, paAway = 0, bfHome = 0, rAllowedHome = 0;
      for (const [id, l] of r.bat) {
        expect(l.pa).toBe(l.ab + l.bb + l.hbp + l.sh + l.sf);
        if (awayIds.has(id)) { runsAway += l.r; paAway += l.pa; } else runsHome += l.r;
      }
      for (const [id, l] of r.pitch) if (!awayIds.has(id)) { bfHome += l.bf; rAllowedHome += l.r; }
      expect(runsAway).toBe(r.awayRuns);
      expect(runsHome).toBe(r.homeRuns);
      expect(bfHome).toBe(paAway);
      expect(rAllowedHome).toBe(r.awayRuns);
      // 勝敗投手
      if (!r.tie) {
        expect(r.winningPitcher).not.toBeNull();
        expect(r.losingPitcher).not.toBeNull();
        const winIsAway = r.awayRuns > r.homeRuns;
        expect(awayIds.has(r.winningPitcher!)).toBe(winIsAway);
        expect(awayIds.has(r.losingPitcher!)).toBe(!winIsAway);
      }
      // ホームチームの守備アウト数: 9回裏まで行けば27以上
      let outsHome = 0;
      for (const [id, l] of r.pitch) if (!awayIds.has(id)) outsHome += l.outs;
      expect(outsHome).toBe(r.lineAway.length * 3);
    }
  });
  it('サヨナラ時は裏の攻撃で決勝点が入ったところで終わる', () => {
    let found = 0;
    for (let s = 1; s <= 400 && found < 5; s++) {
      const r = play(s);
      if (r.walkoff) {
        found++;
        expect(r.homeRuns).toBeGreaterThan(r.awayRuns);
        expect(r.lineHome.length).toBe(r.lineAway.length);
        const last = r.events.filter((e) => e.t === 'pa').pop()!;
        if (last.t === 'pa' && last.result !== 'HR') expect(r.homeRuns - r.awayRuns).toBe(1);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
  it('1打席ずつ進められる（観戦用）', () => {
    const t = makeTeams(5, 2);
    const g = new GameSim(teamInput(t[0], 0, true), teamInput(t[1], 0, true), NEUTRAL_PARK, { dh: true, seed: 3, log: true });
    let steps = 0;
    while (g.step()) steps++;
    expect(steps).toBeGreaterThan(50);
    expect(g.over).toBe(true);
  });
});

describe('アマチュア用の簡易モード', () => {
  it('能力の低いチーム同士でも試合が成立し、高速に回る', async () => {
    const { Rng } = await import('../src/engine/rng');
    const { generateTeamRoster } = await import('../src/players/generate');
    const { buildGameLineup } = await import('../src/league/roster');
    const rng = new Rng(1);
    const mk = (id: number) => {
      const players = generateTeamRoster(rng, 25);
      const sp = players.filter((p) => p.isPitcher)[0];
      const lineup = buildGameLineup(players.filter((p) => !p.isPitcher), sp.id, players.filter((p) => p.isPitcher && p !== sp), true);
      return { teamId: id, name: 'HS' + id, players: new Map(players.map((p) => [p.id, p])), lineup, availability: new Map() };
    };
    const a = mk(1), h = mk(2);
    const t0 = Date.now();
    let runs = 0;
    for (let i = 0; i < 300; i++) {
      const r = simulateGame(a, h, NEUTRAL_PARK, { dh: true, seed: i, maxInnings: null, log: false });
      expect(r.tie).toBe(false); // トーナメントは決着まで
      runs += r.awayRuns + r.homeRuns;
    }
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(runs / 600).toBeGreaterThan(2);
  });
});
