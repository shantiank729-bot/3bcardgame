// 対局後の解析を裏で進める。結果は1局面ずつ IndexedDB に保存し、購読者に知らせる。
import { Position } from "../core/position";
import { toUsiPosition, usiToMove } from "../core/usi";
import { GameRecord, loadGame, saveGame } from "../db/records";
import { EngineClient } from "../engine/client";
import { MATE_SCORE } from "../engine/usi";
import { PosEval } from "./classify";

type Listener = (gameId: number, rec: GameRecord) => void;

let engine: EngineClient | null = null;
/** 解析用エンジン（複数スレッド） */
export function analysisEngine(): EngineClient {
  if (!engine) {
    const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2;
    engine = new EngineClient(Math.max(1, Math.min(4, cores - 1)), 64);
  }
  return engine;
}

class AnalysisManager {
  private queue: number[] = [];
  private running = false;
  private paused = false;
  private listeners = new Set<Listener>();
  current: number | null = null;

  subscribe(f: Listener) { this.listeners.add(f); return () => this.listeners.delete(f); }

  /** 対局中は止めて、エンジンを対局に使わせる */
  setPaused(p: boolean) {
    this.paused = p;
    if (!p) void this.run();
  }

  enqueue(id: number, front = false) {
    this.queue = this.queue.filter((x) => x !== id);
    if (front) this.queue.unshift(id); else this.queue.push(id);
    void this.run();
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    try {
      while (this.queue.length && !this.paused) {
        const id = this.queue.shift()!;
        this.current = id;
        await this.analyzeGame(id);
        this.current = null;
      }
    } finally {
      this.running = false;
      this.current = null;
    }
  }

  private async analyzeGame(id: number) {
    const rec = await loadGame(id);
    if (!rec || rec.analysis?.done) return;
    const kind = (await analysisEngine().ready).kind;
    const nodes = kind === "yaneuraou" ? 300_000 : 20_000;
    const n = rec.moves.length;
    const a = rec.analysis ?? { nodes, evals: [], done: false };
    while (a.evals.length < n + 1) a.evals.push(null);
    rec.analysis = a;
    const pos = Position.fromSfen(rec.startSfen);
    const moves = rec.moves.map(usiToMove);
    for (let k = 0; k <= n; k++) {
      if (k > 0) pos.doMove(moves[k - 1]);
      if (a.evals[k]) continue;
      if (this.paused) { this.queue.unshift(id); return; }
      let e: PosEval;
      if (!pos.hasLegalMove()) e = { score: -MATE_SCORE, best: "", pv: [] };
      else {
        const position = toUsiPosition(rec.startSfen, moves.slice(0, k)).replace(/^position /, "");
        const r = await analysisEngine().analyze({ position, multipv: 2, nodes });
        const c = r.candidates;
        e = c.length
          ? { score: c[0].score, best: c[0].move, pv: c[0].pv.slice(0, 12), second: c[1]?.score }
          : { score: 0, best: r.bestmove, pv: [r.bestmove] };
      }
      a.evals[k] = e;
      await saveGame(rec);
      for (const f of this.listeners) f(id, rec);
    }
    a.done = true;
    await saveGame(rec);
    for (const f of this.listeners) f(id, rec);
  }
}

export const analysis = new AnalysisManager();
