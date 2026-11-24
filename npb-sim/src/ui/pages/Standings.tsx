import { computeStandings } from '../../league/standings';
import { LEAGUE_NAMES, type LeagueId } from '../../league/teams';
import { teamById, type World } from '../../league/world';
import { Logo } from '../components/Logo';
import { f3 } from '../format';
import { useWorld } from '../store';

const gbStr = (gb: number | null) => (gb === null ? '-' : gb === 0 ? '0' : gb.toFixed(1).replace('.0', ''));

export function StandingsTable({ w, league, mini = false, inter = false }: { w: World; league?: LeagueId; mini?: boolean; inter?: boolean }) {
  const rows = computeStandings(w, league, inter ? (k) => k === 'I' : undefined);
  return (
    <table class="data standings">
      <thead>
        <tr>
          <th>順</th><th class="l">球団</th><th>試合</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th><th>差</th>
          {!mini && <><th>得点</th><th>失点</th><th>本拠地</th><th>ビジター</th>{!inter && <th>交流戦</th>}<th>直近10</th><th>連続</th><th>残り</th></>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const t = teamById(w, r.tid);
          return (
            <tr key={r.tid} class={r.tid === w.userTeamId ? 'me' : ''}>
              <td>{i + 1}</td>
              <td class="l"><a href={'#/team/' + t.id}><Logo team={t} size={18} /> {mini ? t.nickname : t.city + t.nickname}</a></td>
              <td>{r.g}</td><td>{r.w}</td><td>{r.l}</td><td>{r.t}</td><td>{f3(r.pct)}</td><td>{gbStr(r.gb)}</td>
              {!mini && (
                <>
                  <td>{r.rs}</td><td>{r.ra}</td>
                  <td>{r.home.join('-')}</td><td>{r.away.join('-')}</td>
                  {!inter && <td>{r.inter.join('-')}</td>}
                  <td>{r.last10}</td><td>{r.streak}</td><td>{r.remaining}</td>
                </>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function Standings() {
  const w = useWorld();
  return (
    <div class="page">
      {(['C', 'P'] as const).map((lg) => (
        <section class="card" key={lg}>
          <h2>{LEAGUE_NAMES[lg]}</h2>
          <div class="tablewrap"><StandingsTable w={w} league={lg} /></div>
        </section>
      ))}
      <section class="card">
        <h2>交流戦</h2>
        <p class="muted">{w.calendar.interleague.start} 〜 {w.calendar.interleague.end}</p>
        <div class="tablewrap"><StandingsTable w={w} inter /></div>
      </section>
      <p class="muted small">勝率は引き分けを除いて計算（勝÷(勝+敗)）。ゲーム差は首位との差。</p>
    </div>
  );
}
