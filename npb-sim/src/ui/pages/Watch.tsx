import { useState } from 'preact/hooks';
import type { OffenseTactic, SideState } from '../../engine/game';
import { offenseValue, pitcherValue, relieverAvailable } from '../../engine/ai';
import { PITCH_NAMES, type FieldPos, type Pos } from '../../engine/types';
import { fmtDate } from '../../league/calendar';
import { teamById, type World } from '../../league/world';
import { Field } from '../components/Field';
import { Logo } from '../components/Logo';
import { f2, f3, grade, ipStr, POS_1 } from '../format';
import { advance, finishLive, idle, live, startLive, stop, type Live, type StepMode } from '../live';
import { pitchText } from '../liveView';
import { autosave } from '../actions';
import { go, useWorld } from '../store';

function seasonBat(w: World, pid: number) {
  let ab = 0, h = 0, hr = 0, rbi = 0;
  for (const e of Object.values(w.season)) if (e.pid === pid && e.bat) { ab += e.bat.ab; h += e.bat.h; hr += e.bat.hr; rbi += e.bat.rbi; }
  return { avg: ab ? h / ab : 0, hr, rbi };
}
function seasonPit(w: World, pid: number) {
  let outs = 0, er = 0, wn = 0, l = 0, sv = 0;
  for (const e of Object.values(w.season)) if (e.pid === pid && e.pitch) { outs += e.pitch.outs; er += e.pitch.er; wn += e.pitch.w; l += e.pitch.l; sv += e.pitch.sv; }
  return { era: outs ? (er * 27) / outs : 0, w: wn, l, sv, outs };
}

const TACTICS: [OffenseTactic, string][] = [['none', '打たせる'], ['bunt', '送りバント'], ['steal', '盗塁'], ['steal3', '三盗'], ['hitrun', 'エンドラン'], ['squeeze', 'スクイズ']];
const ROLE_JP: Record<string, string> = { CL: '抑え', SU1: 'SU', SU2: 'SU2', MID: '中継ぎ', LONG: 'ロング', SP: '先発' };

function Lights({ n, max, cls }: { n: number; max: number; cls: string }) {
  return <span class="lights">{[...Array(max)].map((_, i) => <i key={i} class={i < n ? cls : ''} />)}</span>;
}

function Zone({ L }: { L: Live }) {
  const ps = L.view.pitchesThisPA;
  return (
    <svg class="zone" viewBox="-2.2 -2.2 4.4 4.4" role="img" aria-label="投球コース">
      <rect x="-1" y="-1" width="2" height="2" class="zbox" />
      {[-1 / 3, 1 / 3].map((x) => <line key={'v' + x} x1={x} x2={x} y1="-1" y2="1" class="zgrid" />)}
      {[-1 / 3, 1 / 3].map((y) => <line key={'h' + y} y1={y} y2={y} x1="-1" x2="1" class="zgrid" />)}
      {ps.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={-p.y} r="0.3" class={`pdot ${p.result}`} />
          <text x={p.x} y={-p.y + 0.11} class="pnum">{i + 1}</text>
        </g>
      ))}
    </svg>
  );
}

