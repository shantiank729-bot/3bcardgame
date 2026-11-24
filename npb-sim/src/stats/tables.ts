import type { BatLine, PitchLine } from '../engine/box';
import type { LeagueId } from '../league/teams';
import type { PlayerSeason, World } from '../league/world';
import { computeStandings } from '../league/standings';
import { batterMetrics, leagueContext, pitcherMetrics, pythag, type BatterMetrics, type LeagueContext, type PitcherMetrics } from './saber';

export interface BatterRow extends BatterMetrics {
  pid: number; tid: number; name: string; b: BatLine; qualified: boolean;
}
export interface PitcherRow extends PitcherMetrics {
  pid: number; tid: number; name: string; p: PitchLine; qualified: boolean;
}

export function teamGamesPlayed(w: World, tid: number) {
  const a = w.park[tid];
  return a ? a.homeGames + a.awayGames : 0;
}

export function contexts(w: World): Record<LeagueId, LeagueContext> {
  return { C: leagueContext(w, 'C'), P: leagueContext(w, 'P') };
}

const leagueOf = (w: World, tid: number) => w.teams.find((t) => t.id === tid)!.league;

/** 打者一覧（リーグ補正込みのWAR） */
export function batterRows(w: World, league: LeagueId | 'ALL', ctxs = contexts(w), season: PlayerSeason[] = Object.values(w.season)): BatterRow[] {
  const rows: BatterRow[] = [];
  for (const e of season) {
    if (!e.bat || e.bat.pa === 0) continue;
    const lg = leagueOf(w, e.tid);
    if (league !== 'ALL' && lg !== league) continue;
    const ctx = ctxs[lg];
    const m = batterMetrics(e.bat, e.field, ctx, ctx.parkFactor[e.tid] ?? 1);
    const p = w.players[e.pid];
    rows.push({ ...m, pid: e.pid, tid: e.tid, name: p?.name ?? '?', b: e.bat, qualified: e.bat.pa >= Math.floor(teamGamesPlayed(w, e.tid) * 3.1) });
  }
  // リーグ補正: 打撃・走塁・守備・ポジションの合計がリーグで0になるよう打席数で配分
  for (const lg of ['C', 'P'] as const) {
    const rs = rows.filter((r) => leagueOf(w, r.tid) === lg);
    const sum = rs.reduce((s, r) => s + r.batRuns + r.bsrRuns + r.fldRuns + r.posRuns, 0);
    const pa = rs.reduce((s, r) => s + r.pa, 0);
    if (!pa) continue;
    const adj = -sum / pa;
    for (const r of rs) r.war += (adj * r.pa) / ctxs[lg].rpw;
  }
  return rows;
}

export function pitcherRows(w: World, league: LeagueId | 'ALL', ctxs = contexts(w), season: PlayerSeason[] = Object.values(w.season)): PitcherRow[] {
  const rows: PitcherRow[] = [];
  for (const e of season) {
    if (!e.pitch || e.pitch.bf === 0) continue;
    const lg = leagueOf(w, e.tid);
    if (league !== 'ALL' && lg !== league) continue;
    const ctx = ctxs[lg];
    const m = pitcherMetrics(e.pitch, ctx, ctx.parkFactor[e.tid] ?? 1);
    const p = w.players[e.pid];
    rows.push({ ...m, pid: e.pid, tid: e.tid, name: p?.name ?? '?', p: e.pitch, qualified: e.pitch.outs >= teamGamesPlayed(w, e.tid) * 3 });
  }
  return rows;
}

export interface TeamRow {
  tid: number; w: number; l: number; t: number; pct: number; rs: number; ra: number; diff: number;
  pythag: number; expW: number; luck: number; avg: number; hr: number; sb: number; era: number; risp: number;
  ops: number; pf: number; errors: number;
}

