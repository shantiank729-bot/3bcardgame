import { useState } from 'preact/hooks';
import { PITCH_NAMES } from '../../engine/types';
import { fmtDate } from '../../league/calendar';
import { PREFS, REGIONS, UNI_LEAGUES } from '../../amateur/data';
import { leagueStandings } from '../../amateur/tourney';
import { AREA_NAMES, projection, scoutedOverall, scoutedRatings, scoutReport, toggleWatch } from '../../amateur/scout';
import type { Amateur, School, Tourney } from '../../amateur/types';
import type { World } from '../../league/world';
import { overall } from '../../players/development';
import { pitcherStuff } from '../../engine/pa';
import { grade, POS_1, handStr } from '../format';
import { go, notify, toast, useWorld } from '../store';
import { startAmateurLive } from '../live';

const STAGE: Record<string, string> = { HS: '高校', UNI: '大学', SHA: '社会人' };

/** スカウトの見立てによる評価（ぶれが大きいと「?」） */
export function SG({ v, sd }: { v: number; sd: number }) {
  const g = grade(v);
  return <span class={`grade ${g.cls}`} title={`推定 ${Math.round(v)}（±${Math.round(sd)}）`}>{g.g}{sd > 9 ? '?' : ''}</span>;
}

function SchoolLink({ w, id }: { w: World; id: number }) {
  const s = w.amateur.schools[id];
  if (!s) return <span>-</span>;
  return <a href={'#/school/' + id} class="school"><i style={{ background: s.colors[0], borderColor: s.colors[1] }} />{s.name}</a>;
}

function roundName(t: Tourney, r: number) {
  if (r === t.rounds) return '決勝';
  if (r === t.rounds - 1) return '準決勝';
  if (r === t.rounds - 2) return '準々決勝';
  return `${r}回戦`;
}

