/**
 * 球団の財政（単位: 万円）
 * 収入: チケット（観客動員×客単価）、放映権、スポンサー、グッズ、ポストシーズン
 * 支出: 年俸総額、運営費、育成への投資
 * 観客動員は 球場の大きさ・地元の人口・人気・勝率・曜日・交流戦・優勝争い・チケット価格 で決まる
 */
import { Rng } from '../engine/rng';
import { weekday } from './calendar';
import { computeStandings, magicNumber } from './standings';
import type { TeamInfo } from './teams';
import { rosterOf, teamById, type World } from './world';
import type { Played } from '../news/daily';

export interface SeasonFinance {
  year: number;
  homeGames: number;
  attendance: number;
  ticket: number;
  broadcast: number;
  sponsor: number;
  merch: number;
  postseason: number;
  payroll: number;
  ops: number;
  invest: number;
  profit: number;
  closed: boolean;
}

export interface TeamFinance {
  /** チケット価格帯 -1=安い 0=普通 1=高い */
  pricing: -1 | 0 | 1;
  /** 育成への投資 0=標準 1=強化 2=大型投資 */
  invest: 0 | 1 | 2;
  /** 人気（0-100） */
  popularity: number;
  capacity: number;
  current: SeasonFinance;
  history: SeasonFinance[];
}

export const PRICE_LABEL = { [-1]: '安め（2,800円）', 0: '標準（4,000円）', 1: '高め（5,200円）' } as Record<number, string>;
export const INVEST_LABEL = ['標準', '強化（年3億円）', '大型投資（年6億円）'];
export const INVEST_COST = [0, 30000, 60000];
/** 運営費（球場使用料・スタッフ・遠征・二軍など）= 固定費 + 収入に比例する分 */
const OPS_BASE = 400000;
const OPS_RATE = 0.4;
const PRICE = { [-1]: 2800, 0: 4000, 1: 5200 } as Record<number, number>;

const blank = (year: number): SeasonFinance => ({ year, homeGames: 0, attendance: 0, ticket: 0, broadcast: 0, sponsor: 0, merch: 0, postseason: 0, payroll: 0, ops: 0, invest: 0, profit: 0, closed: false });

export function capacityOf(t: TeamInfo) {
  const p = t.park;
  return Math.round(((p.dome ? 40000 : 32000) + (p.cf - 118) * 600 + (t.market - 1) * 8000) / 500) * 500;
}

export function initFinance(teams: TeamInfo[], year = 2027): Record<number, TeamFinance> {
  const out: Record<number, TeamFinance> = {};
  for (const t of teams) out[t.id] = { pricing: 0, invest: 0, popularity: Math.round(45 + (t.market - 1) * 40), capacity: capacityOf(t), current: blank(year), history: [] };
  return out;
}

/** 1試合の観客動員 */
export function attendanceFor(w: World, home: number, date: string, kind: string, rng: Rng): number {
  const t = teamById(w, home);
  const f = w.finance[home];
  if (kind === 'CS1' || kind === 'CS2' || kind === 'JS') return Math.round(f.capacity * (0.97 + rng.next() * 0.03));
  const st = computeStandings(w, t.league);
  const r = st.find((x) => x.tid === home)!;
  const pct = r.w + r.l ? r.w / (r.w + r.l) : 0.5;
  const wd = weekday(date);
  let fill = 0.7 + (t.market - 1) * 0.3 + (f.popularity - 50) / 220 + (pct - 0.5) * 0.7 + (wd === 0 || wd === 6 ? 0.13 : wd === 5 ? 0.06 : 0) + (kind === 'I' ? 0.05 : 0) - f.pricing * 0.12;
  // 優勝争い（9月以降、首位から5ゲーム差以内）
  if (date.slice(5) >= '09-01' && (r.gb ?? 0) <= 5) fill += 0.08;
  if (date.slice(5) <= '04-07') fill += 0.08; // 開幕直後
  fill += rng.normal(0, 0.04);
  return Math.round(f.capacity * Math.max(0.3, Math.min(1, fill)));
}

/** その日の主催試合の入場料収入を計上 */
export function gateRevenue(w: World, played: Played[]) {
  const rng = new Rng(played.length * 7919 + w.date.length + Number(w.date.replace(/-/g, '')));
  for (const p of played) {
    if (p.kind === 'AS') continue;
    const home = p.summary.home;
    const f = w.finance?.[home];
    if (!f) continue;
    if (f.current.year !== w.year) f.current = blank(w.year);
    const att = attendanceFor(w, home, p.summary.date, p.kind, rng);
    const post = p.kind !== 'L' && p.kind !== 'I';
    const price = PRICE[f.pricing] * (post ? 1.6 : 1);
    const gate = Math.round((att * price) / 10000);
    if (post) f.current.postseason += gate;
    else {
      f.current.homeGames++;
      f.current.attendance += att;
      f.current.ticket += gate;
    }
    (p.summary as { attendance?: number }).attendance = att;
  }
}

