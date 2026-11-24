/** 観戦中の試合（画面遷移しても保持） */
import type { GameSim } from '../engine/game';
import { findScheduled, prepareLiveGame, recordLiveGame, simulateDay, type ScheduledGame } from '../league/sim';
import { teamById, type World } from '../league/world';
import type { TeamInfo } from '../league/teams';
import type { Park } from '../engine/types';
import { gameSetup } from '../amateur/season';
import { liveAmateurGame } from '../amateur/games';

/** 学校をチーム情報の形にする（観戦画面用） */
export function schoolTeam(w: World, sid: number): TeamInfo {
  const s = w.amateur.schools[sid];
  return {
    id: sid, league: 'C', city: '', nickname: s.name, short: s.name.slice(0, 1), abbr: '', primary: s.colors[0], secondary: s.colors[1],
    emblem: 'star', park: null as never, smallBall: 70, market: 1,
  };
}

/** 甲子園などの観戦を始める（今日の未消化の試合のみ） */
export function startAmateurLive(w: World, tourneyId: string, a: number, b: number): Live | null {
  const t = w.amateur.tourneys[tourneyId];
  const g = t?.games.find((x) => x.a === a && x.b === b && x.winner === undefined);
  if (!g) return null;
  const setup = gameSetup(w, t, a, b, g.round);
  const sim = liveAmateurGame(w.amateur, a, b, g.date, setup);
  const id = -((a * 1000 + b) * 10 + g.round);
  live = {
    gameId: id, meta: { id, date: g.date, away: a, home: b, kind: 'L', maxInnings: null }, kind: 'amateur', tourneyId,
    teams: [schoolTeam(w, a), schoolTeam(w, b)], park: setup.park, title: `${t.short} ${g.round === t.rounds ? '決勝' : g.round === t.rounds - 1 ? '準決勝' : g.round === t.rounds - 2 ? '準々決勝' : `${g.round}回戦`}　${setup.park.name}`,
    sim, view: initialView(sim.away.pitcher.id, sim.home.pitcher.id), queue: [], consumed: 0, playing: false, mode: null, speed: 1, anim: null, t: 0, recorded: true,
  };
  return live;
}
import type { FieldAnim } from './components/Field';
import { animFor, applyFrame, framesFrom, initialView, type Frame, type View } from './liveView';
import { notify } from './store';

export type StepMode = 'pitch' | 'pa' | 'inning' | 'game';

export interface Live {
  gameId: number;
  meta: ScheduledGame;
  /** pro=プロの試合（記録する） amateur=甲子園などの観戦のみ */
  kind: 'pro' | 'amateur';
  teams: [TeamInfo, TeamInfo];
  park: Park;
  title: string;
  tourneyId?: string;
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
  const meta = findScheduled(w, gameId)!;
  const H = teamById(w, meta.home);
  live = {
    gameId, meta, kind: 'pro', teams: [teamById(w, meta.away), H], park: H.park,
    title: `${H.park.name}${meta.label ? `　${meta.kind === 'JS' ? '日本シリーズ' : 'CS'}${meta.label}` : ''}`, sim, view: initialView(sim.away.pitcher.id, sim.home.pitcher.id), queue: [], consumed: 0, playing: false,
    mode: null, speed: 1, anim: null, t: 0, recorded: false,
  };
  return live;
}

export function clearLive() {
  if (live) live.playing = false;
  live = null;
}

const nameOf = (w: World) => (id: number) => w.players[id]?.name ?? w.amateur.players[id]?.name ?? '?';
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
  const park = L.park;
  const label = (id: number) => (L.kind === 'amateur' ? String(L.sim.offense.order.findIndex((s) => s.playerId === id) + 1 || '') : String(w.players[id]?.number ?? ''));
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
