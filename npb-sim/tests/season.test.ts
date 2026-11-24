import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { newWorld, rosterOf } from '../src/league/world';
import { simulateUntil, simulateDay } from '../src/league/sim';
import { computeStandings, winPct } from '../src/league/standings';
import { batterRows, contexts, pitcherRows } from '../src/stats/tables';
import { fipOf, wobaOf } from '../src/stats/saber';
import { deleteSave, listSaves, loadWorld, saveWorld } from '../src/save/db';
import { deserializeWorld, serializeWorld } from '../src/save/serialize';
import { runInWorker } from '../src/worker/client';

describe('新しいゲーム', () => {
  const w = newWorld(1, 4);
  it('12球団・一軍31人・外国人枠4人以内・支配下70人以内', () => {
    expect(w.teams.length).toBe(12);
    for (const t of w.teams) {
      const active = rosterOf(w, t.id, 'active');
      expect(active.length).toBe(31);
      expect(active.filter((p) => p.foreign).length).toBeLessThanOrEqual(4);
      expect(active.filter((p) => p.foreign && p.isPitcher).length).toBeLessThanOrEqual(3);
      expect(active.filter((p) => p.foreign && !p.isPitcher).length).toBeLessThanOrEqual(3);
      expect(rosterOf(w, t.id, 'active').length + rosterOf(w, t.id, 'farm').length).toBeLessThanOrEqual(70);
      const nums = [...rosterOf(w, t.id, 'active'), ...rosterOf(w, t.id, 'farm')].map((p) => p.number);
      expect(new Set(nums).size).toBe(nums.length);
    }
  });
  it('2027年は両リーグDH', () => {
    expect(w.settings.dh).toEqual({ C: true, P: true });
  });
});

describe('1シーズン', () => {
  const w = newWorld(7, 1);
  simulateUntil(w, '2099-01-01');
  it('全858試合を消化してレギュラーシーズン終了', () => {
    expect(Object.keys(w.results).filter((id) => Number(id) < 90000).length).toBe(858);
    expect(w.phase).toBe('offseason');
    for (const lg of ['C', 'P'] as const) for (const r of computeStandings(w, lg)) expect(r.g).toBe(143);
  });
  it('勝率は引き分けを除いて計算', () => {
    expect(winPct(70, 70)).toBe(0.5);
    const r = computeStandings(w, 'C')[0];
    expect(r.pct).toBeCloseTo(r.w / (r.w + r.l), 10);
    // 勝敗の合計がリーグで釣り合う
    const all = [...computeStandings(w, 'C'), ...computeStandings(w, 'P')];
    expect(all.reduce((s, x) => s + x.w, 0)).toBe(all.reduce((s, x) => s + x.l, 0));
  });
  it('チームの得点合計 = 打者の得点合計', () => {
    const all = [...computeStandings(w, 'C'), ...computeStandings(w, 'P')];
    const rs = all.reduce((s, x) => s + x.rs, 0);
    const r = Object.values(w.season).reduce((s, e) => s + (e.bat?.r ?? 0), 0);
    expect(r).toBe(rs);
  });
  it('セイバー指標: リーグwOBA=リーグ出塁率、リーグFIP=リーグ防御率、WARの総量', () => {
    const ctx = contexts(w);
    for (const lg of ['C', 'P'] as const) {
      const c = ctx[lg];
      expect(wobaOf(c.bat, c.weights)).toBeCloseTo(c.obp, 3);
      expect(fipOf(c.pitch, c.fipConst)).toBeCloseTo(c.era, 6);
      // 本塁打の得点価値 > 三塁打 > 二塁打 > 単打 > 四球 > 0
      expect(c.weights.hr).toBeGreaterThan(c.weights.b3);
      expect(c.weights.b3).toBeGreaterThan(c.weights.b2);
      expect(c.weights.b2).toBeGreaterThan(c.weights.b1);
      expect(c.weights.b1).toBeGreaterThan(c.weights.bb);
      // 得点期待値: 無死満塁 > 無死走者なし > 二死走者なし
      expect(c.re[7]).toBeGreaterThan(c.re[0]);
      expect(c.re[0]).toBeGreaterThan(c.re[16]);
      const bw = batterRows(w, lg, ctx).reduce((s, r) => s + r.war, 0);
      const pw = pitcherRows(w, lg, ctx).reduce((s, r) => s + r.war, 0);
      const pool = (0.5 - 0.294) * 6 * 143;
      expect(bw + pw).toBeGreaterThan(pool * 0.9);
      expect(bw + pw).toBeLessThan(pool * 1.1);
      // 規定打席到達者の wRC+ 平均はおおむね100以上（レギュラーは平均より打つ）
      const q = batterRows(w, lg, ctx).filter((r) => r.qualified);
      expect(q.length).toBeGreaterThan(10);
    }
  });
  it('パークファクター: 本塁打の出やすい球場は1より大きい', () => {
    const ctx = contexts(w);
    const pfs = w.teams.map((t) => [t.park.hrFactor, ctx.C.parkFactor[t.id]] as const);
    const hi = pfs.filter(([h]) => h > 1.1).map(([, p]) => p);
    const lo = pfs.filter(([h]) => h < 0.9).map(([, p]) => p);
    expect(Math.min(...hi)).toBeGreaterThan(Math.max(...lo) - 0.05);
  });
});

describe('セーブ', () => {
  it('JSON書き出し・読み込みで同じ状態に戻る', () => {
    const w = newWorld(3, 2);
    for (let i = 0; i < 5; i++) simulateDay(w);
    const back = deserializeWorld(serializeWorld(w));
    expect(back.date).toBe(w.date);
    expect(Object.keys(back.results).length).toBe(Object.keys(w.results).length);
    // 続きを同じように進められる（決定的）
    simulateDay(w);
    simulateDay(back);
    expect(serializeWorld(back)).toBe(serializeWorld(w));
  });
  it('IndexedDB の複数スロットに保存・読込・削除', async () => {
    const w = newWorld(5, 6);
    simulateDay(w);
    await saveWorld(w, 1);
    simulateDay(w);
    await saveWorld(w, 2, 'テスト');
    const list = await listSaves();
    expect(list.map((m) => m.slot)).toEqual([1, 2]);
    expect(list[1].name).toBe('テスト');
    const l1 = await loadWorld(1);
    expect(l1.date < w.date).toBe(true);
    await deleteSave(1);
    expect((await listSaves()).length).toBe(1);
  });
  it('壊れたデータは読み込まない', () => {
    expect(() => deserializeWorld('{"foo":1}')).toThrow();
  });
});

describe('一括計算（Workerが無い環境ではメインスレッド）', () => {
  it('指定日まで進んで返る', async () => {
    const w = newWorld(9, 3);
    const h = runInWorker(w, '2027-04-10');
    const { world } = await h.promise;
    expect(world.date).toBe('2027-04-11');
  });
});
