/** 自動進行（テスト・「おまかせ」ボタン用） */
import { autoDraft } from './draft';
import { advanceOffseason } from './offseason';
import { completeDraft, simulateDay } from './sim';
import type { World } from './world';

/** ドラフトをすべて自動で終える */
export function autoCompleteDraft(w: World) {
  if (!w.draft) return;
  if (w.draft.stage !== 'done') autoDraft(w, w.draft);
  completeDraft(w);
}

/** オフシーズンを最後まで自動で進める（戦力外はおすすめ通り） */
export function autoOffseason(w: World) {
  let guard = 0;
  while (w.off && guard++ < 20) {
    if (w.off.stage === 'release') w.off.userRelease = [...w.off.releaseSuggest];
    advanceOffseason(w);
  }
}

/** 1シーズン（オフシーズン込み）を自動で進める */
export function autoSeason(w: World) {
  const year = w.year;
  let guard = 0;
  while (w.year === year && guard++ < 400) {
    if (w.phase === 'offseason') {
      autoOffseason(w);
      continue;
    }
    const r = simulateDay(w);
    if (r.blocked === 'draft') autoCompleteDraft(w);
  }
}

/** 日本シリーズ終了（オフシーズン入り）まで進める。ドラフトは自動 */
export function runToOffseason(w: World) {
  let guard = 0;
  while (w.phase !== 'offseason' && guard++ < 400) {
    const r = simulateDay(w);
    if (r.blocked === 'draft') autoCompleteDraft(w);
  }
}
