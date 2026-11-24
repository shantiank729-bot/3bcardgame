/**
 * オフシーズンの進行
 *  1. 戦力外・引退（11月）
 *  2. FA（国内・海外）
 *  3. 契約更改（12月）
 *  4. 現役ドラフト（12月）
 *  5. 外国人選手の獲得・補強（1月）
 *  6. 春季キャンプ（2月）→ 成長・衰えを反映して新シーズンへ
 * ※ FAの補償は金銭補償のみ（人的補償は省略）
 */
import { Rng } from '../engine/rng';
import { generateBatter, generatePitcher, setNextPlayerId, allocPlayerId } from '../players/generate';
import { developPlayer, overall, rollPotential } from '../players/development';
import { addStory, careerTotals } from '../news/daily';
import { shortName } from '../news/text';
import { contexts, batterRows, pitcherRows } from '../stats/tables';
import { addDays, openingDay } from './calendar';
import { domesticFA, initContract, marketSalary, MIN_SALARY, overseasFA, renewalAsk, teamOffer, yen, IKUSEI_MIN } from './contracts';
import { assignNumber } from './draft';
import { buildSchedule } from './schedule';
import { computeNorm } from './norm';
import { amateurTick } from '../amateur/season';
import { computeStandings } from './standings';
import { inbox, rebuildActive, shihaika, SHIHAIKA_MAX } from './rosterOps';
import { aiTrades, playerValue } from './trade';
import { emptyPark, emptyRunEnv, rosterOf, teamById, type PlayerRecord, type World } from './world';
import type { FieldPos } from '../engine/types';

export type OffStage = 'release' | 'fa' | 'contract' | 'gendai' | 'foreign' | 'camp' | 'done';
export const STAGES: { key: OffStage; label: string; md: string }[] = [
  { key: 'release', label: '戦力外・引退', md: '11-05' },
  { key: 'fa', label: 'FA', md: '11-15' },
  { key: 'contract', label: '契約更改', md: '12-01' },
  { key: 'gendai', label: '現役ドラフト', md: '12-09' },
  { key: 'foreign', label: '外国人・補強', md: '01-15' },
  { key: 'camp', label: '春季キャンプ', md: '02-01' },
];

export interface FAOffer { tid: number; salary: number; years: number }
export interface FAEntry {
  pid: number;
  from: number;
  kind: 'domestic' | 'overseas';
  ask: number;
  rank: 'A' | 'B' | 'C';
  offers: FAOffer[];
  result?: { tid: number | null; salary: number; years: number; mlb?: boolean };
}
export interface ContractTalk { pid: number; ask: number; offer: number; status: 'pending' | 'signed' | 'holdout' }

export interface OffseasonState {
  year: number;
  stage: OffStage;
  /** 戦力外の候補（ユーザー球団へのおすすめ） */
  releaseSuggest: number[];
  /** ユーザーが選んだ戦力外 */
  userRelease: number[];
  retired: number[];
  released: number[];
  fa: FAEntry[];
  talks: ContractTalk[];
  gendai: { from: number; to: number; pid: number }[];
  /** 移籍市場の選手（外国人・自由契約） */
  market: number[];
  devReport: { pid: number; before: number; after: number }[];
  warLast: Record<number, number>;
}

const hashSeed = (...xs: number[]) => xs.reduce((h, x) => Math.imul(h ^ x, 16777619) >>> 0, 2166136261);
const mdDate = (w: World, md: string) => `${md >= '07' ? w.year : w.year + 1}-${md}`;

function seasonWar(w: World): Record<number, number> {
  const ctx = contexts(w);
  const out: Record<number, number> = {};
  for (const r of batterRows(w, 'ALL', ctx)) out[r.pid] = (out[r.pid] ?? 0) + r.war;
  for (const r of pitcherRows(w, 'ALL', ctx)) out[r.pid] = (out[r.pid] ?? 0) + r.war;
  return out;
}

/** 引退するか（年齢・能力・立場で決まる） */
function retireProb(p: PlayerRecord): number {
  const o = overall(p);
  let pr = p.age < 27 ? 0.002 : p.age < 30 ? 0.008 : p.age < 33 ? 0.04 : p.age < 35 ? 0.15 : p.age < 37 ? 0.35 : p.age < 39 ? 0.6 : 0.9;
  // 一軍に定着できない選手は早めに引退を考える（若手は戦力外で整理されるので少なめ）
  if (p.status !== 'active' && o < 42) pr += p.age >= 30 ? 0.25 : p.age >= 27 ? 0.06 : 0;
  if (o >= 58) pr *= 0.4;
  return Math.min(0.97, pr);
}

