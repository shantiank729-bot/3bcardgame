import { fmtDate } from '../../league/calendar';
import { LEAGUE_NAMES } from '../../league/teams';
import { teamById, type World } from '../../league/world';
import type { Series } from '../../league/postseason';
import { Logo } from '../components/Logo';
import { go, useWorld } from '../store';

function SeriesCard({ w, s }: { w: World; s: Series }) {
  const T = (id: number) => (id ? teamById(w, id) : null);
  const hi = T(s.high), lo = T(s.low);
  const row = (t: ReturnType<typeof T>, wins: number, adv: boolean) => (
    <div class={`srow ${s.winner && t && s.winner === t.id ? 'win' : ''}`}>
      {t ? <><Logo team={t} size={22} /><span>{t.city}{t.nickname}</span></> : <span class="muted">未定</span>}
      <b>{wins}</b>{adv && <small class="adv">アドバンテージ1勝含む</small>}
    </div>
  );
  return (
    <div class={`series ${s.status}`}>
      <h4>{s.league ? LEAGUE_NAMES[s.league] + ' ' : ''}{s.name}<small>{s.kind === 'CS1' ? '3試合制・2勝で突破' : s.kind === 'CS2' ? '6試合制・4勝で突破' : '4勝先取'}</small></h4>
      {row(hi, s.wins[0], s.advantage > 0)}
      {row(lo, s.wins[1], false)}
      {s.ties > 0 && <p class="small muted">引き分け {s.ties}</p>}
      <ul class="sgames">
        {s.games.map((g) => {
          const r = w.results[g.id];
          return (
            <li key={g.id} class={r ? 'done' : ''} onClick={() => r && go('game/' + g.id)}>
              <span>第{g.no}戦 {fmtDate(g.date)}</span>
              <span>{g.away ? teamById(w, g.away).short : '?'} {r ? `${r.awayRuns}-${r.homeRuns}` : '-'} {g.home ? teamById(w, g.home).short : '?'}</span>
            </li>
          );
        })}
      </ul>
      {s.winner && <p class="swinner">勝者: {teamById(w, s.winner).city}{teamById(w, s.winner).nickname}</p>}
    </div>
  );
}

export function PostPage() {
  const w = useWorld();
  const post = w.post;
  if (!post) return <div class="page"><section class="card"><h2>ポストシーズン</h2><p class="muted">レギュラーシーズン終了後、各リーグ上位3球団でクライマックスシリーズ、その勝者同士で日本シリーズを行います。</p></section></div>;
  const get = (id: Series['id']) => post.series.find((s) => s.id === id)!;
  return (
    <div class="page">
      {post.champion && (
        <section class="card champ">
          <Logo team={teamById(w, post.champion)} size={64} />
          <div><h2>{w.year}年 日本一</h2><p class="big">{teamById(w, post.champion).city}{teamById(w, post.champion).nickname}</p></div>
        </section>
      )}
      <div class="bracket">
        {(['C', 'P'] as const).map((lg) => (
          <section class="card" key={lg}>
            <h3>{LEAGUE_NAMES[lg]} クライマックスシリーズ</h3>
            <p class="small muted">1位 {teamById(w, post.seeds[lg][0]).nickname}・2位 {teamById(w, post.seeds[lg][1]).nickname}・3位 {teamById(w, post.seeds[lg][2]).nickname}</p>
            <SeriesCard w={w} s={get(`${lg}1` as Series['id'])} />
            <SeriesCard w={w} s={get(`${lg}2` as Series['id'])} />
          </section>
        ))}
        <section class="card js">
          <h3>日本シリーズ</h3>
          <SeriesCard w={w} s={get('JS')} />
          <p class="small muted">第1・2・6・7戦は{w.year % 2 === 1 ? 'パ' : 'セ'}・リーグ優勝球団の本拠地。引き分けがあれば第8戦以降を行います。</p>
        </section>
      </div>
    </div>
  );
}
