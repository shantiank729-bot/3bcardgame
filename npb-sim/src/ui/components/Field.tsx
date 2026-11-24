import type { FieldPos, Park } from '../../engine/types';

/** 座標: 本塁(0,0)、単位はメートル、y がマイナス方向がセンター */
export type Pt = [number, number];
export const polar = (angleDeg: number, d: number): Pt => {
  const a = (angleDeg * Math.PI) / 180;
  return [d * Math.sin(a), -d * Math.cos(a)];
};
const B = 27.43 / Math.SQRT2;
export const BASES: Pt[] = [[0, 0], [B, -B], [0, -2 * B], [-B, -B], [0, 0]];

export function fenceDist(park: Park, angle: number) {
  const t = Math.min(1, Math.abs(angle) / 45);
  const side = angle < 0 ? park.lf : park.rf;
  return park.cf + (side - park.cf) * Math.pow(t, 1.4);
}

export function homePos(park: Park, pos: FieldPos): Pt {
  switch (pos) {
    case 'P': return [0, -18.4];
    case 'C': return [0, 3];
    case '1B': return polar(40, 29);
    case '2B': return polar(14, 40);
    case 'SS': return polar(-14, 40);
    case '3B': return polar(-40, 29);
    case 'LF': return polar(-27, fenceDist(park, -27) * 0.78);
    case 'CF': return polar(0, park.cf * 0.8);
    case 'RF': return polar(27, fenceDist(park, 27) * 0.78);
  }
}