/** AIの戦力外候補（価値の低い順、70人枠に余裕を残す） */
export function releaseCandidates(w: World, tid: number): number[] {
  const roster = rosterOf(w, tid);
  const shi = roster.filter((p) => p.status === 'active' || p.status === 'farm');
  const need = Math.max(0, shi.length - (SHIHAIKA_MAX - 3));
  const isC = (p: PlayerRecord) => !p.isPitcher && (p.bat.positions.C ?? 0) >= 60;
  const catchers = shi.filter(isC).length;
  const byValue = shi.filter((p) => p.contract.years <= 1 && !(isC(p) && catchers <= 4)).sort((a, b) => playerValue(a) - playerValue(b));
  const out = byValue.slice(0, need).map((p) => p.id);
  // 明らかに力の落ちたベテラン・伸びない若手
  for (const p of byValue) {
    if (out.includes(p.id)) continue;
    const o = overall(p);
    if ((p.age >= 31 && o < 40) || (p.age >= 26 && o < 33 && p.pot < 45)) out.push(p.id);
  }
  // 育成の契約満了（3年）で伸びていない選手
  for (const p of roster.filter((x) => x.status === 'ikusei' && x.contract.years <= 1)) if (overall(p) < 38) out.push(p.id);
  return out;
}

export function startOffseason(w: World) {
  const warLast = seasonWar(w);
  const st: OffseasonState = {
    year: w.year, stage: 'release', releaseSuggest: releaseCandidates(w, w.userTeamId), userRelease: [], retired: [], released: [],
    fa: [], talks: [], gendai: [], market: [], devReport: [], warLast,
  };
  w.off = st;
  w.date = mdDate(w, STAGES[0].md);
  // 引退（選手の意思）
  const rng = new Rng(hashSeed(w.seed, w.year, 4242));
  for (const p of Object.values(w.players)) {
    if (p.teamId === null || p.status === 'retired' || p.status === 'mlb' || p.status === 'fa') continue;
    if (p.contract.years > 1) continue;
    if (rng.chance(retireProb(p))) retire(w, p, true);
  }
  inbox(w, 'オフシーズンに入りました。戦力外にする選手を選んで「次へ」を押してください', 'info');
}

function retire(w: World, p: PlayerRecord, announce: boolean) {
  const tid = p.teamId;
  p.status = 'retired';
  p.events.push({ year: w.year, text: '現役引退' });
  p.teamId = null;
  w.off?.retired.push(p.id);
  if (!announce || tid === null) return;
  const c = careerTotals(w, p.id);
  const notable = p.isPitcher ? c.w >= 80 || c.sv >= 100 : c.hr >= 150 || c.h >= 1200;
  if (notable || tid === w.userTeamId) {
    const line = p.isPitcher ? `通算${c.w}勝${c.l}敗${c.sv ? c.sv + 'セーブ' : ''}` : `通算${c.h}安打${c.hr}本塁打`;
    addStory(w, w.date, {
      id: `retire-${p.id}`, score: notable ? 35 + (p.isPitcher ? c.w / 5 : c.hr / 10) : 12, kind: 'retire',
      headline: [`${shortName(p.name)} 現役引退`, `${shortName(p.name)} ユニホーム脱ぐ`, `${shortName(p.name)} 引退を表明`][p.id % 3],
      sub: `${teamById(w, tid).nickname}・${p.age}歳 ${line}`,
      body: `${teamById(w, tid).city}${teamById(w, tid).nickname}の${p.name}（${p.age}歳）が今季限りでの現役引退を表明した。プロ${w.year - (p.debutYear ?? w.year) + 1}年で${line}。`,
      scene: 'retire', tids: [tid], pids: [p.id],
    });
  }
}

function release(w: World, p: PlayerRecord) {
  const from = p.teamId!;
  p.events.push({ year: w.year, text: `${teamById(w, from).nickname}から戦力外通告` });
  w.off!.released.push(p.id);
  // 高齢・力の落ちた選手は引退、他は自由契約（トライアウト）
  if (p.age >= 32 || overall(p) < 30) retire(w, p, false);
  else {
    p.status = 'fa';
    p.teamId = null;
    w.off!.market.push(p.id);
  }
}