export function TourneyView({ w, t }: { w: World; t: Tourney }) {
  if (t.level === 'league') {
    const st = leagueStandings(t);
    return (
      <div class="tablewrap"><table class="data">
        <thead><tr><th>順</th><th class="l">大学</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th></tr></thead>
        <tbody>{st.map((r, i) => <tr key={r[0]}><td>{i + 1}</td><td class="l"><SchoolLink w={w} id={r[0]} /></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{(r[1] / Math.max(1, r[1] + r[2])).toFixed(3).replace(/^0/, '')}</td></tr>)}</tbody>
      </table></div>
    );
  }
  const rounds = [...new Set(t.games.map((g) => g.round))].sort((a, b) => a - b);
  const today = t.games.filter((g) => g.date === w.date && g.winner === undefined && g.date > w.amateur.lastTick);
  const L = t.leaders ?? {};
  const name = (pid: string) => w.amateur.players[Number(pid)]?.name ?? w.players[Number(pid)]?.name ?? '?';
  const top = (f: (x: number[]) => number, n = 5, filter: (x: number[]) => boolean = () => true) => Object.entries(L).filter(([, x]) => filter(x)).sort((a, b) => f(b[1]) - f(a[1])).slice(0, n);
  return (
    <div>
      {t.champion && <p class="big">優勝 <SchoolLink w={w} id={t.champion} />{t.runnerUp ? <span class="muted">　準優勝 {w.amateur.schools[t.runnerUp]?.name}</span> : null}</p>}
      {today.length > 0 && (
        <div class="todaygames">
          <h4>今日の試合（観戦できます）</h4>
          {today.map((g) => (
            <div key={g.a + '-' + g.b} class="tg">
              <SchoolLink w={w} id={g.a} /> vs <SchoolLink w={w} id={g.b} />
              <button class="btn primary" onClick={() => { if (startAmateurLive(w, t.id, g.a, g.b)) go('watch'); }}>観戦する</button>
            </div>
          ))}
        </div>
      )}
      <div class="bracketview">
        {rounds.map((r) => (
          <div class="bround" key={r}>
            <h5>{roundName(t, r)}</h5>
            {t.games.filter((g) => g.round === r).map((g, i) => (
              <div class={`bgame ${g.winner !== undefined ? 'done' : ''}`} key={i}>
                <small>{fmtDate(g.date)}</small>
                {[g.a, g.b].map((sid, k) => (
                  <div key={sid} class={`bteam ${g.winner === sid ? 'win' : g.winner !== undefined ? 'lose' : ''}`}>
                    <span>{w.amateur.schools[sid]?.name ?? '-'}</span>
                    <b>{g.score ? g.score[k] : ''}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      {Object.keys(L).length > 0 && (
        <div class="grid2">
          <div><h4>本塁打</h4><ol>{top((x) => x[2], 5, (x) => x[2] > 0).map(([pid, x]) => <li key={pid}><a href={'#/am/' + pid}>{name(pid)}</a> {x[2]}本</li>)}</ol></div>
          <div><h4>奪三振</h4><ol>{top((x) => x[4], 5, (x) => x[4] > 0).map(([pid, x]) => <li key={pid}><a href={'#/am/' + pid}>{name(pid)}</a> {x[4]}個（{Math.floor(x[5] / 3)}回）</li>)}</ol></div>
          <div><h4>打率（8打数以上）</h4><ol>{top((x) => x[0] / Math.max(1, x[1]), 5, (x) => x[1] >= 8).map(([pid, x]) => <li key={pid}><a href={'#/am/' + pid}>{name(pid)}</a> {(x[0] / x[1]).toFixed(3).replace(/^0/, '')}（{x[1]}-{x[0]}）</li>)}</ol></div>
          <div><h4>打点</h4><ol>{top((x) => x[3], 5, (x) => x[3] > 0).map(([pid, x]) => <li key={pid}><a href={'#/am/' + pid}>{name(pid)}</a> {x[3]}打点</li>)}</ol></div>
        </div>
      )}
    </div>
  );
}

function TourneysTab({ w }: { w: World }) {
  const all = Object.values(w.amateur.tourneys);
  const years = [...new Set(all.map((t) => t.year))].sort((a, b) => b - a);
  const [year, setYear] = useState(years[0] ?? w.year);
  const [sel, setSel] = useState<string | null>(null);
  const list = all.filter((t) => t.year === year);
  const nat = list.filter((t) => t.level === 'national').sort((a, b) => (a.games[0]?.date ?? '').localeCompare(b.games[0]?.date ?? ''));
  const regions = list.filter((t) => t.level === 'region');
  const summer = list.filter((t) => t.id.includes('-summer-'));
  const fall = list.filter((t) => t.id.includes('-fall-'));
  const leagues = list.filter((t) => t.level === 'league');
  const cur = sel ? w.amateur.tourneys[sel] : nat.find((t) => !t.done && t.games.some((g) => g.date <= w.date)) ?? nat[nat.length - 1];
  const chip = (t: Tourney) => <button key={t.id} class={`chip ${cur?.id === t.id ? 'on' : ''} ${t.done ? '' : 'live'}`} onClick={() => setSel(t.id)}>{t.short}{t.champion ? `：${w.amateur.schools[t.champion]?.name}` : t.done ? '' : '（開催中）'}</button>;
  return (
    <>
      <section class="card">
        <div class="toolbar"><select value={year} onChange={(e) => { setYear(Number((e.target as HTMLSelectElement).value)); setSel(null); }}>{years.map((y) => <option key={y} value={y}>{y}年度</option>)}</select></div>
        <h4>全国大会</h4><div class="chips">{nat.map(chip)}</div>
        {regions.length > 0 && (<><h4>秋季地区大会（センバツ選考の参考）</h4><div class="chips">{regions.map(chip)}</div></>)}
        {leagues.length > 0 && (<><h4>大学リーグ戦</h4><div class="chips">{leagues.map(chip)}</div></>)}
        {summer.length > 0 && (<details><summary>夏の地方大会（{summer.length}大会）</summary><div class="chips">{summer.map(chip)}</div></details>)}
        {fall.length > 0 && (<details><summary>秋季都道府県大会（{fall.length}大会）</summary><div class="chips">{fall.map(chip)}</div></details>)}
        {w.amateur.senbatsu[year + 1] && <p class="small">翌年のセンバツ出場校: {w.amateur.senbatsu[year + 1].map((id) => w.amateur.schools[id].name).join('、')}{w.amateur.senbatsu21?.[year + 1] ? `（21世紀枠: ${w.amateur.senbatsu21[year + 1].map((id) => w.amateur.schools[id].name).join('・')}）` : ''}</p>}
        {list.length === 0 && <p class="muted">この年度の大会はまだありません。</p>}
      </section>
      {cur && <section class="card"><h3>{cur.name}</h3><TourneyView w={w} t={cur} /></section>}
    </>
  );
}

function SchoolsTab({ w }: { w: World }) {
  const [pref, setPref] = useState(12);
  const schools = Object.values(w.amateur.schools).filter((s) => s.kind === 'HS' && s.pref === pref).sort((a, b) => b.strength - a.strength);
  return (
    <section class="card">
      <div class="toolbar">
        <select value={pref} onChange={(e) => setPref(Number((e.target as HTMLSelectElement).value))}>{PREFS.map(([n], i) => <option key={i} value={i}>{n}</option>)}</select>
      </div>
      <SchoolTable w={w} list={schools} />
    </section>
  );
}

function SchoolTable({ w, list }: { w: World; list: School[] }) {
  return (
    <div class="tablewrap"><table class="data">
      <thead><tr><th class="l">学校</th><th class="l">区分</th><th>伝統</th><th>監督</th><th>環境</th><th>甲子園 出場/勝利/優勝</th><th class="l">注目選手</th></tr></thead>
      <tbody>{list.map((s) => {
        const star = Object.values(w.amateur.players).filter((p) => p.schoolId === s.id).sort((a, b) => b.hype - a.hype)[0];
        return (
          <tr key={s.id}>
            <td class="l"><SchoolLink w={w} id={s.id} /></td><td class="l small">{s.district}</td>
            <td>{'★'.repeat(Math.max(1, Math.round(s.strength / 20)))}</td><td>{grade(s.coach).g}</td><td>{grade(s.facility).g}</td>
            <td>{s.kind === 'HS' ? `${s.koshien.apps}/${s.koshien.wins}/${s.koshien.titles}` : '-'}</td>
            <td class="l">{star && <a href={'#/am/' + star.id}>{star.name}（{star.grade}年）</a>}</td>
          </tr>
        );
      })}</tbody>
    </table></div>
  );
}

function UniTab({ w }: { w: World }) {
  return (
    <>
      {UNI_LEAGUES.map((lg, li) => (
        <section class="card" key={li}><h3>{lg.name}（{lg.region}）</h3><SchoolTable w={w} list={Object.values(w.amateur.schools).filter((s) => s.kind === 'UNI' && s.league === li)} /></section>
      ))}
      <section class="card"><h3>社会人</h3><SchoolTable w={w} list={Object.values(w.amateur.schools).filter((s) => s.kind === 'SHA')} /></section>
    </>
  );
}

export function PlayerRow({ w, p }: { w: World; p: Amateur }) {
  const v = scoutedOverall(w, p);
  const watched = !!w.amateur.watch[p.id];
  const seen = w.amateur.watch[p.id] ?? w.amateur.seen[p.id];
  return (
    <tr>
      <td><button class={`star ${watched ? 'on' : ''}`} title="注目リスト" onClick={() => { toggleWatch(w, p.id); notify(); }}>{watched ? '★' : '☆'}</button></td>
      <td class="l"><a href={'#/am/' + p.id}>{p.name}</a>{p.shibou && <em class="tag">志望届</em>}</td>
      <td class="l small"><SchoolLink w={w} id={p.schoolId} /></td>
      <td>{STAGE[p.stage]}{p.stage === 'SHA' ? `${p.grade}年目` : `${p.grade}年`}</td><td>{POS_1[p.pos]}</td>
      <td><SG v={v.ovr} sd={v.sd} /></td><td><SG v={v.pot} sd={v.sd * 1.4} /></td>
      <td><span class="hype" style={{ width: `${p.hype * 0.6}px` }} /></td><td class="small">{seen?.visits ?? 0}回</td>
      <td class="small">{projection(v.pot * 0.6 + v.ovr * 0.4 + p.hype * 0.05)}</td>
    </tr>
  );
}

const PLAYER_HEAD = <tr><th /><th class="l">選手</th><th class="l">所属</th><th>学年</th><th>位</th><th>現在</th><th>将来</th><th>注目度</th><th>視察</th><th>評価</th></tr>;

function HotTab({ w }: { w: World }) {
  const [f, setF] = useState('HS3');
  const filters: Record<string, (p: Amateur) => boolean> = {
    HS3: (p) => p.stage === 'HS' && p.grade === 3, HS2: (p) => p.stage === 'HS' && p.grade === 2, HS1: (p) => p.stage === 'HS' && p.grade === 1,
    UNI4: (p) => p.stage === 'UNI' && p.grade === 4, UNI: (p) => p.stage === 'UNI' && p.grade < 4, SHA: (p) => p.stage === 'SHA',
  };
  const list = Object.values(w.amateur.players).filter(filters[f]).sort((a, b) => b.hype - a.hype).slice(0, 60);
  return (
    <section class="card">
      <div class="seg">{[['HS3', '高校3年'], ['HS2', '高校2年'], ['HS1', '高校1年'], ['UNI4', '大学4年'], ['UNI', '大学1-3年'], ['SHA', '社会人']].map(([k, l]) => <button key={k} class={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      <p class="muted small">注目度の高い順。能力はあなたのスカウトの見立てで、視察が少ない選手は「?」付き（ぶれが大きい）です。☆を押すと注目リストに入り、担当スカウトが優先して視察します。</p>
      <div class="tablewrap"><table class="data"><thead>{PLAYER_HEAD}</thead><tbody>{list.map((p) => <PlayerRow key={p.id} w={w} p={p} />)}</tbody></table></div>
    </section>
  );
}

function ScoutTab({ w }: { w: World }) {
  const am = w.amateur;
  const list = Object.keys(am.watch).map((id) => am.players[Number(id)]).filter(Boolean);
  const areas = [...REGIONS.map((r) => r.key as string), 'uni', 'sha'];
  return (
    <>
      <section class="card">
        <h3>スカウト陣</h3>
        <p class="muted small">各スカウトは担当地域の選手を毎週視察します。注目リストの選手を優先し、空いた時間で注目度の高い選手を見て回ります。腕の良いスカウトほど評価が正確です。</p>
        <div class="tablewrap"><table class="data">
          <thead><tr><th class="l">スカウト</th><th>腕</th><th class="l">担当地域</th><th>注目リストの担当</th></tr></thead>
          <tbody>{am.scouts.map((s) => (
            <tr key={s.id}>
              <td class="l">{s.name}</td><td><span class={`grade ${grade(s.skill).cls}`}>{grade(s.skill).g}</span></td>
              <td class="l"><select value={s.area} onChange={(e) => { s.area = (e.target as HTMLSelectElement).value as never; notify(); }}>{areas.map((a) => <option key={a} value={a}>{AREA_NAMES[a]}</option>)}</select></td>
              <td>{list.filter((p) => { const sc = am.schools[p.schoolId]; return (sc.kind === 'HS' ? sc.region : sc.kind === 'UNI' ? 'uni' : 'sha') === s.area; }).length}人</td>
            </tr>
          ))}</tbody>
        </table></div>
      </section>
      <section class="card">
        <h3>注目リスト（{list.length}人）</h3>
        {list.length === 0 ? <p class="muted">「注目選手」タブや選手のページで☆を押すと追加できます。</p> : (
          <div class="tablewrap"><table class="data"><thead>{PLAYER_HEAD}</thead><tbody>{list.map((p) => <PlayerRow key={p.id} w={w} p={p} />)}</tbody></table></div>
        )}
      </section>
    </>
  );
}

export function AmateurPage({ tab }: { tab?: string }) {
  const w = useWorld();
  const t = tab ?? 'tourney';
  return (
    <div class="page">
      <div class="seg">
        {[['tourney', '大会'], ['hot', '注目選手'], ['hs', '高校'], ['uni', '大学・社会人'], ['scout', 'スカウト']].map(([k, l]) => <button key={k} class={t === k ? 'on' : ''} onClick={() => go('amateur/' + k)}>{l}</button>)}
      </div>
      {t === 'tourney' && <TourneysTab w={w} />}
      {t === 'hot' && <HotTab w={w} />}
      {t === 'hs' && <SchoolsTab w={w} />}
      {t === 'uni' && <UniTab w={w} />}
      {t === 'scout' && <ScoutTab w={w} />}
    </div>
  );
}

export function SchoolPage({ id }: { id: number }) {
  const w = useWorld();
  const s = w.amateur.schools[id];
  if (!s) return <div class="page"><p>学校が見つかりません</p></div>;
  const ps = Object.values(w.amateur.players).filter((p) => p.schoolId === id).sort((a, b) => b.grade - a.grade || b.hype - a.hype);
  return (
    <div class="page">
      <section class="card hero-card" style={{ '--tc': s.colors[0], '--tc2': s.colors[1] } as never}>
        <div>
          <h2>{s.name}</h2>
          <p>{s.kind === 'HS' ? `${PREFS[s.pref][0]}・${s.district}` : s.district}　伝統{'★'.repeat(Math.max(1, Math.round(s.strength / 20)))}・監督{grade(s.coach).g}・練習環境{grade(s.facility).g}</p>
          {s.kind === 'HS' && <p>甲子園 出場{s.koshien.apps}回・{s.koshien.wins}勝・優勝{s.koshien.titles}回</p>}
        </div>
      </section>
      <section class="card">
        <h3>部員</h3>
        <div class="tablewrap"><table class="data"><thead>{PLAYER_HEAD}</thead><tbody>{ps.map((p) => <PlayerRow key={p.id} w={w} p={p} />)}</tbody></table></div>
      </section>
      {s.history.length > 0 && <section class="card"><h3>主な実績</h3><ul>{[...s.history].reverse().slice(0, 30).map((h, i) => <li key={i}>{h.year}年 {h.text}</li>)}</ul></section>}
    </div>
  );
}

const bline = (a?: number[]) => (a ? `${a[0]}試合 ${a[1]}打数${a[2]}安打 打率${(a[2] / Math.max(1, a[1])).toFixed(3).replace(/^0/, '')} ${a[5]}本 ${a[6]}打点 ${a[9]}盗塁` : '');
const pline = (a?: number[]) => (a ? `${a[0]}登板 ${Math.floor(a[1] / 3)}回${a[1] % 3 ? (a[1] % 3) + '/3' : ''} ${a[6]}勝${a[7]}敗 ${a[5]}奪三振 防御率${((a[3] * 27) / Math.max(1, a[1])).toFixed(2)}` : '');
export { bline, pline };

export function AmPlayerPage({ id }: { id: number }) {
  const w = useWorld();
  const p = w.amateur.players[id];
  if (!p) {
    if (w.players[id]) { go('player/' + id); return null; }
    return <div class="page"><section class="card"><p>選手が見つかりません（卒業して野球を離れた可能性があります）。</p></section></div>;
  }
  const v = scoutedRatings(w, p);
  const sd = v.sd;
  const watched = !!w.amateur.watch[p.id];
  const seen = w.amateur.watch[p.id] ?? w.amateur.seen[p.id];
  const Bar = ({ label, x, extra }: { label: string; x: number; extra?: string }) => {
    const g = grade(x);
    return (
      <div class="rbar"><span class="rl">{label}</span>
        <span class="track"><span class={`fill ${g.cls}`} style={{ width: `${Math.max(2, Math.min(100, x))}%` }} /><span class="err" style={{ left: `${Math.max(0, x - sd)}%`, width: `${Math.min(100, sd * 2)}%` }} /></span>
        <span class={`grade ${g.cls}`}>{g.g}{sd > 9 ? '?' : ''}<small>{extra ?? Math.round(x)}</small></span></div>
    );
  };
  const keys = [...new Set([...Object.keys(p.sbat), ...Object.keys(p.spit)])].sort();
  return (
    <div class="page">
      <section class="card hero-card" style={{ '--tc': w.amateur.schools[p.schoolId].colors[0], '--tc2': w.amateur.schools[p.schoolId].colors[1] } as never}>
        <div>
          <h2>{p.name}{p.shibou && <em class="tag">プロ志望届</em>}</h2>
          <p><SchoolLink w={w} id={p.schoolId} />・{STAGE[p.stage]}{p.stage === 'SHA' ? `${p.grade}年目` : `${p.grade}年`}・{POS_1[p.pos]}・{p.age}歳・{handStr(p.bats, p.throws)}</p>
          {p.path.length > 0 && <p class="small">出身: {p.path.join(' → ')}</p>}
          <p class="small">注目度 {Math.round(p.hype)}・視察 {seen?.visits ?? 0}回・評価 {projection(v.pot * 0.6 + overall({ ...p, bat: v.bat, pit: v.pit }) * 0.4 + p.hype * 0.05)}</p>
          <button class="btn" onClick={() => { toggleWatch(w, p.id); notify(); toast(watched ? '注目リストから外しました' : '注目リストに追加しました'); }}>{watched ? '★ 注目リストから外す' : '☆ 注目リストに追加'}</button>
        </div>
      </section>
      <div class="grid2">
        <section class="card">
          <h3>スカウトの見立て</h3>
          <p class="muted small">帯の薄い部分は見立てのぶれ（±{Math.round(sd)}）。視察を重ねると狭まります。</p>
          {p.isPitcher && v.pit ? (
            <>
              <Bar label="球速" x={(v.pit.velocity - 110) * 2} extra={`${Math.round(v.pit.velocity)}km`} />
              <Bar label="球威" x={pitcherStuff(v.pit)} />
              <Bar label="制球" x={v.pit.control} />
              <Bar label="スタミナ" x={v.pit.stamina} />
              {v.pit.pitches.map((x) => <Bar key={x.type} label={PITCH_NAMES[x.type]} x={x.quality} />)}
            </>
          ) : (
            <>
              <Bar label="ミート" x={v.bat.contact} /><Bar label="パワー" x={v.bat.power} /><Bar label="選球眼" x={v.bat.eye} />
              <Bar label="走力" x={v.bat.speed} /><Bar label="守備力" x={v.bat.fielding} /><Bar label="肩" x={v.bat.arm} />
            </>
          )}
          <Bar label="将来性" x={v.pot} />
        </section>
        <section class="card">
          <h3>スカウトレポート</h3>
          <ul>{scoutReport(w, p).map((t, i) => <li key={i}>{t}</li>)}</ul>
          <h3>成績</h3>
          <ul class="career">{keys.map((k) => (
            <li key={k}><span>{k.slice(0, 4)}{k.endsWith('K') ? ' 甲子園' : k.endsWith('N') ? ' 全国' : ''}</span>{p.isPitcher ? pline(p.spit[k]) || bline(p.sbat[k]) : bline(p.sbat[k])}</li>
          ))}{keys.length === 0 && <li class="muted">公式戦の出場なし</li>}</ul>
        </section>
      </div>
      <section class="card"><h3>経歴・実績</h3><ul class="career">{p.notes.map((n, i) => <li key={i}><span>{n.year}年</span>{n.text}</li>)}</ul></section>
    </div>
  );
}

export function regionName(key: string) {
  return AREA_NAMES[key] ?? key;
}
export { UNI_LEAGUES };
