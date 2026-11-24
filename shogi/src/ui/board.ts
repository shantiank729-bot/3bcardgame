import { PIECE_CHAR } from "../core/kif";
import { Position } from "../core/position";
import {
  BLACK, Color, HAND_TYPES, Move, WHITE, fileOf, isPromoted, pieceColor, pieceType, promoteType, rankOf, sqOf,
} from "../core/types";
import { el } from "./dom";

export interface Arrow { from: number; to: number; drop?: number; color?: string }

export interface BoardState {
  pos: Position;
  lastMove?: Move | null;
  /** 盤を反転（後手が下） */
  flipped?: boolean;
  /** 人が操作できる手番。null なら操作不可 */
  movable?: Color | null;
  arrows?: Arrow[];
  /** 特定のマスを強調（振り返りの印など） */
  marks?: Record<number, string>;
}

type Sel = { kind: "board"; sq: number } | { kind: "hand"; type: number } | null;

const KAN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];

/** 盤＋両者の持ち駒。タップ（とドラッグ）で指し手を作る。 */
export class BoardView {
  readonly root: HTMLElement;
  readonly topHand: HTMLElement;
  readonly bottomHand: HTMLElement;
  private grid: HTMLElement;
  private svg: SVGSVGElement;
  private cells: HTMLElement[] = [];
  private state!: BoardState;
  private sel: Sel = null;
  private legal: Move[] = [];
  private drag: { ghost: HTMLElement; startX: number; startY: number; moved: boolean; sel: Sel } | null = null;
  onMove: (m: Move) => void = () => {};
  /** 持ち駒の行の右端に置く要素（名前・時計など）。色ごと */
  info: [HTMLElement | null, HTMLElement | null] = [null, null];

