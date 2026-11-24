// 詰将棋の問題集（最初から入っている問題＋端末で生成した問題）と進み具合の保存
import { get, put } from "../db/db";
import { loadGames } from "../db/records";
import starter from "./pool.json";
import { TsumeProblem } from "./generate";
import { candidatesFromGame } from "./fromGame";
import { TsumeState, initialState } from "./progress";
import type { TsumeIn, TsumeOut } from "./tsume.worker";

interface Extra { key: "tsumePool"; problems: TsumeProblem[]; scannedGames: number[] }

export async function loadState(): Promise<TsumeState> {
  return (await get<TsumeState>("kv", "tsume")) ?? initialState();
}
export async function saveState(st: TsumeState) { await put("kv", st); }

async function loadExtra(): Promise<Extra> {
  return (await get<Extra>("kv", "tsumePool")) ?? { key: "tsumePool", problems: [], scannedGames: [] };
}

export async function loadPool(): Promise<TsumeProblem[]> {
  const extra = await loadExtra();
  const ids = new Set<string>();
  const out: TsumeProblem[] = [];
  for (const p of [...extra.problems, ...(starter as TsumeProblem[])]) if (!ids.has(p.id)) { ids.add(p.id); out.push(p); }
  return out;
}

let worker: Worker | null = null;
let reqId = 0;
type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
function runWorker(msg: WithoutId<TsumeIn>): Promise<TsumeProblem[]> {
  worker ??= new Worker(new URL("./tsume.worker.ts", import.meta.url), { type: "module" });
  const id = ++reqId;
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent<TsumeOut>) => {
      if (e.data.id !== id) return;
      worker!.removeEventListener("message", onMsg);
      resolve(e.data.problems);
    };
    worker!.addEventListener("message", onMsg);
    worker!.postMessage({ ...msg, id } as TsumeIn);
  });
}

let refilling = false;
/** 未出題の問題が少なくなったら裏で作り足す。対局の局面からも作る */
export async function refillInBackground(level: number) {
  if (refilling) return;
  refilling = true;
  try {
    const [st, pool, extra] = await Promise.all([loadState(), loadPool(), loadExtra()]);
    const seen = new Set(st.attempts.map((a) => a.pid));
    const added: TsumeProblem[] = [];
    // 自分の対局から
    const games = (await loadGames()).filter((g) => g.analysis?.done && g.id !== undefined && !extra.scannedGames.includes(g.id));
    for (const g of games) {
      const sfens = candidatesFromGame(g);
      if (sfens.length) added.push(...await runWorker({ type: "fromPositions", sfens }));
      extra.scannedGames.push(g.id!);
    }
    // 近い難しさで未出題が少なければ生成
    for (const len of [level, Math.min(7, level + 2)]) {
      const unseen = pool.filter((p) => p.length === len && !seen.has(p.id)).length;
      if (unseen < 12) added.push(...await runWorker({ type: "generate", length: len, count: 4, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 }));
    }
    const ids = new Set(pool.map((p) => p.id));
    extra.problems.push(...added.filter((p) => !ids.has(p.id)));
    await put("kv", extra);
  } finally {
    refilling = false;
  }
}
