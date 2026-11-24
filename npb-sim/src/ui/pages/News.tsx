import { useState } from 'preact/hooks';
import { fmtDate } from '../../league/calendar';
import { computeStandings } from '../../league/standings';
import { LEAGUE_NAMES } from '../../league/teams';
import { teamById, type World } from '../../league/world';
import { PAPER_NAME, type NewsIssue, type Story } from '../../news/types';
import { NewsArt } from '../components/NewsArt';
import { go, useWorld } from '../store';

export function Masthead({ date, no }: { date: string; no: number }) {
  return (
    <header class="masthead">
      <div class="paper-logo" aria-label={PAPER_NAME}>
        <svg viewBox="0 0 60 60" width="44" height="44" aria-hidden="true">
          <circle cx="30" cy="30" r="26" fill="#fff" />
          <path d="M14,12 Q26,30 14,48 M46,12 Q34,30 46,48" fill="none" stroke="#d0021b" stroke-width="3" stroke-dasharray="4 3" />
        </svg>
        <span>{PAPER_NAME}</span>
      </div>
      <div class="mast-info">
        <b>{fmtDate(date, true)}</b>
        <span>第{no}号</span>
        <span>定価160円</span>
      </div>
    </header>
  );
}

function colorsOf(w: World, s: Story) {
  const t = s.tids[0] ? teamById(w, s.tids[0]) : null;
  return { c: t?.primary ?? '#c62828', c2: t?.secondary ?? '#ffffff' };
}

function StoryView({ w, s, size }: { w: World; s: Story; size: 'top' | 'mid' | 'small' }) {
  const { c, c2 } = colorsOf(w, s);
  const link = s.gameId && w.results[s.gameId] ? () => go('game/' + s.gameId) : s.pids[0] ? () => go('player/' + s.pids[0]) : undefined;
  return (
    <article class={`story ${size}`}>
      {size !== 'small' && (
        <div class="artwrap">
          <NewsArt scene={s.scene} c={c} c2={c2} big={s.big} seed={s.id.length} />
          {size === 'top' && <div class="tate">{s.sub}</div>}
        </div>
      )}
      <h2 class="hl">{s.headline}</h2>
      {size !== 'top' && <p class="subhl">{s.sub}</p>}
      <p class="body">{s.body}</p>
      {link && <button class="more" onClick={link}>{s.gameId ? 'ボックススコアを見る' : '選手を見る'} ›</button>}
    </article>
  );
}

export function FrontPage({ w, issue, compact = false }: { w: World; issue: NewsIssue; compact?: boolean }) {
  const no = Object.keys(w.news).sort().indexOf(issue.date) + 1;
  const [top, ...rest] = issue.stories;
  if (compact) {
    return (
      <div class="paper compact" onClick={() => go('news/' + issue.date)}>
        <Masthead date={issue.date} no={no} />
        <StoryView w={w} s={top} size="top" />
      </div>
    );
  }
  const mid = rest.slice(0, 2);
  const small = rest.slice(2);
  const results = Object.values(w.results).filter((g) => g.date === issue.date);
  return (
    <div class="paper">
      <Masthead date={issue.date} no={no} />
      <div class="page1">
        <StoryView w={w} s={top} size="top" />
        {mid.length > 0 && <div class="mids">{mid.map((s) => <StoryView key={s.id} w={w} s={s} size="mid" />)}</div>}
      </div>
      {(small.length > 0 || results.length > 0) && (
        <div class="inner">
          <div class="inner-head">中面</div>
          <div class="inner-grid">
            <div class="smalls">{small.map((s) => <StoryView key={s.id} w={w} s={s} size="small" />)}</div>
            <aside class="paper-box">
              {results.length > 0 && (
                <>
                  <h4>きのうの結果</h4>
                  <ul>{results.map((g) => (
                    <li key={g.id} onClick={() => go('game/' + g.id)}>
                      {teamById(w, g.away).short} {g.awayRuns}-{g.homeRuns} {teamById(w, g.home).short}
                      <small>{g.label ? `${g.kind === 'AS' ? '球宴' : g.kind === 'JS' ? '日本S' : 'CS'}${g.label}` : `勝:${w.players[g.wp ?? 0]?.name.split(' ')[0] ?? '-'}`}</small>
                    </li>
                  ))}</ul>
                </>
              )}
              {w.phase === 'regular' && (['C', 'P'] as const).map((lg) => (
                <div key={lg}>
                  <h4>{LEAGUE_NAMES[lg]}</h4>
                  <ol>{computeStandings(w, lg).map((r) => <li key={r.tid}>{teamById(w, r.tid).short} {r.w}-{r.l}-{r.t} <small>{r.gb ?? '-'}</small></li>)}</ol>
                </div>
              ))}
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}

export function NewsPage({ date }: { date?: string }) {
  const w = useWorld();
  const dates = Object.keys(w.news).sort();
  const [q, setQ] = useState('');
  const [team, setTeam] = useState(0);
  const cur = date && w.news[date] ? date : dates[dates.length - 1];
  if (!cur) return <div class="page"><section class="card"><p>まだ新聞は発行されていません。試合を進めると毎日発行されます。</p></section></div>;
  const i = dates.indexOf(cur);
  const list = dates.slice().reverse().filter((d) => {
    const top = w.news[d].stories;
    if (team && !top.some((s) => s.tids.includes(team))) return false;
    if (q && !top.some((s) => (s.headline + s.body + s.sub).includes(q))) return false;
    return true;
  });
  return (
    <div class="page news">
      <div class="toolbar">
        <button class="btn" disabled={i <= 0} onClick={() => go('news/' + dates[i - 1])}>‹ 前日</button>
        <input type="date" id="newsdate" value={cur} min={dates[0]} max={dates[dates.length - 1]} onChange={(e) => {
          const v = (e.target as HTMLInputElement).value;
          const near = dates.find((d) => d >= v) ?? dates[dates.length - 1];
          go('news/' + near);
        }} />
        <button class="btn" disabled={i >= dates.length - 1} onClick={() => go('news/' + dates[i + 1])}>翌日 ›</button>
      </div>
      <FrontPage w={w} issue={w.news[cur]} />
      <section class="card">
        <h2>バックナンバー</h2>
        <div class="toolbar">
          <input id="newsq" type="search" placeholder="見出し・本文を検索" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <select id="newsteam" value={team} onChange={(e) => setTeam(Number((e.target as HTMLSelectElement).value))}>
            <option value={0}>全球団</option>
            {w.teams.map((t) => <option key={t.id} value={t.id}>{t.city}{t.nickname}</option>)}
          </select>
          <span class="muted small">{list.length}件</span>
        </div>
        <ul class="backnumbers">
          {list.slice(0, 200).map((d) => {
            const s = w.news[d].stories[0];
            return (
              <li key={d} class={d === cur ? 'on' : ''} onClick={() => go('news/' + d)}>
                <span class="d">{fmtDate(d)}</span><b>{s.headline}</b><small>{s.sub}</small>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
