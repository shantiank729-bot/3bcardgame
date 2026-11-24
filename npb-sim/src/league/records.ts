/** 歴代記録（シーズン記録・通算記録・優勝の歴史・名選手） */
import type { BatLine, PitchLine } from '../engine/box';
import { computeStandings } from './standings';
import { historySeason } from './pack';
import type { PlayerSeason, World } from './world';

export interface SeasonRec { pid: number; tid: number; year: number; value: number; text: string }

const qualified = (games: number) => ({ pa: Math.floor(games * 3.1), outs: games * 3 });

/** 年ごとの成績一覧（過去＋今季） */
function seasons(w: World): { year: number; list: PlayerSeason[]; games: number }[] {
  const out = Object.entries(w.history).map(([y, h]) => ({ year: Number(y), list: historySeason(h), games: 143 }));
  if (w.phase !== 'regular' || Object.keys(w.season).length) {
    const g = Math.max(1, ...w.teams.map((t) => (w.park[t.id]?.homeGames ?? 0) + (w.park[t.id]?.awayGames ?? 0)));
    if (!w.history[w.year]) out.push({ year: w.year, list: Object.values(w.season), games: g });
  }
  return out;
}

type Cat = { key: string; label: string; bat?: (b: BatLine) => number; pit?: (p: PitchLine) => number; rate?: boolean; asc?: boolean; fmt: (v: number) => string };

export const SEASON_CATS: Cat[] = [
  { key: 'hr', label: '本塁打', bat: (b) => b.hr, fmt: (v) => `${v}本` },
  { key: 'avg', label: '打率', bat: (b) => (b.ab ? b.h / b.ab : 0), rate: true, fmt: (v) => v.toFixed(3).replace(/^0/, '') },
  { key: 'rbi', label: '打点', bat: (b) => b.rbi, fmt: (v) => `${v}` },
  { key: 'h', label: '安打', bat: (b) => b.h, fmt: (v) => `${v}` },
  { key: 'sb', label: '盗塁', bat: (b) => b.sb, fmt: (v) => `${v}` },
  { key: 'w', label: '勝利', pit: (p) => p.w, fmt: (v) => `${v}勝` },
  { key: 'era', label: '防御率', pit: (p) => (p.outs ? (p.er * 27) / p.outs : 99), rate: true, asc: true, fmt: (v) => v.toFixed(2) },
  { key: 'k', label: '奪三振', pit: (p) => p.k, fmt: (v) => `${v}` },
  { key: 'sv', label: 'セーブ', pit: (p) => p.sv, fmt: (v) => `${v}` },
];

export function seasonRecords(w: World, cat: Cat, n = 10): SeasonRec[] {
  const out: SeasonRec[] = [];
  for (const s of seasons(w)) {
    const q = qualified(s.games);
    // 球団をまたいだ成績は合算
    const byP = new Map<number, { tid: number; bat?: BatLine; pit?: PitchLine }>();
    for (const e of s.list) {
      const cur = byP.get(e.pid) ?? { tid: e.tid };
      if (e.bat) cur.bat = cur.bat ? addB(cur.bat, e.bat) : { ...e.bat };
      if (e.pitch) cur.pit = cur.pit ? addP(cur.pit, e.pitch) : { ...e.pitch };
      byP.set(e.pid, cur);
    }
    for (const [pid, x] of byP) {
      if (cat.bat && x.bat) {
        if (cat.rate && x.bat.pa < q.pa) continue;
        out.push({ pid, tid: x.tid, year: s.year, value: cat.bat(x.bat), text: '' });
      }
      if (cat.pit && x.pit) {
        if (cat.rate && x.pit.outs < q.outs) continue;
        out.push({ pid, tid: x.tid, year: s.year, value: cat.pit(x.pit), text: '' });
      }
    }
  }
  return out.sort((a, b) => (cat.asc ? a.value - b.value : b.value - a.value)).slice(0, n).map((r) => ({ ...r, text: cat.fmt(r.value) }));
}

function addB(a: BatLine, b: BatLine): BatLine {
  const o = { ...a };
  for (const k in b) (o as unknown as Record<string, number>)[k] += (b as unknown as Record<string, number>)[k];
  return o;
}
function addP(a: PitchLine, b: PitchLine): PitchLine {
  const o = { ...a };
  for (const k in b) (o as unknown as Record<string, number>)[k] += (b as unknown as Record<string, number>)[k];
  return o;
}