// ---------------- 各段階 ----------------
function doRelease(w: World) {
  const st = w.off!;
  for (const t of w.teams) {
    const ids = t.id === w.userTeamId ? st.userRelease : releaseCandidates(w, t.id);
    for (const id of ids) {
      const p = w.players[id];
      if (!p || p.teamId !== t.id) continue;
      // 育成の再契約（3年）
      if (p.status === 'ikusei' && t.id !== w.userTeamId && overall(p) >= 38) {
        p.contract = { salary: Math.max(IKUSEI_MIN, p.contract.salary), years: 3 };
        continue;
      }
      release(w, p);
    }
    // 育成で契約満了だが戦力外にしなかった選手は再契約（育成は各球団12人まで）
    for (const p of rosterOf(w, t.id, 'ikusei')) if (p.contract.years <= 1) p.contract.years = 4;
    if (t.id !== w.userTeamId) {
      const ik = rosterOf(w, t.id, 'ikusei').sort((a, b) => playerValue(a) - playerValue(b));
      for (const p of ik.slice(0, Math.max(0, ik.length - 12))) release(w, p);
    }
  }
  // FA宣言
  const rng = new Rng(hashSeed(w.seed, w.year, 777));
  for (const p of Object.values(w.players)) {
    if (p.teamId === null || p.status === 'ikusei' || p.status === 'retired' || p.contract.years > 1) continue;
    const o = overall(p);
    if (overseasFA(p) && o >= 63 && p.age <= 33 && rng.chance(0.45)) {
      st.fa.push({ pid: p.id, from: p.teamId, kind: 'overseas', ask: marketSalary(p), rank: 'A', offers: [] });
      continue;
    }
    if (!domesticFA(p) || p.faUsed) continue;
    const gap = (marketSalary(p) - p.contract.salary) / Math.max(1000, p.contract.salary);
    const prob = Math.max(0.03, Math.min(0.55, 0.12 + gap * 0.4 + (o >= 55 ? 0.12 : 0) - (p.age >= 34 ? 0.1 : 0)));
    if (rng.chance(prob)) {
      const team = rosterOf(w, p.teamId).filter((x) => x.status !== 'ikusei' && !x.foreign).sort((a, b) => b.contract.salary - a.contract.salary);
      const rk = team.indexOf(p);
      st.fa.push({ pid: p.id, from: p.teamId, kind: 'domestic', ask: Math.round(marketSalary(p) * 1.1 / 10) * 10, rank: rk < 3 ? 'A' : rk < 10 ? 'B' : 'C', offers: [] });
    }
  }
  for (const f of st.fa) {
    const p = w.players[f.pid];
    if (f.from === w.userTeamId) inbox(w, `${p.name}が${f.kind === 'overseas' ? '海外' : '国内'}FA権の行使を宣言しました`, 'fa');
  }
  const big = st.fa.filter((f) => overall(w.players[f.pid]) >= 55);
  if (st.fa.length) {
    addStory(w, w.date, {
      id: `fa-declare-${w.year}`, score: 30 + big.length * 5, kind: 'fa',
      headline: big.length ? `${shortName(w.players[big[0].pid].name)}らFA宣言` : `今オフのFA宣言は${st.fa.length}人`,
      sub: `国内${st.fa.filter((f) => f.kind === 'domestic').length}人・海外${st.fa.filter((f) => f.kind === 'overseas').length}人`,
      body: `今オフ、FA権を行使したのは${st.fa.map((f) => `${w.players[f.pid].name}（${teamById(w, f.from).nickname}${f.kind === 'overseas' ? '・海外' : ''}）`).join('、')}。`,
      scene: 'handshake', tids: big.map((f) => f.from), pids: big.map((f) => f.pid),
    });
  }
  // AIのFAオファー
  aiFAOffers(w);
}

export function payroll(w: World, tid: number) {
  return rosterOf(w, tid).reduce((s, p) => s + p.contract.salary, 0);
}