  constructor() {
    this.topHand = el("div", { class: "hand top" });
    this.bottomHand = el("div", { class: "hand bottom" });
    this.grid = el("div", { class: "grid" });
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "arrows");
    this.svg.setAttribute("viewBox", "0 0 9 9");
    for (let i = 0; i < 81; i++) {
      const c = el("div", { class: "cell" });
      c.dataset.i = String(i);
      this.cells.push(c);
      this.grid.append(c);
    }
    const files = el("div", { class: "coords files" }, ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => el("span", {}, String(n))));
    const ranks = el("div", { class: "coords ranks" }, ...KAN.slice(1).map((k) => el("span", {}, k)));
    const boardWrap = el("div", { class: "board" }, files, el("div", { class: "board-inner" }, this.grid, this.svg), ranks);
    this.root = el("div", { class: "board-view" }, this.topHand, boardWrap, this.bottomHand);
    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    window.addEventListener("pointermove", (e) => this.onPointerMove(e));
    window.addEventListener("pointerup", (e) => this.onPointerUp(e));
  }

  set(state: BoardState) {
    this.state = state;
    this.legal = state.movable != null && state.pos.turn === state.movable ? state.pos.legalMoves() : [];
    if (this.sel && !this.legal.length) this.sel = null;
    this.render();
  }

  clearSelection() { this.sel = null; this.render(); }

  /** 画面上の index（0=左上）→ sq */
  private idxToSq(i: number) { return this.state.flipped ? 80 - i : i; }
  private sqToIdx(sq: number) { return this.state.flipped ? 80 - sq : sq; }

  private targets(): Set<number> {
    const s = new Set<number>();
    const sel = this.sel;
    if (!sel) return s;
    for (const m of this.legal) {
      if (sel.kind === "board" && m.from === sel.sq) s.add(m.to);
      if (sel.kind === "hand" && m.from < 0 && m.drop === sel.type) s.add(m.to);
    }
    return s;
  }

  private render() {
    const { pos, lastMove, flipped, marks } = this.state;
    const tg = this.targets();
    const checkSq = pos.inCheck() ? pos.kingSq[pos.turn] : -1;
    for (let i = 0; i < 81; i++) {
      const sq = this.idxToSq(i);
      const c = this.cells[i];
      const pc = pos.board[sq];
      c.className = "cell";
      if (lastMove && lastMove.to === sq) c.classList.add("last");
      if (lastMove && lastMove.from === sq) c.classList.add("last-from");
      if (this.sel?.kind === "board" && this.sel.sq === sq) c.classList.add("selected");
      if (tg.has(sq)) c.classList.add(pc ? "target-capture" : "target");
      if (sq === checkSq) c.classList.add("check");
      if (marks?.[sq]) c.classList.add("mark-" + marks[sq]);
      c.replaceChildren();
      if (pc) c.append(pieceEl(pieceType(pc), (pieceColor(pc) === WHITE) !== !!flipped));
    }
    const bottom: Color = flipped ? WHITE : BLACK;
    this.renderHand(this.bottomHand, bottom, false);
    this.renderHand(this.topHand, (bottom ^ 1) as Color, true);
    this.renderArrows();
  }

  private renderHand(container: HTMLElement, c: Color, top: boolean) {
    const { pos } = this.state;
    const mark = el("span", { class: "hand-mark" }, c === BLACK ? "☗" : "☖");
    const items: HTMLElement[] = [];
    for (const t of HAND_TYPES) {
      const n = pos.hands[c][t];
      if (!n) continue;
      const it = el("div", { class: "hand-piece" }, pieceEl(t, top));
      it.dataset.hand = String(t);
      it.dataset.color = String(c);
      if (n > 1) it.append(el("span", { class: "count" }, String(n)));
      if (this.sel?.kind === "hand" && this.sel.type === t && pos.turn === c) it.classList.add("selected");
      items.push(it);
    }
    if (!items.length) items.push(el("span", { class: "hand-empty" }, "持ち駒なし"));
    const info = this.info[c];
    container.replaceChildren(mark, ...items, ...(info ? [info] : []));
    container.classList.toggle("to-move", pos.turn === c);
  }

  private renderArrows() {
    const arrows = this.state.arrows ?? [];
    const ns = "http://www.w3.org/2000/svg";
    this.svg.replaceChildren();
    const defs = document.createElementNS(ns, "defs");
    defs.innerHTML = `<marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="context-stroke"/></marker>`;
    this.svg.append(defs);
    for (const a of arrows) {
      const ti = this.sqToIdx(a.to);
      const tx = (ti % 9) + 0.5, ty = Math.floor(ti / 9) + 0.5;
      let fx: number, fy: number;
      if (a.from >= 0) { const fi = this.sqToIdx(a.from); fx = (fi % 9) + 0.5; fy = Math.floor(fi / 9) + 0.5; }
      else { fx = tx; fy = this.state.flipped ? -0.6 : 9.6; }
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(fx)); line.setAttribute("y1", String(fy));
      line.setAttribute("x2", String(tx)); line.setAttribute("y2", String(ty));
      line.setAttribute("stroke", a.color ?? "rgba(30,120,255,.75)");
      line.setAttribute("stroke-width", "0.18");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("marker-end", "url(#ah)");
      this.svg.append(line);
    }
  }

  // ---- 操作 ----
  private hitTest(x: number, y: number): { kind: "cell"; sq: number } | { kind: "hand"; type: number; color: Color } | null {
    const t = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!t) return null;
    const cell = t.closest<HTMLElement>(".cell");
    if (cell && this.root.contains(cell)) return { kind: "cell", sq: this.idxToSq(Number(cell.dataset.i)) };
    const hp = t.closest<HTMLElement>(".hand-piece");
    if (hp && this.root.contains(hp)) return { kind: "hand", type: Number(hp.dataset.hand), color: Number(hp.dataset.color) as Color };
    return null;
  }

  private onPointerDown(e: PointerEvent) {
    if (!this.legal.length) return;
    const hit = this.hitTest(e.clientX, e.clientY);
    if (!hit) return;
    const { pos } = this.state;
    const us = pos.turn;
    // 既に選択中で移動先をタップ
    if (this.sel && hit.kind === "cell" && this.targets().has(hit.sq)) {
      this.tryMove(hit.sq);
      return;
    }
    let newSel: Sel = null;
    if (hit.kind === "cell") {
      const pc = pos.board[hit.sq];
      if (pc && pieceColor(pc) === us) newSel = { kind: "board", sq: hit.sq };
    } else if (hit.color === us) newSel = { kind: "hand", type: hit.type };
    if (!newSel) { this.sel = null; this.render(); return; }
    const same = JSON.stringify(newSel) === JSON.stringify(this.sel);
    this.sel = same ? null : newSel;
    this.render();
    if (!same) {
      e.preventDefault();
      const sel = this.sel!;
      const src = sel.kind === "board"
        ? this.cells[this.sqToIdx(sel.sq)].querySelector<HTMLElement>(".piece")
        : this.root.querySelector<HTMLElement>(`.hand-piece[data-hand="${sel.type}"][data-color="${us}"] .piece`);
      if (src) {
        const ghost = src.cloneNode(true) as HTMLElement;
        ghost.classList.add("ghost");
        const r = src.getBoundingClientRect();
        ghost.style.width = r.width + "px";
        ghost.style.height = r.height + "px";
        this.drag = { ghost, startX: e.clientX, startY: e.clientY, moved: false, sel: this.sel };
      }
    }
  }

  private onPointerMove(e: PointerEvent) {
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return;
    if (!d.moved) { d.moved = true; document.body.append(d.ghost); }
    d.ghost.style.left = e.clientX + "px";
    d.ghost.style.top = e.clientY + "px";
  }

  private onPointerUp(e: PointerEvent) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    d.ghost.remove();
    if (!d.moved) return;
    const hit = this.hitTest(e.clientX, e.clientY);
    if (hit?.kind === "cell" && this.targets().has(hit.sq)) this.tryMove(hit.sq);
  }

  private async tryMove(to: number) {
    const sel = this.sel;
    if (!sel) return;
    const cands = this.legal.filter((m) =>
      m.to === to && (sel.kind === "board" ? m.from === sel.sq : m.from < 0 && m.drop === sel.type));
    if (!cands.length) return;
    let m = cands[0];
    if (cands.length > 1) {
      const t = pieceType(this.state.pos.board[(cands[0] as Move).from]);
      const promote = await askPromotion(t, this.state.pos.turn !== (this.state.flipped ? WHITE : BLACK));
      if (promote === null) return;
      m = cands.find((x) => x.promote === promote)!;
    }
    this.sel = null;
    this.onMove(m);
  }
}

