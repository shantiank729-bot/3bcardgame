/**
 * トレード。AI球団は「今後3年の見込みの働き − 年俸」で選手の価値を測り、得をする（少し上乗せがある）なら応じる。
 * シーズン中は7月31日が期限。
 */
import { Rng } from '../engine/rng';
import { overall } from '../players/development';
import { addStory } from '../news/daily';
import { shortName } from '../news/text';
import { autoFillActive, inbox, SHIHAIKA_MAX, shihaika } from './rosterOps';
import { yen } from './contracts';
import { rosterOf, teamById, type PlayerRecord, type World } from './world';
import { dayIndex } from './sim';

export interface TradeRecord {
  date: string;
  a: number;
  b: number;
  aGives: number[];
  bGives: number[];
  cash?: number;
}

/** 1勝あたりの価値（万円） */
const WIN_VALUE = 6000;

/** 総合値から見込みWAR（レギュラーとして出場した場合） */
export function projectedWar(ovr: number, pitcher: boolean) {
  return pitcher ? (ovr - 44) / 4.5 : (ovr - 43) / 4;
}

/** 選手の価値（万円）。若手の伸びしろ、ベテランの衰え、契約の残りを考える */
export function playerValue(p: PlayerRecord): number {
  let v = 0;
  let ovr = overall(p);
  for (let y = 0; y < 3; y++) {
    const age = p.age + y;
    if (age <= 27) ovr += Math.max(0, p.pot - ovr) * 0.22;
    else if (age >= 32) ovr -= 1 + (age - 32) * 0.6;
    const war = Math.max(0, projectedWar(ovr, p.isPitcher));
    const salary = y < p.contract.years ? p.contract.salary : Math.max(440, war * WIN_VALUE * 0.6);
    v += (war * WIN_VALUE - salary) * Math.pow(0.85, y);
  }
  if (p.age <= 25) v += Math.max(0, p.pot - 50) * 250;
  return Math.round(v);
}

export function isTradeWindow(w: World): boolean {
  if (w.phase === 'offseason') return true;
  if (w.phase === 'regular') return w.date.slice(5) <= '07-31';
  return false;
}

export interface TradeEval {
  ok: boolean;
  /** AI側から見た損得（万円） */
  gain: number;
  reason: string;
}

/** 相手球団（AI）が受けるかを判定。gives: ユーザー側が出す、gets: ユーザー側が受け取る */
export function evaluateTrade(w: World, me: number, them: number, gives: number[], gets: number[]): TradeEval {
  if (!isTradeWindow(w)) return { ok: false, gain: 0, reason: 'トレード期間外です（シーズン中は7月31日まで）' };
  if (gives.length === 0 && gets.length === 0) return { ok: false, gain: 0, reason: '選手を選んでください' };
  const P = (id: number) => w.players[id];
  if ([...gives, ...gets].some((id) => P(id).injury && P(id).injury!.days > 30)) return { ok: false, gain: 0, reason: '長期離脱中の選手は対象にできません' };
  // 支配下70人の枠
  const ik = (ids: number[]) => ids.filter((id) => P(id).status === 'ikusei').length;
  const myAfter = shihaika(w, me).length - (gives.length - ik(gives)) + (gets.length - ik(gets));
  const theirAfter = shihaika(w, them).length - (gets.length - ik(gets)) + (gives.length - ik(gives));
  if (myAfter > SHIHAIKA_MAX) return { ok: false, gain: 0, reason: 'あなたの球団の支配下が70人を超えます' };
  if (theirAfter > SHIHAIKA_MAX) return { ok: false, gain: 0, reason: '相手球団の支配下が70人を超えます' };
  const vin = gives.reduce((s, id) => s + playerValue(P(id)), 0);
  const vout = gets.reduce((s, id) => s + playerValue(P(id)), 0);
  // 主力を出すときは上乗せを求める
  const premium = 800 + Math.max(0, vout) * 0.12;
  const gain = vin - vout;
  const ok = gain >= premium;
  const reason = ok
    ? 'この条件なら応じます'
    : gain >= premium * 0.5 ? 'もう少し上乗せがほしいです'
    : vout > vin * 2 ? 'その選手は簡単には出せません'
    : '釣り合っていません';
  return { ok, gain, reason };
}