/** 塁 from → to の走路上の位置（0〜1）。to=4 は本塁 */
export function runnerPath(from: number, to: number, t: number): Pt {
  const legs = Math.max(1, to - from);
  const x = Math.min(legs, Math.max(0, t * legs));
  const i = Math.min(legs - 1, Math.floor(x));
  const f = x - i;
  const a = BASES[from + i], b = BASES[from + i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export interface RunnerAnim {
  id: number;
  label: string;
  from: number;
  to: number; // 1〜4
  out: boolean;
}

export interface FieldAnim {
  ball?: { to: Pt; kind: 'GB' | 'LD' | 'FB' | 'IFFB' | 'HR' | 'BUNT'; caught: boolean };
  fielder?: { pos: FieldPos; to: Pt };
  runners: RunnerAnim[];
  caption?: string;
  captionCls?: string;
}

export interface FieldProps {
  park: Park;
  defColor: string;
  defColor2: string;
  offColor: string;
  offColor2: string;
  /** 静止状態の走者（塁1〜3の表示ラベル）*/
  bases: (string | null)[];
  batterSide: 'L' | 'R' | null;
  anim: FieldAnim | null;
  t: number;
  theme?: 'pro' | 'koshien';
  defLabels?: Partial<Record<FieldPos, string>>;
}

const POSITIONS: FieldPos[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : 1 - (1 - x) * (1 - x));

export function Field(p: FieldProps) {
  const { park, anim, t } = p;
  // 外野フェンス
  const fence: Pt[] = [];
  for (let a = -45; a <= 45; a += 3) fence.push(polar(a, fenceDist(park, a)));
  const fencePath = `M0,0 L${fence.map((q) => q.join(',')).join(' L')} Z`;
  const grassIn: Pt[] = [];
  for (let a = -45; a <= 45; a += 5) grassIn.push(polar(a, 29));
  const stands: Pt[] = [];
  for (let a = -48; a <= 48; a += 3) stands.push(polar(a, fenceDist(park, Math.max(-45, Math.min(45, a))) + 16));
  // 走者の位置
  const runnerDots: { key: string; pt: Pt; label: string; fade: number }[] = [];
  const animIds = new Set(anim?.runners.map((r) => r.id) ?? []);
  const tRun = ease((t - 0.08) / 0.85);
  if (anim) {
    for (const r of anim.runners) {
      let pt: Pt;
      let fade = 1;
      if (r.out) {
        const tt = Math.min(tRun, 0.55);
        pt = runnerPath(r.from, Math.max(r.to, r.from + 1), tt);
        fade = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
      } else pt = runnerPath(r.from, r.to, tRun);
      if (r.to === 4 && !r.out && tRun >= 1) fade = 0.35;
      runnerDots.push({ key: 'r' + r.id, pt, label: r.label, fade });
    }
  }
  p.bases.forEach((lab, i) => {
    if (i === 0 || !lab) return;
    if (anim) return; // アニメ中は anim の走者だけ描く
    runnerDots.push({ key: 'b' + i, pt: BASES[i], label: lab, fade: 1 });
  });
  void animIds;
  // ボール
  let ballPt: Pt | null = null;
  let ballR = 1.8;
  let shadow: Pt | null = null;
  if (anim?.ball) {
    const tb = ease(Math.min(1, t / 0.5));
    const to = anim.ball.to;
    const start: Pt = [0, -1];
    const cur: Pt = [start[0] + (to[0] - start[0]) * tb, start[1] + (to[1] - start[1]) * tb];
    const k = anim.ball.kind;
    const arc = k === 'FB' || k === 'HR' || k === 'IFFB' ? Math.sin(Math.PI * tb) : k === 'LD' ? Math.sin(Math.PI * tb) * 0.3 : 0;
    ballR = 1.8 + arc * (k === 'HR' ? 3.2 : 2.4);
    shadow = cur;
    ballPt = [cur[0], cur[1] - arc * (k === 'HR' ? 22 : 14)];
    if (t > 0.5 && anim.ball.caught) {
      // 捕球後は内野へ返球
      const tr = ease((t - 0.5) / 0.4);
      ballPt = [to[0] + (0 - to[0]) * tr * 0.6, to[1] + (-30 - to[1]) * tr * 0.6];
      shadow = ballPt;
      ballR = 1.2;
    }
  }
  const koshien = p.theme === 'koshien';
  const maxD = Math.max(park.lf, park.cf, park.rf) + 22;
  return (
    <svg class={`field ${koshien ? 'koshien' : ''}`} viewBox={`${-maxD * 0.7} ${-maxD + 4} ${maxD * 1.4} ${maxD + 4}`} role="img" aria-label="グラウンド">
      <defs>
        <pattern id="mow" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" class="g1" />
          <rect width="6" height="12" class="g2" />
        </pattern>
      </defs>
      <path d={`M0,0 L${stands.map((q) => q.join(',')).join(' L')} Z`} class="stands" />
      <path d={fencePath} fill="url(#mow)" class="grass" />
      <path d={`M0,0 L${fence.map((q) => q.join(',')).join(' L')}`} class="fence" />
      {koshien && <path d={`M${fence.slice(1, -1).map((q) => q.join(',')).join(' L')}`} class="ivy" />}
      {/* 内野 */}
      <path d={`M0,6 L${polar(-45, 29).join(',')} A29,29 0 0 1 ${polar(45, 29).join(',')} Z`} class="dirt" />
      <path d={`M0,-2 L${BASES[1].join(',')} L${BASES[2].join(',')} L${BASES[3].join(',')} Z`} class="infield-grass" />
      <circle cx="0" cy="-18.4" r="2.8" class="dirt mound" />
      <line x1="0" y1="0" x2={polar(-45, fenceDist(park, -45))[0]} y2={polar(-45, fenceDist(park, -45))[1]} class="chalk" />
      <line x1="0" y1="0" x2={polar(45, fenceDist(park, 45))[0]} y2={polar(45, fenceDist(park, 45))[1]} class="chalk" />
      <circle cx="0" cy="0" r="4" class="dirt" />
      {BASES.slice(1, 4).map((b, i) => <rect key={i} x={b[0] - 1} y={b[1] - 1} width="2" height="2" transform={`rotate(45 ${b[0]} ${b[1]})`} class="base" />)}
      <path d="M-0.9,-0.4 L0.9,-0.4 L0.9,0.4 L0,1.2 L-0.9,0.4 Z" class="base" />
      <text x={polar(0, park.cf)[0]} y={polar(0, park.cf)[1] + 6} class="dist">{park.cf}</text>
      <text x={polar(-40, fenceDist(park, -40))[0] + 5} y={polar(-40, fenceDist(park, -40))[1] + 6} class="dist">{park.lf}</text>
      <text x={polar(40, fenceDist(park, 40))[0] - 5} y={polar(40, fenceDist(park, 40))[1] + 6} class="dist">{park.rf}</text>
      {/* 打者 */}
      {p.batterSide && <circle cx={p.batterSide === 'R' ? -3.4 : 3.4} cy="0.5" r="2.6" fill={p.offColor} stroke={p.offColor2} stroke-width="0.5" />}
      {/* 野手 */}
      {POSITIONS.map((pos) => {
        let pt = homePos(park, pos);
        if (anim?.fielder && anim.fielder.pos === pos) {
          const tf = ease(Math.min(1, t / 0.5));
          pt = [pt[0] + (anim.fielder.to[0] - pt[0]) * tf * 0.92, pt[1] + (anim.fielder.to[1] - pt[1]) * tf * 0.92];
        }
        return (
          <g key={pos} transform={`translate(${pt[0]},${pt[1]})`}>
            <circle r="3" fill={p.defColor} stroke={p.defColor2} stroke-width="0.7" />
            <text y="0.9" class="flabel">{p.defLabels?.[pos] ?? ''}</text>
          </g>
        );
      })}
      {/* 走者 */}
      {runnerDots.map((r) => (
        <g key={r.key} transform={`translate(${r.pt[0]},${r.pt[1]})`} opacity={r.fade}>
          <circle r="3.2" fill={p.offColor} stroke={p.offColor2} stroke-width="0.8" />
          <text y="0.9" class="rlabel">{r.label}</text>
        </g>
      ))}
      {shadow && <ellipse cx={shadow[0]} cy={shadow[1]} rx="1.2" ry="0.7" class="ballshadow" />}
      {ballPt && <circle cx={ballPt[0]} cy={ballPt[1]} r={ballR} class="ball" />}
    </svg>
  );
}