export interface CareerRow { pid: number; g: number; h: number; hr: number; rbi: number; sb: number; w: number; sv: number; hld: number; k: number; outs: number; pg: number }

/** 全選手の通算（ゲーム開始前の通算＋各年）を一度に集計 */
export function allCareers(w: World): CareerRow[] {
  const m = new Map<number, CareerRow>();
  const get = (pid: number) => {
    let r = m.get(pid);
    if (!r) {
      const pre = w.players[pid]?.pre;
      r = { pid, g: pre?.g ?? 0, h: pre?.h ?? 0, hr: pre?.hr ?? 0, rbi: pre?.rbi ?? 0, sb: pre?.sb ?? 0, w: pre?.w ?? 0, sv: pre?.sv ?? 0, hld: pre?.hld ?? 0, k: pre?.k ?? 0, outs: pre?.outs ?? 0, pg: pre?.pg ?? 0 };
      m.set(pid, r);
    }
    return r;
  };
  for (const s of seasons(w)) {
    for (const e of s.list) {
      const r = get(e.pid);
      if (e.bat) { r.g += e.bat.g; r.h += e.bat.h; r.hr += e.bat.hr; r.rbi += e.bat.rbi; r.sb += e.bat.sb; }
      if (e.pitch) { r.w += e.pitch.w; r.sv += e.pitch.sv; r.hld += e.pitch.hld; r.k += e.pitch.k; r.outs += e.pitch.outs; r.pg += e.pitch.g; }
    }
  }
  for (const p of Object.values(w.players)) if (p.pre) get(p.id);
  return [...m.values()];
}

export const CAREER_CATS: { key: keyof CareerRow; label: string; unit: string; milestone: number }[] = [
  { key: 'h', label: '安打', unit: '', milestone: 2000 },
  { key: 'hr', label: '本塁打', unit: '本', milestone: 400 },
  { key: 'rbi', label: '打点', unit: '', milestone: 1200 },
  { key: 'sb', label: '盗塁', unit: '', milestone: 300 },
  { key: 'w', label: '勝利', unit: '勝', milestone: 200 },
  { key: 'sv', label: 'セーブ', unit: '', milestone: 250 },
  { key: 'k', label: '奪三振', unit: '', milestone: 2000 },
];

/** 年ごとの優勝・主な表彰 */
export function championsByYear(w: World) {
  return Object.keys(w.awards).map(Number).sort((a, b) => b - a).map((y) => {
    const a = w.awards[y];
    const koshien = w.amateur?.tourneys[`${y}-koshien`]?.champion;
    const senbatsu = w.amateur?.tourneys[`${y}-senbatsu`]?.champion;
    return { year: y, a, koshien, senbatsu };
  });
}

/** 球団の歴史（年ごとの順位） */
export function franchiseHistory(w: World, tid: number) {
  const rows: { year: number; w: number; l: number; t: number; rank: number; champ: boolean; japan: boolean }[] = [];
  for (const [y, h] of Object.entries(w.history)) {
    const lg = w.teams.find((t) => t.id === tid)!.league;
    const st = h.standings.filter((r) => w.teams.find((t) => t.id === r.tid)!.league === lg)
      .map((r) => ({ ...r, pct: r.w / Math.max(1, r.w + r.l) })).sort((a, b) => b.pct - a.pct);
    const i = st.findIndex((r) => r.tid === tid);
    rows.push({ year: Number(y), w: st[i].w, l: st[i].l, t: st[i].t, rank: i + 1, champ: i === 0, japan: w.awards[Number(y)]?.champion === tid });
  }
  if (w.phase === 'regular' && !w.history[w.year]) {
    const lg = w.teams.find((t) => t.id === tid)!.league;
    const st = computeStandings(w, lg);
    const i = st.findIndex((r) => r.tid === tid);
    if (st[i].g > 0) rows.push({ year: w.year, w: st[i].w, l: st[i].l, t: st[i].t, rank: i + 1, champ: false, japan: false });
  }
  return rows.sort((a, b) => b.year - a.year);
}
