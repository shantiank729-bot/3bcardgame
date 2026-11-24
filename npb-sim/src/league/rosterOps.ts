/**
 * 選手登録（一軍31人・外国人4人まで）、ケガ、入れ替え。
 * - 一軍の外国人は4人まで（投手・野手それぞれ3人まで）
 * - 抹消した選手は10日間再登録できない
 */
import { Rng } from '../engine/rng';
import { overall } from '../players/development';
import { rosterOf, teamById, type PlayerRecord, type World } from './world';
import { farmLine } from './farm';

export const ACTIVE_MAX = 31;
export const SHIHAIKA_MAX = 70;
export const REREG_DAYS = 10;

export interface Inbox {
  date: string;
  text: string;
  kind: 'injury' | 'roster' | 'trade' | 'fa' | 'info';
}

export function inbox(w: World, text: string, kind: Inbox['kind'] = 'info') {
  (w.inbox ??= []).unshift({ date: w.date, text, kind });
  if (w.inbox.length > 80) w.inbox.length = 80;
}

export const shihaika = (w: World, tid: number) => rosterOf(w, tid).filter((p) => p.status === 'active' || p.status === 'farm');

export function foreignOk(active: PlayerRecord[], add?: PlayerRecord): boolean {
  const list = add ? [...active, add] : active;
  const f = list.filter((p) => p.foreign);
  return f.length <= 4 && f.filter((p) => p.isPitcher).length <= 3 && f.filter((p) => !p.isPitcher).length <= 3;
}

/** 一軍登録できるか。できない理由を返す（できるなら null） */
export function cannotActivate(w: World, p: PlayerRecord, today: number): string | null {
  if (p.status !== 'farm') return p.status === 'ikusei' ? '育成選手は一軍登録できません（支配下登録が必要）' : '二軍の選手ではありません';
  if (p.injury) return 'ケガで離脱中です';
  if (p.demotedDay !== undefined && today - p.demotedDay < REREG_DAYS && today >= p.demotedDay) return `抹消から10日間は再登録できません（あと${REREG_DAYS - (today - p.demotedDay)}日）`;
  const active = rosterOf(w, p.teamId!, 'active');
  if (active.length >= ACTIVE_MAX) return '一軍は31人までです';
  if (!foreignOk(active, p)) return '一軍の外国人枠（4人・投手野手各3人まで）を超えます';
  return null;
}

export function demote(w: World, p: PlayerRecord, today: number) {
  if (p.status !== 'active') return;
  p.status = 'farm';
  p.demotedDay = today;
  const ts = w.teamState[p.teamId!];
  if (ts) ts.rotation = ts.rotation.filter((id) => id !== p.id);
}

export function promote(w: World, p: PlayerRecord, today: number): string | null {
  const why = cannotActivate(w, p, today);
  if (why) return why;
  p.status = 'active';
  return null;
}

/** 支配下登録（育成→支配下）。7月末まで */
export function signToShihaika(w: World, p: PlayerRecord): string | null {
  if (p.status !== 'ikusei') return '育成選手ではありません';
  if (shihaika(w, p.teamId!).length >= SHIHAIKA_MAX) return '支配下は70人までです';
  if (w.phase === 'regular' && w.date.slice(5) > '07-31') return '支配下登録の期限（7月31日）を過ぎています';
  p.status = 'farm';
  p.contract = { salary: Math.max(440, p.contract.salary), years: 1 };
  p.events.push({ year: w.year, text: '支配下登録' });
  return null;
}

