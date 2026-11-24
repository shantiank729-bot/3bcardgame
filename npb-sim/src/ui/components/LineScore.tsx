import type { GameSummary, World } from '../../league/world';
import { teamById } from '../../league/world';
import { Logo } from './Logo';

export function LineScore({ w, g, compact = false }: { w: World; g: GameSummary; compact?: boolean }) {
  const n = Math.max(9, g.lineAway.length, g.lineHome.length);
  const cells = (line: number[], isHome: boolean) =>
    [...Array(n)].map((_, i) => {
      const v = line[i];
      if (v === undefined) return <td key={i}>{isHome && i === line.length && !g.tie && g.homeRuns > g.awayRuns ? 'X' : ''}</td>;
      return <td key={i}>{v}</td>;
    });
  const A = teamById(w, g.away);
  const H = teamById(w, g.home);
  return (
    <table class={`linescore ${compact ? 'compact' : ''}`}>
      <thead>
        <tr>
          <th class="tn"></th>
          {[...Array(n)].map((_, i) => <th key={i}>{i + 1}</th>)}
          <th class="tot">計</th>
          <th class="tot">安</th>
          <th class="tot">失</th>
        </tr>
      </thead>
      <tbody>
        {([[A, g.lineAway, g.awayRuns, 0, false], [H, g.lineHome, g.homeRuns, 1, true]] as const).map(([t, line, runs, i, home]) => (
          <tr key={t.id}>
            <th class="tn"><Logo team={t} size={18} /> {t.short}</th>
            {cells(line as number[], home)}
            <td class="tot runs">{runs}</td>
            <td class="tot">{g.hits[i]}</td>
            <td class="tot">{g.errors[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
