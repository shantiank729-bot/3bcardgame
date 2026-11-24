import { describe, expect, it } from "vitest";
import { Clock } from "../src/game/clock";

describe("時計", () => {
  it("持ち時間が減り、切れたら秒読み", () => {
    const c = new Clock({ main: 10_000, byoyomi: 5_000 });
    c.start(0, 0);
    expect(c.view(0, 4_000)).toMatchObject({ main: 6_000, byo: 5_000, flagged: false });
    expect(c.press(4_000)).toBe(4_000);
    expect(c.view(1, 4_000).main).toBe(10_000);
    c.press(5_000);
    expect(c.view(0, 14_000)).toMatchObject({ main: 0, byo: 2_000, flagged: false });
    expect(c.view(0, 16_001).flagged).toBe(true);
  });
  it("秒読み中は毎手リセット", () => {
    const c = new Clock({ main: 0, byoyomi: 30_000 });
    c.start(0, 0);
    c.press(29_000);
    c.press(30_000);
    expect(c.view(0, 59_000)).toMatchObject({ byo: 1_000, flagged: false });
  });
  it("切れ負け", () => {
    const c = new Clock({ main: 1_000, byoyomi: 0 });
    c.start(0, 0);
    expect(c.view(0, 999).flagged).toBe(false);
    expect(c.view(0, 1_000).flagged).toBe(true);
  });
});