/** 一軍の人数・構成を整える（ケガ人の穴埋めなど） */
export function autoFillActive(w: World, tid: number, today: number) {
  const active = () => rosterOf(w, tid, 'active');
  // ケガ人は抹消
  for (const p of active()) if (p.injury) demote(w, p, today);
  let guard = 0;
  while (active().length < ACTIVE_MAX && guard++ < 40) {
    const a = active();
    const pitchers = a.filter((p) => p.isPitcher).length;
    const catchers = a.filter((p) => !p.isPitcher && (p.bat.positions.C ?? 0) >= 60).length;
    const farmC = rosterOf(w, tid, 'farm').some((p) => !p.isPitcher && (p.bat.positions.C ?? 0) >= 60 && !cannotActivate(w, p, today));
    const wantPitcher = pitchers < 13;
    const cands = rosterOf(w, tid, 'farm')
      .filter((p) => !cannotActivate(w, p, today))
      .filter((p) => (catchers < 2 && farmC ? (p.bat.positions.C ?? 0) >= 60 && !p.isPitcher : p.isPitcher === wantPitcher));
    const pool = cands.length ? cands : rosterOf(w, tid, 'farm').filter((p) => !cannotActivate(w, p, today));
    if (!pool.length) break;
    const best = pool.sort((x, y) => overall(y) - overall(x))[0];
    best.status = 'active';
  }
  fixRotation(w, tid);
}

/** ローテーションを一軍の先発投手で6人にそろえる */
export function fixRotation(w: World, tid: number) {
  const ts = w.teamState[tid];
  const active = rosterOf(w, tid, 'active').filter((p) => p.isPitcher);
  ts.rotation = ts.rotation.filter((id) => active.some((p) => p.id === id));
  const cands = active.filter((p) => !ts.rotation.includes(p.id) && p.pit!.stamina >= 50).sort((a, b) => overall(b) - overall(a));
  while (ts.rotation.length < 6 && cands.length) ts.rotation.push(cands.shift()!.id);
  const any = active.filter((p) => !ts.rotation.includes(p.id)).sort((a, b) => b.pit!.stamina - a.pit!.stamina);
  while (ts.rotation.length < 5 && any.length) ts.rotation.push(any.shift()!.id);
  if (ts.rotIdx >= ts.rotation.length) ts.rotIdx = 0;
}

/** 一軍の顔ぶれを能力順に組み直す（シーズン前） */
export function rebuildActive(w: World, tid: number, today: number) {
  const all = rosterOf(w, tid).filter((p) => (p.status === 'active' || p.status === 'farm') && !p.injury);
  for (const p of all) p.status = 'farm';
  const byOvr = (a: PlayerRecord, b: PlayerRecord) => overall(b) - overall(a);
  const pick = (list: PlayerRecord[], n: number) => {
    for (const p of list.sort(byOvr)) {
      if (n <= 0) break;
      if (!foreignOk(rosterOf(w, tid, 'active'), p)) continue;
      p.status = 'active';
      n--;
    }
  };
  const sps = all.filter((p) => p.isPitcher && p.pit!.stamina >= 50);
  pick(sps, 6);
  pick(all.filter((p) => p.isPitcher && p.status === 'farm'), 7);
  pick(all.filter((p) => !p.isPitcher && (p.bat.positions.C ?? 0) >= 70), 2);
  pick(all.filter((p) => !p.isPitcher && p.status === 'farm'), 16);
  const ts = w.teamState[tid];
  ts.rotation = [];
  ts.rotIdx = 0;
  ts.lastStart = {};
  ts.pitchLog = {};
  autoFillActive(w, tid, today);
  for (const p of rosterOf(w, tid, 'active')) p.demotedDay = undefined;
}

// ---------------- ケガ ----------------
const INJURIES: [string, number, number][] = [
  // [部位, 最短日数, 最長日数]
  ['右太もも裏の張り', 7, 20], ['左太もも裏の肉離れ', 21, 45], ['右脇腹の痛み', 14, 35], ['左脇腹の肉離れ', 25, 50],
  ['腰痛', 7, 21], ['右手首の打撲', 5, 15], ['左手の骨折', 40, 80], ['右足首のねんざ', 10, 25], ['右ひじの炎症', 14, 40],
  ['右肩の違和感', 14, 45], ['首の寝違え', 3, 8], ['発熱・体調不良', 5, 10], ['右ひざの靱帯損傷', 60, 150], ['右ひじ靱帯の損傷', 120, 300],
];

