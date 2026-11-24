import { useEffect, useState } from 'preact/hooks';
import type { World } from '../league/world';

export interface Busy {
  label: string;
  date: string;
  cancel?: () => void;
}

interface State {
  world: World | null;
  slot: number;
  busy: Busy | null;
  toast: string | null;
  version: number;
}

export const state: State = { world: null, slot: 1, busy: null, toast: null, version: 0 };
const listeners = new Set<() => void>();

export function notify() {
  state.version++;
  for (const l of listeners) l();
}
export function setWorld(w: World | null, slot = state.slot) {
  state.world = w;
  state.slot = slot;
  notify();
}
export function setBusy(b: Busy | null) {
  state.busy = b;
  notify();
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  state.toast = msg;
  notify();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    notify();
  }, 2500);
}

export function useStore(): State {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((x) => x + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}

/** world がある前提の画面用 */
export function useWorld(): World {
  const s = useStore();
  return s.world!;
}

// ---- ルーター（#/path/arg）----
export function useRoute(): string[] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}
export function go(path: string) {
  location.hash = '#/' + path;
}
