import { simulateDay } from '../league/sim';
import type { World } from '../league/world';
import { deserializeWorld, serializeWorld } from '../save/serialize';
import type { WorkerRequest, WorkerResponse } from './sim.worker';

let worker: Worker | null = null;
function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
  return worker;
}

export interface RunHandle {
  promise: Promise<{ world: World; cancelled: boolean }>;
  cancel(): void;
}

/** until の日付まで（含む）を Web Worker で一括計算する。画面は固まらない */
export function runInWorker(w: World, until: string, onProgress?: (date: string, days: number) => void): RunHandle {
  const wk = getWorker();
  if (!wk) {
    // Worker が使えない環境ではメインスレッドで実行
    let cancelled = false;
    const promise = (async () => {
      while (!cancelled && w.phase === 'regular' && w.date <= until) {
        simulateDay(w);
        onProgress?.(w.date, 0);
        await new Promise((r) => setTimeout(r, 0));
      }
      return { world: w, cancelled };
    })();
    return { promise, cancel: () => (cancelled = true) };
  }
  const promise = new Promise<{ world: World; cancelled: boolean }>((resolve, reject) => {
    wk.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const m = ev.data;
      if (m.type === 'progress') onProgress?.(m.date, m.days);
      else resolve({ world: deserializeWorld(m.json), cancelled: m.cancelled });
    };
    wk.onerror = (e) => reject(e);
    wk.postMessage({ type: 'run', json: serializeWorld(w), until } satisfies WorkerRequest);
  });
  return { promise, cancel: () => wk.postMessage({ type: 'cancel' } satisfies WorkerRequest) };
}
