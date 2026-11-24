import { pitcherStuff } from '../../engine/pa';
import { PITCH_NAMES } from '../../engine/types';
import { teamById, type PlayerSeason, type World } from '../../league/world';
import { batterMetrics, pitcherMetrics, type BatterMetrics, type LeagueContext, type PitcherMetrics } from '../../stats/saber';
import { batterRows, contexts, pitcherRows } from '../../stats/tables';
import { LineChart } from '../components/LineChart';
import { domesticFA, overseasFA, SEASON_DAYS, yen } from '../../league/contracts';
import { overall } from '../../players/development';
import { careerTotals } from '../../news/daily';
import { Logo } from '../components/Logo';
import { f0, f1, f2, f3, grade, handStr, ipStr, pct1, POS_1, POS_JP } from '../format';
import { useWorld } from '../store';

interface YearRow {
  year: number;
  e: PlayerSeason;
  bm?: BatterMetrics;
  pm?: PitcherMetrics;
}

function yearRows(w: World, pid: number): YearRow[] {
  const out: YearRow[] = [];
  const lgOf = (tid: number) => teamById(w, tid).league;
  for (const [y, h] of Object.entries(w.history)) {
    for (const e of h.season) {
      if (e.pid !== pid) continue;
      const ctx: LeagueContext | undefined = h.ctx?.[lgOf(e.tid)];
      out.push({
        year: Number(y), e,
        bm: e.bat && ctx ? batterMetrics(e.bat, e.field, ctx, ctx.parkFactor[e.tid] ?? 1) : undefined,
        pm: e.pitch && ctx ? pitcherMetrics(e.pitch, ctx, ctx.parkFactor[e.tid] ?? 1) : undefined,
      });
    }
  }
  const ctxs = contexts(w);
  const cur = Object.values(w.season).filter((e) => e.pid === pid);
  for (const e of cur) {
    const lg = lgOf(e.tid);
    // 今季はリーグ補正込みの一覧から取る
    const br = e.bat ? batterRows(w, lg, ctxs, [e]).find(() => true) : undefined;
    const pr = e.pitch ? pitcherRows(w, lg, ctxs, [e]).find(() => true) : undefined;
    const full = batterRows(w, lg, ctxs).find((r) => r.pid === pid && r.tid === e.tid);
    out.push({ year: w.year, e, bm: full ?? br, pm: pr });
  }
  return out.sort((a, b) => a.year - b.year);
}

function Bar({ label, v, extra }: { label: string; v: number; extra?: string }) {
  const g = grade(v);
  return (
    <div class="rbar">
      <span class="rl">{label}</span>
      <span class="track"><span class={`fill ${g.cls}`} style={{ width: `${Math.max(2, Math.min(100, v))}%` }} /></span>
      <span class={`grade ${g.cls}`}>{g.g}<small>{extra ?? Math.round(v)}</small></span>
    </div>
  );
}

