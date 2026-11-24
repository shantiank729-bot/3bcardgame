import { useState } from 'preact/hooks';
import { addDays, fmtDate, weekday, WEEKDAY_JP } from '../../league/calendar';
import { teamById } from '../../league/world';
import { Logo } from '../components/Logo';
import { go, useWorld } from '../store';

export function Schedule() {
  const w = useWorld();
  const [tid, setTid] = useState(w.userTeamId);
  const months = [...new Set(w.calendar.games.map((g) => g.date.slice(0, 7)))];
  const [month, setMonth] = useState(months.includes(w.date.slice(0, 7)) ? w.date.slice(0, 7) : months[0]);
  const [day, setDay] = useState<string | null>(null);
  const first = month + '-01';
  const start = addDays(first, -weekday(first));
  const cells: string[] = [];
  for (let d = start; d.slice(0, 7) <= month || cells.length % 7 !== 0; d = addDays(d, 1)) {
    cells.push(d);
    if (cells.length > 42) break;
  }
  const gamesOn = (d: string) => w.calendar.games.filter((g) => g.date === d);
  const dayGames = day ? gamesOn(day) : [];
  return (
    <div class="page">
      <section class="card">
        <div class="toolbar">
          <select value={tid} onChange={(e) => setTid(Number((e.target as HTMLSelectElement).value))}>
            {w.teams.map((t) => <option key={t.id} value={t.id}>{t.city}{t.nickname}</option>)}
          </select>
          <div class="seg">
            {months.map((m) => (
              <button key={m} class={m === month ? 'on' : ''} onClick={() => setMonth(m)}>{Number(m.slice(5))}月</button>
            ))}
          </div>
        </div>
        <div class="calendar">
          {WEEKDAY_JP.map((d, i) => <div key={d} class={`wd w${i}`}>{d}</div>)}
          {cells.map((d) => {
            const g = gamesOn(d).find((x) => x.away === tid || x.home === tid);
            const r = g && w.results[g.id];
            const opp = g && teamById(w, g.away === tid ? g.home : g.away);
            let res = '';
            let cls = '';
            if (g && r) {
              const my = g.home === tid ? r.homeRuns : r.awayRuns;
              const op = g.home === tid ? r.awayRuns : r.homeRuns;
              res = `${my > op ? '○' : my < op ? '●' : '△'}${my}-${op}`;
              cls = my > op ? 'win' : my < op ? 'loss' : 'tie';
            }
            const isAS = w.calendar.allStar.includes(d);
            return (
              <button key={d} class={`cell ${d.slice(0, 7) !== month ? 'out' : ''} ${d === w.date ? 'today' : ''} ${cls} ${g?.kind === 'I' ? 'inter' : ''}`}
                onClick={() => (r ? go('game/' + g!.id) : setDay(d))}>
                <span class="dn">{Number(d.slice(8))}</span>
                {opp && <span class="opp"><Logo team={opp} size={16} /><small>{g!.home === tid ? 'vs' : '@'}{opp.short}</small></span>}
                {res && <span class="res">{res}</span>}
                {isAS && <span class="tag">球宴</span>}
              </button>
            );
          })}
        </div>
        <p class="muted small">○勝ち ●負け △引き分け／黄色の枠は交流戦／日付を押すとその日の全試合</p>
      </section>
      {day && (
        <section class="card">
          <h3>{fmtDate(day, true)}</h3>
          {dayGames.length === 0 ? <p class="muted">試合はありません</p> : (
            <ul class="results">
              {dayGames.map((g) => {
                const r = w.results[g.id];
                return (
                  <li key={g.id} onClick={() => r && go('game/' + g.id)}>
                    <span>{teamById(w, g.away).nickname}</span>
                    <b>{r ? `${r.awayRuns} - ${r.homeRuns}` : 'vs'}</b>
                    <span>{teamById(w, g.home).nickname}</span>
                    <small>{teamById(w, g.home).park.name}</small>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
