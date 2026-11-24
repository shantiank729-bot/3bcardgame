import { useState } from 'preact/hooks';
import { overall } from '../../players/development';
import { domesticFA, seasonsOf, yen } from '../../league/contracts';
import { advanceOffseason, makeFAOffer, payroll, proposeContract, signFreeAgent, STAGES } from '../../league/offseason';
import { shihaika, SHIHAIKA_MAX } from '../../league/rosterOps';
import { fmtDate } from '../../league/calendar';
import { rosterOf, teamById, type PlayerRecord, type World } from '../../league/world';
import { Logo } from '../components/Logo';
import { f1, grade, POS_1 } from '../format';
import { go, notify, toast, useWorld } from '../store';
import { autosave } from '../actions';
import { ConfirmButton } from '../components/ConfirmButton';

const G = ({ v }: { v: number }) => <span class={`grade ${grade(v).cls}`}>{grade(v).g}<small>{Math.round(v)}</small></span>;
const P = ({ p }: { p: PlayerRecord }) => <a href={'#/player/' + p.id}>{p.name}</a>;
const posOf = (p: PlayerRecord) => POS_1[p.primary] ?? '';

function Budget({ w }: { w: World }) {
  const me = w.userTeamId;
  return <p class="small">支配下 <b>{shihaika(w, me).length}</b>/{SHIHAIKA_MAX}人・育成 {rosterOf(w, me, 'ikusei').length}人・年俸総額 <b>{yen(payroll(w, me))}</b>（予算 {yen(w.budget[me])}）</p>;
}

export function OffPage() {
  const w = useWorld();
  const st = w.off;
  const [, set] = useState(0);
  const refresh = () => { set((x) => x + 1); notify(); };
  if (!st) {
    return (
      <div class="page">
        <section class="card"><h2>オフシーズン</h2><p class="muted">日本シリーズが終わるとオフシーズンです。戦力外・FA・契約更改・現役ドラフト・外国人獲得・キャンプを順に進めて、次のシーズンを迎えます。</p></section>
        {w.devReport && w.devReport.length > 0 && <DevReport w={w} />}
      </div>
    );
  }
  const idx = STAGES.findIndex((s) => s.key === st.stage);
  const next = () => {
    advanceOffseason(w);
    void autosave(w);
    if (!w.off) {
      toast(`${w.year}年シーズンが始まります`);
      go('off');
    }
    refresh();
  };
  return (
    <div class="page">
      <section class="card">
        <h2>{st.year}年オフシーズン</h2>
        <ol class="stepper">
          {STAGES.map((s, i) => <li key={s.key} class={i < idx ? 'done' : i === idx ? 'now' : ''}><span>{s.label}</span><small>{s.md.replace('-', '/')}</small></li>)}
        </ol>
        <p class="muted small">{fmtDate(w.date, true)}・トレードはオフシーズン中いつでも申し込めます（<a href="#/trade">トレード</a>）</p>
        <Budget w={w} />
      </section>
      {st.stage === 'release' && <ReleaseStage w={w} refresh={refresh} />}
      {st.stage === 'fa' && <FAStage w={w} refresh={refresh} />}
      {st.stage === 'contract' && <ContractStage w={w} refresh={refresh} />}
      {st.stage === 'gendai' && <section class="card"><h3>現役ドラフト</h3><p>出場機会に恵まれない選手を各球団が2人ずつ出し、それぞれ1人を獲得します（あなたの球団の候補はAIが選びます）。</p></section>}
      {st.stage === 'foreign' && <MarketStage w={w} refresh={refresh} />}
      {st.stage === 'camp' && <section class="card"><h3>春季キャンプ</h3><p>キャンプを打ち上げると、年齢が1つ上がり、若手の成長・ベテランの衰えが反映され、新しいシーズンの日程が組まれます。一軍のメンバーは能力順に組み直されます。</p></section>}
      <section class="card">
        <div class="btns">
          <ConfirmButton cls="btn primary big" onConfirm={next} ask="もう一度押すと確定します">
            {st.stage === 'release' ? '戦力外を通告して次へ' : st.stage === 'fa' ? 'FA交渉を締め切って次へ' : st.stage === 'contract' ? '契約更改を終えて次へ' : st.stage === 'gendai' ? '現役ドラフトを行って次へ' : st.stage === 'foreign' ? '補強を終えてキャンプへ' : 'キャンプを打ち上げて新シーズンへ'}
          </ConfirmButton>
        </div>
      </section>
      {st.gendai.length > 0 && (
        <section class="card"><h3>現役ドラフトの結果</h3>
          <ul>{st.gendai.map((g) => <li key={g.pid}>{w.players[g.pid].name}: {teamById(w, g.from).nickname} → {teamById(w, g.to).nickname}</li>)}</ul>
        </section>
      )}
      {st.retired.length > 0 && (
        <section class="card"><h3>引退・退団した主な選手</h3>
          <p class="small">{st.retired.map((id) => w.players[id]).filter((p) => overall(p) >= 50 || st.released.includes(p.id) === false).slice(0, 40).map((p) => `${p.name}（${p.age}歳）`).join('、')}</p>
        </section>
      )}
    </div>
  );
}

