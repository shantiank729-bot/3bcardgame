/** 年ごとの推移グラフ（SVG・依存なし） */
export function LineChart({ points, label, fmt = (v: number) => v.toFixed(1), refLine }: {
  points: { x: number; y: number }[]; label: string; fmt?: (v: number) => string; refLine?: number;
}) {
  const W = 320, H = 140, P = 28;
  if (points.length === 0) return <p class="muted">データがありません</p>;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  if (refLine !== undefined) ys.push(refLine);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const sx = (x: number) => (x1 === x0 ? W / 2 : P + ((x - x0) / (x1 - x0)) * (W - 2 * P));
  const sy = (y: number) => H - P + 8 - ((y - lo) / (hi - lo)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x)},${sy(p.y)}`).join(' ');
  return (
    <figure class="chart">
      <figcaption>{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
        {refLine !== undefined && <line x1={P} x2={W - P} y1={sy(refLine)} y2={sy(refLine)} class="ref" />}
        <path d={d} class="line" />
        {points.map((p) => (
          <g key={p.x}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="4" class="dot" />
            <text x={sx(p.x)} y={sy(p.y) - 8} text-anchor="middle" class="val">{fmt(p.y)}</text>
            <text x={sx(p.x)} y={H - 4} text-anchor="middle" class="ax">{p.x}</text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
