/** 観戦中の試合（画面遷移しても保持） */
import type { GameSim } from '../engine/game';
import { prepareLiveGame, recordLiveGame, simulateDay } from '../league/sim';
import type { World } from '../league/world';
import type { FieldAnim } from './components/Field';
import { animFor, applyFrame, framesFrom, initialView, type Frame, type View } from './liveView';
import { notify } from './store';

export type StepMode = 'pitch' | 'pa' | 'inning' | 'game';

export interface Live {
  gameId: number;
  sim: GameSim;
  view: View;
  queue: Frame[];
  consumed: number;
  playing: boolean;
  mode: StepMode | null;
  speed: number; // 0 = 演出なし
  anim: FieldAnim | null;
  t: number;
  recorded: boolean;
}

export let live: Live | null = null;

export function startLive(w: World, gameId: number): Live {
  if (live && live.gameId === gameId) return live;
  const sim = prepareLiveGame(w, gameId);
  live = {
    gameId, sim, view: initialView(sim.away.pitcher.id, sim.home.pitcher.id), queue: [], consumed: 0, playing: false,
    mode: null, speed: 1, anim: null, t: 0, recorded: false,
  };
  return live;
}

export function clearLive() {
  if (live) live.playing = false;
  live = null;
}

const nameOf = (w: World) => (id: number) => w.players[id]?.name ?? '?';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pull(L: Live) {
  if (L.queue.length === 0 && !L.sim.over) {
    L.sim.step();
  }
  const ev = L.sim.events.slice(L.consumed);
  L.consumed = L.sim.events.length;
  L.queue.push(...framesFrom(ev));
}

/** 演出つきで1フレーム再生 */
async function playFrame(L: Live, w: World, f: Frame) {
  const sp = L.speed;
  if (f.k === 'pitch') {
    applyFrame(L.view, f, nameOf(w));
    notify();
    if (sp) await sleep(650 / sp);
    return;
  }
  const park = w.teams.find((t) => t.id === w.calendar.games.find((g) => g.id === L.gameId)!.home)!.park;
  const label = (id: number) => String(w.players[id]?.number ?? '');
  if (sp && (f.e.t === 'pa' || f.e.t === 'steal')) {
    // 最後の1球を見せる
    if (f.e.t === 'pa' && f.e.seq?.length) {
      L.view.lastPitch = f.e.seq[f.e.seq.length - 1];
      L.view.pitchesThisPA = f.e.seq;
      if (f.e.seq.length === 1) L.view.bases = [f.e.batter, ...f.e.basesBefore];
      L.view.batter = f.e.batter;
      notify();
      await sleep(350 / sp);
    }
    const plan = animFor(f.e, park, label, L.view);
    if (plan) {
      L.anim = plan.anim;
      const dur = plan.ms / sp;
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const tick = () => {
          L.t = Math.min(1, (performance.now() - t0) / dur);
          notify();
          if (L.t < 1 && live === L) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      await sleep(250 / sp);
      L.anim = null;
      L.t = 0;
    }
  }
  applyFrame(L.view, f, nameOf(w));
  notify();
  if (sp && f.e.t === 'inningEnd') await sleep(700 / sp);
  else if (sp && (f.e.t === 'pitchChange' || f.e.t === 'sub')) await sleep(500 / sp);
}

const isBoundary = (mode: StepMode, f: Frame) =>
  mode === 'pitch' ? true
    : mode === 'pa' ? f.k === 'event' && (f.e.t === 'pa' || f.e.t === 'end')
    : mode === 'inning' ? f.k === 'event' && (f.e.t === 'inningEnd' || f.e.t === 'end')
    : f.k === 'event' && f.e.t === 'end';

export async function advance(L: Live, w: World, mode: StepMode) {
  if (L.playing) return;
  L.playing = true;
  L.mode = mode;
  notify();
  try {
    while (L.playing && live === L) {
      if (L.queue.length === 0) {
        if (L.sim.over && L.view.over) break;
        pull(L);
        if (L.queue.length === 0) break;
      }
      const f = L.queue.shift()!;
      // 「試合終了まで」で演出なしの時は一気に
      if (L.speed === 0 || (mode === 'game' && L.speed >= 8)) {
        applyFrame(L.view, f, nameOf(w));
      } else await playFrame(L, w, f);
      if (isBoundary(mode, f)) break;
      if (L.speed === 0 && L.queue.length === 0 && mode !== 'game') {
        // 演出なしでも1打席・1イニングの区切りは守る
        continue;
      }
    }
  } finally {
    L.playing = false;
    L.mode = null;
    notify();
  }
}

export function stop(L: Live) {
  L.playing = false;
}

/** 試合を記録し、その日の他の試合も消化して日付を進める */
export function finishLive(L: Live, w: World) {
  if (!L.recorded) {
    recordLiveGame(w, L.gameId, L.sim);
    L.recorded = true;
  }
  simulateDay(w);
  clearLive();
  notify();
}

/** キューが空＝エンジンの状態と表示が一致している（采配できる） */
export const idle = (L: Live) => !L.playing && L.queue.length === 0 && !L.sim.over;
