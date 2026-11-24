import { describe, expect, it } from 'vitest';
import { newWorld, rosterOf } from '../src/league/world';
import { autoSeason, runToOffseason } from '../src/league/auto';
import { simulateDay } from '../src/league/sim';
import { currentPicker, makePick, startDraft, submitRound1, runAiPicks } from '../src/league/draft';
import { developPlayer, overall } from '../src/players/development';
import { Rng } from '../src/engine/rng';
import { evaluateTrade, executeTrade } from '../src/league/trade';
import { cannotActivate, demote, foreignOk } from '../src/league/rosterOps';
import { domesticFA, MIN_SALARY } from '../src/league/contracts';
import { advanceOffseason } from '../src/league/offseason';
import { deserializeWorld, serializeWorld } from '../src/save/serialize';
import { teamById } from '../src/league/world';
import { generateBatter } from '../src/players/generate';

describe('成長と衰え', () => {
  it('伸びしろのある若手は伸び、ベテランは衰える', () => {
    const rng = new Rng(5);
    let young = 0, old = 0;
    for (let i = 0; i < 200; i++) {
      const y = { ...generateBatter(rng, 'SS', { level: 40, age: 19 }), pot: 65, growth: 'normal' as const };
      const o = { ...generateBatter(rng, 'SS', { level: 60, age: 36 }), pot: 60, growth: 'normal' as const };
      const dy = developPlayer(rng, y);
      young += dy.after - dy.before;
      const d = developPlayer(rng, o);
      old += d.after - d.before;
    }
    expect(young / 200).toBeGreaterThan(1.5);
    expect(old / 200).toBeLessThan(-1.5);
  });
});

describe('ドラフト会議', () => {
  const w = newWorld(8, 1);
  // ドラフト当日まで進める
  for (let guard = 0; guard < 400; guard++) if (simulateDay(w).blocked) break;
  it('CSと日本シリーズの間の日に止まる', () => {
    expect(w.phase).toBe('postseason');
    expect(w.draft).not.toBeNull();
    expect(w.date).toBe(w.post!.draftDate);
  });
  it('1位入札が重なると抽選、外れた球団は再入札', () => {
    const d = startDraft(w, w.date);
    const top = [...d.prospects].sort((a, b) => b.hype - a.hype)[0];
    // 全球団の見立てを同じにして競合させる
    for (const t of w.teams) d.views[t.id][top.id] = 999;
    const logs = submitRound1(w, d, top.id);
    expect(logs.find((l) => l.pid === top.id)!.bidders.length).toBe(12);
    while (d.stage === 'r1') submitRound1(w, d, null);
    const ones = d.picks.filter((p) => p.round === 1);
    expect(ones.length).toBe(12);
    expect(new Set(ones.map((p) => p.tid)).size).toBe(12);
    expect(new Set(ones.map((p) => p.pid)).size).toBe(12);
    expect(ones.filter((p) => p.label === '外れ1位').length).toBe(11);
  });
  it('2巡目以降はウェーバー（両リーグ交互）、奇数巡は逆順', () => {
    const d = startDraft(w, w.date);
    while (d.stage === 'r1') submitRound1(w, d, null);
    const lg = d.order.map((t) => teamById(w, t).league);
    for (let i = 1; i < 12; i++) expect(lg[i]).not.toBe(lg[i - 1]);
    // ユーザーの番まで進める→ユーザーが指名
    runAiPicks(w, d, true);
    expect(currentPicker(d)).toBe(w.userTeamId);
    const before = d.picks.length;
    const avail = d.prospects.find((p) => !d.picks.some((x) => x.pid === p.id))!;
    makePick(w, d, w.userTeamId, avail.id);
    expect(d.picks.length).toBe(before + 1);
    const r2 = d.picks.filter((p) => p.round === 2).map((p) => p.tid);
    const r3 = (runAiPicks(w, d, false), d.picks.filter((p) => p.round === 3).map((p) => p.tid));
    expect(r2[0]).toBe(d.order[0]);
    if (r3.length === 12) expect(r3[0]).toBe(d.order[11]);
  });
});

describe('一軍登録のルール', () => {
  const w = newWorld(9, 1);
  it('外国人は一軍4人まで（投手・野手各3人まで）', () => {
    for (const t of w.teams) expect(foreignOk(rosterOf(w, t.id, 'active'))).toBe(true);
    const active = rosterOf(w, 1, 'active');
    const fakeForeign = active.filter((p) => !p.foreign).slice(0, 1).map((p) => ({ ...p, foreign: true }));
    expect(foreignOk([...active.filter((p) => p.foreign), ...fakeForeign, ...fakeForeign])).toBe(false);
  });
  it('抹消から10日間は再登録できない', () => {
    const p = rosterOf(w, 1, 'active')[5];
    demote(w, p, 20);
    expect(cannotActivate(w, p, 25)).toMatch(/10日/);
    expect(cannotActivate(w, p, 30)).toBeNull();
  });
});

