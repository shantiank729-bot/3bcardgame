import { describe, expect, it } from 'vitest';
import { quickSeason, summarize } from './helpers';

/**
 * 1シーズン（12球団×143試合）を回し、リーグ全体の数字が近年のNPB平均に近いか確認する。
 * 目標値（概数）: 打率.245 / 得点3.4 / 本塁打0.65 / 防御率3.10 / K%19.5 / BB%7.5
 */
describe('NPB平均へのキャリブレーション', () => {
  const seeds = [101, 202, 303];
  const s = seeds.map((x) => summarize(quickSeason(x)));
  const mean = (k: keyof (typeof s)[0]) => s.reduce((a, b) => a + b[k], 0) / s.length;
  const report = Object.fromEntries(Object.keys(s[0]).map((k) => [k, +mean(k as never).toFixed(3)]));
  console.log('リーグ平均', report);

  it('打率 .245 ±.008', () => expect(Math.abs(mean('avg') - 0.245)).toBeLessThan(0.008));
  it('1試合1チームの得点 3.4 ±0.3', () => expect(Math.abs(mean('runsPerTeamGame') - 3.4)).toBeLessThan(0.3));
  it('本塁打 0.65/試合 ±0.10', () => expect(Math.abs(mean('hrPerTeamGame') - 0.65)).toBeLessThan(0.1));
  it('防御率 3.10 ±0.3', () => expect(Math.abs(mean('era') - 3.1)).toBeLessThan(0.3));
  it('三振率 19.5% ±1.5pt', () => expect(Math.abs(mean('kPct') - 0.195)).toBeLessThan(0.015));
  it('四球率 7.5% ±1.0pt', () => expect(Math.abs(mean('bbPct') - 0.075)).toBeLessThan(0.01));
  it('その他の指標が現実的な範囲', () => {
    expect(mean('babip')).toBeGreaterThan(0.28);
    expect(mean('babip')).toBeLessThan(0.31);
    expect(mean('sbPerTeamGame')).toBeGreaterThan(0.25);
    expect(mean('shPerTeamGame')).toBeGreaterThan(0.25);
    expect(mean('gidpPerTeamGame')).toBeLessThan(0.85);
    expect(mean('tieRate')).toBeLessThan(0.07);
    expect(mean('pitchesPerTeamGame')).toBeGreaterThan(135);
    expect(mean('pitchesPerTeamGame')).toBeLessThan(160);
  });
});
