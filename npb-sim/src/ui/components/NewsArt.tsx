import type { JSX } from 'preact';
import type { Scene } from '../../news/types';

/** 新聞の挿絵（写真の代わり）。人物は丸と太い線で描いたシルエット */
type Pose = 'stand' | 'swing' | 'pitch' | 'jump' | 'arms' | 'slide' | 'bow' | 'shake' | 'cap' | 'down';

const POSES: Record<Pose, string[]> = {
  stand: ['M0,-40 L-8,-28 L-10,-16', 'M0,-40 L8,-28 L10,-16', 'M0,-40 L0,-15', 'M0,-15 L-5,-7 L-6,0', 'M0,-15 L5,-7 L6,0'],
  swing: ['M0,-40 L12,-40 L22,-46', 'M0,-40 L10,-34 L22,-46', 'M0,-40 L-2,-15', 'M-2,-15 L-12,-7 L-16,0', 'M-2,-15 L8,-6 L12,0', 'M22,-46 L2,-70'],
  pitch: ['M0,-40 L12,-30 L20,-20', 'M0,-40 L-12,-44 L-20,-54', 'M0,-40 L4,-16', 'M4,-16 L14,-8 L20,0', 'M4,-16 L-8,-14 L-16,-6'],
  jump: ['M0,-40 L-10,-50 L-14,-62', 'M0,-40 L10,-50 L14,-62', 'M0,-40 L0,-15', 'M0,-15 L-8,-10 L-6,-2', 'M0,-15 L8,-10 L6,-2'],
  arms: ['M0,-40 L-4,-54 L-4,-68', 'M0,-40 L4,-54 L4,-68', 'M0,-40 L0,-15', 'M0,-15 L-5,-7 L-6,0', 'M0,-15 L5,-7 L6,0'],
  slide: ['M-20,-6 L-8,-12', 'M-8,-12 L4,-20 L16,-26', 'M-8,-12 L2,-4 L14,-2', 'M-20,-6 L-34,-6 L-44,-2', 'M-20,-6 L-30,-14 L-40,-12'],
  bow: ['M0,-34 L-4,-22 L-6,-12', 'M0,-34 L4,-22 L6,-12', 'M0,-34 L0,-15', 'M0,-15 L-5,-7 L-6,0', 'M0,-15 L5,-7 L6,0'],
  shake: ['M0,-40 L10,-32 L18,-30', 'M0,-40 L-8,-28 L-10,-16', 'M0,-40 L0,-15', 'M0,-15 L-5,-7 L-6,0', 'M0,-15 L5,-7 L6,0'],
  cap: ['M0,-40 L-8,-28 L-10,-16', 'M0,-40 L10,-52 L12,-66', 'M0,-40 L0,-15', 'M0,-15 L-5,-7 L-6,0', 'M0,-15 L5,-7 L6,0'],
  down: ['M0,-38 L-6,-26 L-6,-14', 'M0,-38 L6,-26 L6,-14', 'M0,-38 L0,-15', 'M0,-15 L-5,-7 L-6,0', 'M0,-15 L5,-7 L6,0'],
};
const HEAD: Partial<Record<Pose, [number, number]>> = { bow: [6, -40], slide: [24, -30], down: [3, -45] };

