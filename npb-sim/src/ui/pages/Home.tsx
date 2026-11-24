import { fmtDate } from '../../league/calendar';
import { computeStandings } from '../../league/standings';
import { LEAGUE_NAMES } from '../../league/teams';
import { teamById } from '../../league/world';
import { scheduledOn, userGameToday } from '../../league/sim';
import { seriesStatus } from '../../league/postseason';
import { batterRows, contexts, pitcherRows } from '../../stats/tables';
import { LineScore } from '../components/LineScore';
import { Logo } from '../components/Logo';
import { f2, f3 } from '../format';
import { go, useWorld } from '../store';
import { live, startLive } from '../live';
import { StandingsTable } from './Standings';
import { FrontPage } from './News';

export function Home() {
  const w = useWorld();
  const me = teamById(w, w.userTeamId);
  const today = scheduledOn(w, w.date);
  const dates = Object.keys(w.news).sort();
  const latest = dates.length ? w.news[dates[dates.length - 1]] : null;
  // 直近の試合結果
  const resultDates = [...new Set(Object.values(w.results).map((g) => g.date))].sort();
  const lastDate = resultDates[resultDates.length - 1];
  const last = lastDate ? Object.values(w.results).filter((g) => g.date === lastDate) : [];
  const myLast = last.find((g) => g.away === me.id || g.home === me.id);
  const next = w.phase === 'regular' ? w.calendar.games.filter((g) => (g.away === me.id || g.home === me.id) && !w.results[g.id]).slice(0, 6) : [];
  const ctx = contexts(w);
  const bats = batterRows(w, me.league, ctx).filter((r) => r.qualified);
  const pits = pitcherRows(w, me.league, ctx).filter((r) => r.qualified);
  const ug = userGameToday(w);
  const st = computeStandings(w, me.league);
  const rank = st.findIndex((r) => r.tid === me.id);
  const myRow = st[rank];
  const mySeries = w.post?.series.filter((s) => s.high === me.id || s.low === me.id) ?? [];
  const status = w.phase === 'regular'
    ? `${LEAGUE_NAMES[me.league]} ${rank + 1}位　${myRow.w}勝${myRow.l}敗${myRow.t}分　${myRow.streak}`
    : w.phase === 'postseason'
      ? mySeries.length ? `ポストシーズン: ${mySeries.map((s) => `${s.name} ${s.winner ? (s.winner === me.id ? '突破' : '敗退') : s.status === 'active' ? '戦い中' : '待機'}`).join('・')}` : `レギュラーシーズン ${rank + 1}位で終了（ポストシーズン進出ならず）`
      : `${w.year}年シーズン終了${w.post?.champion ? `・日本一は${teamById(w, w.post.champion).nickname}` : ''}`;
  return (
    <div class="page home">
      <section class="card hero-card" style={{ '--tc': me.primary, '--tc2': me.secondary } as never}>
        <Logo team={me} size={64} />
        <div>
          <h2>{me.city}{me.nickname}</h2>
          <p>{fmtDate(w.date, true)}</p>
          <p class="big">{status}</p>
        </div>
      </section>

      {ug && (() => {
        const opp = teamById(w, ug.away === me.id ? ug.home : ug.away);
        const watching = live && live.gameId === ug.id;
        return (
          <section class="card playball">
            <div>
              <h3>今日の試合{ug.label ? `（${ug.kind === 'JS' ? '日本シリーズ' : 'クライマックスシリーズ'}${ug.label}）` : ''}</h3>
              <p class="big"><Logo team={me} size={26} /> {me.nickname} {ug.home === me.id ? 'vs' : '@'} <Logo team={opp} size={26} /> {opp.nickname}</p>
              <p class="muted small">{teamById(w, ug.home).park.name}{ug.kind === 'I' ? '・交流戦' : ''}</p>
            </div>
            <div class="btns">
              <button class="btn primary big" onClick={() => { startLive(w, ug.id); go('watch'); }}>{watching ? '観戦に戻る' : '⚾ 試合を観戦・采配する'}</button>
            </div>
          </section>
        );
      })()}

      {w.phase !== 'regular' && w.post && (
        <section class="card">
          <h3><a href="#/post">ポストシーズン</a></h3>
          <ul class="results">
            {w.post.series.filter((s) => s.status !== 'waiting').map((s) => (
              <li key={s.id} onClick={() => go('post')}>
                <span>{s.league ? LEAGUE_NAMES[s.league] : ''}{s.name}</span>
                <b>{teamById(w, s.high).short} {s.wins[0]}-{s.wins[1]} {teamById(w, s.low).short}</b>
                <small>{s.winner ? `${teamById(w, s.winner).nickname}が突破` : seriesStatus(s)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div class="grid2">
        {latest ? (
          <section class="card newscard">
            <h3><a href={'#/news/' + latest.date}>{fmtDate(latest.date)}の新聞・1面</a></h3>
            <FrontPage w={w} issue={latest} compact />
          </section>
        ) : <section class="card"><h3>スポーツ新聞</h3><p class="muted">試合が始まると毎日発行されます。</p></section>}
        <div class="side">
          <section class="card">
            <h3>{today.length ? `今日の試合（${fmtDate(w.date)}）` : '今日の試合'}</h3>
            {today.length === 0 && <p class="muted">{w.phase === 'offseason' ? 'シーズンは終了しました。次のシーズンへの移行（ドラフト・FA・契約更改）はフェーズ5で追加します。' : '今日は試合がありません'}</p>}
            <ul class="games">
              {today.map((g) => {
                const A = teamById(w, g.away), H = teamById(w, g.home);
                const mine = g.away === me.id || g.home === me.id;
                return (
                  <li key={g.id} class={mine ? 'mine' : ''}>
                    <span><Logo team={A} size={20} /> {A.nickname}</span>
                    <span class="vs">vs</span>
                    <span><Logo team={H} size={20} /> {H.nickname}</span>
                    <small>{H.park.name}{g.kind === 'I' ? '・交流戦' : g.label ? '・' + g.label : ''}</small>
                  </li>
                );
              })}
              {w.calendar.allStar.includes(w.date) && <li class="mine">★ オールスターゲーム第{w.calendar.allStar.indexOf(w.date) + 1}戦</li>}
            </ul>
          </section>
          {lastDate && (
            <section class="card">
              <h3>前回の結果（{fmtDate(lastDate)}）</h3>
              {myLast && <div class="mylast" onClick={() => go('game/' + myLast.id)}><LineScore w={w} g={myLast} compact /></div>}
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
              </ul>
            </section>
          )}
        </div>
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
        {next.length > 0 && (
          <section class="card">
            <h3>今後の日程</h3>
            <ul class="games">
              {next.map((g) => {
                const opp = teamById(w, g.away === me.id ? g.home : g.away);
                return <li key={g.id}><span>{fmtDate(g.date)}</span><span>{g.home === me.id ? 'vs' : '@'} <Logo team={opp} size={18} /> {opp.nickname}</span></li>;
              })}
            </ul>
          </section>
        )}
        <section class="card">
          <h3><a href="#/leaders">{LEAGUE_NAMES[me.league]} 主な個人成績</a></h3>
          {bats.length === 0 ? <p class="muted">規定到達者がまだいません</p> : (
            <dl class="leaders">
              {([['打率', (r: (typeof bats)[0]) => r.avg, (r: (typeof bats)[0]) => f3(r.avg)], ['本塁打', (r: (typeof bats)[0]) => r.b.hr, (r: (typeof bats)[0]) => r.b.hr + '本'], ['打点', (r: (typeof bats)[0]) => r.b.rbi, (r: (typeof bats)[0]) => String(r.b.rbi)]] as const).map(([k, v, f]) => {
                const r = [...bats].sort((a, b) => v(b) - v(a))[0];
                return <div key={k}><dt>{k}</dt><dd><a href={'#/player/' + r.pid}>{r.name}</a>（{teamById(w, r.tid).short}） {f(r)}</dd></div>;
              })}
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