function aiFAOffers(w: World) {
  const st = w.off!;
  const rng = new Rng(hashSeed(w.seed, w.year, 888));
  for (const f of st.fa) {
    if (f.kind === 'overseas') continue;
    const p = w.players[f.pid];
    const v = playerValue(p);
    for (const t of w.teams) {
      if (t.id === w.userTeamId) continue;
      const room = w.budget[t.id] - payroll(w, t.id) - st.fa.filter((x) => x.offers.some((o) => o.tid === t.id)).reduce((s, x) => s + x.offers.find((o) => o.tid === t.id)!.salary, 0);
      const keen = t.id === f.from ? 0.7 : 0.35 * t.market;
      if (v < -2000 || room < f.ask * 0.9 || !rng.chance(keen)) continue;
      const salary = Math.round((f.ask * (0.9 + rng.next() * 0.25)) / 10) * 10;
      f.offers.push({ tid: t.id, salary, years: p.age <= 29 ? rng.int(3, 5) : p.age <= 33 ? rng.int(2, 3) : 1 });
    }
  }
}

/** ユーザー球団のオファー */
export function makeFAOffer(w: World, pid: number, salary: number, years: number): string | null {
  const f = w.off?.fa.find((x) => x.pid === pid);
  if (!f || w.off!.stage !== 'fa') return 'FA交渉の期間ではありません';
  if (f.kind === 'overseas') return '海外FAの選手には申し込めません';
  f.offers = f.offers.filter((o) => o.tid !== w.userTeamId);
  f.offers.push({ tid: w.userTeamId, salary, years });
  return null;
}

function resolveFA(w: World) {
  const st = w.off!;
  const rng = new Rng(hashSeed(w.seed, w.year, 999));
  const pct = (tid: number) => computeStandings(w, teamById(w, tid).league).find((r) => r.tid === tid)!.pct;
  for (const f of st.fa) {
    const p = w.players[f.pid];
    if (f.kind === 'overseas') {
      p.status = 'mlb';
      p.teamId = null;
      p.events.push({ year: w.year, text: '海外FA権を行使して海外球団へ移籍' });
      f.result = { tid: null, salary: 0, years: 0, mlb: true };
      addStory(w, w.date, {
        id: `mlb-${p.id}`, score: 60, kind: 'mlb', headline: `${shortName(p.name)} 海を渡る`, sub: `${teamById(w, f.from).nickname}から海外球団へ`,
        body: `海外FA権を行使した${p.name}（${teamById(w, f.from).nickname}）が海外球団との契約に合意した。`, scene: 'handshake', tids: [f.from], pids: [p.id],
      });
      continue;
    }
    // 選手は お金（総額と年平均）＋ 残留への愛着 ＋ チームの強さ で選ぶ
    let best: FAOffer | null = null, bv = -Infinity;
    for (const o of f.offers) {
      const v = o.salary * (1 + Math.min(o.years, 4) * 0.08) * (o.tid === f.from ? 1.1 : 1) * (0.9 + pct(o.tid) * 0.25) * (0.95 + rng.next() * 0.1);
      if (v > bv) { bv = v; best = o; }
    }
    if (!best) best = { tid: f.from, salary: renewalAsk(p, st.warLast[p.id] ?? 0), years: 1 };
    const moved = best.tid !== f.from;
    p.teamId = best.tid;
    p.status = 'farm';
    p.contract = { salary: best.salary, years: best.years };
    p.faUsed = true;
    f.result = { tid: best.tid, salary: best.salary, years: best.years };
    p.events.push({ year: w.year, text: moved ? `FAで${teamById(w, best.tid).city}${teamById(w, best.tid).nickname}へ移籍（${best.years}年・年俸${yen(best.salary)}）` : `FA宣言して残留（${best.years}年）` });
    if (moved) {
      assignNumber(w, p);
      // 金銭補償（Aランク80%、Bランク60%）
      const comp = f.rank === 'A' ? 0.8 : f.rank === 'B' ? 0.6 : 0;
      if (comp) {
        w.budget[f.from] += Math.round(p.contract.salary * comp);
        w.budget[best.tid] -= Math.round(p.contract.salary * comp);
      }
      addStory(w, w.date, {
        id: `famove-${p.id}`, score: 35 + Math.min(40, overall(p) - 45) + (best.tid === w.userTeamId || f.from === w.userTeamId ? 10 : 0), kind: 'faMove',
        headline: [`${shortName(p.name)} ${teamById(w, best.tid).nickname}入り`, `${shortName(p.name)} FA移籍決断`, `${teamById(w, best.tid).nickname} ${shortName(p.name)}獲得`][p.id % 3],
        sub: `${best.years}年総額${yen(best.salary * best.years)}`,
        body: `FA権を行使していた${p.name}（${teamById(w, f.from).nickname}）が${teamById(w, best.tid).city}${teamById(w, best.tid).nickname}への移籍を決めた。${best.years}年契約で年俸は${yen(best.salary)}。${comp ? `${f.rank}ランクのため、${teamById(w, f.from).nickname}には金銭補償が支払われる。` : ''}`,
        scene: 'handshake', tids: [best.tid, f.from], pids: [p.id],
      });
    }
    if (f.from === w.userTeamId || best.tid === w.userTeamId) inbox(w, `${p.name}は${moved ? teamById(w, best.tid).nickname + 'へ移籍' : '残留'}しました`, 'fa');
  }
}