export function pieceEl(t: number, rotated: boolean): HTMLElement {
  const p = el("div", { class: "piece" + (rotated ? " gote" : "") + (isPromoted(t) ? " promoted" : "") + (t === 8 ? " king" : "") });
  const ch = PIECE_CHAR[t];
  p.append(el("span", {}, ch));
  return p;
}

/** 成る/成らないの確認。キャンセルで null */
export function askPromotion(t: number, rotated: boolean): Promise<boolean | null> {
  return new Promise((resolve) => {
    const close = (v: boolean | null) => { overlay.remove(); resolve(v); };
    const pro = el("button", { class: "promo-btn" }, pieceEl(promoteType(t), rotated), el("div", {}, "成る"));
    const non = el("button", { class: "promo-btn" }, pieceEl(t, rotated), el("div", {}, "成らない"));
    pro.onclick = () => close(true);
    non.onclick = () => close(false);
    const overlay = el("div", { class: "overlay" }, el("div", { class: "dialog promo" }, el("p", {}, "成りますか？"), el("div", { class: "row" }, pro, non)));
    overlay.onclick = (e) => { if (e.target === overlay) close(null); };
    document.body.append(overlay);
  });
}

export const sqName = (sq: number) => `${fileOf(sq)}${KAN[rankOf(sq)]}`;
export { sqOf };
