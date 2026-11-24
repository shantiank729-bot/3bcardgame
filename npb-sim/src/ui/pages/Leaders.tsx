import { useState } from 'preact/hooks';
import { LEAGUE_NAMES, type LeagueId } from '../../league/teams';
import { teamById } from '../../league/world';
import { batterRows, contexts, pitcherRows, type BatterRow, type PitcherRow } from '../../stats/tables';
import { f2, f3, ipStr } from '../format';
import { useWorld } from '../store';

type Cat<T> = { label: string; v: (r: T) => number; fmt: (r: T) => string; rate?: boolean; asc?: boolean };

const BAT: Cat<BatterRow>[] = [
  { label: '打率', v: (r) => r.avg, fmt: (r) => f3(r.avg), rate: true },
  { label: '本塁打', v: (r) => r.b.hr, fmt: (r) => String(r.b.hr) },
  { label: '打点', v: (r) => r.b.rbi, fmt: (r) => String(r.b.rbi) },
  { label: '安打', v: (r) => r.b.h, fmt: (r) => String(r.b.h) },
  { label: '盗塁', v: (r) => r.b.sb, fmt: (r) => String(r.b.sb) },
  { label: '出塁率', v: (r) => r.obp, fmt: (r) => f3(r.obp), rate: true },
  { label: '長打率', v: (r) => r.slg, fmt: (r) => f3(r.slg), rate: true },
  { label: 'OPS', v: (r) => r.ops, fmt: (r) => f3(r.ops), rate: true },
  { label: '得点', v: (r) => r.b.r, fmt: (r) => String(r.b.r) },
  { label: '四球', v: (r) => r.b.bb, fmt: (r) => String(r.b.bb) },
];
const PIT: Cat<PitcherRow>[] = [
  { label: '防御率', v: (r) => r.era, fmt: (r) => f2(r.era), rate: true, asc: true },
  { label: '勝利', v: (r) => r.p.w, fmt: (r) => String(r.p.w) },
  { label: 'セーブ', v: (r) => r.p.sv, fmt: (r) => String(r.p.sv) },
  { label: 'ホールド', v: (r) => r.p.hld, fmt: (r) => String(r.p.hld) },
  { label: '奪三振', v: (r) => r.p.k, fmt: (r) => String(r.p.k) },
  { label: '勝率', v: (r) => (r.p.w + r.p.l ? r.p.w / (r.p.w + r.p.l) : 0), fmt: (r) => f3(r.p.w / Math.max(1, r.p.w + r.p.l)), rate: true },
  { label: 'WHIP', v: (r) => r.whip, fmt: (r) => f2(r.whip), rate: true, asc: true },
  { label: '投球回', v: (r) => r.p.outs, fmt: (r) => ipStr(r.p.outs) },
  { label: '完投', v: (r) => r.p.cg, fmt: (r) => String(r.p.cg) },
];

function Board<T extends { pid: number; tid: number; name: string; qualified: boolean }>({ cats, rows }: { cats: Cat<T>[]; rows: T[] }) {
  const w = useWorld();
  return (
    <div class="boards">
      {cats.map((c) => {
        const pool = c.rate ? rows.filter((r) => r.qualified) : rows;
        const top = [...pool].sort((a, b) => (c.asc ? c.v(a) - c.v(b) : c.v(b) - c.v(a))).slice(0, 5);
        return (
          <div class="board" key={c.label}>
            <h4>{c.label}</h4>
            <ol>
              {top.map((r) => (
                <li key={r.pid}><a href={'#/player/' + r.pid}>{r.name}</a><small>{teamById(w, r.tid).short}</small><b>{c.fmt(r)}</b></li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

export function Leaders() {
  const w = useWorld();
  const [lg, setLg] = useState<LeagueId>(w.teams.find((t) => t.id === w.userTeamId)!.league);
  const ctx = contexts(w);
  return (
    <div class="page">
      <div class="seg">
        {(['C', 'P'] as const).map((l) => <button key={l} class={l === lg ? 'on' : ''} onClick={() => setLg(l)}>{LEAGUE_NAMES[l]}</button>)}
      </div>
      <section class="card"><h2>打撃部門</h2><Board cats={BAT} rows={batterRows(w, lg, ctx)} /></section>
      <section class="card"><h2>投手部門</h2><Board cats={PIT} rows={pitcherRows(w, lg, ctx)} /></section>
      <p class="muted small">率の部門は規定打席（試合数×3.1）・規定投球回（試合数×1.0）以上が対象</p>
    </div>
  );
}
