import { addDays } from '../league/calendar';
import { simulateDay } from '../league/sim';
import { newWorld, type World } from '../league/world';
import { AUTO_SLOT, saveWorld } from '../save/db';
import { runInWorker } from '../worker/client';
import { clearLive } from './live';
import { setBusy, setWorld, state, toast, notify } from './store';

export async function autosave(w: World) {
  try {
    await saveWorld(w, AUTO_SLOT, 'オートセーブ');
  } catch (e) {
    console.warn('autosave failed', e);
  }
}

export function startNewGame(teamId: number, seed = Math.floor(Math.random() * 1e9)) {
  const w = newWorld(seed, teamId);
  setWorld(w, 1);
  void autosave(w);
}

/** 1日だけ進める（メインスレッドで即時） */
export function simOneDay() {
  const w = state.world;
  if (!w || w.phase !== 'regular') return;
  clearLive();
  const r = simulateDay(w);
  notify();
  void autosave(w);
  return r;
}

export type SimSpan = 'week' | 'month' | 'season';

/** 指定期間を Web Worker で一括計算 */
export async function simSpan(span: SimSpan) {
  const w = state.world;
  if (!w || w.phase !== 'regular' || state.busy) return;
  clearLive();
  let until: string;
  if (span === 'week') until = addDays(w.date, 6);
  else if (span === 'month') {
    const [y, m] = w.date.split('-').map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    until = addDays(next, -1);
  } else until = w.calendar.lastDay;
  const label = span === 'week' ? '1週間' : span === 'month' ? '月末まで' : 'シーズン終了まで';
  const h = runInWorker(w, until, (date) => setBusy({ label, date, cancel: h.cancel }));
  setBusy({ label, date: w.date, cancel: h.cancel });
  try {
    const { world, cancelled } = await h.promise;
    setWorld(world);
    if (cancelled) toast('途中で止めました');
    void autosave(world);
  } catch (e) {
    toast('計算中にエラーが発生しました');
    console.error(e);
  } finally {
    setBusy(null);
  }
}
