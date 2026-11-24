import { useState } from 'preact/hooks';
import { pitcherStuff } from '../../engine/pa';
import { PITCH_NAMES } from '../../engine/types';
import { buildTeamInput, chooseStarter, dayIndex } from '../../league/sim';
import { rosterOf, teamById, type PlayerRecord } from '../../league/world';
import { Logo } from '../components/Logo';
import { grade, handStr, POS_1, POS_JP } from '../format';
import { useWorld } from '../store';

export function Grade({ v }: { v: number }) {
  const g = grade(v);
  return <span class={`grade ${g.cls}`}>{g.g}<small>{Math.round(v)}</small></span>;
}

function HitterRow({ p }: { p: PlayerRecord }) {
  const b = p.bat;
  return (
    <tr>
      <td>{p.number}</td>
      <td class="l"><a href={'#/player/' + p.id}>{p.name}</a>{p.foreign && <em class="tag">外</em>}</td>
      <td>{POS_1[p.primary]}</td><td>{p.age}</td><td>{handStr(p.bats, p.throws)}</td>
      <td><Grade v={b.contact} /></td><td><Grade v={b.power} /></td><td><Grade v={b.eye} /></td><td><Grade v={b.speed} /></td>
      <td><Grade v={b.fielding} /></td><td><Grade v={b.arm} /></td><td><Grade v={b.catching} /></td>
      <td class="l small">{Object.entries(b.positions).filter(([, v]) => (v ?? 0) >= 40).map(([k]) => POS_1[k]).join('')}</td>
    </tr>
  );
}

function PitcherRowView({ p, role }: { p: PlayerRecord; role?: string }) {
  const pt = p.pit!;
  return (
    <tr>
      <td>{p.number}</td>
      <td class="l"><a href={'#/player/' + p.id}>{p.name}</a>{p.foreign && <em class="tag">外</em>}</td>
      <td>{role ?? (p.role === 'SP' ? '先発' : '救援')}</td><td>{p.age}</td><td>{p.throws === 'R' ? '右' : '左'}</td>
      <td>{pt.velocity}km</td><td><Grade v={pitcherStuff(pt)} /></td><td><Grade v={pt.control} /></td><td><Grade v={pt.stamina} /></td>
      <td class="l small">{pt.pitches.map((x) => `${PITCH_NAMES[x.type]}${grade(x.quality).g}`).join(' ')}</td>
    </tr>
  );
}

