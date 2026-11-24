import { useState } from 'preact/hooks';
import { overall } from '../../players/development';
import { yen } from '../../league/contracts';
import { evaluateTrade, executeTrade, isTradeWindow, playerValue } from '../../league/trade';
import { fmtDate } from '../../league/calendar';
import { rosterOf, teamById, type PlayerRecord, type World } from '../../league/world';
import { Logo } from '../components/Logo';
import { grade, POS_1 } from '../format';
import { notify, toast, useWorld } from '../store';
import { autosave } from '../actions';

function Side({ w, tid, sel, toggle, title }: { w: World; tid: number; sel: Set<number>; toggle: (id: number) => void; title: string }) {
  const [f, setF] = useState<'all' | 'active' | 'farm' | 'ikusei'>('all');
  const list = rosterOf(w, tid).filter((p) => f === 'all' || p.status === f).sort((a, b) => overall(b) - overall(a));
  return (
    <div class="tside">
      <h4><Logo team={teamById(w, tid)} size={18} /> {title}</h4>
      <div class="seg small">{(['all', 'active', 'farm', 'ikusei'] as const).map((k) => <button key={k} class={f === k ? 'on' : ''} onClick={() => setF(k)}>{{ all: '全員', active: '一軍', farm: '二軍', ikusei: '育成' }[k]}</button>)}</div>
      <div class="tablewrap tlist"><table class="data">
        <thead><tr><th /><th class="l">選手</th><th>位</th><th>齢</th><th>総合</th><th>年俸</th></tr></thead>
        <tbody>{list.map((p: PlayerRecord) => (
          <tr key={p.id} class={sel.has(p.id) ? 'sel' : ''} onClick={() => toggle(p.id)}>
            <td><input type="checkbox" checked={sel.has(p.id)} readOnly /></td>
            <td class="l">{p.name}{p.foreign && <em class="tag">外</em>}{p.injury && <em class="tag">傷</em>}</td>
            <td>{POS_1[p.primary]}</td><td>{p.age}</td><td><span class={`grade ${grade(overall(p)).cls}`}>{grade(overall(p)).g}</span></td><td class="small">{yen(p.contract.salary)}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

export function TradePage() {
  const w = useWorld();
  const me = w.userTeamId;
  const others = w.teams.filter((t) => t.id !== me);
  const [them, setThem] = useState(others[0].id);
  const [give, setGive] = useState<Set<number>>(new Set());
  const [get, setGet] = useState<Set<number>>(new Set());
  const tg = (s: Set<number>, set: (x: Set<number>) => void) => (id: number) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); set(n); };
  const ev = evaluateTrade(w, me, them, [...give], [...get]);
  const sum = (s: Set<number>) => [...s].reduce((a, id) => a + playerValue(w.players[id]), 0);
  const propose = () => {
    if (!ev.ok) { toast(ev.reason); return; }
    executeTrade(w, me, them, [...give], [...get]);
    setGive(new Set()); setGet(new Set());
    notify();
    void autosave(w);
    toast('トレードが成立しました');
  };
  return (
    <div class="page">
      <section class="card">
        <h2>トレード</h2>
        <p class="small muted">{isTradeWindow(w) ? 'トレードを申し込めます（シーズン中は7月31日まで）。相手は「今後3年の見込みの働き − 年俸」で損得を判断し、主力を出すときは上乗せを求めます。' : 'いまはトレード期間外です（8月1日〜シーズン終了まで）。'}</p>
        <div class="toolbar">
          <select value={them} onChange={(e) => { setThem(Number((e.target as HTMLSelectElement).value)); setGet(new Set()); }}>
            {others.map((t) => <option key={t.id} value={t.id}>{t.city}{t.nickname}</option>)}
          </select>
        </div>
        <div class="trade">
          <Side w={w} tid={me} sel={give} toggle={tg(give, setGive)} title="出す選手" />
          <Side w={w} tid={them} sel={get} toggle={tg(get, setGet)} title="もらう選手" />
        </div>
        <div class="tradebar">
          <span>出す: {[...give].map((id) => w.players[id].name).join('、') || 'なし'}</span>
          <span>もらう: {[...get].map((id) => w.players[id].name).join('、') || 'なし'}</span>
          <span class="small muted">価値の目安 出す{yen(Math.max(0, sum(give)))} / もらう{yen(Math.max(0, sum(get)))}</span>
          <b class={ev.ok ? 'ok' : 'warn'}>{teamById(w, them).nickname}: 「{ev.reason}」</b>
          <button class="btn primary" disabled={!ev.ok} onClick={propose}>トレードを申し込む</button>
        </div>
      </section>
      <section class="card">
        <h3>トレードの記録</h3>
        <ul>{[...w.trades].reverse().slice(0, 30).map((t, i) => (
          <li key={i}>{fmtDate(t.date, true)} {teamById(w, t.a).nickname}（{t.aGives.map((id) => w.players[id]?.name).join('、')}）⇔ {teamById(w, t.b).nickname}（{t.bGives.map((id) => w.players[id]?.name).join('、')}）</li>
        ))}{w.trades.length === 0 && <li class="muted">まだありません</li>}</ul>
      </section>
    </div>
  );
}
