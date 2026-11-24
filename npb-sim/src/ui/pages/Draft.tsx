import { useState } from 'preact/hooks';
import { PITCH_NAMES } from '../../engine/types';
import { autoDraft, currentPicker, makePick, runAiPicks, submitRound1, type LotteryLog } from '../../league/draft';
import { completeDraft, draftPending } from '../../league/sim';
import { teamById, type World } from '../../league/world';
import type { Prospect } from '../../players/prospects';
import { Logo } from '../components/Logo';
import { projection, scoutedRatings, uncertainty } from '../../amateur/scout';
import { grade, POS_1 } from '../format';
import { go, notify, toast, useWorld } from '../store';
import { autosave } from '../actions';

const KIND: Record<string, string> = { HS: '高校', COL: '大学', SHA: '社会人' };

function evalOf(w: World, p: Prospect) {
  return w.draft!.views[w.userTeamId][p.id] ?? 0;
}

function ProspectRow({ w, p, onPick, pickLabel, taken }: { w: World; p: Prospect; onPick?: () => void; pickLabel?: string; taken?: string }) {
  const v = evalOf(w, p);
  const sd = w.amateur.players[p.id] ? uncertainty(w, p.id) : 4;
  const pl = p.player;
  return (
    <tr class={taken ? 'taken' : ''}>
      <td class="l"><a href={'#/am/' + p.id}><b>{pl.name}</b></a>{w.amateur.watch[p.id] && <em class="tag">注目</em>}{p.note && <small class="note"> {p.note}</small>}</td>
      <td class="l small">{KIND[p.kind]}・{p.school}</td>
      <td>{POS_1[p.pos]}</td><td>{pl.age}</td>
      <td>{pl.throws === 'R' ? '右' : '左'}投{pl.bats === 'R' ? '右' : pl.bats === 'L' ? '左' : '両'}打</td>
      <td><span class={`grade ${grade(v).cls}`} title={`ぶれ ±${Math.round(sd)}`}>{grade(v).g}{sd > 9 ? '?' : ''}</span><small class="muted"> {projection(v)}</small></td>
      <td><span class="hype" style={{ width: `${p.hype}%` }} title={`注目度 ${p.hype}`} /></td>
      <td class="l small">
        {pl.isPitcher && pl.pit
          ? (() => { const s = w.amateur.players[p.id] ? scoutedRatings(w, w.amateur.players[p.id]) : null; const pt = s?.pit ?? pl.pit; return `${Math.round(pt.velocity)}km・制球${grade(pt.control).g}・${pt.pitches.map((x) => PITCH_NAMES[x.type]).join('/')}`; })()
          : (() => { const s = w.amateur.players[p.id] ? scoutedRatings(w, w.amateur.players[p.id]) : null; const b = s?.bat ?? pl.bat; return `ミ${grade(b.contact).g} パ${grade(b.power).g} 走${grade(b.speed).g} 守${grade(b.fielding).g}`; })()}
      </td>
      <td>{taken ? <small>{taken}</small> : onPick ? <button class="btn" onClick={onPick}>{pickLabel}</button> : null}</td>
    </tr>
  );
}

