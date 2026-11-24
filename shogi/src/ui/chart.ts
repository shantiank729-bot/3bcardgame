// レーティング推移の折れ線グラフ（1系列。凡例なし・タイトルが系列名）。ホバー/タップで値を表示。
import { el } from "./dom";

export interface Point { x: number; y: number; label: string }

const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag: string, attrs: Record<string, string | number>) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

/**
 * @param gridLines y 方向の目盛り（値とラベル）
 */
export function lineChart(points: Point[], gridLines: (min: number, max: number) => { y: number; label: string }[], height = 200): HTMLElement {
  const wrap = el("div", { class: "chart" });
  const tip = el("div", { class: "chart-tip hidden" });
  wrap.append(tip);
  const draw = () => {
    wrap.querySelector("svg")?.remove();
    const W = Math.max(280, wrap.clientWidth || 340), H = height;
    const pad = { l: 44, r: 12, t: 10, b: 22 };
    const ys = points.map((p) => p.y);
    let min = Math.min(...ys), max = Math.max(...ys);
    if (max - min < 200) { const c = (max + min) / 2; min = c - 100; max = c + 100; }
    min -= 30; max += 30;
    const xMax = Math.max(1, points.length - 1);
    const X = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / xMax;
    const Y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - min) / (max - min));
    const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "レーティングの推移" }) as SVGSVGElement;
    for (const g of gridLines(min, max)) {
      svg.append(svgEl("line", { x1: pad.l, x2: W - pad.r, y1: Y(g.y), y2: Y(g.y), class: "grid-line" }));
      const t = svgEl("text", { x: pad.l - 6, y: Y(g.y) + 4, "text-anchor": "end", class: "axis-label" });
      t.textContent = g.label;
      svg.append(t);
    }
    const xl = svgEl("text", { x: W - pad.r, y: H - 4, "text-anchor": "end", class: "axis-label" });
    xl.textContent = `${points.length - 1}局`;
    svg.append(xl);
    const d = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
    svg.append(svgEl("path", { d, class: "series-line" }));
    const last = points[points.length - 1];
    svg.append(svgEl("circle", { cx: X(points.length - 1), cy: Y(last.y), r: 4, class: "series-dot" }));
    const cross = svgEl("line", { y1: pad.t, y2: H - pad.b, class: "crosshair hidden" });
    const dot = svgEl("circle", { r: 5, class: "series-dot hover hidden" });
    svg.append(cross, dot);
    const move = (clientX: number) => {
      const r = svg.getBoundingClientRect();
      const i = Math.round(((clientX - r.left - pad.l) / (W - pad.l - pad.r)) * xMax);
      const k = Math.max(0, Math.min(points.length - 1, i));
      const p = points[k];
      cross.setAttribute("x1", String(X(k))); cross.setAttribute("x2", String(X(k)));
      dot.setAttribute("cx", String(X(k))); dot.setAttribute("cy", String(Y(p.y)));
      cross.classList.remove("hidden"); dot.classList.remove("hidden");
      tip.textContent = p.label;
      tip.classList.remove("hidden");
      const tx = Math.min(W - 150, Math.max(0, X(k) - 70));
      tip.style.left = `${tx}px`;
    };
    svg.addEventListener("pointermove", (e) => move(e.clientX));
    svg.addEventListener("pointerdown", (e) => move(e.clientX));
    svg.addEventListener("pointerleave", () => { cross.classList.add("hidden"); dot.classList.add("hidden"); tip.classList.add("hidden"); });
    wrap.append(svg);
  };
  requestAnimationFrame(draw);
  return wrap;
}