export function executeTrade(w: World, a: number, b: number, aGives: number[], bGives: number[]) {
  const today = dayIndex(w);
  const rec: TradeRecord = { date: w.date, a, b, aGives, bGives };
  w.trades.push(rec);
  const A = teamById(w, a), B = teamById(w, b);
  for (const [ids, to, from] of [[aGives, b, a], [bGives, a, b]] as const) {
    for (const id of ids) {
      const p = w.players[id];
      p.teamId = to;
      if (p.status === 'active') p.status = 'farm';
      p.demotedDay = undefined;
      p.events.push({ year: w.year, text: `トレードで${teamById(w, from).nickname}から${teamById(w, to).city}${teamById(w, to).nickname}へ移籍` });
      w.teamState[from].manualOrder = from === w.userTeamId ? null : w.teamState[from].manualOrder;
      w.teamState[from].rotation = w.teamState[from].rotation.filter((x) => x !== id);
    }
  }
  if (w.phase === 'regular') {
    // 移籍してきた選手はすぐ一軍で使えるように
    for (const tid of [a, b]) {
      for (const id of tid === a ? bGives : aGives) {
        const p = w.players[id];
        if (p.status === 'farm' && !p.injury && rosterOf(w, tid, 'active').length < 31) p.status = 'active';
      }
      autoFillActive(w, tid, today);
    }
  }
  const names = (ids: number[]) => ids.map((id) => w.players[id].name).join('、');
  const star = [...aGives, ...bGives].map((id) => w.players[id]).sort((x, y) => playerValue(y) - playerValue(x))[0];
  const score = 30 + Math.min(40, Math.max(0, playerValue(star) / 1500)) + (a === w.userTeamId || b === w.userTeamId ? 10 : 0);
  addStory(w, w.date, {
    id: `trade-${w.trades.length}-${w.year}`, score, kind: 'trade',
    headline: [`${shortName(star.name)} 電撃トレード`, `${A.nickname}・${B.nickname} 交換トレード成立`, `${shortName(star.name)}が${teamById(w, star.teamId!).nickname}へ`][w.trades.length % 3],
    sub: `${A.nickname}⇔${B.nickname}`,
    body: `${A.city}${A.nickname}と${B.city}${B.nickname}の間でトレードが成立した。${A.nickname}は${names(aGives) || 'なし'}を、${B.nickname}は${names(bGives) || 'なし'}を放出する。`,
    scene: 'handshake', tids: [a, b], pids: [star.id],
  });
}

/** AI球団同士のトレード（たまに成立） */
export function aiTrades(w: World, rng: Rng, attempts = 30) {
  const teams = w.teams.filter((t) => t.id !== w.userTeamId).map((t) => t.id);
  let made = 0;
  for (let i = 0; i < attempts && made < 2; i++) {
    const a = rng.pick(teams);
    const b = rng.pick(teams.filter((x) => x !== a));
    // a の二軍で燻っている中堅と、b の余剰選手
    const pickFrom = (tid: number) => {
      const list = rosterOf(w, tid).filter((p) => p.status === 'farm' && !p.injury && overall(p) >= 45 && p.age >= 24);
      return list.length ? rng.pick(list) : null;
    };
    const x = pickFrom(a), y = pickFrom(b);
    if (!x || !y || x.isPitcher === y.isPitcher) continue;
    const va = playerValue(y) - playerValue(x);
    const vb = playerValue(x) - playerValue(y);
    // 互いに補強ポイントを埋めるなら少し損でも応じる
    const needA = rosterOf(w, a).filter((p) => p.isPitcher === y.isPitcher).length < rosterOf(w, a).filter((p) => p.isPitcher === x.isPitcher).length;
    const needB = rosterOf(w, b).filter((p) => p.isPitcher === x.isPitcher).length < rosterOf(w, b).filter((p) => p.isPitcher === y.isPitcher).length;
    if ((va > -1500 || needA) && (vb > -1500 || needB) && needA && needB) {
      executeTrade(w, a, b, [x.id], [y.id]);
      made++;
    }
  }
  return made;
}

export function valueText(v: number) {
  return v >= 0 ? `+${yen(v)}` : `-${yen(-v)}`;
}

export function noteToUser(w: World, text: string) {
  inbox(w, text, 'trade');
}
