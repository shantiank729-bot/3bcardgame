import { useState } from 'preact/hooks';
import { ACE_AWARD_NAME, aceCriteria } from '../../league/awards';
import { LEAGUE_NAMES } from '../../league/teams';
import { teamById } from '../../league/world';
import { Logo } from '../components/Logo';
import { useWorld } from '../store';

const POS: Record<string, string> = { P: '投手', C: '捕手', '1B': '一塁手', '2B': '二塁手', '3B': '三塁手', SS: '遊撃手', OF: '外野手', DH: '指名打者' };

export function AwardsPage() {
  const w = useWorld();
  const years = Object.keys(w.awards).map(Number).sort((a, b) => b - a);
  const [year, setYear] = useState(years[0]);
  const a = w.awards[year];
  const P = (pid: number | null) => {
    if (!pid) return <span class="muted">該当者なし</span>;
    const p = w.players[pid];
    const t = p?.teamId ? teamById(w, p.teamId) : null;
    return <span class="awardee">{t && <Logo team={t} size={16} />}<a href={'#/player/' + pid}>{p?.name ?? '?'}</a>{t && <small>{t.nickname}</small>}</span>;
  };
  if (!a) return <div class="page"><section class="card"><h2>タイトル・表彰</h2><p class="muted">レギュラーシーズン終了時にタイトルと各賞が決まります。</p></section></div>;
  return (
    <div class="page">
      <div class="toolbar">
        <select value={year} onChange={(e) => setYear(Number((e.target as HTMLSelectElement).value))}>{years.map((y) => <option key={y} value={y}>{y}年</option>)}</select>
      </div>
      <section class="card">
        <h2>{year}年の主な表彰</h2>
        <table class="data kv"><tbody>
          <tr><th>日本一</th><td>{a.champion ? `${teamById(w, a.champion).city}${teamById(w, a.champion).nickname}` : '（日本シリーズ未了）'}</td></tr>
          {(['C', 'P'] as const).map((lg) => <tr key={lg}><th>{LEAGUE_NAMES[lg]}優勝</th><td>{teamById(w, a.leagueChamp[lg]).city}{teamById(w, a.leagueChamp[lg]).nickname}</td></tr>)}
          {(['C', 'P'] as const).map((lg) => <tr key={'m' + lg}><th>{LEAGUE_NAMES[lg]} MVP</th><td>{P(a.mvp[lg])}</td></tr>)}
          {(['C', 'P'] as const).map((lg) => <tr key={'r' + lg}><th>{LEAGUE_NAMES[lg]} 新人王</th><td>{P(a.roy[lg])}</td></tr>)}
          <tr><th title={aceCriteria()}>{ACE_AWARD_NAME}（最優秀先発投手）</th><td>{P(a.ace)}</td></tr>
          <tr><th>日本シリーズMVP</th><td>{P(a.jsMvp)}</td></tr>
          {(['C', 'P'] as const).map((lg) => <tr key={'c' + lg}><th>{LEAGUE_NAMES[lg]} CS MVP</th><td>{P(a.csMvp[lg])}</td></tr>)}
          {a.allStarMvp.map((m, i) => <tr key={'as' + i}><th>オールスター第{i + 1}戦MVP</th><td>{P(m)}</td></tr>)}
        </tbody></table>
        <p class="muted small">{ACE_AWARD_NAME}: {aceCriteria()}。</p>
      </section>
      <div class="grid2">
        {(['C', 'P'] as const).map((lg) => (
          <section class="card" key={lg}>
            <h3>{LEAGUE_NAMES[lg]} タイトル</h3>
            <table class="data kv"><tbody>{a.titles[lg].map((t, i) => <tr key={i}><th>{t.title}</th><td>{P(t.pid)} <b>{t.value}</b></td></tr>)}</tbody></table>
            <h3>ベストナイン</h3>
            <table class="data kv"><tbody>{a.bestNine[lg].map((x, i) => <tr key={i}><th>{POS[x.pos]}</th><td>{P(x.pid)}</td></tr>)}</tbody></table>
            <h3>ゴールデングラブ賞</h3>
            <table class="data kv"><tbody>{a.goldenGlove[lg].map((x, i) => <tr key={i}><th>{POS[x.pos]}</th><td>{P(x.pid)}</td></tr>)}</tbody></table>
          </section>
        ))}
      </div>
    </div>
  );
}
