// 毎日の詰将棋: 出題の選び方・難しさの調整・間違えた問題の再出題・記録（純粋関数）
import type { TsumeProblem } from "./generate";

export const LENGTHS = [1, 3, 5, 7] as const;
export const DAILY_COUNT = 3;

export interface Attempt { pid: string; length: number; correct: boolean; date: string; review: boolean }
export interface TsumeState {
  key: "tsume";
  /** 今の難しさ（手数） */
  level: number;
  attempts: Attempt[];
  /** 間違えた問題の再出題予定 */
  review: { pid: string; due: string }[];
  daily: { date: string; pids: string[] } | null;
}

export const initialState = (): TsumeState => ({ key: "tsume", level: 1, attempts: [], review: [], daily: null });

/** ローカル日付 "YYYY-MM-DD" */
export function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return dateStr(new Date(y, m - 1, d + n));
}

/** 今日の問題を決める（同じ日なら同じ問題）。復習が先、残りは今の難しさの未出題の問題 */
export function pickDaily(st: TsumeState, pool: TsumeProblem[], today: string, rnd: () => number, count = DAILY_COUNT): TsumeState {
  if (st.daily?.date === today) return st;
  const byId = new Map(pool.map((p) => [p.id, p]));
  const due = st.review.filter((r) => r.due <= today && byId.has(r.pid)).map((r) => r.pid);
  const pids = due.slice(0, Math.max(1, count - 1));
  const seen = new Set(st.attempts.map((a) => a.pid));
  const fresh = (len: number) => pool.filter((p) => p.length === len && !seen.has(p.id) && !pids.includes(p.id));
  // 今の難しさ → 足りなければ近い難しさ → それでもなければ出題済みから
  const order = [st.level, ...LENGTHS.filter((l) => l !== st.level).sort((a, b) => Math.abs(a - st.level) - Math.abs(b - st.level))];
  for (const len of order) {
    const cands = fresh(len);
    while (pids.length < count && cands.length) pids.push(cands.splice(Math.floor(rnd() * cands.length), 1)[0].id);
    if (pids.length >= count) break;
  }
  if (pids.length < count) {
    const rest = pool.filter((p) => p.length === st.level && !pids.includes(p.id));
    while (pids.length < count && rest.length) pids.push(rest.splice(Math.floor(rnd() * rest.length), 1)[0].id);
  }
  return { ...st, daily: { date: today, pids } };
}

/** 解答の結果を記録し、難しさと復習予定を更新する */
export function recordAttempt(st: TsumeState, p: TsumeProblem, correct: boolean, today: string): TsumeState {
  const inReview = st.review.some((r) => r.pid === p.id);
  const attempts = [...st.attempts, { pid: p.id, length: p.length, correct, date: today, review: inReview }];
  let review = st.review.filter((r) => r.pid !== p.id);
  // 間違えたら翌日にもう一度。復習で正解したら予定から外す
  if (!correct) review = [...review, { pid: p.id, due: addDays(today, 1) }];
  return { ...st, attempts, review, level: adjustLevel(st.level, attempts) };
}

/** 今の難しさでの最近の正解率に合わせて手数を上げ下げする */
export function adjustLevel(level: number, attempts: Attempt[]): number {
  const recent = attempts.filter((a) => a.length === level && !a.review).slice(-10);
  const idx = LENGTHS.indexOf(level as (typeof LENGTHS)[number]);
  const rate = recent.length ? recent.filter((a) => a.correct).length / recent.length : 0;
  if (recent.length >= 5 && rate >= 0.8 && idx < LENGTHS.length - 1) {
    // 上げた直後に下がらないよう、直近5問がすべて今の難しさの問題であることを条件にする
    return LENGTHS[idx + 1];
  }
  const last6 = recent.slice(-6);
  if (last6.length >= 6 && last6.filter((a) => a.correct).length <= 2 && idx > 0) return LENGTHS[idx - 1];
  return level;
}

export interface TsumeStats {
  solved: number;
  attempts: number;
  accuracy: number | null;
  streakDays: number;
  byLength: Record<number, { tried: number; correct: number }>;
}

/** 解けた数・正解率・連続で解いた日数 */
export function tsumeStats(st: TsumeState, today: string): TsumeStats {
  const solvedIds = new Set(st.attempts.filter((a) => a.correct).map((a) => a.pid));
  const days = new Set(st.attempts.filter((a) => a.correct).map((a) => a.date));
  // 今日まだ解いていなくても、昨日まで続いていれば連続は途切れていない
  let d = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(d)) { streak++; d = addDays(d, -1); }
  const byLength: TsumeStats["byLength"] = {};
  for (const a of st.attempts) {
    byLength[a.length] ??= { tried: 0, correct: 0 };
    byLength[a.length].tried++;
    if (a.correct) byLength[a.length].correct++;
  }
  const n = st.attempts.length;
  return { solved: solvedIds.size, attempts: n, accuracy: n ? st.attempts.filter((a) => a.correct).length / n : null, streakDays: streak, byLength };
}