function prepareTalks(w: World) {
  const st = w.off!;
  st.talks = rosterOf(w, w.userTeamId)
    .filter((p) => p.contract.years <= 1 && !st.fa.some((f) => f.pid === p.id && f.result))
    .map((p) => {
      const war = st.warLast[p.id] ?? 0;
      return { pid: p.id, ask: renewalAsk(p, war), offer: teamOffer(p, war), status: 'pending' as const };
    });
}

/** 契約更改の提示（ユーザー）: 要求額の97%以上なら一発サイン、低いと保留 */
export function proposeContract(w: World, pid: number, offer: number): ContractTalk | null {
  const t = w.off?.talks.find((x) => x.pid === pid);
  if (!t || t.status === 'signed') return t ?? null;
  t.offer = offer;
  if (offer >= t.ask * 0.97) {
    t.status = 'signed';
    w.players[pid].contract = { salary: offer, years: 1 };
  } else t.status = 'holdout';
  return t;
}

function doContracts(w: World) {
  const st = w.off!;
  // ユーザーの未決着分: 保留はお互いの中間で決着
  for (const t of st.talks) {
    if (t.status === 'signed') continue;
    const salary = Math.round(((t.status === 'holdout' ? (t.offer + t.ask) / 2 : t.offer)) / 10) * 10;
    w.players[t.pid].contract = { salary, years: 1 };
    t.status = 'signed';
  }
  // AI球団
  const raises: { p: PlayerRecord; before: number; after: number }[] = [];
  for (const p of Object.values(w.players)) {
    if (p.teamId === null || p.teamId === w.userTeamId || p.contract.years > 1) continue;
    if (st.fa.some((f) => f.pid === p.id && f.result)) continue;
    const before = p.contract.salary;
    p.contract = { salary: teamOffer(p, st.warLast[p.id] ?? 0), years: p.foreign ? 1 : 1 };
    raises.push({ p, before, after: p.contract.salary });
  }
  const top = raises.sort((a, b) => b.after - b.before - (a.after - a.before))[0];
  if (top && top.after > top.before) {
    addStory(w, w.date, {
      id: `kousei-${w.year}`, score: 25 + Math.min(30, (top.after - top.before) / 1000), kind: 'contract',
      headline: `${shortName(top.p.name)} ${yen(top.after - top.before)}増の${yen(top.after)}`, sub: `${teamById(w, top.p.teamId!).nickname} 契約更改`,
      body: `${teamById(w, top.p.teamId!).city}${teamById(w, top.p.teamId!).nickname}の${top.p.name}が契約を更改し、${yen(top.before)}から${yen(top.after)}へ大幅アップした。`,
      scene: 'handshake', tids: [top.p.teamId!], pids: [top.p.id],
    });
  }
}

/** 現役ドラフト: 各球団が2人を候補に出し、それぞれ1人ずつ獲得する */
function doGendai(w: World) {
  const st = w.off!;
  const rng = new Rng(hashSeed(w.seed, w.year, 1212));
  const lists = new Map<number, PlayerRecord[]>();
  for (const t of w.teams) {
    const c = rosterOf(w, t.id)
      .filter((p) => (p.status === 'farm' || p.status === 'active') && !p.foreign && !domesticFA(p) && p.contract.years <= 1 && (p.debutYear ?? 0) < w.year && overall(p) >= 38)
      .sort((a, b) => playerValue(a) - playerValue(b))
      .slice(2, 4);
    lists.set(t.id, c);
  }
  const order = w.teams.map((t) => t.id).sort(() => rng.next() - 0.5);
  for (let i = 0; i < order.length; i++) {
    const to = order[i], from = order[(i + 1) % order.length];
    const c = lists.get(from)!.sort((a, b) => playerValue(b) - playerValue(a))[0];
    if (!c) continue;
    c.teamId = to;
    c.status = 'farm';
    assignNumber(w, c);
    c.events.push({ year: w.year, text: `現役ドラフトで${teamById(w, to).city}${teamById(w, to).nickname}へ移籍` });
    st.gendai.push({ from, to, pid: c.id });
    if (to === w.userTeamId || from === w.userTeamId) inbox(w, `現役ドラフト: ${c.name}が${teamById(w, from).nickname}から${teamById(w, to).nickname}へ`, 'roster');
  }
  addStory(w, w.date, {
    id: `gendai-${w.year}`, score: 22, kind: 'gendai', headline: '現役ドラフト 12人が新天地へ', sub: '出場機会を求めて移籍',
    body: st.gendai.map((g) => `${w.players[g.pid].name}（${teamById(w, g.from).short}→${teamById(w, g.to).short}）`).join('、') + '。',
    scene: 'draft', tids: [], pids: [],
  });
}