export function Watch() {
  const w = useWorld();
  const [, setTick] = useState(0);
  const L = live;
  if (!L) {
    return <div class="page"><section class="card"><p>観戦中の試合はありません。</p><button class="btn" onClick={() => go('home')}>ホームへ</button></section></div>;
  }
  const g = w.calendar.games.find((x) => x.id === L.gameId)!;
  const A = teamById(w, g.away), H = teamById(w, g.home);
  const v = L.view;
  const sim = L.sim;
  const offTeam = v.top ? A : H;
  const defTeam = v.top ? H : A;
  const isIdle = idle(L);
  const name = (id: number | null) => (id === null ? '' : w.players[id]?.name ?? '?');
  const mySide: SideState = sim.away.team.teamId === w.userTeamId ? sim.away : sim.home;
  const myOffense = isIdle ? sim.offense === mySide : v.top === (mySide === sim.away);
  const nextBatterId = isIdle ? sim.offense.order[sim.offense.next].playerId : v.batter;
  const batterId = v.batter ?? nextBatterId;
  const pitcherId = isIdle ? sim.defenseSide.pitcher.id : v.pitcher[v.top ? 1 : 0];
  const batter = batterId ? w.players[batterId] : null;
  const pitcher = pitcherId ? w.players[pitcherId] : null;
  const sb = batter ? seasonBat(w, batter.id) : null;
  const sp = pitcher ? seasonPit(w, pitcher.id) : null;
  const td = batter ? v.today[batter.id] : undefined;
  const refresh = () => setTick((x) => x + 1);
  const run = (m: StepMode) => void advance(L, w, m);
  const n = Math.max(9, v.line[0].length, v.line[1].length);
  const koshien = false;
  const defLabels: Partial<Record<FieldPos, string>> = {};
  for (const pos of Object.keys(sim.defenseSide.defense) as FieldPos[]) defLabels[pos] = String(w.players[sim.defenseSide.defense[pos]]?.number ?? '');
  const finish = () => {
    finishLive(L, w);
    void autosave(w);
    go('game/' + g.id);
  };
  return (
    <div class={`page watch ${koshien ? 'koshien' : ''}`}>
      <section class="card sb-card">
        <div class="sb-head">
          <span>{fmtDate(g.date)} {H.park.name}</span>
          <span class="inn">{v.over ? '試合終了' : `${v.inning}回${v.top ? '表' : '裏'}`}</span>
        </div>
        <div class="tablewrap">
          <table class="linescore">
            <thead><tr><th class="tn" />{[...Array(n)].map((_, i) => <th key={i} class={!v.over && i + 1 === v.inning ? 'now' : ''}>{i + 1}</th>)}<th class="tot">計</th><th class="tot">安</th><th class="tot">失</th></tr></thead>
            <tbody>
              {([[A, 0], [H, 1]] as const).map(([t, i]) => (
                <tr key={t.id}>
                  <th class="tn"><Logo team={t} size={18} /> {t.short}</th>
                  {[...Array(n)].map((_, k) => {
                    const val = v.line[i][k];
                    const cur = !v.over && k + 1 === v.inning && (i === 0) === v.top;
                    return <td key={k} class={cur ? 'now' : ''}>{val ?? (cur ? v.halfRuns : '')}</td>;
                  })}
                  <td class="tot runs">{v.score[i]}</td><td class="tot">{v.hits[i]}</td><td class="tot">{v.errors[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div class="watch-grid">
        <section class="card field-card">
          <div class="fieldwrap">
            <Field park={H.park} defColor={defTeam.primary} defColor2={defTeam.secondary} offColor={offTeam.primary} offColor2={offTeam.secondary}
              bases={v.bases.map((id) => (id === null ? null : String(w.players[id]?.number ?? '')))} batterSide={batter && !v.over ? (batter.bats === 'S' ? (pitcher?.throws === 'R' ? 'L' : 'R') : batter.bats) : null}
              anim={L.anim} t={L.t} defLabels={defLabels} />
            {L.anim?.caption && L.t > 0.35 && <div class={`caption ${L.anim.captionCls ?? ''}`}>{L.anim.caption}</div>}
            <div class="count">
              <div><b>B</b><Lights n={v.balls} max={3} cls="on-b" /></div>
              <div><b>S</b><Lights n={v.strikes} max={2} cls="on-s" /></div>
              <div><b>O</b><Lights n={v.outs} max={2} cls="on-o" /></div>
            </div>
          </div>
          <div class="controls">
            <div class="btns">
              <button class="btn" disabled={L.playing || v.over} onClick={() => run('pitch')}>1球</button>
              <button class="btn primary" disabled={L.playing || v.over} onClick={() => run('pa')}>1打席</button>
              <button class="btn" disabled={L.playing || v.over} onClick={() => run('inning')}>1イニング</button>
              <button class="btn" disabled={L.playing || v.over} onClick={() => run('game')}>試合終了まで</button>
              {L.playing && <button class="btn danger" onClick={() => stop(L)}>一時停止</button>}
            </div>
            <div class="speed">
              速度
              <div class="seg">
                {[[0.5, '0.5x'], [1, '1x'], [2, '2x'], [4, '4x'], [0, '演出なし']].map(([s, l]) => (
                  <button key={l} class={L.speed === s ? 'on' : ''} onClick={() => { L.speed = s as number; refresh(); }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div class="side">
          <section class="card matchup">
            <div class="mrow">
              <span class="who">投手</span>
              <a href={'#/player/' + pitcher?.id}>{pitcher?.name}</a>
              <small>{pitcher ? `${pitcher.throws === 'R' ? '右' : '左'}・${v.pitchCount[pitcher.id] ?? 0}球` : ''}{sp ? `・${sp.w}勝${sp.l}敗${sp.sv ? sp.sv + 'S' : ''} 防${f2(sp.era)}` : ''}</small>
            </div>
            <div class="mrow">
              <span class="who">{isIdle ? '次打者' : '打者'}</span>
              <a href={'#/player/' + batter?.id}>{batter?.name}</a>
              <small>{batter ? `${batter.bats === 'R' ? '右' : batter.bats === 'L' ? '左' : '両'}打` : ''}{sb ? `・${f3(sb.avg)} ${sb.hr}本 ${sb.rbi}点` : ''}{td ? `・今日 ${td.ab}-${td.h}` : ''}</small>
            </div>
            <div class="pitchrow">
              <Zone L={L} />
              <div class="plist">
                {v.pitchesThisPA.map((p, i) => <div key={i} class={`p ${p.result}`}>{pitchText(p, i + 1)}</div>)}
                {v.lastPitch && <div class="lastp">{PITCH_NAMES[v.lastPitch.type]} <b>{v.lastPitch.kmh}</b>km/h</div>}
              </div>
            </div>
          </section>

          {!v.over ? (
            <section class={`card tactics ${isIdle ? '' : 'disabled'}`}>
              <h3>{myOffense ? '攻撃の采配' : '守備の采配'} <small class="muted">{isIdle ? '次の打席に向けて指示できます' : '打席中は指示できません'}</small></h3>
              {myOffense ? <OffenseControls L={L} w={w} side={mySide} refresh={refresh} /> : <DefenseControls L={L} w={w} side={mySide} refresh={refresh} />}
              <details class="auto">
                <summary>AIに任せる項目</summary>
                {([['pitching', '継投'], ['subs', '代打・代走・守備固め'], ['tactics', '作戦（バント・盗塁など）']] as const).map(([k, l]) => (
                  <label class="check" key={k}>
                    <input type="checkbox" checked={sim.manualAuto[k]} onChange={(e) => { sim.manualAuto[k] = (e.target as HTMLInputElement).checked; refresh(); }} /> {l}
                  </label>
                ))}
                <p class="muted small">チェックを外すと、その項目はあなたが指示したときだけ行います（疲れ切った投手だけは自動で交代します）。</p>
              </details>
            </section>
          ) : (
            <section class="card">
              <h3>試合終了 {v.score[0]} - {v.score[1]}</h3>
              <button class="btn primary big" onClick={finish}>結果を記録して、今日の他の試合も進める</button>
            </section>
          )}

          <section class="card log">
            <h3>実況</h3>
            <ul>
              {v.log.slice(0, 60).map((l, i) => <li key={v.log.length - i} class={l.cls}><small>{l.inning}{l.top ? '表' : '裏'}</small>{l.text}</li>)}
              {v.log.length === 0 && <li class="muted">プレイボール！ {name(sim.away.pitcher.id)}（{A.short}）と {name(sim.home.pitcher.id)}（{H.short}）の先発で試合開始</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function benchOf(w: World, side: SideState) {
  return side.bench.filter((id) => !side.used.has(id)).map((id) => w.players[id]);
}

function OffenseControls({ L, w, side, refresh }: { L: Live; w: World; side: SideState; refresh: () => void }) {
  const sim = L.sim;
  const [ph, setPh] = useState<number | ''>('');
  const [pr, setPr] = useState<{ base: number; id: number | '' }>({ base: -1, id: '' });
  const ok = idle(L);
  const [b1, b2, b3] = sim.bases;
  const valid: Record<OffenseTactic, boolean> = {
    none: true, bunt: !!(b1 || b2), steal: !!(b1 && !b2), steal3: !!(b2 && !b3), hitrun: !!b1, squeeze: !!(b3 && sim.outs < 2),
  };
  const bench = benchOf(w, side).filter((p) => !p.isPitcher);
  const vs = w.players[sim.defenseSide.pitcher.id]?.throws;
  return (
    <div class="tgroup">
      <div class="btns">
        {TACTICS.map(([k, l]) => (
          <button key={k} class={`btn ${(sim.pendingTactic ?? 'none') === k ? 'sel' : ''}`} disabled={!ok || !valid[k]} onClick={() => { sim.pendingTactic = k === 'none' ? null : k; refresh(); }}>{l}</button>
        ))}
      </div>
      <div class="subrow">
        <label>代打</label>
        <select value={ph} disabled={!ok} onChange={(e) => setPh(Number((e.target as HTMLSelectElement).value) || '')}>
          <option value="">選手を選ぶ</option>
          {bench.map((p) => <option key={p.id} value={p.id}>{p.name}（{POS_1[p.primary]}・{p.bats === 'R' ? '右' : p.bats === 'L' ? '左' : '両'}・打力{grade(offenseValue(p, vs)).g}）</option>)}
        </select>
        <button class="btn" disabled={!ok || ph === ''} onClick={() => { sim.substitute(side, side.next, ph as number, 'PH'); setPh(''); refresh(); }}>送る</button>
      </div>
      <div class="subrow">
        <label>代走</label>
        <select value={pr.base} disabled={!ok} onChange={(e) => setPr({ ...pr, base: Number((e.target as HTMLSelectElement).value) })}>
          <option value={-1}>走者</option>
          {sim.bases.map((r, i) => r && <option key={i} value={i}>{i + 1}塁 {w.players[r.id].name}</option>)}
        </select>
        <select value={pr.id} disabled={!ok} onChange={(e) => setPr({ ...pr, id: Number((e.target as HTMLSelectElement).value) || '' })}>
          <option value="">選手を選ぶ</option>
          {bench.map((p) => <option key={p.id} value={p.id}>{p.name}（走力{grade(p.bat.speed).g}）</option>)}
        </select>
        <button class="btn" disabled={!ok || pr.base < 0 || pr.id === '' || !sim.bases[pr.base]} onClick={() => {
          const runner = sim.bases[pr.base]!;
          const slot = side.order.findIndex((s) => s.playerId === runner.id);
          if (slot >= 0) sim.substitute(side, slot, pr.id as number, 'PR');
          setPr({ base: -1, id: '' });
          refresh();
        }}>送る</button>
      </div>
    </div>
  );
}

function DefenseControls({ L, w, side, refresh }: { L: Live; w: World; side: SideState; refresh: () => void }) {
  const sim = L.sim;
  const ok = idle(L);
  const [rp, setRp] = useState<number | ''>('');
  const [def, setDef] = useState<{ slot: number; id: number | ''; pos: Pos | '' }>({ slot: -1, id: '', pos: '' });
  const pen = side.bullpen.filter((b) => !side.used.has(b.playerId));
  const ps = side.pitcher;
  const canIBB = !sim.bases[0] || !(sim.bases[0] && sim.bases[1] && sim.bases[2]);
  const bench = benchOf(w, side).filter((p) => !p.isPitcher);
  return (
    <div class="tgroup">
      <p class="small">投手 {w.players[ps.id].name}: {ps.pitches}球・{ipStr(ps.outs)}回・{sim.pitchLine(ps.id).r}失点{sim.pitcherFatigue(ps) > 0.5 ? '・疲れが見える' : ''}</p>
      <div class="btns">
        <button class={`btn ${sim.pendingIBB ? 'sel' : ''}`} disabled={!ok || !canIBB} onClick={() => { sim.pendingIBB = sim.pendingIBB ? null : true; refresh(); }}>
          {sim.pendingIBB ? '敬遠（指示済み）' : '申告敬遠'}
        </button>
      </div>
      <div class="subrow">
        <label>継投</label>
        <select value={rp} disabled={!ok} onChange={(e) => setRp(Number((e.target as HTMLSelectElement).value) || '')}>
          <option value="">リリーフを選ぶ</option>
          {pen.map((b) => {
            const p = w.players[b.playerId];
            const av = relieverAvailable(side, p.id);
            return <option key={p.id} value={p.id}>{ROLE_JP[b.role]} {p.name}（{p.throws === 'R' ? '右' : '左'}・総合{grade(pitcherValue(p)).g}{av ? '' : '・連投'}）</option>;
          })}
        </select>
        <button class="btn" disabled={!ok || rp === ''} onClick={() => {
          const b = side.bullpen.find((x) => x.playerId === rp)!;
          sim.changePitcher(side, b.playerId, b.role);
          setRp('');
          refresh();
        }}>交代</button>
      </div>
      <div class="subrow">
        <label>守備</label>
        <select value={def.slot} disabled={!ok} onChange={(e) => {
          const slot = Number((e.target as HTMLSelectElement).value);
          setDef({ ...def, slot, pos: slot >= 0 ? side.order[slot].pos : '' });
        }}>
          <option value={-1}>下げる選手</option>
          {side.order.map((s, i) => s.pos !== 'P' && <option key={i} value={i}>{POS_1[s.pos]} {w.players[s.playerId].name}</option>)}
        </select>
        <select value={def.id} disabled={!ok} onChange={(e) => setDef({ ...def, id: Number((e.target as HTMLSelectElement).value) || '' })}>
          <option value="">入れる選手</option>
          {bench.map((p) => <option key={p.id} value={p.id}>{p.name}（{Object.keys(p.bat.positions).map((k) => POS_1[k]).join('')}・守{grade(p.bat.fielding).g}）</option>)}
        </select>
        <button class="btn" disabled={!ok || def.slot < 0 || def.id === ''} onClick={() => {
          sim.substitute(side, def.slot, def.id as number, 'DEF', (def.pos || undefined) as Pos | undefined);
          setDef({ slot: -1, id: '', pos: '' });
          refresh();
        }}>交代</button>
      </div>
    </div>
  );
}

export { startLive };
