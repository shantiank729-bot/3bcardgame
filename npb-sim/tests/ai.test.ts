import { describe, expect, it } from 'vitest';
import { quickSeason } from './helpers';
import { assignBullpen } from '../src/league/roster';

describe('采配AI（1シーズン）', () => {
  const s = quickSeason(77, true, 143, true);
  it('先発は中5日以上空けて登板する（ほぼ中6日ローテ）', () => {
    const gaps: number[] = [];
    for (const days of s.starts.values()) for (let i = 1; i < days.length; i++) gaps.push(days[i] - days[i - 1]);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(5);
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    expect(avg).toBeGreaterThan(5.8);
    expect(avg).toBeLessThan(7.5);
  });
  it('リリーフの3連投はブルペンが尽きた緊急時のみ（登板の0.5%未満）', () => {
    let apps = 0, three = 0;
    for (const [pid, days] of s.appearDays) {
      if (s.starts.has(pid)) continue;
      apps += days.length;
      for (let i = 2; i < days.length; i++) if (days[i] - days[i - 2] === 2) three++;
    }
    expect(three / apps).toBeLessThan(0.005);
  });
  it('抑え投手がセーブの大半を挙げる', () => {
    let closerSaves = 0, total = 0;
    for (const t of s.teams) {
      const cl = assignBullpen(t.relievers).find((b) => b.role === 'CL')!.playerId;
      for (const r of s.results) {
        if (r.savePitcher === null) continue;
        if (!t.players.some((p) => p.id === r.savePitcher)) continue;
        total++;
        if (r.savePitcher === cl) closerSaves++;
      }
    }
    expect(closerSaves / total).toBeGreaterThan(0.6);
  });
  it('先発投手の平均投球回が5〜7回', () => {
    let outs = 0, n = 0;
    for (const r of s.results) for (const id of [r.startersAway, r.startersHome]) { outs += r.pitch.get(id)!.outs; n++; }
    const ip = outs / n / 3;
    expect(ip).toBeGreaterThan(5);
    expect(ip).toBeLessThan(7);
  });
});
