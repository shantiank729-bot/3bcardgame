import { fmtDate } from '../league/calendar';
import { teamById } from '../league/world';
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
import { useRoute, useStore } from './store';

const NAV: [string, string, string][] = [
  ['home', 'ホーム', '⌂'],
  ['standings', '順位表', '☰'],
  ['schedule', '日程', '▦'],
  ['leaders', '成績', '★'],
  ['saber', 'セイバー', '∑'],
  ['team', 'チーム', '⚾'],
  ['saves', 'セーブ', '⛁'],
];

export function App() {
  const s = useStore();
  const route = useRoute();
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
    default: body = <Home />;
  }
  const active = page ?? 'home';
  const regular = w.phase === 'regular';
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
      <nav class="nav">
        {NAV.map(([k, label, icon]) => (
          <a key={k} href={'#/' + k} class={active === k ? 'on' : ''}><span class="ic">{icon}</span><span>{label}</span></a>
        ))}
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
