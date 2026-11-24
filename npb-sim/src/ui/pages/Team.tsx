import { useState } from 'preact/hooks';
import { pitcherStuff } from '../../engine/pa';
import { PITCH_NAMES } from '../../engine/types';
import { buildTeamInput, chooseStarter, dayIndex } from '../../league/sim';
import { rosterOf, teamById, type PlayerRecord } from '../../league/world';
import { Logo } from '../components/Logo';
import { LineupEditor, RotationEditor } from '../components/LineupEditor';
import { grade, handStr, POS_1, POS_JP } from '../format';
import { notify, toast, useWorld } from '../store';
import { yen } from '../../league/contracts';
import { scoutedRatings } from '../../amateur/scout';
import { cannotActivate, demote, fixRotation, promote, signToShihaika } from '../../league/rosterOps';
import { payroll } from '../../league/offseason';

export function Grade({ v }: { v: number }) {
  const g = grade(v);
  return <span class={`grade ${g.cls}`}>{g.g}<small>{Math.round(v)}</small></span>;
}

function Move({ p }: { p: PlayerRecord }) {
  const w = useWorld();
  if (p.teamId !== w.userTeamId) return null;
  const today = dayIndex(w);
  if (p.status === 'active') return <button class="btn mini" onClick={() => { demote(w, p, today); notify(); toast(`${p.name}の登録を抹消しました（10日間は再登録不可）`); }}>抹消</button>;
  if (p.status === 'farm') {
    const why = cannotActivate(w, p, today);
    return <button class="btn mini" title={why ?? ''} disabled={!!why} onClick={() => { const e = promote(w, p, today); fixRotation(w, p.teamId!); notify(); toast(e ?? `${p.name}を一軍に登録しました`); }}>登録</button>;
  }
  if (p.status === 'ikusei') return <button class="btn mini" onClick={() => { const e = signToShihaika(w, p); notify(); toast(e ?? `${p.name}を支配下登録しました`); }}>支配下へ</button>;
  return null;
}

function HitterRow({ p }: { p: PlayerRecord }) {
  const w = useWorld();
  const b = p.teamId === w.userTeamId ? p.bat : scoutedRatings(w, p).bat;
  return (
    <tr class={p.injury ? 'injured' : ''}>
      <td>{p.number}</td>
      <td class="l"><a href={'#/player/' + p.id}>{p.name}</a>{p.foreign && <em class="tag">外</em>}{p.injury && <em class="tag" title={p.injury.desc}>傷{p.injury.days}日</em>}</td>
      <td>{POS_1[p.primary]}</td><td>{p.age}</td><td>{handStr(p.bats, p.throws)}</td>
      <td><Grade v={b.contact} /></td><td><Grade v={b.power} /></td><td><Grade v={b.eye} /></td><td><Grade v={b.speed} /></td>
      <td><Grade v={b.fielding} /></td><td><Grade v={b.arm} /></td><td><Grade v={b.catching} /></td>
      <td class="l small">{Object.entries(b.positions).filter(([, v]) => (v ?? 0) >= 40).map(([k]) => POS_1[k]).join('')}</td>
      <td class="small">{yen(p.contract.salary)}</td><td><Move p={p} /></td>
    </tr>
  );
}

function PitcherRowView({ p, role }: { p: PlayerRecord; role?: string }) {
  const w = useWorld();
  const pt = p.teamId === w.userTeamId ? p.pit! : scoutedRatings(w, p).pit!;
  return (
    <tr class={p.injury ? 'injured' : ''}>
      <td>{p.number}</td>
      <td class="l"><a href={'#/player/' + p.id}>{p.name}</a>{p.foreign && <em class="tag">外</em>}{p.injury && <em class="tag" title={p.injury.desc}>傷{p.injury.days}日</em>}</td>
      <td>{role ?? (p.role === 'SP' ? '先発' : '救援')}</td><td>{p.age}</td><td>{p.throws === 'R' ? '右' : '左'}</td>
      <td>{Math.round(pt.velocity)}km</td><td><Grade v={pitcherStuff(pt)} /></td><td><Grade v={pt.control} /></td><td><Grade v={pt.stamina} /></td>
      <td class="l small">{pt.pitches.map((x) => `${PITCH_NAMES[x.type]}${grade(x.quality).g}`).join(' ')}</td>
      <td class="small">{yen(p.contract.salary)}</td><td><Move p={p} /></td>
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
      <thead><tr><th>#</th><th class="l">野手</th><th>位</th><th>齢</th><th>投打</th><th>ミ</th><th>パ</th><th>眼</th><th>走</th><th>守</th><th>肩</th><th>捕</th><th class="l">守備位置</th><th>年俸</th><th /></tr></thead>
      <tbody>{ps.map((p) => <HitterRow key={p.id} p={p} />)}</tbody>
    </table></div>
  );
  const pTable = (ps: PlayerRecord[], roles?: Map<number, string>) => (
    <div class="tablewrap"><table class="data roster">
      <thead><tr><th>#</th><th class="l">投手</th><th>役割</th><th>齢</th><th>投</th><th>球速</th><th>球威</th><th>制球</th><th>スタ</th><th class="l">変化球</th><th>年俸</th><th /></tr></thead>
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
          <p>支配下 {active.length + farm.length}/70人（一軍 {active.length}/31人・一軍の外国人 {foreignActive}/4）・育成 {ikusei.length}人</p>
          <p class="small">年俸総額 {yen(payroll(w, id))}（予算 {yen(w.budget[id] ?? 0)}）</p>
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
          {id === w.userTeamId && (<><h3>打順の編集</h3><LineupEditor w={w} tid={id} /><hr /></>)}
          <h3>今日の打順（{w.teamState[id].manualOrder && id === w.userTeamId ? '手動' : '自動・対右投手'}）</h3>
          <ol class="order">
            {input.lineup.order.map((s) => {
              const p = w.players[s.playerId];
              return <li key={s.playerId}><span class="pos">{POS_1[s.pos]}</span><a href={'#/player/' + p.id}>{p.name}</a><small>{POS_JP[s.pos]}</small></li>;
            })}
          </ol>
          <h4>ベンチ</h4>
          <p>{input.lineup.bench.map((id) => w.players[id].name).join('、')}</p>
        </section>
      )}
      {tab === 'rot' && (
        <section class="card">
          {id === w.userTeamId && (<><h3>ローテーションの編集</h3><RotationEditor w={w} tid={id} /><hr /></>)}
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
