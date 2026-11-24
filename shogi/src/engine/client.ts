// メインスレッド側のエンジン窓口。Worker に依頼して結果を Promise で受け取る。
import type { WorkerIn, WorkerOut } from "./engine.worker";
import { AnalyzeRequest, AnalyzeResult, Candidate } from "./usi";

export type EngineKind = "yaneuraou" | "fallback";

export class EngineClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, { resolve: (r: AnalyzeResult) => void; reject: (e: Error) => void; onUpdate?: (c: Candidate[]) => void }>();
  readonly ready: Promise<{ kind: EngineKind; error?: string }>;

  constructor(threads = 1, hashMb = 64) {
    this.worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
    this.ready = new Promise((resolve) => {
      this.worker.addEventListener("message", (e: MessageEvent<WorkerOut>) => {
        const m = e.data;
        if (m.type === "ready") resolve({ kind: m.kind, error: m.error });
        else if (m.type === "update") this.pending.get(m.id)?.onUpdate?.(m.candidates);
        else if (m.type === "result") { this.pending.get(m.id)?.resolve(m.result); this.pending.delete(m.id); }
        else if (m.type === "error") { this.pending.get(m.id)?.reject(new Error(m.message)); this.pending.delete(m.id); }
      });
    });
    const base = new URL("engine/", document.baseURI).href;
    this.send({ type: "init", base, threads, hashMb });
  }

  private send(m: WorkerIn) { this.worker.postMessage(m); }

  async analyze(req: AnalyzeRequest, onUpdate?: (c: Candidate[]) => void): Promise<AnalyzeResult> {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onUpdate });
      this.send({ type: "analyze", id, req });
    });
  }

  stop() { this.send({ type: "stop" }); }

  terminate() {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error("エンジンを終了しました"));
    this.pending.clear();
  }
}

let shared: EngineClient | null = null;
/** 対局用の共有エンジン（1スレッド。レベルの探索量を一定にするため） */
export function playEngine(): EngineClient {
  shared ??= new EngineClient(1, 64);
  return shared;
}
