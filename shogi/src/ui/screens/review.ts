// 対局後の振り返り: 解析（裏で進行）・形勢グラフ・悪手/疑問手/好手・最善手の読み筋の再生
import { MARK_LABEL, MARK_SYMBOL, MoveJudge, PosEval, blackScore, judgeMove, winProb } from "../../analysis/classify";
import { analysis } from "../../analysis/manager";
import { moveToDisplay } from "../../core/kif";
import { Position } from "../../core/position";
import { Color, Move } from "../../core/types";
import { moveToUsi, usiToMove } from "../../core/usi";
import { GameRecord, loadGame } from "../../db/records";
import { Arrow, BoardView } from "../board";
import { el } from "../dom";

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/** USI の手順を表示用の文字列に */
function pvText(pos: Position, pv: string[], limit = 8): string {
  const p = pos.clone();
  const out: string[] = [];
  let prevTo: number | null = null;
  for (const u of pv.slice(0, limit)) {
    let m: Move;
    try { m = usiToMove(u); } catch { break; }
    if (!p.isLegal(m)) break;
    out.push(moveToDisplay(p, m, prevTo));
    prevTo = m.to;
    p.doMove(m);
  }
  return out.join(" ");
}

export function mountReview(root: HTMLElement, arg?: string) {
  const id = Number(arg);
  const screen = el("div", { class: "screen review" }, el("p", { class: "note" }, "読み込み中…"));
  root.replaceChildren(screen);
  let unsub: (() => void) | null = null;
  void (async () => {
    const rec = await loadGame(id);
    if (!rec) { screen.replaceChildren(el("p", {}, "対局が見つかりません。"), el("a", { href: "#/records" }, "記録に戻る")); return; }
    unsub = startReview(screen, rec);
  })();
  return () => unsub?.();
}

