/** 観戦画面の表示状態（エンジンのイベント列から組み立てる。DOMに依存しない） */
import type { GameEvent } from '../engine/game';
import { isOutfield } from '../engine/pa';
import type { PitchInfo, PitchResult } from '../engine/pitches';
import { PITCH_NAMES } from '../engine/types';
import { describeEvent } from '../engine/describe';
import { homePos, polar, type FieldAnim } from './components/Field';
import type { Park } from '../engine/types';

export type PAEvent = Extract<GameEvent, { t: 'pa' }>;

export type Frame =
  | { k: 'pitch'; pa: PAEvent; i: number }
  | { k: 'event'; e: GameEvent };

export interface LogLine {
  text: string;
  inning: number;
  top: boolean;
  cls: string;
}

export interface View {
  inning: number;
  top: boolean;
  outs: number;
  balls: number;
  strikes: number;
  score: [number, number];
  line: [number[], number[]];
  hits: [number, number];
  errors: [number, number];
  bases: (number | null)[]; // [打者, 1塁, 2塁, 3塁]
  batter: number | null;
  pitcher: [number | null, number | null]; // [ビジター側の投手, ホーム側の投手]
  pitchCount: Record<number, number>;
  lastPitch: PitchInfo | null;
  pitchesThisPA: PitchInfo[];
  log: LogLine[];
  today: Record<number, { ab: number; h: number; hr: number; rbi: number; bb: number; k: number }>;
  halfRuns: number;
  halfOpen: boolean;
  over: boolean;
}

export function initialView(awaySP: number, homeSP: number): View {
  return {
    inning: 1, top: true, outs: 0, balls: 0, strikes: 0, score: [0, 0], line: [[], []], hits: [0, 0], errors: [0, 0],
    bases: [null, null, null, null], batter: null, pitcher: [awaySP, homeSP], pitchCount: {}, lastPitch: null,
    pitchesThisPA: [], log: [], today: {}, halfRuns: 0, halfOpen: false, over: false,
  };
}

/** イベントを観戦用のフレームに分解（打席は1球ずつ） */
export function framesFrom(events: GameEvent[]): Frame[] {
  const out: Frame[] = [];
  for (const e of events) {
    if (e.t === 'pa' && e.seq && e.seq.length > 1) {
      for (let i = 0; i < e.seq.length - 1; i++) out.push({ k: 'pitch', pa: e, i });
    }
    out.push({ k: 'event', e });
  }
  return out;
}

const PITCH_JP: Record<PitchResult, string> = {
  ball: 'ボール', called: '見逃しストライク', swinging: '空振り', foul: 'ファウル', inplay: '打った！', hbp: '死球',
};
export function pitchText(p: PitchInfo, n: number) {
  return `${n}球目 ${PITCH_NAMES[p.type]} ${p.kmh}km ${PITCH_JP[p.result]}`;
}

const HIT_CODES = new Set(['1B', '2B', '3B', 'HR', 'SHHIT']);
const NO_AB = new Set(['BB', 'IBB', 'HBP', 'SH', 'SF', 'SQZ']);

/** フレームを1つ表示状態に反映（view を直接書き換える） */
export function applyFrame(v: View, f: Frame, name: (id: number) => string) {
  if (f.k === 'pitch') {
    const p = f.pa.seq![f.i];
    v.batter = f.pa.batter;
    v.inning = f.pa.inning;
    v.top = f.pa.top;
    v.balls = p.balls;
    v.strikes = p.strikes;
    v.lastPitch = p;
    v.pitchesThisPA = f.pa.seq!.slice(0, f.i + 1);
    v.pitchCount[f.pa.pitcher] = (v.pitchCount[f.pa.pitcher] ?? 0) + 1;
    if (f.i === 0) {
      v.bases = [f.pa.batter, ...f.pa.basesBefore];
    }
    return;
  }
  const e = f.e;
  const side = (top: boolean) => (top ? 0 : 1);
  switch (e.t) {
    case 'pa': {
      const s = side(e.top);
      const last = e.seq?.[e.seq.length - 1];
      v.inning = e.inning;
      v.top = e.top;
      v.halfOpen = true;
      if (last) {
        v.lastPitch = last;
        v.pitchesThisPA = e.seq!;
        v.pitchCount[e.pitcher] = (v.pitchCount[e.pitcher] ?? 0) + 1;
      }
      v.batter = null;
      v.balls = 0;
      v.strikes = 0;
      v.outs = Math.min(3, e.outsAfter);
      v.bases = [null, ...e.basesAfter];
      v.score = [e.scoreAway, e.scoreHome];
      v.halfRuns += e.runs;
      v.pitcher[e.top ? 1 : 0] = e.pitcher;
      if (HIT_CODES.has(e.result)) v.hits[s]++;
      if (e.result === 'E') v.errors[1 - s]++;
      const td = (v.today[e.batter] ??= { ab: 0, h: 0, hr: 0, rbi: 0, bb: 0, k: 0 });
      if (!NO_AB.has(e.result)) td.ab++;
      if (HIT_CODES.has(e.result)) td.h++;
      if (e.result === 'HR') td.hr++;
      if (e.result === 'BB' || e.result === 'IBB' || e.result === 'HBP') td.bb++;
      if (e.result === 'K') td.k++;
      td.rbi += e.rbi;
      const cls = e.result === 'HR' ? 'hr' : e.runs > 0 ? 'score' : HIT_CODES.has(e.result) ? 'hit' : '';
      v.log.unshift({ text: describeEvent(e, name), inning: e.inning, top: e.top, cls });
      break;
    }
    case 'steal': {
      v.outs = Math.min(3, e.outsAfter);
      const from = e.base - 1;
      const runner = v.bases[from];
      v.bases[from] = null;
      if (e.success) v.bases[e.base] = runner;
      v.log.unshift({ text: describeEvent(e, name), inning: e.inning, top: e.top, cls: '' });
      break;
    }
    case 'wp': {
      v.halfOpen = true;
      v.score[side(e.top)] += e.runs;
      v.halfRuns += e.runs;
      v.bases = [v.bases[0], null, v.bases[1], v.bases[2]];
      v.log.unshift({ text: describeEvent(e, name), inning: e.inning, top: e.top, cls: e.runs ? 'score' : '' });
      break;
    }
    case 'pitchChange': {
      // 守備側の投手
      v.pitcher[e.top ? 1 : 0] = e.in;
      v.log.unshift({ text: describeEvent(e, name), inning: e.inning, top: e.top, cls: 'sub' });
      break;
    }
    case 'sub': {
      for (let i = 1; i < 4; i++) if (v.bases[i] === e.out) v.bases[i] = e.in;
      v.log.unshift({ text: describeEvent(e, name), inning: e.inning, top: e.top, cls: 'sub' });
      break;
    }
    case 'inningEnd': {
      v.line[side(e.top)].push(e.runs);
      v.halfOpen = false;
      v.halfRuns = 0;
      v.outs = 0;
      v.bases = [null, null, null, null];
      v.log.unshift({ text: describeEvent(e, name), inning: e.inning, top: e.top, cls: 'inning' });
      if (e.top) {
        v.top = false;
      } else {
        v.top = true;
        v.inning = e.inning + 1;
      }
      break;
    }
    case 'end': {
      // サヨナラで終わった回は inningEnd が無いので、ここで得点を記入
      if (v.halfOpen) v.line[side(v.top)].push(v.halfRuns);
      v.halfOpen = false;
      v.over = true;
      v.log.unshift({ text: describeEvent(e, name), inning: e.innings, top: v.top, cls: 'inning' });
      break;
    }
  }
}