/** シーズンの収支を締める（日本シリーズ後） */
export function closeSeasonFinance(w: World) {
  for (const t of w.teams) {
    const f = w.finance[t.id];
    const c = f.current;
    if (c.closed) continue;
    c.broadcast = Math.round(180000 * Math.sqrt(t.market) + f.popularity * 1500);
    c.sponsor = Math.round(120000 * t.market + f.popularity * 800);
    c.merch = Math.round(c.attendance * 0.06 + f.popularity * 1200);
    c.payroll = rosterOf(w, t.id).reduce((s, p) => s + p.contract.salary, 0);
    c.ops = Math.round(OPS_BASE + OPS_RATE * (c.ticket + c.broadcast + c.sponsor + c.merch + c.postseason));
    c.invest = INVEST_COST[f.invest];
    c.profit = c.ticket + c.broadcast + c.sponsor + c.merch + c.postseason - c.payroll - c.ops - c.invest;
    c.closed = true;
    // 人気: 勝率・優勝・日本一で上下
    const st = computeStandings(w, t.league);
    const i = st.findIndex((r) => r.tid === t.id);
    const champ = w.post?.champion === t.id;
    f.popularity = Math.round(Math.max(10, Math.min(100, f.popularity * 0.75 + (st[i].pct * 100 - 50) * 0.8 + 12 + (i === 0 ? 8 : i <= 2 ? 3 : 0) + (champ ? 10 : 0) - f.pricing * 2)));
  }
}

/** 来季の予算（年俸総額の上限の目安）= 収入見込み − 運営費 − 投資。赤字が続くと絞られる */
export function nextBudget(w: World, tid: number): number {
  const f = w.finance[tid];
  const last = f.history[f.history.length - 1] ?? f.current;
  const revenue = last.ticket + last.broadcast + last.sponsor + last.merch + last.postseason * 0.5;
  // 収入の約4分の1に、前年の利益（赤字なら減額）を少し反映
  const b = revenue * 0.26 + last.profit * 0.3 - INVEST_COST[f.invest] * 0.5;
  return Math.round(Math.max(180000, b) / 1000) * 1000;
}

/** シーズン切り替え */
export function rollFinance(w: World) {
  for (const t of w.teams) {
    const f = w.finance[t.id];
    if (!f.current.closed) closeSeasonFinance(w);
    f.history.push(f.current);
    if (f.history.length > 30) f.history.shift();
    w.budget[t.id] = nextBudget(w, t.id);
    f.current = blank(w.year + 1);
  }
}

/** 今季の収支見込み（シーズン途中の表示用） */
export function projected(w: World, tid: number): SeasonFinance {
  const f = w.finance[tid];
  const c = { ...f.current };
  if (c.closed) return c;
  const t = teamById(w, tid);
  if (c.homeGames < 5) {
    // 開幕直後は昨季の実績（なければ定員の75%）から見込む
    const last = f.history[f.history.length - 1];
    c.attendance = last ? last.attendance : Math.round(f.capacity * 0.75 * 71.5);
    c.ticket = last ? last.ticket : Math.round((c.attendance * PRICE[f.pricing]) / 10000);
    c.homeGames = 0;
  }
  const share = c.homeGames >= 5 ? Math.min(1, c.homeGames / 71.5) : 1;
  c.broadcast = Math.round(180000 * Math.sqrt(t.market) + f.popularity * 1500);
  c.sponsor = Math.round(120000 * t.market + f.popularity * 800);
  c.merch = Math.round((c.attendance / share) * 0.06 + f.popularity * 1200);
  c.ticket = Math.round(c.ticket / share);
  c.attendance = Math.round(c.attendance / share);
  c.payroll = rosterOf(w, tid).reduce((s, p) => s + p.contract.salary, 0);
  c.ops = Math.round(OPS_BASE + OPS_RATE * (c.ticket + c.broadcast + c.sponsor + c.merch + c.postseason));
  c.invest = INVEST_COST[f.invest];
  c.profit = c.ticket + c.broadcast + c.sponsor + c.merch + c.postseason - c.payroll - c.ops - c.invest;
  return c;
}

export { magicNumber };