function startReview(screen: HTMLElement, rec: GameRecord): () => void {
  const moves = rec.moves.map(usiToMove);
  const n = moves.length;
  const startTurn = (rec.startSfen.split(" ")[1] === "w" ? 1 : 0) as Color;
  const me: Color = rec.humanColor ?? 0;
  const positions: Position[] = [];
  {
    const p = Position.fromSfen(rec.startSfen);
    positions.push(p.clone());
    for (const m of moves) { p.doMove(m); positions.push(p.clone()); }
  }
  // 各手を指したのはどちらか
  const moverOf = (k: number) => ((startTurn + k - 1) % 2) as Color;
  let evals: (PosEval | null)[] = rec.analysis?.evals ?? [];
  let judges: (MoveJudge | null)[] = [];
  let ply = n;
  let variation: { base: number; pv: Move[]; step: number } | null = null;

  const board = new BoardView();
  const title = el("div", { class: "review-title" });
  const progress = el("div", { class: "note" });
  const graph = el("div", { class: "eval-graph" });
  const info = el("div", { class: "review-info" });
  const nav = el("div", { class: "review-nav" });
  const list = el("div", { class: "review-moves" });
  screen.replaceChildren(title, board.root, graph, nav, info, progress, list);

  const resultText = (() => {
    const r = rec.result;
    if (rec.humanColor === null) return r.winner === null ? `${r.reason}で引き分け` : `${r.reason}で${r.winner === 0 ? "先手" : "後手"}の勝ち`;
    return r.winner === null ? `${r.reason}で引き分け` : r.winner === rec.humanColor ? `${r.reason}であなたの勝ち` : `${r.reason}であなたの負け`;
  })();
  title.replaceChildren(el("h2", {}, "振り返り"), el("div", { class: "note" }, `☗${rec.names[0]} 対 ☖${rec.names[1]}・${n}手・${resultText}`));

  const btn = (label: string, f: () => void, cls = "btn") => { const b = el("button", { class: cls }, label); b.onclick = f; return b; };

  function recompute() {
    judges = [null];
    for (let k = 1; k <= n; k++) judges.push(judgeMove(evals, k, rec.moves[k - 1]));
  }

  function nextMistake(dir: 1 | -1) {
    const isMistake = (k: number) => moverOf(k) === me && (judges[k]?.mark === "bad" || judges[k]?.mark === "dubious");
    // 端まで行ったら反対側から探す
    for (let i = 1; i <= n; i++) {
      const k = ((ply - 1 + dir * i) % n + n) % n + 1;
      if (isMistake(k)) { go(k); return; }
    }
  }

  function go(k: number) {
    variation = null;
    ply = Math.max(0, Math.min(n, k));
    render();
  }

  function render() {
    // 盤
    if (variation) {
      const p = positions[variation.base].clone();
      for (let i = 0; i < variation.step; i++) p.doMove(variation.pv[i]);
      board.set({ pos: p, lastMove: variation.step ? variation.pv[variation.step - 1] : null, flipped: me === 1, movable: null });
    } else {
      const arrows: Arrow[] = [];
      const e = evals[ply];
      if (e?.best && ply < n + 1) {
        try { const m = usiToMove(e.best); arrows.push({ from: m.from, to: m.to, drop: m.drop }); } catch { /* 無視 */ }
      }
      const marks: Record<number, string> = {};
      const j = judges[ply];
      if (ply > 0 && j?.mark) marks[moves[ply - 1].to] = j.mark === "good" ? "good" : "bad";
      board.set({ pos: positions[ply], lastMove: ply ? moves[ply - 1] : null, flipped: me === 1, movable: null, arrows, marks });
    }
    renderGraph();
    renderInfo();
    renderNav();
    renderList();
    const done = evals.filter(Boolean).length;
    progress.textContent = rec.analysis?.done ? "解析済み" : `解析中… ${done}/${n + 1}局面（終わった所から表示します）`;
  }

  function renderNav() {
    if (variation) {
      const v = variation;
      nav.replaceChildren(
        btn("◀", () => { v.step = Math.max(0, v.step - 1); render(); }),
        btn("▶", () => { v.step = Math.min(v.pv.length, v.step + 1); render(); }),
        btn("読み筋を終わる", () => { variation = null; render(); }, "btn primary"),
      );
      return;
    }
    nav.replaceChildren(
      btn("⏮", () => go(0)), btn("◀", () => go(ply - 1)), btn("▶", () => go(ply + 1)), btn("⏭", () => go(n)),
      btn("前の悪手", () => nextMistake(-1), "btn small"), btn("次の悪手", () => nextMistake(1), "btn small"),
    );
  }

  function renderInfo() {
    if (variation) {
      const v = variation;
      const base = positions[v.base];
      info.replaceChildren(
        el("div", { class: "info-head" }, `${v.base + 1}手目の最善手の読み筋（${v.step}/${v.pv.length}）`),
        el("div", { class: "pv" }, pvText(base, v.pv.map(moveToUsi), 20)),
      );
      return;
    }
    const parts: HTMLElement[] = [];
    if (ply === 0) parts.push(el("div", { class: "info-head" }, "開始局面"));
    else {
      const prev = positions[ply - 1];
      const mv = moveToDisplay(prev, moves[ply - 1], ply > 1 ? moves[ply - 2].to : null);
      const j = judges[ply];
      const who = moverOf(ply) === me && rec.humanColor !== null ? "（あなた）" : "";
      const head = el("div", { class: "info-head" }, `${ply}手目 ${mv}${who}`);
      if (j?.mark) head.append(el("span", { class: `mark ${j.mark}` }, ` ${MARK_SYMBOL[j.mark]} ${MARK_LABEL[j.mark]}`));
      parts.push(head);
      if (j) parts.push(el("div", { class: "note" }, `指した側の勝率 ${Math.round(j.before * 100)}% → ${Math.round(j.after * 100)}%`));
      const pe = evals[ply - 1];
      if (pe?.best && pe.best !== rec.moves[ply - 1]) {
        const bestTxt = pvText(prev, [pe.best], 1);
        parts.push(el("div", {}, `最善手: ${bestTxt}`));
        parts.push(el("div", { class: "pv note" }, `読み筋: ${pvText(prev, pe.pv)}`));
        if (j && (j.mark === "bad" || j.mark === "dubious")) {
          parts.push(btn("最善手と読み筋を盤で再生", () => {
            const pv: Move[] = [];
            const p = prev.clone();
            for (const u of pe.pv) { const m = usiToMove(u); if (!p.isLegal(m)) break; pv.push(m); p.doMove(m); }
            variation = { base: ply - 1, pv, step: 1 };
            render();
          }, "btn primary small"));
        }
      } else if (pe?.best) parts.push(el("div", { class: "note" }, "最善手と同じ手です。"));
    }
    const e = evals[ply];
    if (e) {
      const bs = blackScore(evals, ply, startTurn)!;
      const mine = me === 0 ? bs : -bs;
      parts.push(el("div", { class: "note" }, `評価値（${rec.humanColor === null ? "先手" : "あなた"}から見て）: ${fmtScore(mine)}`));
      if (e.best) parts.push(el("div", { class: "note" }, `この局面の最善手（青い矢印）: ${pvText(positions[ply], [e.best], 1)}`));
    } else if (ply <= n) parts.push(el("div", { class: "note" }, "この局面はまだ解析中です。"));
    info.replaceChildren(...parts);
  }

  function renderList() {
    const items: HTMLElement[] = [];
    let prevTo: number | null = null;
    for (let k = 1; k <= n; k++) {
      const txt = moveToDisplay(positions[k - 1], moves[k - 1], prevTo);
      prevTo = moves[k - 1].to;
      const j = judges[k];
      const it = el("button", { class: "rv-move" + (k === ply ? " current" : "") + (moverOf(k) === me ? " mine" : "") }, `${k} ${txt}`);
      if (j?.mark) it.append(el("span", { class: `mark ${j.mark}` }, ` ${MARK_SYMBOL[j.mark]}`));
      it.onclick = () => go(k);
      items.push(it);
    }
    list.replaceChildren(...items);
    list.querySelector(".current")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function renderGraph() {
    const W = Math.max(280, graph.clientWidth || 340), H = 120;
    const pad = { l: 34, r: 8, t: 8, b: 16 };
    const X = (k: number) => pad.l + ((W - pad.l - pad.r) * k) / Math.max(1, n);
    const Y = (p: number) => pad.t + (H - pad.t - pad.b) * (1 - p);
    const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "形勢グラフ" }) as SVGSVGElement;
    for (const [p, label] of [[1, "100%"], [0.5, "50%"], [0, "0%"]] as const) {
      svg.append(svgEl("line", { x1: pad.l, x2: W - pad.r, y1: Y(p), y2: Y(p), class: p === 0.5 ? "mid-line" : "grid-line" }));
      const t = svgEl("text", { x: pad.l - 4, y: Y(p) + 4, "text-anchor": "end", class: "axis-label" });
      t.textContent = label;
      svg.append(t);
    }
    // あなた（または先手）の勝率
    const pts: [number, number][] = [];
    for (let k = 0; k <= n; k++) {
      const bs = blackScore(evals, k, startTurn);
      if (bs === null) continue;
      pts.push([k, winProb(me === 0 ? bs : -bs)]);
    }
    if (pts.length > 1) {
      const d = pts.map(([k, p], i) => `${i ? "L" : "M"}${X(k).toFixed(1)},${Y(p).toFixed(1)}`).join(" ");
      const area = `${d} L${X(pts[pts.length - 1][0]).toFixed(1)},${Y(0.5)} L${X(pts[0][0]).toFixed(1)},${Y(0.5)} Z`;
      svg.append(svgEl("path", { d: area, class: "eval-area" }), svgEl("path", { d, class: "series-line" }));
    }
    // 悪手・疑問手の印（自分の手だけ）
    for (let k = 1; k <= n; k++) {
      const j = judges[k];
      if (!j?.mark || moverOf(k) !== me) continue;
      const p = j.after;
      const t = svgEl("text", { x: X(k), y: Y(p) + 4, "text-anchor": "middle", class: `graph-mark ${j.mark}` });
      t.textContent = MARK_SYMBOL[j.mark];
      svg.append(t);
    }
    svg.append(svgEl("line", { x1: X(ply), x2: X(ply), y1: pad.t, y2: H - pad.b, class: "cursor-line" }));
    graphGeom = { left: pad.l, width: W - pad.l - pad.r };
    graph.replaceChildren(el("div", { class: "graph-title" }, `${rec.humanColor === null ? "先手" : "あなた"}の勝率（タップでその局面へ）`), svg);
  }

  // グラフの操作は作り直されない外側の要素で受ける
  let graphGeom = { left: 0, width: 1 };
  const pick = (e: PointerEvent) => {
    const svg = graph.querySelector("svg");
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    go(Math.round(((e.clientX - r.left - graphGeom.left) / graphGeom.width) * n));
  };
  graph.addEventListener("pointerdown", (e) => { pick(e); try { graph.setPointerCapture(e.pointerId); } catch { /* 無視 */ } });
  graph.addEventListener("pointermove", (e) => { if (e.buttons) pick(e); });

  recompute();
  render();
  requestAnimationFrame(() => render());
  const unsub = analysis.subscribe((gid, r) => {
    if (gid !== rec.id) return;
    rec.analysis = r.analysis;
    evals = r.analysis?.evals ?? [];
    recompute();
    render();
  });
  if (!rec.analysis?.done && rec.id !== undefined) analysis.enqueue(rec.id, true);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") variation ? (variation.step = Math.max(0, variation.step - 1), render()) : go(ply - 1);
    if (e.key === "ArrowRight") variation ? (variation.step = Math.min(variation.pv.length, variation.step + 1), render()) : go(ply + 1);
  };
  window.addEventListener("keydown", onKey);
  return () => { unsub(); window.removeEventListener("keydown", onKey); };
}

function fmtScore(s: number): string {
  if (s >= 29000) return `詰みあり（${30000 - s}手）`;
  if (s <= -29000) return `詰まされる（${30000 + s}手）`;
  return (s > 0 ? "+" : "") + s;
}

