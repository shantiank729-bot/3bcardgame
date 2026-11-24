/**
 * スカウト。担当地域の選手を毎週視察し、視察回数が増えるほど評価のぶれが小さくなる。
 * 評価のぶれ（標準偏差）= 基本値 ×（1 − スカウトの腕/150）÷ √(1 + 視察回数)
 * ぶれの向きは選手ごとに決まっているので、何度見ても「同じ方向の見誤り」が少しずつ小さくなる。
 */
import { Rng } from '../engine/rng';
import { pitcherStuff } from '../engine/pa';
import { PITCH_NAMES, type BatterRatings, type PitcherRatings } from '../engine/types';
import { overall } from '../players/development';
import type { PlayerRecord, World } from '../league/world';
import type { Amateur } from './types';
import { REGIONS } from './data';

const clamp = (x: number) => Math.max(1, Math.min(100, x));

/** 選手ごと・能力ごとに決まったぶれの向き（-1〜1付近の正規乱数） */
function noiseDir(pid: number, i: number, salt: number) {
  const r = new Rng((pid * 2654435761 + i * 40503 + salt * 97) >>> 0);
  return r.normal(0, 1);
}

export function areaOf(w: World, a: Amateur): string {
  const s = w.amateur.schools[a.schoolId];
  return s.kind === 'HS' ? s.region : s.kind === 'UNI' ? 'uni' : 'sha';
}

/** 見立てのぶれの大きさ */
export function uncertainty(w: World, pid: number): number {
  const am = w.amateur;
  const a = am.players[pid];
  if (!a) {
    const p = w.players[pid];
    if (!p || p.teamId === w.userTeamId) return 0;
    return p.status === 'retired' ? 0 : 3; // 他球団のプロ選手は試合を見られるのでぶれは小さい
  }
  const seen = am.watch[pid] ?? am.seen[pid];
  const visits = seen?.visits ?? 0;
  const best = seen?.best ?? 40;
  return (16 * (1 - best / 150)) / Math.sqrt(1 + visits) + 1;
}

/** スカウトが見た能力（ユーザー球団の見立て） */
export function scoutedRatings(w: World, p: Amateur | PlayerRecord): { bat: BatterRatings; pit?: PitcherRatings; pot: number; sd: number } {
  const sd = uncertainty(w, p.id);
  const salt = w.userTeamId * 7 + (w.amateur?.players[p.id] ? 0 : w.year);
  const n = (i: number) => noiseDir(p.id, i, salt) * sd;
  const bat = { ...p.bat, contact: clamp(p.bat.contact + n(0)), power: clamp(p.bat.power + n(1)), eye: clamp(p.bat.eye + n(2)), speed: clamp(p.bat.speed + n(3) * 0.5), fielding: clamp(p.bat.fielding + n(4)), arm: clamp(p.bat.arm + n(5) * 0.7), catching: clamp(p.bat.catching + n(6)) };
  const pit = p.pit ? { ...p.pit, control: clamp(p.pit.control + n(7)), stamina: clamp(p.pit.stamina + n(8) * 0.6), velocity: Math.round(p.pit.velocity + n(9) * 0.15), pitches: p.pit.pitches.map((x, i) => ({ ...x, quality: clamp(x.quality + n(10 + i)) })) } : undefined;
  return { bat, pit, pot: clamp(p.pot + n(15) * 1.4), sd };
}

/** 見立てによる総合値と将来性 */
export function scoutedOverall(w: World, p: Amateur | PlayerRecord) {
  const v = scoutedRatings(w, p);
  return { ovr: overall({ ...p, bat: v.bat, pit: v.pit }), pot: v.pot, sd: v.sd };
}

/** ドラフト評価の目安 */
export function projection(value: number): string {
  if (value >= 62) return '1位候補';
  if (value >= 54) return '上位候補';
  if (value >= 47) return '中位候補';
  if (value >= 40) return '下位候補';
  return '育成候補';
}

/** スカウトレポート（見立てに基づく文章） */
export function scoutReport(w: World, a: Amateur): string[] {
  const v = scoutedRatings(w, a);
  const out: string[] = [];
  const conf = v.sd < 4 ? '確度は高い' : v.sd < 8 ? 'まだ見極めが必要' : '情報が少なく評価は不確か';
  if (a.isPitcher && v.pit) {
    const st = pitcherStuff(v.pit);
    out.push(`最速${Math.round(v.pit.velocity)}km前後。${st >= 55 ? '球威は即戦力級' : st >= 42 ? '球威は平均以上' : '球威はまだ物足りない'}。`);
    out.push(v.pit.control >= 50 ? '制球がまとまっており、試合を作れる。' : v.pit.control >= 38 ? '制球にばらつきがある。' : '制球に大きな課題。');
    const best = [...v.pit.pitches].sort((x, y) => y.quality - x.quality)[0];
    if (best) out.push(`${PITCH_NAMES[best.type]}が武器${best.quality >= 55 ? 'で、プロでも通用しそう' : ''}。`);
    out.push(v.pit.stamina >= 55 ? 'スタミナがあり先発向き。' : 'リリーフ向きか。');
  } else {
    const b = v.bat;
    if (b.power >= 50) out.push('長打力は高校・大学トップクラス。');
    else if (b.power >= 38) out.push('パンチ力がある。');
    if (b.contact >= 48) out.push('ミート力に優れ、広角に打てる。');
    if (b.speed >= 60) out.push('俊足でプロでも武器になる。');
    if (b.fielding >= 50) out.push('守備範囲が広く、守備は即戦力級。');
    if (b.arm >= 60) out.push('強肩。');
    if (out.length === 0) out.push('全体にまとまっているが、突出した武器はまだない。');
  }
  out.push(`将来性は${v.pot >= 65 ? '非常に高い' : v.pot >= 55 ? '高い' : v.pot >= 45 ? '平均的' : '低め'}（${conf}）。`);
  return out;
}

/** 毎週の視察: 担当地域の注目リストの選手を優先し、残りは注目度の高い選手を見て回る */
export function weeklyScouting(w: World, rng: Rng) {
  const am = w.amateur;
  for (const s of am.scouts) {
    const inArea = Object.values(am.players).filter((p) => areaOf(w, p) === s.area);
    const watched = inArea.filter((p) => am.watch[p.id]);
    const others = inArea.filter((p) => !am.watch[p.id]).sort((a, b) => b.hype - a.hype).slice(0, 12);
    const targets = [...watched.sort(() => rng.next() - 0.5).slice(0, 4), ...others.sort(() => rng.next() - 0.5).slice(0, 2)];
    for (const p of targets) {
      const rec = am.watch[p.id] ?? (am.seen[p.id] ??= { visits: 0, best: 0 });
      rec.visits++;
      rec.best = Math.max(rec.best, s.skill);
    }
  }
}

/** 注目リストに追加・削除 */
export function toggleWatch(w: World, pid: number) {
  const am = w.amateur;
  if (am.watch[pid]) {
    am.seen[pid] = { visits: am.watch[pid].visits, best: am.watch[pid].best };
    delete am.watch[pid];
  } else {
    const prev = am.seen[pid];
    am.watch[pid] = { visits: prev?.visits ?? 0, best: prev?.best ?? 0, added: w.date };
    delete am.seen[pid];
  }
}

export const AREA_NAMES: Record<string, string> = { ...Object.fromEntries(REGIONS.map((r) => [r.key, r.name])), uni: '大学', sha: '社会人' };
