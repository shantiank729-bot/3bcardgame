/// <reference lib="webworker" />
import { isInSeason, simulateDay } from '../league/sim';
import type { World } from '../league/world';
import { deserializeWorld, serializeWorld } from '../save/serialize';

export type WorkerRequest = { type: 'run'; json: string; until: string; stopOnUserGame?: boolean } | { type: 'cancel' };
export type WorkerResponse =
  | { type: 'progress'; date: string; days: number }
  | { type: 'done'; json: string; cancelled: boolean };

let cancel = false;

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'cancel') {
    cancel = true;
    return;
  }
  cancel = false;
  const w: World = deserializeWorld(msg.json);
  let days = 0;
  const step = () => {
    // 数日ずつ計算して、その合間に中止メッセージを受け取れるようにする
    for (let k = 0; k < 3; k++) {
      if (cancel || !isInSeason(w) || w.date > msg.until) {
        (self as unknown as Worker).postMessage({ type: 'done', json: serializeWorld(w), cancelled: cancel } satisfies WorkerResponse);
        return;
      }
      simulateDay(w);
      days++;
    }
    (self as unknown as Worker).postMessage({ type: 'progress', date: w.date, days } satisfies WorkerResponse);
    setTimeout(step, 0);
  };
  step();
};
