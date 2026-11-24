import { useState } from 'preact/hooks';
import { allCareers, CAREER_CATS, championsByYear, franchiseHistory, SEASON_CATS, seasonRecords } from '../../league/records';
import { LEAGUE_NAMES } from '../../league/teams';
import { teamById, type World } from '../../league/world';
import { ACE_AWARD_NAME } from '../../league/awards';
import { Logo } from '../components/Logo';
import { useWorld } from '../store';

const PL = ({ w, pid }: { w: World; pid: number | null | undefined }) => {
  if (!pid) return <span class="muted">-</span>;
  const p = w.players[pid];
  return <a href={'#/player/' + pid}>{p?.name ?? '?'}</a>;
};
const TM = ({ w, tid }: { w: World; tid: number | null | undefined }) => (tid ? <span class="tshort"><Logo team={teamById(w, tid)} size={14} />{teamById(w, tid).nickname}</span> : <span class="muted">-</span>);

function Champions({ w }: { w: World }) {
  const rows = championsByYear(w);
  if (rows.length === 0) return <section class="card"><p class="muted">最初のシーズンが終わると、ここに優勝や表彰の歴史がたまっていきます。</p></section>;
  return (
    <section class="card">
      <div class="tablewrap"><table class="data">
        <thead><tr><th>年</th><th class="l">日本一</th><th class="l">セ優勝</th><th class="l">パ優勝</th><th class="l">セMVP</th><th class="l">パMVP</th><th class="l">新人王（セ/パ）</th><th class="l">{ACE_AWARD_NAME}</th><th class="l">夏の甲子園</th><th class="l">センバツ</th></tr></thead>
        <tbody>{rows.map(({ year, a, koshien, senbatsu }) => (
          <tr key={year}>
            <td>{year}</td><td class="l"><TM w={w} tid={a.champion} /></td><td class="l"><TM w={w} tid={a.leagueChamp.C} /></td><td class="l"><TM w={w} tid={a.leagueChamp.P} /></td>
            <td class="l"><PL w={w} pid={a.mvp.C} /></td><td class="l"><PL w={w} pid={a.mvp.P} /></td>
            <td class="l"><PL w={w} pid={a.roy.C} /> / <PL w={w} pid={a.roy.P} /></td><td class="l"><PL w={w} pid={a.ace} /></td>
            <td class="l small">{koshien ? <a href={'#/school/' + koshien}>{w.amateur.schools[koshien]?.name}</a> : '-'}</td>
            <td class="l small">{senbatsu ? <a href={'#/school/' + senbatsu}>{w.amateur.schools[senbatsu]?.name}</a> : '-'}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}

function SeasonRecs({ w }: { w: World }) {
  return (
    <section class="card">
      <p class="muted small">このゲームで行われたシーズンの記録（率の部門は規定到達者）。</p>
      <div class="boards">
        {SEASON_CATS.map((c) => (
          <div class="board" key={c.key}>
            <h4>シーズン{c.label}</h4>
            <ol>{seasonRecords(w, c).map((r, i) => <li key={i}><PL w={w} pid={r.pid} /><small>{r.year}・{teamById(w, r.tid).short}</small><b>{r.text}</b></li>)}</ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function Careers({ w }: { w: World }) {
  const rows = allCareers(w);
  return (
    <>
      <section class="card">
        <p class="muted small">通算はゲーム開始前の記録（推定）を含みます。<b>太字</b>は現役選手。</p>
        <div class="boards">
          {CAREER_CATS.map((c) => (
            <div class="board" key={c.key}>
              <h4>通算{c.label}</h4>
              <ol>{[...rows].sort((a, b) => (b[c.key] as number) - (a[c.key] as number)).slice(0, 10).map((r) => {
                const p = w.players[r.pid];
                const active = p && p.status !== 'retired' && p.status !== 'mlb';
                return <li key={r.pid}><span class={active ? 'activeP' : ''}><PL w={w} pid={r.pid} /></span><small>{p?.teamId ? teamById(w, p.teamId).short : p?.status === 'mlb' ? '海外' : '引退'}</small><b>{r[c.key]}{c.unit}</b></li>;
              })}</ol>
            </div>
          ))}
        </div>
      </section>
      <section class="card">
        <h3>大記録の達成者</h3>
        <ul>{CAREER_CATS.flatMap((c) => rows.filter((r) => (r[c.key] as number) >= c.milestone).map((r) => (
          <li key={c.key + r.pid}>通算{c.milestone}{c.label === '安打' ? '安打' : c.label}以上: <PL w={w} pid={r.pid} />（{r[c.key]}{c.unit}）</li>
        )))}</ul>
      </section>
    </>
  );
}

function Franchise({ w }: { w: World }) {
  const [tid, setTid] = useState(w.userTeamId);
  const rows = franchiseHistory(w, tid);
  const tot = rows.reduce((s, r) => ({ w: s.w + r.w, l: s.l + r.l, t: s.t + r.t, c: s.c + (r.champ ? 1 : 0), j: s.j + (r.japan ? 1 : 0) }), { w: 0, l: 0, t: 0, c: 0, j: 0 });
  return (
    <section class="card">
      <div class="toolbar"><select value={tid} onChange={(e) => setTid(Number((e.target as HTMLSelectElement).value))}>{w.teams.map((t) => <option key={t.id} value={t.id}>{t.city}{t.nickname}</option>)}</select></div>
      <p>通算 {tot.w}勝{tot.l}敗{tot.t}分・リーグ優勝{tot.c}回・日本一{tot.j}回（このゲーム内）</p>
      <div class="tablewrap"><table class="data">
        <thead><tr><th>年</th><th>順位</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th><th class="l" /></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.year}><td>{r.year}</td><td>{r.rank}位</td><td>{r.w}</td><td>{r.l}</td><td>{r.t}</td><td>{(r.w / Math.max(1, r.w + r.l)).toFixed(3).replace(/^0/, '')}</td><td class="l">{r.japan ? '日本一' : r.champ ? `${LEAGUE_NAMES[teamById(w, tid).league]}優勝` : ''}</td></tr>)}</tbody>
      </table></div>
    </section>
  );
}

export function RecordsPage() {
  const w = useWorld();
  const [tab, setTab] = useState<'champ' | 'season' | 'career' | 'team'>('champ');
  return (
    <div class="page">
      <div class="seg">{([['champ', '優勝・表彰'], ['season', 'シーズン記録'], ['career', '通算記録'], ['team', '球団の歴史']] as const).map(([k, l]) => <button key={k} class={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'champ' && <Champions w={w} />}
      {tab === 'season' && <SeasonRecs w={w} />}
      {tab === 'career' && <Careers w={w} />}
      {tab === 'team' && <Franchise w={w} />}
    </div>
  );
}
