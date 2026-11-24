import { useState } from 'preact/hooks';
import { LEAGUE_NAMES, type LeagueId } from '../../league/teams';
import { teamById } from '../../league/world';
import { batterRows, contexts, METRIC_HELP, pitcherRows, teamRows, type BatterRow, type PitcherRow, type TeamRow } from '../../stats/tables';
import { DataTable, type Column } from '../components/DataTable';
import { Logo } from '../components/Logo';
import { f0, f1, f2, f3, ipStr, pct1 } from '../format';
import { useWorld } from '../store';

export function Saber() {
  const w = useWorld();
  const [tab, setTab] = useState<'bat' | 'pit' | 'team' | 'league'>('bat');
  const [lg, setLg] = useState<LeagueId | 'ALL'>('ALL');
  const [qual, setQual] = useState(true);
  const ctx = contexts(w);
  const tshort = (tid: number) => {
    const t = teamById(w, tid);
    return <span class="tshort"><Logo team={t} size={14} />{t.short}</span>;
  };
  const name = (r: { pid: number; name: string }) => <a href={'#/player/' + r.pid}>{r.name}</a>;
  const n = (k: string, label: string, v: (r: BatterRow) => number, fmt: (x: number) => string, asc = false): Column<BatterRow> => ({ key: k, label, value: v, render: (r) => fmt(v(r)), help: METRIC_HELP[label], asc });
  const batCols: Column<BatterRow>[] = [
    { key: 'name', label: '選手', value: (r) => r.name, render: name, cls: 'l' },
    { key: 'team', label: '球団', value: (r) => r.tid, render: (r) => tshort(r.tid) },
    n('pa', '打席', (r) => r.pa, f0),
    n('avg', 'AVG', (r) => r.avg, f3), n('obp', 'OBP', (r) => r.obp, f3), n('slg', 'SLG', (r) => r.slg, f3), n('ops', 'OPS', (r) => r.ops, f3),
    n('hr', '本', (r) => r.b.hr, f0), n('iso', 'ISO', (r) => r.iso, f3), n('babip', 'BABIP', (r) => r.babip, f3),
    n('k', 'K%', (r) => r.kPct, pct1, true), n('bb', 'BB%', (r) => r.bbPct, pct1),
    n('woba', 'wOBA', (r) => r.woba, f3), n('wrc', 'wRC+', (r) => r.wrcPlus, f0), n('opsp', 'OPS+', (r) => r.opsPlus, f0),
    n('risp', 'RISP', (r) => r.rispAvg, f3), n('fld', '守備', (r) => r.fldRuns, f1), n('war', 'WAR', (r) => r.war, f1),
  ];
  const p = (k: string, label: string, v: (r: PitcherRow) => number, fmt: (x: number) => string, asc = false): Column<PitcherRow> => ({ key: k, label, value: v, render: (r) => fmt(v(r)), help: METRIC_HELP[label], asc });
  const pitCols: Column<PitcherRow>[] = [
    { key: 'name', label: '選手', value: (r) => r.name, render: name, cls: 'l' },
    { key: 'team', label: '球団', value: (r) => r.tid, render: (r) => tshort(r.tid) },
    { key: 'ip', label: '投球回', value: (r) => r.p.outs, render: (r) => ipStr(r.p.outs) },
    p('w', '勝', (r) => r.p.w, f0), p('l', '敗', (r) => r.p.l, f0), p('sv', 'S', (r) => r.p.sv, f0),
    p('era', 'ERA', (r) => r.era, f2, true), p('fip', 'FIP', (r) => r.fip, f2, true), p('erap', 'ERA+', (r) => r.eraPlus, f0),
    p('whip', 'WHIP', (r) => r.whip, f2, true), p('k9', 'K/9', (r) => r.k9, f2), p('bb9', 'BB/9', (r) => r.bb9, f2, true),
    p('kbb', 'K-BB%', (r) => r.kbbPct, pct1), p('babip', 'BABIP', (r) => r.babip, f3, true), p('gb', 'GB%', (r) => r.gbPct, pct1),
    { key: 'war', label: 'WAR', value: (r) => r.war, render: (r) => f1(r.war), help: METRIC_HELP.pWAR },
  ];
  const t = (k: string, label: string, v: (r: TeamRow) => number, fmt: (x: number) => string): Column<TeamRow> => ({ key: k, label, value: v, render: (r) => fmt(v(r)), help: METRIC_HELP[label] });
  const teamCols: Column<TeamRow>[] = [
    { key: 'team', label: '球団', value: (r) => r.tid, render: (r) => tshort(r.tid), cls: 'l' },
    t('w', '勝', (r) => r.w, f0), t('l', '敗', (r) => r.l, f0), t('pct', '勝率', (r) => r.pct, f3),
    t('rs', '得点', (r) => r.rs, f0), t('ra', '失点', (r) => r.ra, f0), t('diff', '得失差', (r) => r.diff, (x) => (x > 0 ? '+' : '') + x),
    t('py', 'PYTH', (r) => r.pythag, f3), t('xw', '期待勝', (r) => r.expW, f1), t('luck', 'LUCK', (r) => r.luck, (x) => (x > 0 ? '+' : '') + x.toFixed(1)),
    t('avg', 'AVG', (r) => r.avg, f3), t('ops', 'OPS', (r) => r.ops, f3), t('risp', 'RISP', (r) => r.risp, f3), t('hr', '本', (r) => r.hr, f0),
    t('sb', '盗塁', (r) => r.sb, f0), t('era', 'ERA', (r) => r.era, f2), t('e', '失策', (r) => r.errors, f0), t('pf', 'PF', (r) => r.pf, f2),
  ];
  const brows = batterRows(w, lg, ctx).filter((r) => !qual || r.qualified);
  const prows = pitcherRows(w, lg, ctx).filter((r) => !qual || r.qualified);
  return (
    <div class="page">
      <div class="toolbar">
        <div class="seg">
          {([['bat', '打者'], ['pit', '投手'], ['team', 'チーム'], ['league', 'リーグ係数']] as const).map(([k, l]) => (
            <button key={k} class={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {(tab === 'bat' || tab === 'pit') && (
          <>
            <select value={lg} onChange={(e) => setLg((e.target as HTMLSelectElement).value as never)}>
              <option value="ALL">両リーグ</option><option value="C">{LEAGUE_NAMES.C}</option><option value="P">{LEAGUE_NAMES.P}</option>
            </select>
            <label class="check"><input type="checkbox" checked={qual} onChange={(e) => setQual((e.target as HTMLInputElement).checked)} /> 規定{tab === 'bat' ? '打席' : '投球回'}以上</label>
          </>
        )}
      </div>
      <section class="card">
        {tab === 'bat' && <DataTable cols={batCols} rows={brows} initial="war" rowKey={(r) => r.pid + '-' + r.tid} />}
        {tab === 'pit' && <DataTable cols={pitCols} rows={prows} initial="war" rowKey={(r) => r.pid + '-' + r.tid} />}
        {tab === 'team' && (['C', 'P'] as const).map((l) => (
          <div key={l}><h3>{LEAGUE_NAMES[l]}</h3><DataTable cols={teamCols} rows={teamRows(w, l, ctx)} initial="pct" rowKey={(r) => r.tid} /></div>
        ))}
        {tab === 'league' && (
          <div class="grid2">
            {(['C', 'P'] as const).map((l) => {
              const c = ctx[l];
              return (
                <div key={l}>
                  <h3>{LEAGUE_NAMES[l]} {w.year}年</h3>
                  <table class="data kv">
                    <tbody>
                      <tr><th>リーグ打率/出塁率/長打率</th><td>{f3(c.avg)} / {f3(c.obp)} / {f3(c.slg)}</td></tr>
                      <tr><th>リーグ防御率</th><td>{f2(c.era)}</td></tr>
                      <tr><th>wOBA係数 四球/死球</th><td>{f3(c.weights.bb)} / {f3(c.weights.hbp)}</td></tr>
                      <tr><th>単打/二塁打/三塁打/本塁打</th><td>{f3(c.weights.b1)} / {f3(c.weights.b2)} / {f3(c.weights.b3)} / {f3(c.weights.hr)}</td></tr>
                      <tr><th>wOBAスケール</th><td>{f3(c.weights.scale)}</td></tr>
                      <tr><th>FIP定数</th><td>{f2(c.fipConst)}</td></tr>
                      <tr><th>1勝あたりの得点（RPW）</th><td>{f2(c.rpw)}</td></tr>
                      <tr><th>得点/打席</th><td>{f3(c.rPerPA)}</td></tr>
                    </tbody>
                  </table>
                  <h4>得点期待値（RE24）</h4>
                  <table class="data re">
                    <thead><tr><th>走者</th><th>0死</th><th>1死</th><th>2死</th></tr></thead>
                    <tbody>
                      {['なし', '一塁', '二塁', '一二塁', '三塁', '一三塁', '二三塁', '満塁'].map((label, b) => (
                        <tr key={b}><th>{label}</th>{[0, 1, 2].map((o) => <td key={o}>{f2(c.re[o * 8 + b])}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <div>
              <h3>パークファクター（得点）</h3>
              <table class="data kv"><tbody>
                {w.teams.map((tm) => <tr key={tm.id}><th>{tm.park.name}（{tm.short}）</th><td>{f2(ctx.C.parkFactor[tm.id])}</td></tr>)}
              </tbody></table>
              <p class="muted small">本拠地での1試合あたり得点 ÷ ビジターでの得点。試合数が少ないうちは球場の特徴からの推定値に寄せています。</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