/** 外国人選手の市場を作り、AI球団が獲得する */
function prepareForeign(w: World) {
  const st = w.off!;
  const rng = new Rng(hashSeed(w.seed, w.year, 2468));
  // 成績の悪かった外国人は退団
  for (const p of Object.values(w.players)) {
    if (!p.foreign || p.teamId === null || p.contract.years > 1) continue;
    if (p.teamId !== w.userTeamId && (playerValue(p) < 0 || p.age >= 35)) {
      p.events.push({ year: w.year, text: `${teamById(w, p.teamId).nickname}を退団` });
      p.status = 'retired';
      p.teamId = null;
    }
  }
  setNextPlayerId(w.nextPlayerId);
  const POS: Exclude<FieldPos, 'P'>[] = ['1B', 'LF', 'RF', '3B', '1B', 'CF', 'SS'];
  for (let i = 0; i < 22; i++) {
    const pitcher = i % 2 === 0;
    const level = 50 + rng.normal(4, 6);
    const pl = pitcher ? generatePitcher(rng, rng.chance(0.5) ? 'SP' : 'RP', { level, foreign: true, age: rng.int(25, 33) }) : generateBatter(rng, rng.pick(POS), { level, foreign: true, age: rng.int(25, 33) });
    const rec: PlayerRecord = {
      ...pl, teamId: null, status: 'fa', number: 0, primary: pitcher ? 'P' : (Object.keys(pl.bat.positions)[0] as FieldPos), role: pitcher ? (pl.pit!.stamina >= 50 ? 'SP' : 'RP') : undefined,
      form: 0, ...rollPotential(rng, pl), injury: null, contract: { salary: 0, years: 1 }, service: 0, entry: 'FOR', events: [{ year: w.year, text: '海外リーグから来日候補に' }],
    };
    rec.contract = initContract(rng, rec);
    w.players[rec.id] = rec;
    st.market.push(rec.id);
  }
  w.nextPlayerId = allocPlayerId();
  st.market = st.market.filter((id) => w.players[id].status === 'fa');
  // AI: 外国人が5人未満なら獲得
  for (const t of w.teams) {
    if (t.id === w.userTeamId) continue;
    let n = rosterOf(w, t.id).filter((p) => p.foreign).length;
    while (n < 5 && shihaika(w, t.id).length < SHIHAIKA_MAX) {
      const pool = st.market.map((id) => w.players[id]).filter((p) => p.status === 'fa' && p.foreign && p.contract.salary <= w.budget[t.id] - payroll(w, t.id) + 5000);
      const best = pool.sort((a, b) => playerValue(b) - playerValue(a))[0];
      if (!best) break;
      signFreeAgent(w, best, t.id);
      n++;
    }
  }
  aiTrades(w, rng, 40);
}

export function signFreeAgent(w: World, p: PlayerRecord, tid: number): string | null {
  if (p.status !== 'fa') return 'この選手とは契約できません';
  if (shihaika(w, tid).length >= SHIHAIKA_MAX) return '支配下は70人までです';
  p.teamId = tid;
  p.status = 'farm';
  assignNumber(w, p);
  p.events.push({ year: w.year, text: `${teamById(w, tid).city}${teamById(w, tid).nickname}と契約（年俸${yen(p.contract.salary)}）` });
  if (p.foreign && overall(p) >= 55) {
    addStory(w, w.date, {
      id: `foreign-${p.id}`, score: 18 + (tid === w.userTeamId ? 10 : 0), kind: 'foreign', headline: `${teamById(w, tid).nickname} 新助っ人${shortName(p.name)}獲得`,
      sub: `${p.isPitcher ? '投手' : '野手'}・${p.age}歳`, body: `${teamById(w, tid).city}${teamById(w, tid).nickname}が新外国人の${p.name}と契約した。年俸は${yen(p.contract.salary)}。`,
      scene: 'handshake', tids: [tid], pids: [p.id],
    });
  }
  return null;
}

