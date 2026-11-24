import { useState } from 'preact/hooks';
import { offenseValue, pitcherValue } from '../../engine/ai';
import type { Pos } from '../../engine/types';
import { autoLineup, defenseValueAt } from '../../league/roster';
import { rosterOf, type World } from '../../league/world';
import { f3, grade, POS_1 } from '../format';
import { notify, toast } from '../store';

const FIELD: Pos[] = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];

function batAvg(w: World, pid: number) {
  let ab = 0, h = 0;
  for (const e of Object.values(w.season)) if (e.pid === pid && e.bat) { ab += e.bat.ab; h += e.bat.h; }
  return ab ? f3(h / ab) : '-';
}

export function validateOrder(order: { playerId: number; pos: string }[]): string | null {
  if (order.length !== 9) return '9人を選んでください';
  const ids = new Set(order.map((o) => o.playerId));
  if (ids.size !== 9) return '同じ選手が2回入っています';
  for (const p of FIELD) {
    const n = order.filter((o) => o.pos === p).length;
    if (n !== 1) return `${POS_1[p]}（${p}）がちょうど1人になるようにしてください`;
  }
  return null;
}

export function LineupEditor({ w, tid }: { w: World; tid: number }) {
  const ts = w.teamState[tid];
  const hitters = rosterOf(w, tid, 'active').filter((p) => !p.isPitcher);
  const initial = () => ts.manualOrder ?? autoLineup(hitters, true).order.map((o) => ({ playerId: o.playerId, pos: o.pos as string }));
  const [order, setOrder] = useState(initial);
  const err = validateOrder(order);
  const set = (i: number, patch: Partial<{ playerId: number; pos: string }>) => setOrder(order.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const o = [...order];
    [o[i], o[j]] = [o[j], o[i]];
    setOrder(o);
  };
  const benchIds = new Set(order.map((o) => o.playerId));
  return (
    <div class="lineup-edit">
      <p class="muted small">{ts.manualOrder ? '手動の打順を使っています。' : '今は自動の打順です。編集して「この打順で戦う」を押すと、次の試合から使われます（DH制の試合）。'}</p>
      <ol class="order edit">
        {order.map((o, i) => {
          const p = w.players[o.playerId];
          return (
            <li key={i}>
              <select value={o.pos} onChange={(e) => set(i, { pos: (e.target as HTMLSelectElement).value })} aria-label="守備位置">
                {FIELD.map((x) => <option key={x} value={x}>{POS_1[x]}</option>)}
              </select>
              <select value={o.playerId} onChange={(e) => set(i, { playerId: Number((e.target as HTMLSelectElement).value) })} aria-label="選手">
                {hitters.map((h) => <option key={h.id} value={h.id}>{h.name}{benchIds.has(h.id) && h.id !== o.playerId ? '（出場中）' : ''}</option>)}
              </select>
              <small>
                {batAvg(w, p.id) !== '-' && `${batAvg(w, p.id)}・`}打{grade(offenseValue(p)).g}
                {o.pos !== 'DH' && `・守${grade(Math.max(0, defenseValueAt(p, o.pos as never))).g}`}
                {o.pos !== 'DH' && (p.bat.positions[o.pos as never] ?? 0) < 40 && <em class="tag">不慣れ</em>}
              </small>
              <span class="mv">
                <button class="btn" onClick={() => move(i, -1)} aria-label="上へ">▲</button>
                <button class="btn" onClick={() => move(i, 1)} aria-label="下へ">▼</button>
              </span>
            </li>
          );
        })}
      </ol>
      {err && <p class="warn">{err}</p>}
      <div class="btns">
        <button class="btn primary" disabled={!!err} onClick={() => { ts.manualOrder = order; notify(); toast('打順を保存しました'); }}>この打順で戦う</button>
        <button class="btn" onClick={() => { ts.manualOrder = null; setOrder(autoLineup(hitters, true).order.map((o) => ({ playerId: o.playerId, pos: o.pos as string }))); notify(); toast('自動の打順に戻しました'); }}>自動に戻す</button>
      </div>
    </div>
  );
}

export function RotationEditor({ w, tid }: { w: World; tid: number }) {
  const ts = w.teamState[tid];
  const pitchers = rosterOf(w, tid, 'active').filter((p) => p.isPitcher);
  const [add, setAdd] = useState<number | ''>('');
  const rot = ts.rotation.filter((id) => pitchers.some((p) => p.id === id));
  const update = (r: number[]) => {
    ts.rotation = r;
    ts.rotIdx = 0;
    notify();
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rot.length) return;
    const r = [...rot];
    [r[i], r[j]] = [r[j], r[i]];
    update(r);
  };
  const others = pitchers.filter((p) => !rot.includes(p.id));
  return (
    <div>
      <ol class="order edit">
        {rot.map((id, i) => {
          const p = w.players[id];
          return (
            <li key={id}>
              <span>{p.name}</span>
              <small>総合{grade(pitcherValue(p)).g}・スタミナ{grade(p.pit!.stamina).g}</small>
              <span class="mv">
                <button class="btn" onClick={() => move(i, -1)} aria-label="上へ">▲</button>
                <button class="btn" onClick={() => move(i, 1)} aria-label="下へ">▼</button>
                <button class="btn danger" disabled={rot.length <= 5} onClick={() => update(rot.filter((x) => x !== id))}>外す</button>
              </span>
            </li>
          );
        })}
      </ol>
      <div class="subrow">
        <select value={add} onChange={(e) => setAdd(Number((e.target as HTMLSelectElement).value) || '')}>
          <option value="">ブルペンから先発に回す</option>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name}（スタミナ{grade(p.pit!.stamina).g}）</option>)}
        </select>
        <button class="btn" disabled={add === '' || rot.length >= 7} onClick={() => { update([...rot, add as number]); setAdd(''); }}>加える</button>
      </div>
      <p class="muted small">先発は5〜7人。中6日を基本に、上から順に登板します。ローテから外した投手はブルペンに入ります。</p>
    </div>
  );
}
