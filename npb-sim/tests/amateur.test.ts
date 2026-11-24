import { describe, expect, it } from 'vitest';
import { newWorld } from '../src/league/world';
import { autoSeason, autoCompleteDraft } from '../src/league/auto';
import { simulateDay } from '../src/league/sim';
import { schoolsOf, rosterOfSchool } from '../src/amateur/world';
import { amateurTick, gameSetup } from '../src/amateur/season';
import { liveAmateurGame, playAmateurGame } from '../src/amateur/games';
import { toggleWatch, uncertainty, weeklyScouting } from '../src/amateur/scout';
import { Rng } from '../src/engine/rng';
import { deserializeWorld, serializeWorld } from '../src/save/serialize';

describe('アマチュアの世界', () => {
  const w = newWorld(31, 2);
  it('高校は各都道府県に複数校、大学リーグ・社会人チームがある', () => {
    const hs = schoolsOf(w.amateur, 'HS');
    expect(hs.length).toBe(220);
    for (let pi = 0; pi < 47; pi++) expect(hs.filter((s) => s.pref === pi).length).toBeGreaterThanOrEqual(4);
    expect(schoolsOf(w.amateur, 'UNI').length).toBe(48);
    expect(schoolsOf(w.amateur, 'SHA').length).toBe(24);
    expect(rosterOfSchool(w.amateur, hs[0].id).length).toBe(21);
    // 強豪校と無名校の差
    const st = hs.map((s) => s.strength);
    expect(Math.max(...st) - Math.min(...st)).toBeGreaterThan(50);
  });
  it('スカウトの視察が増えるほど評価のぶれが小さくなる', () => {
    const p = Object.values(w.amateur.players)[100];
    const before = uncertainty(w, p.id);
    toggleWatch(w, p.id);
    w.amateur.scouts[0].area = w.amateur.schools[p.schoolId].region as never;
    for (let i = 0; i < 6; i++) weeklyScouting(w, new Rng(i));
    if (w.amateur.schools[p.schoolId].kind === 'HS') expect(uncertainty(w, p.id)).toBeLessThan(before * 0.6);
    toggleWatch(w, p.id);
    expect(w.amateur.watch[p.id]).toBeUndefined();
  });
});

describe('1年間のアマチュア行事とドラフト', () => {
  const w = newWorld(41, 5);
  const firstYears0 = Object.values(w.amateur.players).filter((p) => p.stage === 'HS' && p.grade === 1).length;
  let draftClass = 0;
  let fromAmateur = 0;
  // ドラフト当日まで
  for (let i = 0; i < 400; i++) if (simulateDay(w).blocked) break;
  it('ドラフト候補はプロ志望届を出した高校3年・大学4年と社会人', () => {
    const d = w.draft!;
    draftClass = d.prospects.length;
    for (const p of d.prospects) {
      const a = w.amateur.players[p.id];
      expect(a).toBeDefined();
      if (a.stage === 'HS') { expect(a.grade).toBe(3); expect(a.shibou).toBe(true); }
      if (a.stage === 'UNI') { expect(a.grade).toBe(4); expect(a.shibou).toBe(true); }
    }
    expect(draftClass).toBeGreaterThan(120);
  });
  it('夏の甲子園は49代表（各地方大会の優勝校）、センバツは32校', () => {
    const k = w.amateur.tourneys['2027-koshien'];
    expect(k.entrants.length).toBe(49);
    expect(k.done).toBe(true);
    const champs = Object.values(w.amateur.tourneys).filter((t) => t.id.startsWith('2027-summer-')).map((t) => t.champion);
    expect(new Set(k.entrants)).toEqual(new Set(champs));
    expect(w.amateur.tourneys['2027-senbatsu'].entrants.length).toBe(32);
    expect(w.amateur.tourneys['2027-unichamp'].done).toBe(true);
  });
  it('指名された選手はアマチュアの世界を離れ、高校・大学時代の経歴を持って入団する', () => {
    autoCompleteDraft(w);
    const picks = w.draft!.picks;
    for (const pk of picks) {
      expect(w.amateur.players[pk.pid]).toBeUndefined();
      const p = w.players[pk.pid];
      expect(p.teamId).toBe(pk.tid);
      if (p.amateur) fromAmateur++;
      expect(p.events.some((e) => e.text.includes('ドラフト'))).toBe(true);
    }
    expect(fromAmateur).toBe(picks.length);
    const koshienKids = picks.map((pk) => w.players[pk.pid]).filter((p) => p.events.some((e) => /甲子園|センバツ/.test(e.text)));
    expect(koshienKids.length).toBeGreaterThan(0);
  });
  it('翌年: 新入生が入り、学年が上がり、秋の地区大会・神宮大会・センバツ選考を経る', () => {
    autoSeason(w);
    expect(w.year).toBe(2028);
    const firstYears = Object.values(w.amateur.players).filter((p) => p.stage === 'HS' && p.grade === 1).length;
    expect(firstYears).toBe(firstYears0);
    expect(w.amateur.tourneys['2027-jingu-hs'].done).toBe(true);
    expect(w.amateur.senbatsu[2028].length).toBe(32);
    expect(w.amateur.senbatsu21![2028].length).toBe(2);
  });
});

describe('甲子園の観戦', () => {
  it('観戦した試合と自動計算の結果が同じ', () => {
    const w = newWorld(51, 1);
    amateurTick(w, '2027-08-05');
    const t = w.amateur.tourneys['2027-koshien'];
    const g = t.games.find((x) => x.date === '2027-08-06')!;
    const setup = gameSetup(w, t, g.a, g.b, g.round);
    const sim = liveAmateurGame(w.amateur, g.a, g.b, g.date, setup);
    while (sim.step());
    const live = sim.result();
    const auto = playAmateurGame(w.amateur, g.a, g.b, g.date, setup);
    expect([live.awayRuns, live.homeRuns, live.innings]).toEqual([auto.awayRuns, auto.homeRuns, auto.innings]);
    amateurTick(w, '2027-08-06');
    expect(g.score).toEqual([auto.awayRuns, auto.homeRuns]);
  });
});

describe('セーブ', () => {
  it('アマチュアの世界ごと保存・読込でき、古い形式には後から追加される', () => {
    const w = newWorld(61, 1);
    amateurTick(w, '2027-04-10');
    const back = deserializeWorld(serializeWorld(w));
    expect(Object.keys(back.amateur.players).length).toBe(Object.keys(w.amateur.players).length);
    const old = JSON.parse(serializeWorld(w));
    delete old.amateur;
    old.version = 3;
    const m = deserializeWorld(JSON.stringify(old));
    expect(m.amateur).toBeDefined();
    expect(Object.keys(m.amateur.players).length).toBeGreaterThan(4000);
  });
});