export function teamRows(w: World, league: LeagueId, ctxs = contexts(w)): TeamRow[] {
  const st = computeStandings(w, league);
  const all = Object.values(w.season);
  return st.map((s) => {
    const es = all.filter((e) => e.tid === s.tid);
    let h = 0, ab = 0, hr = 0, sb = 0, er = 0, outs = 0, rh = 0, rab = 0, bb = 0, hbp = 0, sf = 0, tb = 0, e = 0;
    for (const x of es) {
      if (x.bat) {
        h += x.bat.h; ab += x.bat.ab; hr += x.bat.hr; sb += x.bat.sb; rh += x.bat.rispH; rab += x.bat.rispAb;
        bb += x.bat.bb; hbp += x.bat.hbp; sf += x.bat.sf; tb += x.bat.h + x.bat.d + 2 * x.bat.t + 3 * x.bat.hr;
      }
      if (x.pitch) { er += x.pitch.er; outs += x.pitch.outs; }
      if (x.field) e += x.field.e;
    }
    const py = pythag(s.rs, s.ra);
    const expW = py * (s.w + s.l);
    const obp = (h + bb + hbp) / Math.max(1, ab + bb + hbp + sf);
    return {
      tid: s.tid, w: s.w, l: s.l, t: s.t, pct: s.pct, rs: s.rs, ra: s.ra, diff: s.rs - s.ra, pythag: py, expW, luck: s.w - expW,
      avg: ab ? h / ab : 0, hr, sb, era: outs ? (er * 27) / outs : 0, risp: rab ? rh / rab : 0, ops: obp + (ab ? tb / ab : 0),
      pf: ctxs[league].parkFactor[s.tid] ?? 1, errors: e,
    };
  });
}

/** 指標の説明（ツールチップ用） */
export const METRIC_HELP: Record<string, string> = {
  AVG: '打率 = 安打 ÷ 打数',
  OBP: '出塁率 = (安打+四球+死球) ÷ (打数+四球+死球+犠飛)',
  SLG: '長打率 = 塁打 ÷ 打数',
  OPS: '出塁率+長打率。打者の総合力の簡易指標',
  ISO: '純長打率 = 長打率 − 打率。長打力だけを見る',
  BABIP: '本塁打以外のフェアの打球が安打になった割合。運の影響が大きく、平均は.290前後',
  'K%': '三振 ÷ 打席',
  'BB%': '四球 ÷ 打席',
  wOBA: '加重出塁率。四球・単打・長打などに、このリーグの得点価値で重みをつけた出塁率',
  'wRC+': '球場補正済みの得点創出力。100がリーグ平均、120なら平均より20%多く得点を生み出す',
  'OPS+': '球場補正済みのOPSをリーグ平均100として表したもの',
  WAR: '代替可能な選手（控え・二軍レベル）と比べて何勝分チームに貢献したか。打撃・走塁・守備・ポジションを合算',
  ERA: '防御率 = 自責点 × 9 ÷ 投球回',
  FIP: '守備の影響を除いた防御率。本塁打・四死球・三振だけで計算し、防御率と同じ目盛りに合わせる',
  'ERA+': '球場補正済み防御率をリーグ平均100として表したもの。高いほど良い',
  WHIP: '1イニングあたりに出した走者（安打+四球）',
  'K/9': '9イニングあたりの奪三振',
  'BB/9': '9イニングあたりの与四球',
  'K-BB%': '奪三振率 − 与四球率。投手の支配力の指標',
  'pWAR': '投手のWAR（FIPベース）',
  PF: 'パークファクター。1.00が平均で、高いほど得点が入りやすい球場',
  PYTH: 'ピタゴラス勝率 = 得点^1.83 ÷ (得点^1.83 + 失点^1.83)。得失点から見た「実力の勝率」',
  LUCK: '実際の勝利数 − ピタゴラス期待勝利数。プラスは接戦に強かった（運が良かった）',
  RISP: '得点圏打率（走者二塁・三塁での打率）',
};
