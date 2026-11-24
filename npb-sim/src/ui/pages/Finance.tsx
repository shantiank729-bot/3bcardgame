import { yen } from '../../league/contracts';
import { INVEST_LABEL, PRICE_LABEL, projected, type SeasonFinance } from '../../league/finance';
import { teamById } from '../../league/world';
import { LineChart } from '../components/LineChart';
import { Logo } from '../components/Logo';
import { notify, toast, useWorld } from '../store';

const total = (s: SeasonFinance) => s.ticket + s.broadcast + s.sponsor + s.merch + s.postseason;

export function FinancePage() {
  const w = useWorld();
  const me = w.userTeamId;
  const f = w.finance[me];
  const cur = projected(w, me);
  const rows: [string, number][] = [
    ['チケット収入', cur.ticket], ['放映権', cur.broadcast], ['スポンサー', cur.sponsor], ['グッズ・飲食', cur.merch], ['ポストシーズン', cur.postseason],
  ];
  const costs: [string, number][] = [['年俸総額', cur.payroll], ['運営費（球場・スタッフ・遠征・二軍）', cur.ops], ['育成への投資', cur.invest]];
  const maxV = Math.max(...rows.map((r) => r[1]), ...costs.map((r) => r[1]), 1);
  const hist = f.history;
  return (
    <div class="page">
      <section class="card hero-card" style={{ '--tc': teamById(w, me).primary, '--tc2': teamById(w, me).secondary } as never}>
        <Logo team={teamById(w, me)} size={56} />
        <div>
          <h2>球団の財政（{cur.year}年{cur.closed ? '・確定' : '・見込み'}）</h2>
          <p class="big">収支 <span class={cur.profit >= 0 ? 'ok' : 'warn'}>{cur.profit >= 0 ? '+' : '−'}{yen(Math.abs(cur.profit))}</span></p>
          <p>人気 {f.popularity}・観客動員 {cur.attendance.toLocaleString('ja-JP')}人（1試合平均 {Math.round(cur.attendance / 71.5).toLocaleString('ja-JP')}人・定員 {f.capacity.toLocaleString('ja-JP')}人）</p>
          <p>来季の補強予算の目安 {yen(w.budget[me])}（年俸総額 {yen(cur.payroll)}）</p>
        </div>
      </section>
      <div class="grid2">
        <section class="card">
          <h3>収入</h3>
          {rows.map(([k, v]) => <div class="fbar" key={k}><span>{k}</span><i style={{ width: `${(v / maxV) * 100}%` }} class="in" /><b>{yen(v)}</b></div>)}
          <p class="small">合計 {yen(total(cur))}</p>
          <h3>支出</h3>
          {costs.map(([k, v]) => <div class="fbar" key={k}><span>{k}</span><i style={{ width: `${(v / maxV) * 100}%` }} class="out" /><b>{yen(v)}</b></div>)}
          <p class="muted small">{cur.closed ? '' : f.current.homeGames < 5 ? '開幕前・開幕直後は、昨季の実績から1年分を見込んでいます。' : 'シーズン途中は、ここまでの主催試合から1年分を見込んでいます。'}</p>
        </section>
        <section class="card">
          <h3>経営方針</h3>
          <h4>チケット価格</h4>
          <div class="seg">{([-1, 0, 1] as const).map((p) => <button key={p} class={f.pricing === p ? 'on' : ''} onClick={() => { f.pricing = p; notify(); toast(`チケット価格を${PRICE_LABEL[p]}にしました`); }}>{PRICE_LABEL[p]}</button>)}</div>
          <p class="muted small">安くすると観客が増え人気も上がりやすく、高くすると1人あたりの収入が増えます。</p>
          <h4>育成への投資（二軍施設・コーチ）</h4>
          <div class="seg">{([0, 1, 2] as const).map((v) => <button key={v} class={f.invest === v ? 'on' : ''} onClick={() => { f.invest = v; notify(); toast(`育成への投資を「${INVEST_LABEL[v]}」にしました`); }}>{INVEST_LABEL[v]}</button>)}</div>
          <p class="muted small">25歳以下の選手の成長に上積みがあります（キャンプでの成長に反映）。費用は毎年かかり、予算も少し減ります。</p>
          {hist.length > 1 && <LineChart label="収支の推移（億円）" points={hist.map((h) => ({ x: h.year, y: h.profit / 10000 }))} fmt={(v) => v.toFixed(0)} refLine={0} />}
          {hist.length > 1 && <LineChart label="観客動員（万人）" points={hist.map((h) => ({ x: h.year, y: h.attendance / 10000 }))} fmt={(v) => v.toFixed(0)} />}
        </section>
      </div>
      <section class="card">
        <h3>12球団の比較（{cur.year}年{cur.closed ? '' : '・見込み'}）</h3>
        <div class="tablewrap"><table class="data">
          <thead><tr><th class="l">球団</th><th>人気</th><th>観客動員</th><th>1試合平均</th><th>収入</th><th>年俸総額</th><th>収支</th><th>来季予算</th></tr></thead>
          <tbody>{w.teams.map((t) => {
            const p = projected(w, t.id);
            return (
              <tr key={t.id} class={t.id === me ? 'me' : ''}>
                <td class="l"><span class="tshort"><Logo team={t} size={14} />{t.nickname}</span></td><td>{w.finance[t.id].popularity}</td>
                <td>{p.attendance.toLocaleString('ja-JP')}</td><td>{Math.round(p.attendance / 71.5).toLocaleString('ja-JP')}</td>
                <td>{yen(total(p))}</td><td>{yen(p.payroll)}</td><td class={p.profit >= 0 ? 'ok' : 'warn'}>{p.profit >= 0 ? '+' : '−'}{yen(Math.abs(p.profit))}</td><td>{yen(w.budget[t.id])}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </section>
      {hist.length > 0 && (
        <section class="card">
          <h3>過去の収支</h3>
          <div class="tablewrap"><table class="data">
            <thead><tr><th>年</th><th>観客動員</th><th>チケット</th><th>放映権</th><th>スポンサー</th><th>グッズ</th><th>ポストシーズン</th><th>年俸</th><th>運営費</th><th>投資</th><th>収支</th></tr></thead>
            <tbody>{[...hist].reverse().map((h) => <tr key={h.year}><td>{h.year}</td><td>{h.attendance.toLocaleString('ja-JP')}</td>{[h.ticket, h.broadcast, h.sponsor, h.merch, h.postseason, h.payroll, h.ops, h.invest].map((v, i) => <td key={i}>{yen(v)}</td>)}<td class={h.profit >= 0 ? 'ok' : 'warn'}>{yen(h.profit)}</td></tr>)}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
