/// <reference lib="webworker" />
// 詰将棋の生成を画面と別スレッドで行う
import { mulberry32 } from "../engine/levels";
import { TsumeProblem, generateTsume } from "./generate";
import { problemFromPosition } from "./fromGame";

export type TsumeIn =
  | { type: "generate"; id: number; length: number; count: number; seed: number }
  | { type: "fromPositions"; id: number; sfens: string[] };
export type TsumeOut = { type: "done"; id: number; problems: TsumeProblem[] };

self.onmessage = (ev: MessageEvent<TsumeIn>) => {
  const m = ev.data;
  const problems: TsumeProblem[] = [];
  if (m.type === "generate") {
    const rng = mulberry32(m.seed);
    for (let i = 0; i < m.count; i++) {
      const p = generateTsume(m.length, rng, 3000);
      if (p) problems.push(p);
    }
  } else {
    for (const s of m.sfens) {
      try { const p = problemFromPosition(s); if (p) problems.push(p); } catch { /* 読めない局面は飛ばす */ }
    }
  }
  (self as unknown as Worker).postMessage({ type: "done", id: m.id, problems } satisfies TsumeOut);
};