function ReleaseStage({ w, refresh }: { w: World; refresh: () => void }) {
  const st = w.off!;
  const [sel, setSel] = useState<Set<number>>(() => new Set(st.userRelease.length ? st.userRelease : st.releaseSuggest));
  st.userRelease = [...sel];
  const roster = rosterOf(w, w.userTeamId).sort((a, b) => (a.status === b.status ? overall(a) - overall(b) : a.status === 'ikusei' ? 1 : -1));
  const shi = shihaika(w, w.userTeamId).length;
  const after = shi - roster.filter((p) => sel.has(p.id) && p.status !== 'ikusei').length;
  return (
    <section class="card">
      <h3>戦力外通告</h3>
      <p>来季の構想から外れる選手を選んでください。チェックはAIのおすすめです。支配下は70人まで（FA・外国人の補強枠も考えて）。</p>
      <p class="big">通告後の支配下: {after}人 {after > SHIHAIKA_MAX && <em class="tag">70人を超えています</em>}</p>
      <div class="tablewrap"><table class="data">
        <thead><tr><th /><th class="l">選手</th><th>区分</th><th>位</th><th>齢</th><th>総合</th><th>将来性</th><th>年俸</th><th>今季WAR</th><th class="l">契約</th></tr></thead>
        <tbody>{roster.map((p) => (
          <tr key={p.id} class={sel.has(p.id) ? 'sel' : ''}>
            <td><input type="checkbox" checked={sel.has(p.id)} disabled={p.contract.years > 1} onChange={() => { const s = new Set(sel); s.has(p.id) ? s.delete(p.id) : s.add(p.id); setSel(s); refresh(); }} /></td>
            <td class="l"><P p={p} />{p.foreign && <em class="tag">外</em>}{st.releaseSuggest.includes(p.id) && <em class="tag sug">推</em>}</td>
            <td>{p.status === 'ikusei' ? '育成' : p.status === 'active' ? '一軍' : '二軍'}</td><td>{posOf(p)}</td><td>{p.age}</td><td><G v={overall(p)} /></td><td><G v={p.pot} /></td>
            <td>{yen(p.contract.salary)}</td><td>{f1(st.warLast[p.id] ?? 0)}</td><td class="l small">{p.contract.years > 1 ? `残り${p.contract.years}年（複数年）` : p.status === 'ikusei' ? '育成契約' : '1年'}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

function FAStage({ w, refresh }: { w: World; refresh: () => void }) {
  const st = w.off!;
  const [form, setForm] = useState<Record<number, { salary: number; years: number }>>({});
  if (st.fa.length === 0) return <section class="card"><h3>FA</h3><p>今オフにFA権を行使した選手はいません。</p></section>;
  return (
    <section class="card">
      <h3>FA宣言した選手</h3>
      <p class="small muted">国内FAの選手に条件を提示できます。選手は年俸・年数・チームの強さ・元の球団への愛着で行き先を決めます。A/Bランクの選手を獲得すると、元の球団に金銭補償（年俸の80%/60%）を支払います。</p>
      <div class="tablewrap"><table class="data">
        <thead><tr><th class="l">選手</th><th class="l">前所属</th><th>種別</th><th>位</th><th>齢</th><th>総合</th><th>希望年俸</th><th>他球団</th><th class="l">あなたの提示</th></tr></thead>
        <tbody>{st.fa.map((f) => {
          const p = w.players[f.pid];
          const mine = f.offers.find((o) => o.tid === w.userTeamId);
          const fv = form[f.pid] ?? { salary: mine?.salary ?? f.ask, years: mine?.years ?? (p.age <= 30 ? 3 : 2) };
          return (
            <tr key={f.pid}>
              <td class="l"><P p={p} /></td><td class="l"><Logo team={teamById(w, f.from)} size={14} /> {teamById(w, f.from).nickname}</td>
              <td>{f.kind === 'overseas' ? '海外' : `国内${f.rank}`}</td><td>{posOf(p)}</td><td>{p.age}</td><td><G v={overall(p)} /></td><td>{yen(f.ask)}</td>
              <td>{f.offers.filter((o) => o.tid !== w.userTeamId).length}球団</td>
              <td class="l">{f.kind === 'overseas' ? <span class="muted">海外移籍を目指す</span> : (
                <span class="offer">
                  <input type="number" step={100} min={440} value={fv.salary} onInput={(e) => setForm({ ...form, [f.pid]: { ...fv, salary: Number((e.target as HTMLInputElement).value) } })} />万円×
                  <select value={fv.years} onChange={(e) => setForm({ ...form, [f.pid]: { ...fv, years: Number((e.target as HTMLSelectElement).value) } })}>{[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y}年</option>)}</select>
                  <button class="btn" onClick={() => { const err = makeFAOffer(w, f.pid, fv.salary, fv.years); toast(err ?? `${p.name}に提示しました`); refresh(); }}>{mine ? '再提示' : '提示'}</button>
                </span>
              )}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </section>
  );
}

function ContractStage({ w, refresh }: { w: World; refresh: () => void }) {
  const st = w.off!;
  const [vals, setVals] = useState<Record<number, number>>({});
  const results = st.fa.filter((f) => f.result);
  return (
    <>
      {results.length > 0 && (
        <section class="card"><h3>FAの結果</h3>
          <ul>{results.map((f) => <li key={f.pid}>{w.players[f.pid].name}: {f.result!.mlb ? '海外移籍' : f.result!.tid === f.from ? `${teamById(w, f.from).nickname}に残留` : `${teamById(w, f.from).nickname} → ${teamById(w, f.result!.tid!).nickname}（${f.result!.years}年・${yen(f.result!.salary)}）`}</li>)}</ul>
        </section>
      )}
      <section class="card">
        <h3>契約更改</h3>
        <p class="small muted">選手の希望額の97%以上を提示すると一発サイン。下回ると保留になり、最後は双方の中間で決着します。減額は1億円超なら40%、以下は25%までが目安です。</p>
        <div class="tablewrap"><table class="data">
          <thead><tr><th class="l">選手</th><th>齢</th><th>今季WAR</th><th>現年俸</th><th>希望</th><th class="l">提示額</th><th>状態</th></tr></thead>
          <tbody>{st.talks.map((t) => {
            const p = w.players[t.pid];
            const v = vals[t.pid] ?? t.offer;
            return (
              <tr key={t.pid}>
                <td class="l"><P p={p} /></td><td>{p.age}</td><td>{f1(st.warLast[p.id] ?? 0)}</td><td>{yen(p.contract.salary)}</td><td>{yen(t.ask)}</td>
                <td class="l">{t.status === 'signed' ? yen(p.contract.salary) : (
                  <span class="offer"><input type="number" step={10} value={v} onInput={(e) => setVals({ ...vals, [t.pid]: Number((e.target as HTMLInputElement).value) })} />万円
                    <button class="btn" onClick={() => { proposeContract(w, t.pid, v); refresh(); }}>提示</button></span>
                )}</td>
                <td>{t.status === 'signed' ? <span class="ok">サイン</span> : t.status === 'holdout' ? <span class="warn">保留</span> : '交渉前'}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </section>
    </>
  );
}

function MarketStage({ w, refresh }: { w: World; refresh: () => void }) {
  const st = w.off!;
  const pool = st.market.map((id) => w.players[id]).filter((p) => p && p.status === 'fa').sort((a, b) => overall(b) - overall(a));
  return (
    <section class="card">
      <h3>外国人選手・自由契約選手の獲得</h3>
      <p class="small muted">一軍に登録できる外国人は4人まで（投手・野手それぞれ3人まで）。支配下に何人いても構いません。</p>
      <div class="tablewrap"><table class="data">
        <thead><tr><th class="l">選手</th><th>区分</th><th>位</th><th>齢</th><th>総合</th><th class="l">特徴</th><th>年俸</th><th /></tr></thead>
        <tbody>{pool.map((p) => (
          <tr key={p.id}>
            <td class="l"><P p={p} /></td><td>{p.foreign ? '外国人' : `自由契約${domesticFA(p) ? '' : ''}`}</td><td>{posOf(p)}</td><td>{p.age}</td><td><G v={overall(p)} /></td>
            <td class="l small">{p.isPitcher && p.pit ? `${Math.round(p.pit.velocity)}km・制球${grade(p.pit.control).g}` : `ミ${grade(p.bat.contact).g} パ${grade(p.bat.power).g} 走${grade(p.bat.speed).g}`}・プロ{f1(seasonsOf(p))}年</td>
            <td>{yen(p.contract.salary)}</td>
            <td><button class="btn" onClick={() => { const e = signFreeAgent(w, p, w.userTeamId); toast(e ?? `${p.name}と契約しました`); refresh(); }}>契約</button></td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

export function DevReport({ w }: { w: World }) {
  const rep = (w.devReport ?? []).map((r) => ({ ...r, p: w.players[r.pid], d: r.after - r.before })).filter((r) => r.p).sort((a, b) => b.d - a.d);
  return (
    <section class="card">
      <h3>キャンプでの成長（{w.year}年）</h3>
      <div class="grid2">
        <div><h4>伸びた選手</h4><ul>{rep.slice(0, 8).map((r) => <li key={r.pid}><P p={r.p} />（{r.p.age}歳） {r.before.toFixed(0)} → <b class="ok">{r.after.toFixed(0)}</b></li>)}</ul></div>
        <div><h4>衰えが見える選手</h4><ul>{rep.slice(-6).reverse().filter((r) => r.d < 0).map((r) => <li key={r.pid}><P p={r.p} />（{r.p.age}歳） {r.before.toFixed(0)} → <b class="warn">{r.after.toFixed(0)}</b></li>)}</ul></div>
      </div>
    </section>
  );
}