/** 新シーズンへ（成長・衰え、加齢、日程、一軍の編成） */
export function startNewSeason(w: World) {
  const st = w.off;
  const ctx = contexts(w);
  w.history[w.year] = {
    season: Object.values(w.season),
    standings: [...computeStandings(w, 'C'), ...computeStandings(w, 'P')].map((r) => ({ tid: r.tid, w: r.w, l: r.l, t: r.t })),
    ctx,
  };
  const rng = new Rng(hashSeed(w.seed, w.year, 13579));
  // 出場機会（一軍でよく出た若手は伸びやすい）
  const played: Record<number, number> = {};
  for (const e of Object.values(w.season)) played[e.pid] = (played[e.pid] ?? 0) + (e.bat?.pa ?? 0) + (e.pitch?.outs ?? 0) * 1.3;
  const report: OffseasonState['devReport'] = [];
  for (const p of Object.values(w.players)) {
    if (p.status === 'retired' || p.status === 'mlb') continue;
    if (p.status === 'fa' && !p.foreign) {
      // 契約先が見つからなかった選手は引退
      p.status = 'retired';
      p.events.push({ year: w.year, text: '現役引退（所属先が決まらず）' });
      continue;
    }
    p.age++;
    const bonus = p.age <= 26 ? Math.min(1.5, (played[p.id] ?? 0) / 300) : 0;
    const d = developPlayer(rng, p, bonus);
    if (p.teamId === w.userTeamId) report.push({ pid: p.id, before: d.before, after: d.after });
    p.contract.years = Math.max(0, p.contract.years - 1);
    if (p.contract.years === 0) p.contract.years = 1;
    if (p.injury) {
      p.injury.days -= 120;
      if (p.injury.days <= 0) p.injury = null;
    }
    p.form = 0;
    // 新人王の資格
    const c = careerTotals(w, p.id);
    if (p.rookie && (c.pa >= 60 || c.outs >= 90 || w.year + 1 - (p.debutYear ?? w.year) >= 5)) p.rookie = false;
  }
  for (const id of Object.keys(w.players).map(Number)) {
    const p = w.players[id];
    if (p.status === 'fa' && p.foreign) delete w.players[id]; // 契約しなかった外国人はリストから外す
  }
  if (st) st.devReport = report;
  w.devReport = report;
  // 年をまたぐ
  w.year++;
  w.calendar = buildSchedule(w.teams, w.year, w.seed + w.year);
  amateurTick(w, addDays(w.calendar.opening, -1));
  w.date = w.calendar.opening;
  w.phase = 'regular';
  w.results = {};
  w.season = {};
  w.postStats = {};
  w.runEnv = { C: emptyRunEnv(), P: emptyRunEnv() };
  for (const t of w.teams) w.park[t.id] = emptyPark();
  w.post = null;
  w.allStar = null;
  w.draft = null;
  // 支配下70人を超えていたら価値の低い順に整理
  for (const t of w.teams) {
    let over = shihaika(w, t.id).length - SHIHAIKA_MAX;
    if (over > 0) {
      const list = shihaika(w, t.id).sort((a, b) => playerValue(a) - playerValue(b));
      for (const p of list.slice(0, over)) {
        p.status = 'retired';
        p.teamId = null;
        p.events.push({ year: w.year, text: '支配下枠の整理で退団' });
        if (t.id === w.userTeamId) inbox(w, `支配下70人を超えていたため${p.name}が退団しました`, 'roster');
      }
      over = 0;
    }
    ensureCatchers(w, t.id, rng);
    rebuildActive(w, t.id, 0);
    // 予算: 前年の年俸総額に人気（市場）を反映
    w.budget[t.id] = Math.round(Math.max(payroll(w, t.id) * 1.02, 150000 * t.market + 30000) / 1000) * 1000;
  }
  w.teamState[w.userTeamId].manualOrder = null;
  w.norm = computeNorm(w);
  if (st) st.stage = 'done';
  w.off = null;
  // 古い新聞の挿絵用データはそのまま、試合結果は消える
  addStory(w, w.date, {
    id: `opening-${w.year}`, score: 30, kind: 'opening', headline: `${w.year}年シーズン開幕`, sub: '12球団が143試合の戦いへ',
    body: `${w.year}年のプロ野球が開幕する。前年の日本一は${w.history[w.year - 1] ? (w.awards[w.year - 1]?.champion ? teamById(w, w.awards[w.year - 1].champion!).city + teamById(w, w.awards[w.year - 1].champion!).nickname : '-') : '-'}。`,
    scene: 'crowd', tids: [], pids: [],
  });
  void openingDay;
}