function Fig({ x, y, s = 1, pose, c, c2, flip = false, rot = 0 }: { x: number; y: number; s?: number; pose: Pose; c: string; c2: string; flip?: boolean; rot?: number }) {
  const [hx, hy] = HEAD[pose] ?? [0, -50];
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${flip ? -s : s},${s})`}>
      {POSES[pose].map((d, i) => (
        <path key={i} d={d} fill="none" stroke={i === 5 && pose === 'swing' ? '#c9a06a' : c} stroke-width={i === 5 ? 3 : 7} stroke-linecap="round" stroke-linejoin="round" />
      ))}
      <circle cx={hx} cy={hy} r="7" fill={c} />
      <path d={`M${hx - 7},${hy - 2} Q${hx},${hy - 11} ${hx + 7},${hy - 2} L${hx + 12},${hy - 1}`} fill={c2} stroke={c2} stroke-width="1.5" />
    </g>
  );
}

const Sky = ({ night = true, id }: { night?: boolean; id: string }) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={night ? '#0b1d3a' : '#7cc3f0'} />
        <stop offset="1" stop-color={night ? '#29466e' : '#d9f0ff'} />
      </linearGradient>
    </defs>
    <rect width="320" height="200" fill={`url(#${id})`} />
    {night && [30, 290].map((x) => (
      <g key={x}>
        <rect x={x - 2} y="40" width="4" height="70" fill="#4b5d78" />
        <rect x={x - 14} y="28" width="28" height="14" rx="2" fill="#fff9d6" />
        <circle cx={x} cy="35" r="30" fill="#fff6c0" opacity="0.15" />
      </g>
    ))}
  </>
);
const Stands = () => (
  <g>
    <path d="M0,120 Q160,70 320,120 L320,150 L0,150 Z" fill="#2c3445" />
    {[...Array(60)].map((_, i) => <circle key={i} cx={6 + (i % 30) * 10.6} cy={112 - Math.sin((i % 30) / 29 * Math.PI) * 26 + (i >= 30 ? 12 : 0)} r="2.3" fill={['#e9e2d0', '#ffcc66', '#8fb4ff', '#ff8f8f'][i % 4]} opacity="0.8" />)}
  </g>
);
const Grass = ({ y = 150 }: { y?: number }) => (
  <g>
    <rect y={y} width="320" height={200 - y} fill="#2f7d3a" />
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={i * 40} y={y} width="20" height={200 - y} fill="#2a7334" />)}
  </g>
);
const Confetti = ({ n = 40, seed = 1 }: { n?: number; seed?: number }) => (
  <g>
    {[...Array(n)].map((_, i) => {
      const r = Math.sin(i * 12.9898 + seed) * 43758.5453;
      const f = r - Math.floor(r);
      const x = (i * 37 + seed * 13) % 320, y = (f * 130) | 0;
      return <rect key={i} x={x} y={y} width="4" height="7" fill={['#ffd84a', '#ff5a5f', '#4cd964', '#5ac8fa', '#fff'][i % 5]} transform={`rotate(${(f * 180) | 0} ${x} ${y})`} />;
    })}
  </g>
);