export function DraftPage() {
  const w = useWorld();
  const [kind, setKind] = useState('');
  const [pos, setPos] = useState('');
  const [lots, setLots] = useState<LotteryLog[]>([]);
  const d = w.draft;
  if (!d) {
    return (
      <div class="page"><section class="card"><h2>ドラフト会議</h2>
        <p>ドラフト会議は毎年10月、クライマックスシリーズのあと日本シリーズの前に行われます。その日になると日程が止まるので、この画面で指名してください。</p>
        <p class="muted small">1巡目は全球団が同時に入札し、重複したら抽選。2巡目以降はウェーバー方式（交流戦で勝ち越したリーグの最下位から両リーグ交互、奇数巡は逆順）。そのあと育成ドラフトです。</p>
      </section></div>
    );
  }
  const takenBy = new Map(d.picks.map((p) => [p.pid, p]));
  const me = w.userTeamId;
  const picker = currentPicker(d);
  const myTurn = (d.stage === 'r1' && !d.picks.some((p) => p.round === 1 && p.tid === me)) || picker === me;
  const list = d.prospects
    .filter((p) => !kind || p.kind === kind)
    .filter((p) => !pos || (pos === 'P' ? p.pos === 'P' : pos === 'B' ? p.pos !== 'P' : p.pos === pos))
    .sort((a, b) => evalOf(w, b) - evalOf(w, a));
  const act = (pid: number) => {
    if (d.stage === 'r1') {
      const l = submitRound1(w, d, pid);
      setLots(l);
      const mine = d.picks.find((p) => p.round === 1 && p.tid === me);
      toast(mine ? `交渉権を獲得: ${d.prospects.find((p) => p.id === mine.pid)!.player.name}` : '抽選で外れました。もう一度入札してください');
      if ((d.stage as string) === 'waiver') runAiPicks(w, d, true);
    } else {
      makePick(w, d, me, pid);
      runAiPicks(w, d, true);
    }
    notify();
  };
  const finish = () => {
    if (d.stage !== 'done') autoDraft(w, d);
    completeDraft(w);
    notify();
    void autosave(w);
    toast('ドラフト会議が終わりました');
    go('home');
  };
  const myPicks = d.picks.filter((p) => p.tid === me);
  return (
    <div class="page">
      <section class="card">
        <h2>{d.year}年 ドラフト会議</h2>
        <p class="big">
          {d.stage === 'r1' ? `1巡目 ${d.r1Sub === 1 ? '1位入札' : `外れ1位（${d.r1Sub}回目の入札）`}`
            : d.stage === 'waiver' ? `${d.round}巡目（ウェーバー）`
            : d.stage === 'ikusei' ? `育成ドラフト ${d.round}巡目` : '指名終了'}
          {myTurn && d.stage !== 'done' && <em class="tag">あなたの番です</em>}
        </p>
        <div class="btns">
          {d.stage !== 'r1' && d.stage !== 'done' && picker === me && <button class="btn" onClick={() => { makePick(w, d, me, null); runAiPicks(w, d, true); notify(); }}>{d.stage === 'ikusei' ? '育成の指名を終える' : '支配下の指名を終える'}</button>}
          {d.stage !== 'done' && <button class="btn" onClick={() => { autoDraft(w, d); notify(); }}>残りをおまかせで指名</button>}
          {(d.stage === 'done' || !draftPending(w)) && <button class="btn primary" onClick={finish}>ドラフト会議を終える</button>}
        </div>
        {lots.length > 0 && (
          <div class="lottery">
            <h4>抽選結果</h4>
            {lots.map((l) => (
              <p key={l.pid}>{d.prospects.find((p) => p.id === l.pid)!.player.name}: {l.bidders.map((t) => teamById(w, t).short).join('・')}の{l.bidders.length}球団が競合 → <b>{teamById(w, l.winner).nickname}</b>が交渉権{l.winner === me ? '獲得！' : ''}</p>
            ))}
          </div>
        )}
        {myPicks.length > 0 && <p>あなたの指名: {myPicks.map((p) => `${p.label} ${d.prospects.find((x) => x.id === p.pid)!.player.name}`).join('、')}</p>}
      </section>
      <section class="card">
        <div class="toolbar">
          <h3>候補選手（評価はあなたのスカウトの見立て）</h3>
          <select value={kind} onChange={(e) => setKind((e.target as HTMLSelectElement).value)}><option value="">全員</option><option value="HS">高校生</option><option value="COL">大学生</option><option value="SHA">社会人</option></select>
          <select value={pos} onChange={(e) => setPos((e.target as HTMLSelectElement).value)}><option value="">全ポジション</option><option value="P">投手</option><option value="B">野手</option><option value="C">捕手</option><option value="SS">遊撃手</option><option value="CF">中堅手</option></select>
        </div>
        <div class="tablewrap">
          <table class="data draft">
            <thead><tr><th class="l">選手</th><th class="l">所属</th><th>位置</th><th>齢</th><th>投打</th><th>評価</th><th>注目度</th><th class="l">特徴</th><th /></tr></thead>
            <tbody>
              {list.slice(0, 120).map((p) => {
                const t = takenBy.get(p.id);
                return <ProspectRow key={p.id} w={w} p={p} taken={t ? `${teamById(w, t.tid).short} ${t.label}` : undefined}
                  onPick={myTurn && d.stage !== 'done' ? () => act(p.id) : undefined} pickLabel={d.stage === 'r1' ? '1位で入札' : d.stage === 'ikusei' ? '育成で指名' : '指名'} />;
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section class="card">
        <h3>指名結果</h3>
        <div class="draftgrid">
          {w.teams.map((t) => (
            <div key={t.id} class={`dteam ${t.id === me ? 'me' : ''}`}>
              <h4><Logo team={t} size={18} /> {t.nickname}</h4>
              <ol>{d.picks.filter((p) => p.tid === t.id).map((p) => {
                const pr = d.prospects.find((x) => x.id === p.pid)!;
                return <li key={p.pid}><small>{p.label}</small> {pr.player.name}<small>（{KIND[pr.kind]}・{POS_1[pr.pos]}）{p.bidders ? `${p.bidders.length}球団競合` : ''}</small></li>;
              })}</ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
