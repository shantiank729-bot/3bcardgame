// チューニング自動調整: npx vite-node scripts/fit-tuning.ts （結果を src/engine/constants.ts に反映する）
import { DEFAULT_TUNING } from '../src/engine/constants';
import { logit } from '../src/engine/pa';
import { quickSeason, summarize } from '../tests/helpers';
const T = DEFAULT_TUNING as any;
const target = { avg: 0.245, kPct: 0.195, bbPct: 0.075, hbpPct: 0.0085, hrPerTeamGame: 0.65, dblPerTeamGame: 1.42, triPerTeamGame: 0.13 };
const adj = (key: string, actual: number, tgt: number, damp = 0.8) => {
  const v = T[key];
  const nv = 1 / (1 + Math.exp(-(logit(v) + damp * (logit(tgt) - logit(actual)))));
  T[key] = nv;
};
for (let it = 0; it < 5; it++) {
  const acc: any = {};
  for (const seed of [11, 22, 33]) {
    const s: any = summarize(quickSeason(seed));
    for (const k in s) acc[k] = (acc[k] ?? 0) + s[k] / 3;
  }
  console.log(it, ['avg','obp','slg','runsPerTeamGame','hrPerTeamGame','era','kPct','bbPct','babip','dblPerTeamGame','triPerTeamGame','sbPerTeamGame','csPerTeamGame','shPerTeamGame','sfPerTeamGame','gidpPerTeamGame','ibbPerTeamGame','errorsPerTeamGame','pitchesPerTeamGame','tieRate'].map(k=>k+'='+acc[k].toFixed(3)).join(' '));
  adj('k', acc.kPct, target.kPct);
  adj('bb', acc.bbPct, target.bbPct);
  adj('hbp', acc.hbpPct, target.hbpPct);
  adj('hr', acc.hrPerTeamGame / acc.paPerTeamGame, target.hrPerTeamGame / acc.paPerTeamGame);
  // BABIP 目標: avg から逆算
  const ab = acc.paPerTeamGame * (1 - acc.bbPct - acc.hbpPct) - acc.shPerTeamGame - acc.sfPerTeamGame;
  const tgtH = target.avg * ab;
  const curH = acc.avg * ab;
  const f = (tgtH - target.hrPerTeamGame) / (curH - acc.hrPerTeamGame);
  for (const k of ['hitGB', 'hitLD', 'hitFB']) T[k] = 1 / (1 + Math.exp(-(logit(T[k]) + 0.8 * Math.log(f) * 1.3)));
  const lo = (k: string, r: number) => (T[k] = 1 / (1 + Math.exp(-(logit(T[k]) + 0.8 * Math.log(r)))));
  lo('dblLD', target.dblPerTeamGame / acc.dblPerTeamGame);
  lo('dblFB', target.dblPerTeamGame / acc.dblPerTeamGame);
  lo('triple', (target.triPerTeamGame / (target.dblPerTeamGame)) / (acc.triPerTeamGame / (acc.dblPerTeamGame)));
}
console.log(JSON.stringify(Object.fromEntries(Object.entries(T).map(([k, v]: any) => [k, +v.toFixed(4)]))));
