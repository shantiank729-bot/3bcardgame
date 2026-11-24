/// <reference lib="webworker" />
// エンジン用 Web Worker。やねうら王（マルチスレッド wasm）が使えればそれを、だめなら簡易エンジンを使う。
import { fallbackAnalyze } from "./fallback";
import { AnalyzeRequest, AnalyzeResult, Candidate, UsiEngine } from "./usi";

declare const self: DedicatedWorkerGlobalScope & { YaneuraOu_K_P?: (opts: object) => Promise<YModule> };
interface YModule { postMessage(l: string): void; addMessageListener(cb: (l: string) => void): void; terminate(): void }

export type WorkerIn =
  | { type: "init"; base: string; threads: number; hashMb: number }
  | { type: "analyze"; id: number; req: AnalyzeRequest }
  | { type: "stop" }
  | { type: "option"; name: string; value: string | number };
export type WorkerOut =
  | { type: "ready"; kind: "yaneuraou" | "fallback"; error?: string }
  | { type: "update"; id: number; candidates: Candidate[] }
  | { type: "result"; id: number; result: AnalyzeResult }
  | { type: "error"; id: number; message: string };

let engine: UsiEngine | null = null;
const post = (m: WorkerOut) => self.postMessage(m);

async function init(base: string, threads: number, hashMb: number) {
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    post({ type: "ready", kind: "fallback", error: "SharedArrayBuffer が使えません" });
    return;
  }
  try {
    self.importScripts(base + "yaneuraou.k-p.js");
    const m = await self.YaneuraOu_K_P!({
      locateFile: (f: string) => base + f,
      mainScriptUrlOrBlob: base + "yaneuraou.k-p.js",
    });
    engine = new UsiEngine({ send: (l) => m.postMessage(l), onLine: (cb) => m.addMessageListener(cb) });
    await engine.init({ Threads: threads, USI_Hash: hashMb, BookFile: "no_book", PvInterval: 0, MaxMovesToDraw: 0, EnteringKingRule: "CSARule27" });
    post({ type: "ready", kind: "yaneuraou" });
  } catch (e) {
    engine = null;
    post({ type: "ready", kind: "fallback", error: String(e) });
  }
}

self.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type === "init") await init(msg.base, msg.threads, msg.hashMb);
  else if (msg.type === "stop") engine?.stop();
  else if (msg.type === "option") engine?.setOption(msg.name, msg.value);
  else if (msg.type === "analyze") {
    try {
      const result = engine
        ? await engine.analyze(msg.req, (c) => post({ type: "update", id: msg.id, candidates: c }))
        : fallbackAnalyze(msg.req);
      post({ type: "result", id: msg.id, result });
    } catch (e) {
      post({ type: "error", id: msg.id, message: String(e) });
    }
  }
};