export function NewsArt({ scene, c, c2, big, seed = 1 }: { scene: Scene; c: string; c2: string; big?: string; seed?: number }) {
  const id = `sky${scene}${seed}`;
  let body: JSX.Element;
  switch (scene) {
    case 'homer':
      body = (
        <>
          <Sky id={id} /><Stands /><Grass />
          <path d="M70,140 Q170,-20 290,60" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 6" opacity="0.85" />
          <circle cx="290" cy="60" r="6" fill="#fff" stroke="#c33" stroke-width="1" />
          {[[280, 45], [300, 70], [270, 72]].map(([x, y], i) => <path key={i} d={`M${x},${y} l3,-8 l3,8 l8,3 l-8,3 l-3,8 l-3,-8 l-8,-3 z`} fill="#ffe680" />)}
          <Fig x={70} y={185} s={1.5} pose="swing" c={c} c2={c2} />
        </>
      );
      break;
    case 'walkoff':
      body = (
        <>
          <Sky id={id} /><Stands /><Grass />
          <path d="M150,178 l10,-6 l10,6 l0,6 l-20,0 z" fill="#fff" />
          {[60, 105, 150, 195, 240].map((x, i) => <Fig key={x} x={x + 10} y={182 - (i % 2) * 10} s={i === 2 ? 1.45 : 1.2} pose="jump" c={c} c2={c2} flip={i % 2 === 1} />)}
          <Confetti seed={seed} n={30} />
        </>
      );
      break;
    case 'pitcher':
    case 'nohitter':
      body = (
        <>
          <Sky id={id} night={scene === 'nohitter'} /><Stands /><Grass />
          <ellipse cx="120" cy="178" rx="60" ry="10" fill="#b07c46" />
          {scene === 'pitcher' ? (
            <>
              <Fig x={120} y={178} s={1.6} pose="pitch" c={c} c2={c2} />
              <path d="M155,130 L300,150" stroke="#fff" stroke-width="2" stroke-dasharray="10 5" opacity="0.8" />
              <circle cx="300" cy="150" r="5" fill="#fff" />
              {[0, 1, 2].map((i) => <line key={i} x1={160 + i * 20} y1={120 + i * 4} x2={190 + i * 20} y2={124 + i * 4} stroke="#fff" opacity="0.4" stroke-width="2" />)}
            </>
          ) : (
            <>
              <Fig x={120} y={178} s={1.6} pose="arms" c={c} c2={c2} />
              <rect x="200" y="30" width="100" height="56" rx="4" fill="#041009" stroke="#2b4a38" stroke-width="3" />
              <text x="215" y="50" fill="#9ccfb0" font-size="11">H</text><text x="215" y="76" fill="#9ccfb0" font-size="11">R</text>
              <text x="270" y="52" fill="#ffd84a" font-size="20" font-family="monospace" font-weight="700">0</text>
              <text x="270" y="78" fill="#ffd84a" font-size="20" font-family="monospace" font-weight="700">0</text>
            </>
          )}
        </>
      );
      break;
    case 'doage':
      body = (
        <>
          <Sky id={id} /><Stands /><Grass />
          {[70, 100, 130, 160, 190, 220, 250].map((x, i) => <Fig key={x} x={x} y={190 - (i % 2) * 4} s={1.05} pose="arms" c={c} c2={c2} />)}
          <Fig x={160} y={70} s={1.3} pose="stand" c={c2 === '#ffffff' ? '#333' : c2} c2={c} rot={-80} />
          <Confetti seed={seed} />
        </>
      );
      break;
    case 'champion':
    case 'award':
    case 'milestone':
      body = (
        <>
          <Sky id={id} night={false} />
          <Confetti seed={seed} n={scene === 'milestone' ? 20 : 45} />
          <g transform="translate(160,110)">
            {scene === 'milestone' ? (
              <>
                <Fig x={-50} y={80} s={1.5} pose="cap" c={c} c2={c2} />
                <g transform="translate(40,0)">
                  {[...Array(7)].map((_, i) => <circle key={i} cx={Math.cos(i) * 14} cy={-20 + Math.sin(i) * 12} r="9" fill={['#ff6b8b', '#ffd84a', '#ff9f40', '#fff'][i % 4]} />)}
                  <path d="M-6,-6 L0,40 L6,-6 Z" fill="#3d8a3f" />
                </g>
              </>
            ) : (
              <>
                <path d="M-40,-60 L40,-60 L32,-10 Q0,20 -32,-10 Z" fill="#f2c94c" stroke="#a8841c" stroke-width="3" />
                <path d="M-40,-52 Q-70,-50 -60,-25 Q-52,-12 -34,-18" fill="none" stroke="#f2c94c" stroke-width="7" />
                <path d="M40,-52 Q70,-50 60,-25 Q52,-12 34,-18" fill="none" stroke="#f2c94c" stroke-width="7" />
                <rect x="-10" y="10" width="20" height="26" fill="#d9ad35" />
                <rect x="-34" y="36" width="68" height="16" rx="3" fill={c} stroke={c2} stroke-width="2" />
              </>
            )}
          </g>
        </>
      );
      break;
    case 'magic':
    case 'streak':
      body = (
        <>
          <Sky id={id} /><Stands />
          <rect x="60" y="34" width="200" height="110" rx="6" fill="#041009" stroke="#2b4a38" stroke-width="4" />
          {[...Array(18)].map((_, i) => <circle key={i} cx={72 + (i % 9) * 22} cy={i < 9 ? 44 : 134} r="3" fill="#ffd84a" opacity="0.7" />)}
          <path d="M30,150 L30,60 L70,75 L30,90" fill={c} stroke={c2} stroke-width="2" />
          <Grass y={160} />
        </>
      );
      break;
    case 'steal':
      body = (<><Sky id={id} night={false} /><Stands /><Grass /><rect x="230" y="168" width="18" height="10" fill="#fff" transform="rotate(10 239 173)" />
        <ellipse cx="190" cy="180" rx="60" ry="10" fill="#b07c46" opacity="0.8" /><Fig x={200} y={180} s={1.5} pose="slide" c={c} c2={c2} /></>);
      break;
    case 'allstar':
    case 'handshake':
      body = (
        <>
          <Sky id={id} night={scene === 'allstar'} />{scene === 'allstar' && <Stands />}<Grass />
          {scene === 'allstar' && [...Array(14)].map((_, i) => <path key={i} d={`M${20 + i * 22},${30 + (i % 3) * 14} l3,-8 l3,8 l8,3 l-8,3 l-3,8 l-3,-8 l-8,-3 z`} fill="#ffe680" />)}
          <Fig x={130} y={185} s={1.5} pose="shake" c={c} c2={c2} />
          <Fig x={190} y={185} s={1.5} pose="shake" c={c2 === '#ffffff' ? '#455a64' : c2} c2={c} flip />
        </>
      );
      break;
    case 'draft':
      body = (<><Sky id={id} night={false} />
        <rect x="40" y="150" width="240" height="50" fill="#6b4f2a" />
        <rect x="120" y="90" width="80" height="60" fill={c} stroke={c2} stroke-width="3" /><rect x="140" y="86" width="40" height="8" fill="#222" />
        <rect x="200" y="60" width="40" height="50" fill="#fff" transform="rotate(12 220 85)" /><text x="208" y="90" font-size="14" fill="#c00" transform="rotate(12 220 85)">交渉権</text>
        <Fig x={80} y={150} s={1.2} pose="arms" c={c} c2={c2} /></>);
      break;
    case 'koshien':
      body = (<><Sky id={id} night={false} /><circle cx="270" cy="40" r="20" fill="#fff3a0" />
        <rect x="0" y="90" width="320" height="50" fill="#2f5b2a" />
        {[...Array(40)].map((_, i) => <circle key={i} cx={(i * 8.3) % 320} cy={95 + (i % 5) * 9} r="5" fill="#3f7a35" />)}
        <rect y="140" width="320" height="60" fill="#c58a50" />
        {[70, 110, 150, 190, 230].map((x) => <Fig key={x} x={x + 10} y={190} s={1.1} pose="bow" c={c} c2={c2} />)}</>);
      break;
    case 'retire':
      body = (<><rect width="320" height="200" fill="#0d0f16" /><path d="M160,0 L90,200 L230,200 Z" fill="#fff8d0" opacity="0.18" />
        <Fig x={160} y={190} s={1.7} pose="cap" c={c} c2={c2} /></>);
      break;
    case 'slump':
      body = (<><rect width="320" height="200" fill="#3d4652" />{[...Array(40)].map((_, i) => <line key={i} x1={(i * 29) % 320} y1={(i * 17) % 160} x2={(i * 29) % 320 - 6} y2={(i * 17) % 160 + 16} stroke="#9fb3c8" opacity="0.5" />)}
        <Grass y={170} /><Fig x={160} y={185} s={1.6} pose="down" c={c} c2={c2} /></>);
      break;
    default:
      body = (<><Sky id={id} /><Stands /><Grass /><Fig x={110} y={185} s={1.3} pose="arms" c={c} c2={c2} /><Fig x={210} y={185} s={1.3} pose="stand" c={c} c2={c2} flip /></>);
  }
  return (
    <svg class="newsart" viewBox="0 0 320 200" role="img" aria-label="挿絵">
      {body}
      {big && (
        <text x={scene === 'magic' || scene === 'streak' ? 160 : 300} y={scene === 'magic' || scene === 'streak' ? 112 : 40} text-anchor={scene === 'magic' || scene === 'streak' ? 'middle' : 'end'}
          class="bigtxt" font-size={scene === 'magic' || scene === 'streak' ? 54 : 34}>{big}</text>
      )}
    </svg>
  );
}