/** 捕手が3人未満なら補強する（自由契約から、いなければ新たに契約） */
function ensureCatchers(w: World, tid: number, rng: Rng) {
  const isC = (p: PlayerRecord) => !p.isPitcher && (p.bat.positions.C ?? 0) >= 60;
  let n = shihaika(w, tid).filter(isC).length;
  while (n < 3) {
    const ik = rosterOf(w, tid, 'ikusei').filter(isC).sort((a, b) => overall(b) - overall(a))[0];
    if (ik && shihaika(w, tid).length < SHIHAIKA_MAX) {
      ik.status = 'farm';
      ik.events.push({ year: w.year, text: '支配下登録' });
      n++;
      continue;
    }
    setNextPlayerId(w.nextPlayerId);
    const pl = generateBatter(rng, 'C', { level: 47, age: rng.int(23, 29) });
    w.nextPlayerId = allocPlayerId();
    const rec: PlayerRecord = {
      ...pl, teamId: tid, status: 'farm', number: 0, primary: 'C', form: 0, ...rollPotential(rng, pl), injury: null,
      contract: { salary: 800, years: 1 }, service: 0, entry: 'SHA', events: [{ year: w.year, text: `捕手補強で${teamById(w, tid).city}${teamById(w, tid).nickname}に入団（社会人）` }], debutYear: w.year + 1, rookie: true,
    };
    w.players[rec.id] = rec;
    assignNumber(w, rec);
    if (shihaika(w, tid).length > SHIHAIKA_MAX) {
      const drop = shihaika(w, tid).filter((p) => !isC(p) && p.contract.years <= 1).sort((a, b) => playerValue(a) - playerValue(b))[0];
      if (drop) { drop.status = 'retired'; drop.teamId = null; drop.events.push({ year: w.year, text: '支配下枠の整理で退団' }); }
    }
    n++;
  }
}

/** 次の段階へ進める（各段階の処理をしてから） */
export function advanceOffseason(w: World) {
  const st = w.off;
  if (!st) return;
  const i = STAGES.findIndex((s) => s.key === st.stage);
  switch (st.stage) {
    case 'release': doRelease(w); break;
    case 'fa': resolveFA(w); prepareTalks(w); break;
    case 'contract': doContracts(w); break;
    case 'gendai': doGendai(w); break;
    case 'foreign': prepareForeignDone(w); break;
    case 'camp': startNewSeason(w); return;
  }
  const next = STAGES[i + 1];
  st.stage = next.key;
  w.date = mdDate(w, next.md);
  amateurTick(w, w.date);
  if (next.key === 'fa') aiFAOffers2(w);
  if (next.key === 'contract' && st.talks.length === 0) prepareTalks(w);
  if (next.key === 'foreign') prepareForeign(w);
}

function aiFAOffers2(_w: World) {
  // オファーは宣言時点で出している（ユーザーはこの段階で申し込む）
}
function prepareForeignDone(w: World) {
  // 市場に残った国内の自由契約選手は、AI球団が安く拾うことがある
  const st = w.off!;
  const rng = new Rng(hashSeed(w.seed, w.year, 97531));
  for (const id of st.market) {
    const p = w.players[id];
    if (p.status !== 'fa' || p.foreign) continue;
    if (overall(p) >= 42 && rng.chance(0.35)) {
      const t = rng.pick(w.teams.filter((t) => t.id !== w.userTeamId && shihaika(w, t.id).length < SHIHAIKA_MAX));
      if (t) {
        p.contract = { salary: Math.max(MIN_SALARY, Math.round(p.contract.salary * 0.6 / 10) * 10), years: 1 };
        signFreeAgent(w, p, t.id);
      }
    }
  }
}

export function stageIndex(st: OffseasonState) {
  return STAGES.findIndex((s) => s.key === st.stage);
}

export const stageDate = (w: World, key: OffStage) => mdDate(w, STAGES.find((s) => s.key === key)?.md ?? '02-01');
void addDays;