describe('トレード', () => {
  const w = newWorld(10, 1);
  it('釣り合わないトレードは断られ、得をするなら応じる', () => {
    const mine = rosterOf(w, 1).filter((p) => p.status === 'farm').sort((a, b) => overall(a) - overall(b));
    const theirs = rosterOf(w, 2).filter((p) => p.status === 'active').sort((a, b) => overall(b) - overall(a));
    const bad = evaluateTrade(w, 1, 2, [mine[0].id], [theirs[0].id]);
    expect(bad.ok).toBe(false);
    const theirWeak = rosterOf(w, 2).filter((p) => p.status === 'farm').sort((a, b) => overall(a) - overall(b))[0];
    const myStar = rosterOf(w, 1).filter((p) => p.status === 'active').sort((a, b) => overall(b) - overall(a))[0];
    const good = evaluateTrade(w, 1, 2, [myStar.id], [theirWeak.id]);
    expect(good.ok).toBe(true);
    executeTrade(w, 1, 2, [myStar.id], [theirWeak.id]);
    expect(w.players[myStar.id].teamId).toBe(2);
    expect(w.players[theirWeak.id].teamId).toBe(1);
  });
  it('8月以降のシーズン中はトレードできない', () => {
    const w2 = newWorld(11, 1);
    w2.date = '2027-08-05';
    const a = rosterOf(w2, 1)[0], b = rosterOf(w2, 2)[0];
    expect(evaluateTrade(w2, 1, 2, [a.id], [b.id]).ok).toBe(false);
  });
});

describe('複数シーズン', () => {
  const w = newWorld(12, 4);
  const ovr0 = avg(Object.values(w.players).filter((p) => p.status === 'active').map(overall));
  const ages0 = new Map(Object.values(w.players).map((p) => [p.id, p.age]));
  for (let i = 0; i < 3; i++) autoSeason(w);
  it('3シーズン後も編成ルールを守っている', () => {
    expect(w.year).toBe(2030);
    for (const t of w.teams) {
      const r = rosterOf(w, t.id);
      expect(r.filter((p) => p.status === 'active' || p.status === 'farm').length).toBeLessThanOrEqual(70);
      expect(r.filter((p) => p.status === 'active').length).toBe(31);
      expect(foreignOk(r.filter((p) => p.status === 'active'))).toBe(true);
      expect(r.filter((p) => p.status === 'active' && !p.isPitcher && (p.bat.positions.C ?? 0) >= 60).length).toBeGreaterThanOrEqual(2);
      for (const p of r) expect(p.contract.salary).toBeGreaterThanOrEqual(p.status === 'ikusei' ? 240 : MIN_SALARY);
    }
  });
  it('年齢が進み、引退・ドラフト・FAが起きている', () => {
    const still = Object.values(w.players).filter((p) => ages0.has(p.id) && p.status !== 'retired' && p.status !== 'mlb');
    for (const p of still.slice(0, 50)) expect(p.age).toBe(ages0.get(p.id)! + 3);
    expect(Object.values(w.players).filter((p) => p.status === 'retired').length).toBeGreaterThan(150);
    expect(Object.values(w.players).filter((p) => p.events.some((e) => /ドラフト(外れ)?1位で/.test(e.text))).length).toBe(36);
    expect(Object.keys(w.history).map(Number)).toEqual([2027, 2028, 2029]);
  });
  it('リーグの戦力・打撃環境が安定している', () => {
    const ovr = avg(Object.values(w.players).filter((p) => p.status === 'active').map(overall));
    expect(Math.abs(ovr - ovr0)).toBeLessThan(4);
    for (const y of [2027, 2028, 2029]) {
      const c = w.history[y].ctx!;
      for (const lg of ['C', 'P'] as const) {
        expect(c[lg].avg).toBeGreaterThan(0.232);
        expect(c[lg].avg).toBeLessThan(0.262);
        expect(c[lg].era).toBeGreaterThan(2.6);
        expect(c[lg].era).toBeLessThan(3.9);
      }
    }
  });
  it('FA宣言できるのは権利を持つ選手だけ', () => {
    const w2 = newWorld(13, 1);
    runToOffseason(w2);
    advanceOffseason(w2); // 戦力外 → FA宣言
    for (const f of w2.off!.fa) {
      const p = w2.players[f.pid];
      if (f.kind === 'domestic') expect(domesticFA(p)).toBe(true);
    }
  });
  it('セーブ・読込できる（古い形式からの変換を含む）', () => {
    const back = deserializeWorld(serializeWorld(w));
    expect(back.year).toBe(w.year);
    const old = JSON.parse(serializeWorld(newWorld(14, 1)));
    old.version = 2;
    for (const p of Object.values(old.players) as Record<string, unknown>[]) { delete p.pot; delete p.contract; delete p.service; delete p.events; delete p.injury; }
    delete old.budget; delete old.trades; delete old.inbox;
    const m = deserializeWorld(JSON.stringify(old));
    expect(m.version).toBe(4);
    expect(Object.values(m.players).every((p) => p.contract && p.pot > 0 && Array.isArray(p.events))).toBe(true);
  });
});

function avg(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
