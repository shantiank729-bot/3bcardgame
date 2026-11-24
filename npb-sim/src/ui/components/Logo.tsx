import type { TeamInfo } from '../../league/teams';

/** 架空球団のロゴ（SVGで自作の図案） */
const EMBLEMS: Record<TeamInfo['emblem'], string> = {
  phoenix: 'M50 22 C42 34 30 36 22 30 C26 44 36 50 46 50 L40 70 L50 62 L60 70 L54 50 C64 50 74 44 78 30 C70 36 58 34 50 22 Z',
  shark: 'M20 62 C34 60 44 50 50 26 C56 44 66 56 82 60 C70 64 58 66 50 66 C40 66 30 66 20 62 Z M58 66 L66 76 L64 66 Z',
  owl: 'M30 30 L38 38 L50 34 L62 38 L70 30 L70 56 C70 68 60 76 50 76 C40 76 30 68 30 56 Z M42 44 a6 6 0 1 0 0.1 0 Z M58 44 a6 6 0 1 0 0.1 0 Z',
  bolt: 'M56 18 L32 54 L48 54 L42 82 L68 42 L52 42 Z',
  star: 'M50 18 L58 40 L82 40 L62 54 L70 78 L50 64 L30 78 L38 54 L18 40 L42 40 Z',
  comet: 'M62 26 L67 38 L80 38 L70 46 L74 58 L62 51 L51 58 L55 46 L45 38 L58 38 Z M50 50 L20 76 L28 64 L18 66 L44 46 Z',
  falcon: 'M18 40 C36 34 50 36 60 44 L82 36 L70 50 C62 62 50 70 36 72 L46 60 C36 60 26 52 18 40 Z',
  wolf: 'M28 24 L42 40 L58 40 L72 24 L70 52 L60 72 L50 78 L40 72 L30 52 Z M40 52 L46 54 L44 58 Z M60 52 L54 54 L56 58 Z',
  gull: 'M16 50 C28 38 40 40 50 52 C60 40 72 38 84 50 C72 46 62 50 50 62 C38 50 28 46 16 50 Z',
  tree: 'M50 16 L72 46 L62 46 L78 66 L56 66 L56 82 L44 82 L44 66 L22 66 L38 46 L28 46 Z',
  flame: 'M50 16 C56 32 72 38 70 58 C68 72 58 80 50 80 C40 80 30 72 30 58 C30 46 40 42 42 30 C46 40 50 42 52 46 C56 38 54 28 50 16 Z',
  bison: 'M22 30 C22 44 30 48 36 48 L36 62 C36 72 44 78 50 78 C56 78 64 72 64 62 L64 48 C70 48 78 44 78 30 C72 38 66 40 60 38 L40 38 C34 40 28 38 22 30 Z',
};

export function Logo({ team, size = 32 }: { team: TeamInfo; size?: number }) {
  return (
    <svg class="logo" width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={team.nickname}>
      <circle cx="50" cy="50" r="48" fill={team.primary} stroke={team.secondary} stroke-width="4" />
      <path d={EMBLEMS[team.emblem]} fill={team.secondary} fill-rule="evenodd" opacity="0.95" />
    </svg>
  );
}

export function TeamTag({ team, full = false }: { team: TeamInfo; full?: boolean }) {
  return (
    <span class="teamtag">
      <Logo team={team} size={20} />
      <span>{full ? team.city + team.nickname : team.nickname}</span>
    </span>
  );
}