export function PlayerPage({ id }: { id: number }) {
  const w = useWorld();
  const p = w.players[id];
  if (!p) return <div class="page"><p>選手が見つかりません</p></div>;
  const t = p.teamId ? teamById(w, p.teamId) : null;
  const rows = yearRows(w, id);
  const bats = rows.filter((r) => r.e.bat && r.e.bat.pa > 0);
  const pits = rows.filter((r) => r.e.pitch && r.e.pitch.bf > 0);
  const statusJP = { active: '一軍', farm: '二軍', ikusei: '育成', fa: '自由契約', retired: '引退', mlb: '海外移籍' }[p.status];
  return (
    <div class="page">
      <section class="card hero-card" style={{ '--tc': t?.primary ?? '#333', '--tc2': t?.secondary ?? '#999' } as never}>
        {t && <Logo team={t} size={56} />}
        <div>
          <h2><span class="num">{p.number}</span> {p.name}{p.foreign && <em class="tag">外国人</em>}</h2>
          <p>{t ? t.city + t.nickname : 'フリー'}・{statusJP}・{POS_JP[p.primary]}・{p.age}歳・{handStr(p.bats, p.throws)}</p>
          <p class="small">年俸 {yen(p.contract.salary)}（{p.contract.years > 1 ? `残り${p.contract.years}年` : '単年'}）・プロ{w.year - (p.debutYear ?? w.year) + (w.phase === 'offseason' ? 1 : 0)}年目・一軍登録 {(p.service / SEASON_DAYS).toFixed(1)}シーズン{domesticFA(p) ? (p.faUsed ? '・FA行使済' : '・国内FA権あり') : ''}{overseasFA(p) ? '・海外FA権あり' : ''}</p>
          {p.injury && <p class="small warn">ケガ: {p.injury.desc}（復帰まで約{p.injury.days}日）</p>}
          <p class="small">調子: {(p.form ?? 0) > 0.4 ? '絶好調 ☀' : (p.form ?? 0) > 0.1 ? '好調 ⛅' : (p.form ?? 0) < -0.4 ? '絶不調 ☂' : (p.form ?? 0) < -0.1 ? '不調 ☁' : '普通'}</p>
        </div>
      </section>
      <div class="grid2">
        <section class="card">
          <h3>能力</h3>
          <p class="muted small">現在はスカウト評価ではなく本当の能力を表示しています（スカウト機能はフェーズ6）。</p>
          {p.isPitcher && p.pit ? (
            <>
              <Bar label="総合" v={overall(p)} />
              <Bar label="将来性" v={p.pot} />
              <Bar label="球速" v={(p.pit.velocity - 120) * 2.2} extra={Math.round(p.pit.velocity) + 'km'} />
              <Bar label="球威" v={pitcherStuff(p.pit)} />
              <Bar label="制球" v={p.pit.control} />
              <Bar label="スタミナ" v={p.pit.stamina} />
              <p>傾向: {p.pit.groundball > 10 ? 'ゴロ投手' : p.pit.groundball < -10 ? 'フライ投手' : '標準'}</p>
              <h4>変化球</h4>
              {p.pit.pitches.map((x) => <Bar key={x.type} label={PITCH_NAMES[x.type]} v={x.quality} />)}
            </>
          ) : (
            <>
              <Bar label="総合" v={overall(p)} />
              <Bar label="将来性" v={p.pot} />
              <Bar label="ミート" v={p.bat.contact} />
              <Bar label="パワー" v={p.bat.power} />
              <Bar label="選球眼" v={p.bat.eye} />
              <Bar label="走力" v={p.bat.speed} />
              <Bar label="守備力" v={p.bat.fielding} />
              <Bar label="肩" v={p.bat.arm} />
              <Bar label="捕球" v={p.bat.catching} />
              <p>守備位置: {Object.entries(p.bat.positions).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).map(([k, v]) => `${POS_1[k]}(${grade(v ?? 0).g})`).join(' ')}</p>
            </>
          )}
        </section>
        <section class="card">
          <h3>指標の推移</h3>
          {p.isPitcher ? (
            <>
              <LineChart label="WAR" points={pits.map((r) => ({ x: r.year, y: r.pm?.war ?? 0 }))} />
              <LineChart label="FIP" points={pits.map((r) => ({ x: r.year, y: r.pm?.fip ?? 0 }))} fmt={f2} />
            </>
          ) : (
            <>
              <LineChart label="WAR" points={bats.map((r) => ({ x: r.year, y: r.bm?.war ?? 0 }))} />
              <LineChart label="wRC+" points={bats.map((r) => ({ x: r.year, y: r.bm?.wrcPlus ?? 0 }))} fmt={f0} refLine={100} />
            </>
          )}
        </section>
      </div>
      {bats.length > 0 && !p.isPitcher && (
        <section class="card">
          <h3>打撃成績</h3>
          <div class="tablewrap"><table class="data">
            <thead><tr><th>年</th><th>球団</th><th>試合</th><th>打席</th><th>打数</th><th>安打</th><th>二</th><th>三</th><th>本</th><th>打点</th><th>盗塁</th><th>四球</th><th>三振</th><th>打率</th><th>出塁</th><th>長打</th><th>OPS</th><th>wOBA</th><th>wRC+</th><th>WAR</th></tr></thead>
            <tbody>{bats.map((r) => {
              const b = r.e.bat!, m = r.bm;
              return (
                <tr key={r.year + '-' + r.e.tid}>
                  <td>{r.year}</td><td>{teamById(w, r.e.tid).short}</td><td>{b.g}</td><td>{b.pa}</td><td>{b.ab}</td><td>{b.h}</td><td>{b.d}</td><td>{b.t}</td><td>{b.hr}</td><td>{b.rbi}</td><td>{b.sb}</td><td>{b.bb}</td><td>{b.k}</td>
                  <td>{f3(b.ab ? b.h / b.ab : 0)}</td><td>{m ? f3(m.obp) : '-'}</td><td>{m ? f3(m.slg) : '-'}</td><td>{m ? f3(m.ops) : '-'}</td><td>{m ? f3(m.woba) : '-'}</td><td>{m ? f0(m.wrcPlus) : '-'}</td><td>{m ? f1(m.war) : '-'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
          {bats.at(-1)?.bm && (() => {
            const m = bats.at(-1)!.bm!;
            return <p class="small">今季: ISO {f3(m.iso)}・BABIP {f3(m.babip)}・K% {pct1(m.kPct)}・BB% {pct1(m.bbPct)}・OPS+ {f0(m.opsPlus)}・得点圏 {f3(m.rispAvg)}・守備 {f1(m.fldRuns)}点・走塁 {f1(m.bsrRuns)}点</p>;
          })()}
        </section>
      )}
      {pits.length > 0 && (
        <section class="card">
          <h3>投手成績</h3>
          <div class="tablewrap"><table class="data">
            <thead><tr><th>年</th><th>球団</th><th>登板</th><th>先発</th><th>勝</th><th>敗</th><th>S</th><th>H</th><th>投球回</th><th>被安</th><th>被本</th><th>四球</th><th>三振</th><th>防御率</th><th>FIP</th><th>ERA+</th><th>WHIP</th><th>K/9</th><th>WAR</th></tr></thead>
            <tbody>{pits.map((r) => {
              const x = r.e.pitch!, m = r.pm;
              return (
                <tr key={r.year + '-' + r.e.tid}>
                  <td>{r.year}</td><td>{teamById(w, r.e.tid).short}</td><td>{x.g}</td><td>{x.gs}</td><td>{x.w}</td><td>{x.l}</td><td>{x.sv}</td><td>{x.hld}</td><td>{ipStr(x.outs)}</td><td>{x.h}</td><td>{x.hr}</td><td>{x.bb}</td><td>{x.k}</td>
                  <td>{f2(x.outs ? (x.er * 27) / x.outs : 0)}</td><td>{m ? f2(m.fip) : '-'}</td><td>{m ? f0(m.eraPlus) : '-'}</td><td>{m ? f2(m.whip) : '-'}</td><td>{m ? f2(m.k9) : '-'}</td><td>{m ? f1(m.war) : '-'}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </section>
      )}
      <section class="card">
        <h3>経歴</h3>
        <ul class="career">
          {[...p.events].sort((a, b) => a.year - b.year).map((e, i) => <li key={i}><span>{e.year}年</span>{e.text}</li>)}
        </ul>
        {(() => {
          const c = careerTotals(w, p.id);
          return <p class="small">通算: {p.isPitcher ? `${c.pg}登板 ${c.w}勝${c.l}敗${c.sv}S${c.hld}H ${c.k}奪三振 ${Math.floor(c.outs / 3)}回` : `${c.g}試合 ${c.h}安打 ${c.hr}本塁打 ${c.rbi}打点 ${c.sb}盗塁`}{p.pre ? '（このゲーム開始前の記録を含む）' : ''}</p>;
        })()}
        <p class="muted small">高校・大学時代の記録はフェーズ6で追加されます。</p>
      </section>
    </div>
  );
}
