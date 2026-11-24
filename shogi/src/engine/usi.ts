// USI エンジンとのやりとり（環境に依存しない部分）。ブラウザの Worker と Node の両方で使う。

export const MATE_SCORE = 30000;

export interface Candidate {
  /** USI 形式の指し手 */
  move: string;
  /** 手番側から見た評価値（センチポーン）。詰みは ±(30000 - 手数) */
  score: number;
  /** 詰みまでの手数（あれば。正: 勝ち、負: 負け） */
  mate?: number;
  pv: string[];
  depth: number;
}

export interface AnalyzeRequest {
  /** 「position ...」の後ろ（startpos moves ... / sfen ... moves ...） */
  position: string;
  multipv?: number;
  nodes?: number;
  depth?: number;
  movetime?: number;
}

export interface AnalyzeResult {
  bestmove: string;
  candidates: Candidate[];
  nodes: number;
}

export interface LineTransport {
  send(line: string): void;
  onLine(cb: (line: string) => void): void;
}

export function parseInfo(line: string): (Candidate & { multipv: number; nodes: number }) | null {
  if (!line.startsWith("info ") || !line.includes(" pv ")) return null;
  const tok = line.split(" ");
  let depth = 0, multipv = 1, nodes = 0, score = 0, mate: number | undefined;
  let pv: string[] = [];
  for (let i = 1; i < tok.length; i++) {
    const t = tok[i];
    if (t === "depth") depth = Number(tok[++i]);
    else if (t === "multipv") multipv = Number(tok[++i]);
    else if (t === "nodes") nodes = Number(tok[++i]);
    else if (t === "score") {
      const kind = tok[++i], v = tok[++i];
      if (kind === "cp") score = Number(v);
      else if (kind === "mate") {
        // 「mate +」「mate -」のように手数が不明な形式もある
        const win = !v.startsWith("-");
        const n = Math.abs(Number(v.replace(/^[+-]/, "")) || 0);
        mate = win ? n : -n;
        score = win ? MATE_SCORE - n : -(MATE_SCORE - n);
      }
    } else if (t === "pv") { pv = tok.slice(i + 1); break; }
  }
  if (!pv.length) return null;
  return { move: pv[0], score, mate, pv, depth, multipv, nodes };
}

/** 1つのエンジンを順番に使うためのラッパー */
export class UsiEngine {
  private listeners: ((l: string) => void)[] = [];
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private t: LineTransport) {
    t.onLine((l) => { for (const f of [...this.listeners]) f(l); });
  }

  private waitFor(pred: (l: string) => boolean, onLine?: (l: string) => void): Promise<string> {
    return new Promise((resolve) => {
      const f = (l: string) => {
        onLine?.(l);
        if (pred(l)) {
          this.listeners = this.listeners.filter((x) => x !== f);
          resolve(l);
        }
      };
      this.listeners.push(f);
    });
  }

  async init(options: Record<string, string | number>) {
    const ok = this.waitFor((l) => l === "usiok");
    this.t.send("usi");
    await ok;
    for (const [k, v] of Object.entries(options)) this.t.send(`setoption name ${k} value ${v}`);
    const ready = this.waitFor((l) => l === "readyok");
    this.t.send("isready");
    await ready;
    this.t.send("usinewgame");
  }

  setOption(name: string, value: string | number) {
    this.t.send(`setoption name ${name} value ${value}`);
  }

  /** 探索して候補手（MultiPV）を返す。呼び出しは直列化される */
  analyze(req: AnalyzeRequest, onUpdate?: (c: Candidate[]) => void): Promise<AnalyzeResult> {
    const run = async (): Promise<AnalyzeResult> => {
      const multipv = req.multipv ?? 1;
      this.t.send(`setoption name MultiPV value ${multipv}`);
      this.t.send(`position ${req.position}`);
      const lines = new Map<number, Candidate>();
      let nodes = 0;
      const done = this.waitFor((l) => l.startsWith("bestmove"), (l) => {
        const info = parseInfo(l);
        if (!info) return;
        nodes = Math.max(nodes, info.nodes);
        const { multipv: k, nodes: _n, ...c } = info;
        void _n;
        lines.set(k, c);
        onUpdate?.(sorted());
      });
      const sorted = () => [...lines.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
      let go = "go";
      if (req.nodes) go += ` nodes ${req.nodes}`;
      if (req.depth) go += ` depth ${req.depth}`;
      if (req.movetime) go += ` movetime ${req.movetime}`;
      if (go === "go") go += " infinite";
      this.t.send(go);
      const bm = (await done).split(" ")[1];
      // 同じ指し手が複数の multipv に入ることがあるので重複を除く
      const seen = new Set<string>();
      const candidates = sorted().filter((c) => (seen.has(c.move) ? false : (seen.add(c.move), true)));
      candidates.sort((a, b) => b.score - a.score);
      // 探索量がとても少ないと読み筋（info）が出ないことがあるので、bestmove だけでも候補にする
      if (!candidates.length && bm && bm !== "resign" && bm !== "win") candidates.push({ move: bm, score: 0, pv: [bm], depth: 0 });
      return { bestmove: bm, candidates, nodes };
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  stop() { this.t.send("stop"); }
}