/** 試合に出た選手のケガ判定と、ケガの回復（1日分） */
export function dailyInjuries(w: World, rng: Rng, appeared: number[], today: number) {
  const changed = new Set<number>();
  for (const p of Object.values(w.players)) {
    if (p.injury) {
      p.injury.days--;
      if (p.injury.days <= 0) {
        p.injury = null;
        if (p.teamId === w.userTeamId) inbox(w, `${p.name}がケガから回復しました（二軍で待機中）`, 'injury');
      }
    }
  }
  for (const pid of appeared) {
    const p = w.players[pid];
    if (!p || p.injury || p.teamId === null) continue;
    const ageF = p.age >= 33 ? 1.6 : p.age >= 30 ? 1.25 : 1;
    if (!rng.chance(0.0013 * ageF * (p.isPitcher ? 1.4 : 1))) continue;
    let [desc, lo, hi] = rng.pick(INJURIES);
    if (p.isPitcher && rng.chance(0.4)) [desc, lo, hi] = rng.pick(INJURIES.filter((x) => /肩|ひじ/.test(x[0])));
    const days = rng.int(lo, hi);
    p.injury = { days, desc };
    p.events.push({ year: w.year, text: `${desc}で離脱（全治約${Math.ceil(days / 7)}週間）` });
    if (p.status === 'active') {
      demote(w, p, today);
      changed.add(p.teamId!);
    }
    if (p.teamId === w.userTeamId) inbox(w, `${p.name}が${desc}で離脱。全治約${Math.ceil(days / 7)}週間の見込み`, 'injury');
  }
  for (const tid of changed) {
    const before = new Set(rosterOf(w, tid, 'active').map((p) => p.id));
    autoFillActive(w, tid, today);
    if (tid === w.userTeamId) {
      const added = rosterOf(w, tid, 'active').filter((p) => !before.has(p.id));
      if (added.length) inbox(w, `${added.map((p) => p.name).join('、')}を一軍に登録しました（自動）`, 'roster');
    }
  }
}

/** 一軍登録日数を数える（FA権のため） */
export function addServiceDay(w: World) {
  for (const p of Object.values(w.players)) if (p.status === 'active') p.service++;
}

/** AI球団の週1回の入れ替え（調子の悪い選手と好調な二軍選手） */
export function weeklyAiMoves(w: World, today: number) {
  for (const t of w.teams) {
    if (t.id === w.userTeamId) continue;
    const active = rosterOf(w, t.id, 'active');
    const farm = rosterOf(w, t.id, 'farm').filter((p) => !p.injury);
    for (const pos of ['P', 'B'] as const) {
      const isP = pos === 'P';
      const worst = active.filter((p) => p.isPitcher === isP && (p.form ?? 0) < -0.4 && !w.teamState[t.id].rotation.includes(p.id)).sort((a, b) => overall(a) - overall(b))[0];
      // 二軍で結果を出している選手を優先
      const sc = new Map<number, number>();
      for (const p of farm) {
        if (p.isPitcher !== isP) continue;
        const f = farmLine(w, p.id);
        sc.set(p.id, overall(p) + (isP ? (f.ip >= 10 ? (3.5 - f.era) * 2 : 0) : f.pa >= 40 ? (f.ops - 0.65) * 30 : 0));
      }
      const best = farm.filter((p) => p.isPitcher === isP).sort((a, b) => sc.get(b.id)! - sc.get(a.id)!)[0];
      if (!worst || !best || overall(best) < overall(worst) - 2) continue;
      if (!isP && (worst.bat.positions.C ?? 0) >= 60 && (best.bat.positions.C ?? 0) < 60) continue;
      demote(w, worst, today);
      if (promote(w, best, today)) autoFillActive(w, t.id, today);
    }
  }
}

export function teamName(w: World, tid: number) {
  const t = teamById(w, tid);
  return `${t.city}${t.nickname}`;
}