const CAPTION: Record<string, [string, string]> = {
  HR: ['ホームラン！', 'cap-hr'], '3B': ['スリーベース！', 'cap-hit'], '2B': ['ツーベース！', 'cap-hit'], '1B': ['ヒット', 'cap-hit'],
  K: ['三振', 'cap-out'], BB: ['フォアボール', 'cap-walk'], IBB: ['申告敬遠', 'cap-walk'], HBP: ['デッドボール', 'cap-walk'],
  DP: ['ゲッツー', 'cap-out'], E: ['エラー', 'cap-hit'], SF: ['犠牲フライ', 'cap-out'], SH: ['送りバント成功', 'cap-out'],
  SQZ: ['スクイズ成功！', 'cap-hit'], SHHIT: ['バントヒット', 'cap-hit'],
};

/** 打席結果・盗塁のアニメーション計画 */
export function animFor(e: GameEvent, park: Park, label: (id: number) => string, prev: View): { anim: FieldAnim; ms: number } | null {
  if (e.t === 'steal') {
    const from = e.base - 1;
    return {
      anim: { runners: [{ id: e.runner, label: label(e.runner), from, to: e.base, out: !e.success }], caption: e.success ? '盗塁成功' : '盗塁失敗', captionCls: e.success ? 'cap-hit' : 'cap-out' },
      ms: 1300,
    };
  }
  if (e.t !== 'pa') return null;
  const runners: FieldAnim['runners'] = [];
  const before = [e.batter, ...e.basesBefore];
  const after = [null, ...e.basesAfter];
  before.forEach((id, from) => {
    if (id === null) return;
    const scored = e.scorers.includes(id);
    const j = after.indexOf(id);
    if (scored) runners.push({ id, label: label(id), from, to: 4, out: false });
    else if (j > 0) {
      if (j !== from) runners.push({ id, label: label(id), from, to: j, out: false });
      else runners.push({ id, label: label(id), from, to: j, out: false });
    } else runners.push({ id, label: label(id), from, to: Math.min(4, from + 1), out: true });
  });
  // 打者が三振・凡打でアウトなら打者走者を描かない（三振）
  const filtered = runners.filter((r) => !(r.id === e.batter && r.out && (e.result === 'K' || e.result === 'PO' || e.result === 'FO' || e.result === 'LO' || e.result === 'SF')));
  const cap = CAPTION[e.result];
  const anim: FieldAnim = { runners: filtered, caption: e.runs > 0 && e.result !== 'HR' ? `${cap?.[0] ?? ''} ${e.runs}点！`.trim() : cap?.[0], captionCls: cap?.[1] };
  let ms = 1500;
  if (e.result === 'HR' && e.angle !== undefined && e.distance !== undefined) {
    anim.ball = { to: polar(e.angle, e.distance + 8), kind: 'HR', caught: false };
    ms = 2600;
  } else if (e.bip) {
    const b = e.bip;
    const to = polar(b.angle, b.distance);
    anim.ball = { to, kind: b.type, caught: !b.hit && !b.error };
    const fp = b.fielder;
    anim.fielder = { pos: fp, to: b.hit && isOutfield(fp) ? to : b.hit ? homePos(park, fp) : to };
    ms = b.type === 'GB' ? 1700 : 2200;
  } else if (e.result === 'SH' || e.result === 'SHFC' || e.result === 'SHHIT' || e.result === 'SQZ') {
    anim.ball = { to: polar(e.result === 'SQZ' ? -20 : 25, 12), kind: 'BUNT', caught: true };
    ms = 1500;
  } else if (e.result === 'K' || e.result === 'BB' || e.result === 'HBP' || e.result === 'IBB') {
    ms = e.runs ? 1400 : 1000;
  }
  void prev;
  return { anim, ms };
}
