import { addDays, fmtDate } from '../../league/calendar';
import { computeStandings } from '../../league/standings';
import { LEAGUE_NAMES } from '../../league/teams';
import { teamById } from '../../league/world';
import { batterRows, contexts, pitcherRows } from '../../stats/tables';
import { LineScore } from '../components/LineScore';
import { Logo } from '../components/Logo';
import { f2, f3 } from '../format';
import { go, useWorld } from '../store';
import { StandingsTable } from './Standings';

export function Home() {
  const w = useWorld();
  const me = teamById(w, w.userTeamId);
  const today = w.phase === 'regular' ? w.calendar.games.filter((g) => g.date === w.date && !w.results[g.id]) : [];
  // 直近の試合日（結果）
  let lastDate = w.phase === 'regular' ? addDays(w.date, -1) : w.date;
  for (let i = 0; i < 6 && !w.calendar.games.some((g) => g.date === lastDate && w.results[g.id]); i++) lastDate = addDays(lastDate, -1);
  const last = w.calendar.games.filter((g) => g.date === lastDate && w.results[g.id]).map((g) => w.results[g.id]);
  const myLast = last.find((g) => g.away === me.id || g.home === me.id);
  const next = w.calendar.games.filter((g) => (g.away === me.id || g.home === me.id) && !w.results[g.id]).slice(0, 6);
  const ctx = contexts(w);
  const bats = batterRows(w, me.league, ctx).filter((r) => r.qualified);
  const pits = pitcherRows(w, me.league, ctx).filter((r) => r.qualified);
  const leader = (arr: typeof bats, f: (r: (typeof bats)[0]) => number) => [...arr].sort((a, b) => f(b) - f(a))[0];
  return (
    <div class="page home">
      <section class="card hero-card" style={{ '--tc': me.primary, '--tc2': me.secondary } as never}>
        <Logo team={me} size={64} />
        <div>
          <h2>{me.city}{me.nickname}</h2>
          <p>{fmtDate(w.date, true)}{w.phase !== 'regular' ? '・レギュラーシーズン終了' : ''}</p>
          {(() => {
            const st = computeStandings(w, me.league);
            const i = st.findIndex((r) => r.tid === me.id);
            const r = st[i];
            return <p class="big">{LEAGUE_NAMES[me.league]} {i + 1}位　{r.w}勝{r.l}敗{r.t}分　{r.streak}</p>;
          })()}
        </div>
      </section>

      <div class="grid2">
        <section class="card">
          <h3>{w.phase === 'regular' ? `今日の試合（${fmtDate(w.date)}）` : 'シーズン終了'}</h3>
          {today.length === 0 && <p class="muted">{w.phase === 'regular' ? '今日は試合がありません' : 'レギュラーシーズンの全日程が終了しました。ポストシーズン（CS・日本シリーズ）はフェーズ4で追加します。'}</p>}
          <ul class="games">
            {today.map((g) => {
              const A = teamById(w, g.away), H = teamById(w, g.home);
              const mine = g.away === me.id || g.home === me.id;
              return (
                <li key={g.id} class={mine ? 'mine' : ''}>
                  <span><Logo team={A} size={20} /> {A.nickname}</span>
                  <span class="vs">vs</span>
                  <span><Logo team={H} size={20} /> {H.nickname}</span>
                  <small>{H.park.name}{g.kind === 'I' ? '・交流戦' : ''}</small>
                </li>
              );
            })}
          </ul>
        </section>
        <section class="card">
          <h3>前日の結果（{fmtDate(lastDate)}）</h3>
          {myLast && (
            <div class="mylast" onClick={() => go('game/' + myLast.id)}>
              <LineScore w={w} g={myLast} compact />
            </div>
          )}
          <ul class="results">
            {last.map((g) => (
              <li key={g.id} onClick={() => go('game/' + g.id)}>
                <span>{teamById(w, g.away).nickname}</span>
                <b>{g.awayRuns} - {g.homeRuns}</b>
                <span>{teamById(w, g.home).nickname}</span>
                {g.walkoff && <em class="tag">サヨナラ</em>}
                {g.tie && <em class="tag">引分</em>}
              </li>
            ))}
            {last.length === 0 && <li class="muted">まだ試合がありません</li>}
          </ul>
        </section>
      </div>

      <div class="grid2">
        {(['C', 'P'] as const).map((lg) => (
          <section class="card" key={lg}>
            <h3><a href="#/standings">{LEAGUE_NAMES[lg]} 順位</a></h3>
            <div class="tablewrap"><StandingsTable w={w} league={lg} mini /></div>
          </section>
        ))}
      </div>

      <div class="grid2">
        <section class="card">
          <h3>今後の日程</h3>
          {next.length === 0 && <p class="muted">残り試合はありません</p>}
          <ul class="games">
            {next.map((g) => {
              const opp = teamById(w, g.away === me.id ? g.home : g.away);
              return (
                <li key={g.id}>
                  <span>{fmtDate(g.date)}</span>
                  <span>{g.home === me.id ? 'vs' : '@'} <Logo team={opp} size={18} /> {opp.nickname}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section class="card">
          <h3><a href="#/leaders">{LEAGUE_NAMES[me.league]} 主な個人成績</a></h3>
          {bats.length === 0 ? <p class="muted">規定到達者がまだいません</p> : (
            <dl class="leaders">
              {([['打率', leader(bats, (r) => r.avg), (r: (typeof bats)[0]) => f3(r.avg)], ['本塁打', leader(bats, (r) => r.b.hr), (r: (typeof bats)[0]) => r.b.hr + '本'], ['打点', leader(bats, (r) => r.b.rbi), (r: (typeof bats)[0]) => r.b.rbi]] as const).map(([k, r, f]) => (
                <div key={k}><dt>{k}</dt><dd><a href={'#/player/' + r.pid}>{r.name}</a>（{teamById(w, r.tid).short}） {f(r)}</dd></div>
              ))}
              {pits.length > 0 && (() => {
                const e = [...pits].sort((a, b) => a.era - b.era)[0];
                return <div><dt>防御率</dt><dd><a href={'#/player/' + e.pid}>{e.name}</a>（{teamById(w, e.tid).short}） {f2(e.era)}</dd></div>;
              })()}
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
