import { describe, expect, it } from "vitest";
import { mulberry32 } from "../src/engine/levels";
import type { TsumeProblem } from "../src/tsume/generate";
import { addDays, initialState, pickDaily, recordAttempt, tsumeStats } from "../src/tsume/progress";

const pool: TsumeProblem[] = [];
for (const len of [1, 3, 5, 7]) for (let i = 0; i < 20; i++) pool.push({ id: `${len}-${i}`, sfen: "", length: len, solution: [], source: "random" });
const P = (id: string) => pool.find((p) => p.id === id)!;

describe("毎日の詰将棋", () => {
  it("同じ日は同じ問題、今の難しさから出る", () => {
    const rng = mulberry32(1);
    const a = pickDaily(initialState(), pool, "2026-11-24", rng);
    expect(a.daily!.pids).toHaveLength(3);
    expect(a.daily!.pids.every((id) => P(id).length === 1)).toBe(true);
    expect(pickDaily(a, pool, "2026-11-24", rng)).toBe(a);
  });
  it("正解が続くと難しくなり、間違いが続くと易しくなる", () => {
    let st = initialState();
    for (let i = 0; i < 5; i++) st = recordAttempt(st, P(`1-${i}`), true, "2026-11-24");
    expect(st.level).toBe(3);
    for (let i = 0; i < 6; i++) st = recordAttempt(st, P(`3-${i}`), i === 0, "2026-11-25");
    expect(st.level).toBe(1);
  });
  it("間違えた問題は翌日に復習として出て、正解すると外れる", () => {
    let st = recordAttempt(initialState(), P("1-3"), false, "2026-11-24");
    expect(st.review).toEqual([{ pid: "1-3", due: "2026-11-25" }]);
    st = pickDaily(st, pool, "2026-11-25", mulberry32(2));
    expect(st.daily!.pids[0]).toBe("1-3");
    st = recordAttempt(st, P("1-3"), true, "2026-11-25");
    expect(st.review).toEqual([]);
    expect(st.attempts[1].review).toBe(true);
  });
  it("解けた数と連続日数", () => {
    let st = initialState();
    st = recordAttempt(st, P("1-0"), true, "2026-11-22");
    st = recordAttempt(st, P("1-1"), true, "2026-11-23");
    st = recordAttempt(st, P("1-2"), false, "2026-11-24");
    st = recordAttempt(st, P("1-2"), true, "2026-11-24");
    const s = tsumeStats(st, "2026-11-24");
    expect(s.solved).toBe(3);
    expect(s.streakDays).toBe(3);
    expect(tsumeStats(st, "2026-11-25").streakDays).toBe(3); // 今日はまだでも途切れない
    expect(tsumeStats(st, "2026-11-26").streakDays).toBe(0);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
