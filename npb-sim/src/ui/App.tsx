import { fmtDate } from '../league/calendar';
import { teamById } from '../league/world';
import { isInSeason } from '../league/sim';
import { simOneDay, simSpan } from './actions';
import { Logo } from './components/Logo';
import { GamePage } from './pages/Game';
import { Home } from './pages/Home';
import { Leaders } from './pages/Leaders';
import { PlayerPage } from './pages/Player';
import { Saber } from './pages/Saber';
import { Saves } from './pages/Saves';
import { Schedule } from './pages/Schedule';
import { Standings } from './pages/Standings';
import { TeamPage } from './pages/Team';
import { Title } from './pages/Title';
import { Watch } from './pages/Watch';
import { NewsPage } from './pages/News';
import { PostPage } from './pages/Post';
import { AwardsPage } from './pages/Awards';
import { useState } from 'preact/hooks';
import { live } from './live';
import { useRoute, useStore } from './store';

// [ルート, 表示名, アイコン, スマホの下部バーに常に出すか]
const NAV: [string, string, string, boolean][] = [
  ['home', 'ホーム', '⌂', true],
  ['watch', '観戦', '◉', true],
  ['news', '新聞', '▤', true],
  ['standings', '順位表', '☰', true],
  ['schedule', '日程', '▦', false],
  ['leaders', '成績', '★', false],
  ['saber', 'セイバー', '∑', false],
  ['post', 'ポストシーズン', '♛', false],
  ['awards', '表彰', '✪', false],
  ['team', 'チーム', '⚾', true],
  ['saves', 'セーブ', '⛁', false],
];

export function App() {
  const s = useStore();
  const route = useRoute();
  const [more, setMore] = useState(false);
  const w = s.world;
  if (!w) return <><Title />{s.toast && <div class="toast">{s.toast}</div>}</>;
  const me = teamById(w, w.userTeamId);
  const [page, arg] = route;
  let body;
  switch (page) {
    case 'standings': body = <Standings />; break;
    case 'schedule': body = <Schedule />; break;
    case 'leaders': body = <Leaders />; break;
    case 'saber': body = <Saber />; break;
    case 'team': body = <TeamPage id={Number(arg ?? me.id)} key={arg} />; break;
    case 'player': body = <PlayerPage id={Number(arg)} key={arg} />; break;
    case 'game': body = <GamePage id={Number(arg)} />; break;
    case 'saves': body = <Saves />; break;
    case 'watch': body = <Watch />; break;
    case 'news': body = <NewsPage date={arg} key={arg} />; break;
    case 'post': body = <PostPage />; break;
    case 'awards': body = <AwardsPage />; break;
    default: body = <Home />;
  }
  const active = page ?? 'home';
  const regular = isInSeason(w);
  return (
    <div class="app" style={{ '--tc': me.primary, '--tc2': me.secondary } as never}>
      <header class="topbar">
        <a class="brand" href="#/home"><Logo team={me} size={30} /><span>{me.nickname}</span></a>
        <div class="date">{w.year}年 {fmtDate(w.date)}</div>
        <div class="simbtns">
          <button class="btn primary" disabled={!regular || !!s.busy} onClick={() => simOneDay()}>1日</button>
          <button class="btn" disabled={!regular || !!s.busy} onClick={() => simSpan('week')}>1週間</button>
          <button class="btn" disabled={!regular || !!s.busy} onClick={() => simSpan('month')}>月末</button>
          <button class="btn" disabled={!regular || !!s.busy} onClick={() => simSpan('season')}>全日程</button>
        </div>
      </header>
      <nav class={`nav ${more ? 'open' : ''}`} onClick={() => setMore(false)}>
        {NAV.filter(([k]) => k !== 'watch' || live).map(([k, label, icon, main]) => (
          <a key={k} href={'#/' + k} class={`${active === k ? 'on' : ''} ${main ? '' : 'sec'}`}><span class="ic">{icon}</span><span>{label}</span></a>
        ))}
        <button class="morebtn" onClick={(e) => { e.stopPropagation(); setMore(!more); }}><span class="ic">≡</span><span>その他</span></button>
      </nav>
      <main>{body}</main>
      {s.busy && (
        <div class="overlay">
          <div class="busy">
            <div class="spinner" />
            <p>{s.busy.label}を計算中…</p>
            <p class="big">{fmtDate(s.busy.date)}</p>
            {s.busy.cancel && <button class="btn" onClick={s.busy.cancel}>止める</button>}
          </div>
        </div>
      )}
      {s.toast && <div class="toast">{s.toast}</div>}
    </div>
  );
}
