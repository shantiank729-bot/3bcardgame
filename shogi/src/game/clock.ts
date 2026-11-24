import { Color } from "../core/types";

export interface TimeControl {
  /** 持ち時間（ミリ秒）。0 なら最初から秒読み */
  main: number;
  /** 秒読み（ミリ秒）。0 なら秒読みなし（切れ負け） */
  byoyomi: number;
}

export const TIME_PRESETS: { id: string; label: string; tc: TimeControl | null }[] = [
  { id: "none", label: "なし", tc: null },
  { id: "10m", label: "10分 切れ負け", tc: { main: 600_000, byoyomi: 0 } },
  { id: "10m30s", label: "10分 + 秒読み30秒", tc: { main: 600_000, byoyomi: 30_000 } },
  { id: "5m30s", label: "5分 + 秒読み30秒", tc: { main: 300_000, byoyomi: 30_000 } },
  { id: "30s", label: "秒読み30秒", tc: { main: 0, byoyomi: 30_000 } },
  { id: "15m60s", label: "15分 + 秒読み60秒", tc: { main: 900_000, byoyomi: 60_000 } },
];

/** 持ち時間＋秒読みの時計。時刻を引数で受け取るので純粋にテストできる。 */
export class Clock {
  remain: [number, number];
  running: Color | null = null;
  private since = 0;

  constructor(readonly tc: TimeControl) {
    this.remain = [tc.main, tc.main];
  }

  start(c: Color, now: number) {
    this.running = c;
    this.since = now;
  }

  /** 手番側の残り時間（持ち時間・秒読み） */
  view(c: Color, now: number): { main: number; byo: number; flagged: boolean } {
    let main = this.remain[c];
    let byo = this.tc.byoyomi;
    if (this.running === c) {
      let used = now - this.since;
      const fromMain = Math.min(main, used);
      main -= fromMain;
      used -= fromMain;
      byo -= used;
    }
    const flagged = this.running === c && main <= 0 && byo <= 0;
    return { main: Math.max(0, main), byo: Math.max(0, byo), flagged };
  }

  /** 着手して時計を相手に渡す。消費時間を返す */
  press(now: number): number {
    if (this.running === null) return 0;
    const c = this.running;
    const used = now - this.since;
    this.remain[c] = Math.max(0, this.remain[c] - used);
    this.running = (c ^ 1) as Color;
    this.since = now;
    return used;
  }

  stop(now: number) {
    if (this.running === null) return;
    const used = now - this.since;
    this.remain[this.running] = Math.max(0, this.remain[this.running] - used);
    this.running = null;
  }
}

export function fmtClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