export function TeamPage({ id }: { id: number }) {
  const w = useWorld();
  const [tab, setTab] = useState<'one' | 'two' | 'order' | 'rot'>('one');
  const t = teamById(w, id);
  const active = rosterOf(w, id, 'active');
  const farm = rosterOf(w, id, 'farm');
  const ikusei = rosterOf(w, id, 'ikusei');
  const ts = w.teamState[id];
  const sortH = (a: PlayerRecord, b: PlayerRecord) => 'C1B2B3BSSLFCFRF'.indexOf(a.primary) - 'C1B2B3BSSLFCFRF'.indexOf(b.primary) || a.number - b.number;
  const hitters = (ps: PlayerRecord[]) => ps.filter((p) => !p.isPitcher).sort(sortH);
  const pitchers = (ps: PlayerRecord[]) => ps.filter((p) => p.isPitcher).sort((a, b) => (a.role === b.role ? a.number - b.number : a.role === 'SP' ? -1 : 1));
  const hTable = (ps: PlayerRecord[]) => (
    <div class="tablewrap"><table class="data roster">
      <thead><tr><th>#</th><th class="l">野手</th><th>位</th><th>齢</th><th>投打</th><th>ミ</th><th>パ</th><th>眼</th><th>走</th><th>守</th><th>肩</th><th>捕</th><th class="l">守備位置</th></tr></thead>
      <tbody>{ps.map((p) => <HitterRow key={p.id} p={p} />)}</tbody>
    </table></div>
  );
  const pTable = (ps: PlayerRecord[], roles?: Map<number, string>) => (
    <div class="tablewrap"><table class="data roster">
      <thead><tr><th>#</th><th class="l">投手</th><th>役割</th><th>齢</th><th>投</th><th>球速</th><th>球威</th><th>制球</th><th>スタ</th><th class="l">変化球</th></tr></thead>
      <tbody>{ps.map((p) => <PitcherRowView key={p.id} p={p} role={roles?.get(p.id)} />)}</tbody>
    </table></div>
  );
  const foreignActive = active.filter((p) => p.foreign).length;
  const today = dayIndex(w);
  const sp = chooseStarter(w, id, today);
  const input = buildTeamInput(w, id, today, w.settings.dh[t.league], 'R', sp);
  const roleJP: Record<string, string> = { CL: '抑え', SU1: 'セットアッパー', SU2: 'セットアッパー2', MID: '中継ぎ', LONG: 'ロング' };
  const roles = new Map(input.lineup.bullpen.map((b) => [b.playerId, roleJP[b.role]]));
  return (
    <div class="page">
      <section class="card hero-card" style={{ '--tc': t.primary, '--tc2': t.secondary } as never}>
        <Logo team={t} size={56} />
        <div>
          <h2>{t.city}{t.nickname}</h2>
          <p>本拠地: {t.park.name}（両翼{t.park.lf}m・中堅{t.park.cf}m・{t.park.dome ? 'ドーム' : '屋外'}・{t.park.turf ? '人工芝' : '天然芝'}）</p>
          <p>支配下 {active.length + farm.length}人（一軍 {active.length}人・外国人 {foreignActive}/4）・育成 {ikusei.length}人</p>
        </div>
      </section>
      <div class="toolbar">
        <select value={id} onChange={(e) => (location.hash = '#/team/' + (e.target as HTMLSelectElement).value)}>
          {w.teams.map((x) => <option key={x.id} value={x.id}>{x.city}{x.nickname}</option>)}
        </select>
        <div class="seg">
          {([['one', '一軍'], ['two', '二軍・育成'], ['order', '打順'], ['rot', 'ローテ・ブルペン']] as const).map(([k, l]) => (
            <button key={k} class={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      {tab === 'one' && <section class="card">{pTable(pitchers(active), roles)}{hTable(hitters(active))}</section>}
      {tab === 'two' && (
        <section class="card">
          <h3>二軍</h3>{pTable(pitchers(farm))}{hTable(hitters(farm))}
          <h3>育成選手</h3>{pTable(pitchers(ikusei))}{hTable(hitters(ikusei))}
        </section>
      )}
      {tab === 'order' && (
        <section class="card">
          <h3>今日の打順（自動・対右投手）</h3>
          <ol class="order">
            {input.lineup.order.map((s) => {
              const p = w.players[s.playerId];
              return <li key={s.playerId}><span class="pos">{POS_1[s.pos]}</span><a href={'#/player/' + p.id}>{p.name}</a><small>{POS_JP[s.pos]}</small></li>;
            })}
          </ol>
          <h4>ベンチ</h4>
          <p>{input.lineup.bench.map((id) => w.players[id].name).join('、')}</p>
          <p class="muted small">打順の手動編集と試合中の采配はフェーズ3で追加します。</p>
        </section>
      )}
      {tab === 'rot' && (
        <section class="card">
          <h3>先発ローテーション（中6日）</h3>
          <ol class="order">
            {ts.rotation.map((pid) => {
              const p = w.players[pid];
              const last = ts.lastStart[pid];
              return <li key={pid}><a href={'#/player/' + pid}>{p.name}</a><small>{last !== undefined ? `前回登板 ${today - last}日前` : '未登板'}{pid === sp ? '・今日の先発' : ''}</small></li>;
            })}
          </ol>
          <h3>ブルペン</h3>
          <ul class="order">
            {input.lineup.bullpen.map((b) => (
              <li key={b.playerId}><span class="pos">{roleJP[b.role]}</span><a href={'#/player/' + b.playerId}>{w.players[b.playerId].name}</a>
                <small>{[1, 2, 3].map((d) => ts.pitchLog[b.playerId]?.[today - d] ?? 0).map((n) => (n ? '●' : '○')).join('')}（直近3日）</small></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
