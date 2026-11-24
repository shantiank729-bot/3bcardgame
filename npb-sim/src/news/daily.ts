/**
 * 毎日の紙面を作る。出来事ごとに記事候補を作って重要度（score）をつけ、
 * 一番高いものを1面、残りを中面の記事にする。
 */
import type { GameResult } from '../engine/game';
import { Rng } from '../engine/rng';
import { fmtDate } from '../league/calendar';
import { computeStandings, magicNumber } from '../league/standings';
import type { LeagueId } from '../league/teams';
import { LEAGUE_NAMES } from '../league/teams';
import { teamById, type GameKind, type GameSummary, type World } from '../league/world';
import { pick, shortName } from './text';
import type { NewsIssue, Scene, Story } from './types';

export interface Played {
  summary: GameSummary;
  res: GameResult;
  kind: GameKind;
  seriesName?: string;
  seriesStatus?: string;
}

export interface DaySnapshot {
  leaders: Record<LeagueId, number>;
  magic: Record<LeagueId, number | null>;
}

export function snapshot(w: World): DaySnapshot {
  if (w.phase !== 'regular') return { leaders: { C: 0, P: 0 }, magic: { C: null, P: null } };
  return {
    leaders: { C: computeStandings(w, 'C')[0].tid, P: computeStandings(w, 'P')[0].tid },
    magic: { C: magicNumber(w, 'C').magic, P: magicNumber(w, 'P').magic },
  };
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function addStory(w: World, date: string, story: Story) {
  const issue = (w.news[date] ??= { date, stories: [] });
  if (issue.stories.some((s) => s.id === story.id)) return;
  issue.stories.push(story);
  issue.stories.sort((a, b) => b.score - a.score);
}

/** 通算成績（ゲーム開始前の通算＋過去シーズン＋今季） */
export function careerTotals(w: World, pid: number) {
  const p = w.players[pid];
  const c = { ...(p?.pre ?? { g: 0, pa: 0, h: 0, hr: 0, rbi: 0, sb: 0, pg: 0, w: 0, l: 0, sv: 0, hld: 0, k: 0, outs: 0 }) };
  const add = (e: { bat: import('../engine/box').BatLine | null; pitch: import('../engine/box').PitchLine | null }) => {
    if (e.bat) { c.g += e.bat.g; c.pa += e.bat.pa; c.h += e.bat.h; c.hr += e.bat.hr; c.rbi += e.bat.rbi; c.sb += e.bat.sb; }
    if (e.pitch) { c.pg += e.pitch.g; c.w += e.pitch.w; c.l += e.pitch.l; c.sv += e.pitch.sv; c.hld += e.pitch.hld; c.k += e.pitch.k; c.outs += e.pitch.outs; }
  };
  for (const h of Object.values(w.history)) for (const e of h.season) if (e.pid === pid) add(e);
  for (const e of Object.values(w.season)) if (e.pid === pid) add(e);
  return c;
}

function seasonTotals(w: World, pid: number) {
  let hr = 0, wins = 0, sb = 0, h = 0;
  for (const e of Object.values(w.season)) if (e.pid === pid) {
    if (e.bat) { hr += e.bat.hr; sb += e.bat.sb; h += e.bat.h; }
    if (e.pitch) wins += e.pitch.w;
  }
  return { hr, wins, sb, h };
}

const record = (w: World, tid: number) => {
  const lg = teamById(w, tid).league;
  const st = computeStandings(w, lg);
  const i = st.findIndex((r) => r.tid === tid);
  const r = st[i];
  return { text: `${r.w}勝${r.l}敗${r.t ? r.t + '分' : ''}`, rank: i + 1, streak: r.streak, row: r };
};

const ipText = (outs: number) => `${Math.floor(outs / 3)}回${outs % 3 ? `${outs % 3}/3` : ''}`;

// ---------------- 見出しテンプレート ----------------
const T = {
  perfect: ['{p} 完全試合達成！', '{p} 27人斬り 完全試合', '快挙！{p}パーフェクト'],
  nohit: ['{p} ノーヒットノーラン！', '{p} 無安打無得点の快挙', '{p} 魔球の夜 ノーノー達成'],
  teamNohit: ['{tn} 継投でノーヒットノーラン', '{tn} 投手リレーで無安打無得点'],
  walkoffHR: ['{h} サヨナラ弾！', '{h} 劇的サヨナラアーチ', '{h} 一振りで決めた サヨナラ本塁打', '{tn}歓喜 {h}サヨナラ弾'],
  walkoff: ['{h} サヨナラ打！', '{tn} 劇的サヨナラ勝ち', '{h} 決めた！サヨナラ', '粘った{tn} {h}がサヨナラ打'],
  cycle: ['{h} サイクル安打達成！', '{h} 単打・二塁打・三塁打・本塁打 サイクル達成'],
  multiHR: ['{h} 1試合{n}発！', '{h} {n}打席連発の大暴れ', '{h} {n}本塁打の独り舞台'],
  shutout: ['{p} 完封勝利', '{p} 9回0封 圧巻の完封', '{p} 散発{hits}安打完封'],
  strikeouts: ['{p} {k}奪三振の快投', '{p} 三振の山{k}個', '{p} {k}K 奪三振ショー'],
  comeback: ['{tn} {d}点差ひっくり返す大逆転', '{tn} 怒涛の逆転劇', '{tn} 諦めない！{d}点差逆転勝ち'],
  blowout: ['{tn} {r}得点の猛攻', '{tn} 打線爆発 {r}点', '{tn} 打って打って{r}点'],
  homer: ['{h} {hr}号 チームを勝利に導く', '{h} 一発で決めた {hr}号', '{h} 値千金の{hr}号'],
  pitchWin: ['{p} {w}勝目 {k}奪三振', '{p} 好投{w}勝目', '{p} {ip}を{r}失点 {w}勝目'],
  generic: ['{tn} {s}で{ln}下す', '{tn} 接戦制す', '{tn} {ln}に快勝', '{tn} 白星'],
  tie: ['{a}と{b} 12回引き分け', '延長12回 決着つかず', '{a}・{b} 譲らずドロー'],
  winStreak: ['{tn} {n}連勝！', '{tn} 止まらない{n}連勝', '{tn} 破竹の{n}連勝'],
  loseStreak: ['{tn} 泥沼{n}連敗', '{tn} {n}連敗 出口見えず', '{tn} また敗れ{n}連敗'],
  firstPlace: ['{tn} 首位浮上！', '{tn} ついに首位奪取', '{tn} 首位に立つ'],
  magicLit: ['{tn} 優勝マジック{m}点灯！', '{tn} M{m} ついに点灯', '{tn} マジック{m} 優勝へカウントダウン'],
  magic: ['{tn} M{m}', '{tn} マジック{m} 優勝目前', '{tn} 優勝まであと{m}勝'],
  clinch: ['{tn} {y}年{lg}優勝！', '{tn} 胴上げ！{lg}制覇', '{tn} 歓喜のV 監督が宙に舞う', '{tn} 頂点 {lg}優勝'],
  milestoneHR: ['{h} 通算{n}号！', '{h} 通算{n}本塁打の金字塔', '{h} {n}号到達'],
  milestoneHit: ['{h} 通算{n}安打達成', '{h} {n}本目のヒット 大台到達'],
  milestoneWin: ['{p} 通算{n}勝！', '{p} {n}勝の大台'],
  milestoneSave: ['{p} 通算{n}セーブ', '{p} {n}S 守護神の勲章'],
  milestoneK: ['{p} 通算{n}奪三振', '{p} 三振の山 通算{n}'],
  seasonHR: ['{h} 早くも{n}号！', '{h} シーズン{n}本 大台突破', '{h} {n}号 本塁打王へ独走'],
  seasonWin: ['{p} {n}勝目 エースの証', '{p} シーズン{n}勝到達'],
  cs: ['{tn} {sn}第{no}戦制す', '{tn} {sn} {h}が決めた', '{tn} 先勝・王手へ前進'],
  csWin: ['{tn} 日本シリーズ進出！', '{tn} CS突破 頂上決戦へ', '{tn} {lg}代表に'],
  js: ['{tn} 日本シリーズ第{no}戦 勝利', '{tn} {h}の一打で第{no}戦制す', '{tn} シリーズ{st}'],
  jsWin: ['{tn} 日本一！', '{tn} {y}年日本一 歓喜の胴上げ', '頂点！{tn}が日本一'],
  allstar: ['夢の球宴 {lg}が勝利', '球宴第{no}戦 {h}がMVP', 'オールスター {h}が主役'],
};

function score(base: number, w: World, tids: number[]) {
  return base + (tids.includes(w.userTeamId) ? 8 : 0);
}

/** 1試合から記事を1本（最も大きな出来事の切り口で）作る */
function gameStory(w: World, p: Played, rng: Rng, date: string): Story[] {
  const g = p.summary, res = p.res;
  const stories: Story[] = [];
  const A = teamById(w, g.away), H = teamById(w, g.home);
  const name = (pid: number) => w.players[pid]?.name ?? '?';
  const sn = (pid: number) => shortName(name(pid));
  const park = g.parkName ?? H.park.name;
  const homeIds = new Set(res.appeared.get(g.home) ?? []);
  const teamOf = (pid: number) => (homeIds.has(pid) ? g.home : g.away);
  if (g.tie) {
    stories.push({
      id: `g${g.id}`, score: score(8, w, [g.away, g.home]), kind: 'tie', gameId: g.id,
      headline: pick(rng, T.tie, { a: A.nickname, b: H.nickname }), sub: `${A.nickname} ${g.awayRuns}-${g.homeRuns} ${H.nickname}`,
      body: `${park}で行われた${A.city}${A.nickname}と${H.city}${H.nickname}の一戦は、延長12回の末${g.awayRuns}-${g.homeRuns}で引き分けた。`,
      scene: 'crowd', tids: [g.away, g.home], pids: [],
    });
    return stories;
  }
  const winHome = g.homeRuns > g.awayRuns;
  const Wt = winHome ? H : A, Lt = winHome ? A : H;
  const wr = winHome ? g.homeRuns : g.awayRuns, lr = winHome ? g.awayRuns : g.homeRuns;
  const sc = `${wr}-${lr}`;
  // 打のヒーロー
  let hero: number | null = null, heroV = -1;
  for (const [pid, l] of res.bat) {
    if (teamOf(pid) !== Wt.id) continue;
    const v = l.hr * 3 + l.h + l.rbi * 1.5 + l.d * 0.5;
    if (v > heroV) { heroV = v; hero = pid; }
  }
  const wp = g.wp;
  const wpl = wp ? res.pitch.get(wp) : undefined;
  const lastPA = [...res.events].reverse().find((e) => e.t === 'pa') as Extract<GameResult['events'][number], { t: 'pa' }> | undefined;
  const rec = record(w, Wt.id);
  const isPost = p.kind === 'CS1' || p.kind === 'CS2' || p.kind === 'JS';
  const vars: Record<string, string | number> = { tn: Wt.nickname, ln: Lt.nickname, s: sc, r: wr };
  let kind = 'game', base = 10, headline = '', scene: Scene = 'crowd', big: string | undefined, pids: number[] = [];
  const opp = (tid: number) => (tid === g.home ? g.away : g.home);
  const pitchLinesOf = (tid: number) => [...res.pitch].filter(([pid]) => teamOf(pid) === tid);
  const batLinesOf = (tid: number) => [...res.bat].filter(([pid]) => teamOf(pid) === tid);
  // ノーヒットノーラン・完全試合
  for (const tid of [Wt.id]) {
    const oppHits = batLinesOf(opp(tid)).reduce((s, [, l]) => s + l.h, 0);
    const oppRuns = tid === g.home ? g.awayRuns : g.homeRuns;
    if (oppHits === 0 && oppRuns === 0 && g.innings >= 9) {
      const pls = pitchLinesOf(tid);
      const walks = batLinesOf(opp(tid)).reduce((s, [, l]) => s + l.bb + l.hbp, 0);
      const errs = tid === g.home ? g.errors[1] : g.errors[0];
      if (pls.length === 1) {
        const [pid] = pls[0];
        const perfect = walks === 0 && errs === 0;
        kind = perfect ? 'perfect' : 'nohit';
        base = perfect ? 100 : 90;
        headline = pick(rng, perfect ? T.perfect : T.nohit, { p: sn(pid) });
        scene = 'nohitter';
        pids = [pid];
        big = perfect ? '完全' : 'ノーノー';
      } else {
        kind = 'teamNohit';
        base = 60;
        headline = pick(rng, T.teamNohit, vars);
        scene = 'nohitter';
      }
    }
  }
  if (!headline && hero !== null) {
    const hl = res.bat.get(hero)!;
    const singles = hl.h - hl.d - hl.t - hl.hr;
    if (singles >= 1 && hl.d >= 1 && hl.t >= 1 && hl.hr >= 1) {
      kind = 'cycle'; base = 60; headline = pick(rng, T.cycle, { h: sn(hero) }); scene = 'homer'; pids = [hero]; big = 'サイクル';
    }
  }
  if (!headline && g.walkoff && lastPA) {
    const isHR = lastPA.result === 'HR';
    kind = isHR ? 'walkoffHR' : 'walkoff';
    base = isHR ? 55 : 42;
    headline = pick(rng, isHR ? T.walkoffHR : T.walkoff, { h: sn(lastPA.batter), tn: Wt.nickname });
    scene = 'walkoff';
    pids = [lastPA.batter];
  }
  if (!headline) {
    const multi = [...res.bat].filter(([pid, l]) => l.hr >= 3 && teamOf(pid) === Wt.id)[0];
    if (multi) { kind = 'multiHR'; base = 45; headline = pick(rng, T.multiHR, { h: sn(multi[0]), n: multi[1].hr }); scene = 'homer'; pids = [multi[0]]; big = `${multi[1].hr}発`; }
  }
  if (!headline && wp && wpl && wpl.cg && wpl.sho) {
    kind = 'shutout'; base = 30;
    headline = pick(rng, T.shutout, { p: sn(wp), hits: batLinesOf(opp(Wt.id)).reduce((s, [, l]) => s + l.h, 0) });
    scene = 'pitcher'; pids = [wp];
  }
  if (!headline) {
    const ks = [...res.pitch].filter(([, l]) => l.k >= 13)[0];
    if (ks) { kind = 'strikeouts'; base = 35; headline = pick(rng, T.strikeouts, { p: sn(ks[0]), k: ks[1].k }); scene = 'pitcher'; pids = [ks[0]]; big = `${ks[1].k}K`; }
  }
  if (!headline) {
    // 逆転: 勝者の最大ビハインド
    let a = 0, h = 0, maxDef = 0;
    for (let i = 0; i < Math.max(g.lineAway.length, g.lineHome.length); i++) {
      a += g.lineAway[i] ?? 0;
      maxDef = Math.max(maxDef, winHome ? a - h : h - a);
      h += g.lineHome[i] ?? 0;
      maxDef = Math.max(maxDef, winHome ? a - h : h - a);
    }
    if (maxDef >= 4) { kind = 'comeback'; base = 35; headline = pick(rng, T.comeback, { ...vars, d: maxDef }); scene = 'crowd'; }
  }
  if (!headline && wr - lr >= 10) { kind = 'blowout'; base = 18; headline = pick(rng, T.blowout, vars); scene = 'homer'; }
  if (!headline && hero !== null && res.bat.get(hero)!.hr > 0) {
    const shr = seasonTotals(w, hero).hr;
    kind = 'homerWin'; base = 14; headline = pick(rng, T.homer, { h: sn(hero), hr: shr }); scene = 'homer'; pids = [hero]; big = `${shr}号`;
  }
  if (!headline && wp && wpl && wpl.outs >= 18) {
    kind = 'pitchWin'; base = 12;
    headline = pick(rng, T.pitchWin, { p: sn(wp), w: seasonTotals(w, wp).wins, k: wpl.k, ip: ipText(wpl.outs), r: wpl.r });
    scene = 'pitcher'; pids = [wp];
  }
  if (!headline) { headline = pick(rng, T.generic, vars); scene = hero !== null && res.bat.get(hero)!.hr ? 'homer' : 'crowd'; }

  // ポストシーズン・球宴の見出し
  if (isPost) {
    base += p.kind === 'JS' ? 50 : 38;
    const sv = { tn: Wt.nickname, sn: p.seriesName ?? '', no: g.label?.replace(/\D/g, '') ?? '', h: hero ? sn(hero) : '', st: p.seriesStatus ?? '' };
    if (kind === 'game' || kind === 'pitchWin' || kind === 'homerWin') headline = pick(rng, p.kind === 'JS' ? T.js : T.cs, sv);
  }
  // 本文
  const lines: string[] = [];
  const dateJP = fmtDate(date);
  lines.push(`${Wt.city}${Wt.nickname}は${dateJP}、${park}で${Lt.city}${Lt.nickname}と対戦し、${sc}で勝利した${g.innings > 9 ? `（延長${g.innings}回）` : ''}。`);
  if (kind === 'walkoff' || kind === 'walkoffHR') lines.push(`${g.innings}回裏、${name(lastPA!.batter)}が${lastPA!.result === 'HR' ? '打った瞬間それと分かる打球をスタンドへ運び' : '値千金の一打を放ち'}、試合を決めた。`);
  if (hero !== null) {
    const hl = res.bat.get(hero)!;
    if (hl.h > 0) lines.push(`打線は${name(hero)}が${hl.ab}打数${hl.h}安打${hl.rbi ? hl.rbi + '打点' : ''}${hl.hr ? `（${hl.hr}本塁打、今季${seasonTotals(w, hero).hr}号）` : ''}と活躍した。`);
  }
  if (wp && wpl) lines.push(`${wpl.gs ? '先発の' : '救援した'}${name(wp)}は${ipText(wpl.outs)}を投げ${wpl.k}奪三振${wpl.r}失点で${seasonTotals(w, wp).wins}勝目を挙げた。`);
  if (g.sv) lines.push(`最後は${name(g.sv)}が締めた。`);
  if (!isPost && p.kind !== 'AS') lines.push(`これで${Wt.nickname}は${rec.text}、${LEAGUE_NAMES[Wt.league]}${rec.rank}位。`);
  if (isPost && p.seriesStatus) lines.push(`${p.seriesName}は${Wt.nickname}の${p.seriesStatus}。`);
  stories.push({
    id: `g${g.id}`, score: score(base, w, [g.away, g.home]), kind, gameId: g.id, headline,
    sub: `${Wt.nickname} ${sc} ${Lt.nickname}${isPost ? `（${p.seriesName}${g.label ?? ''}）` : ''}`,
    body: lines.join(''), scene, tids: [Wt.id, Lt.id], pids, big,
  });

  // 記録達成（通算・シーズン）
  const MILE = { hr: [100, 200, 300, 400, 500], h: [1000, 1500, 2000, 2500], w: [100, 150, 200], sv: [100, 150, 200, 250], k: [1000, 1500, 2000, 2500] };
  const crossed = (after: number, inc: number, list: number[]) => list.find((m) => after >= m && after - inc < m);
  if (!isPost && p.kind !== 'AS') {
    for (const [pid, l] of res.bat) {
      if (!l.hr && !l.h) continue;
      const c = careerTotals(w, pid);
      const mHR = l.hr ? crossed(c.hr, l.hr, MILE.hr) : undefined;
      const mH = l.h ? crossed(c.h, l.h, MILE.h) : undefined;
      if (mHR) stories.push(milestone(w, rng, date, pid, 'milestoneHR', mHR, 30 + mHR / 8, T.milestoneHR, `${mHR}号`, 'homer'));
      if (mH) stories.push(milestone(w, rng, date, pid, 'milestoneHit', mH, 25 + mH / 40, T.milestoneHit, `${mH}安打`, 'milestone'));
      const s = seasonTotals(w, pid).hr;
      const mS = l.hr ? crossed(s, l.hr, [30, 40, 50, 55, 60]) : undefined;
      if (mS) stories.push(milestone(w, rng, date, pid, 'seasonHR', mS, mS >= 50 ? 40 + mS : 20 + mS / 2, T.seasonHR, `${mS}号`, 'homer'));
    }
    for (const [pid, l] of res.pitch) {
      const c = careerTotals(w, pid);
      const mW = l.w ? crossed(c.w, l.w, MILE.w) : undefined;
      const mSV = l.sv ? crossed(c.sv, l.sv, MILE.sv) : undefined;
      const mK = l.k ? crossed(c.k, l.k, MILE.k) : undefined;
      if (mW) stories.push(milestone(w, rng, date, pid, 'milestoneWin', mW, 30 + mW / 3, T.milestoneWin, `${mW}勝`, 'pitcher'));
      if (mSV) stories.push(milestone(w, rng, date, pid, 'milestoneSave', mSV, 25 + mSV / 5, T.milestoneSave, `${mSV}S`, 'pitcher'));
      if (mK) stories.push(milestone(w, rng, date, pid, 'milestoneK', mK, 25 + mK / 60, T.milestoneK, `${mK}K`, 'pitcher'));
      const sw = l.w ? crossed(seasonTotals(w, pid).wins, l.w, [15, 20]) : undefined;
      if (sw) stories.push(milestone(w, rng, date, pid, 'seasonWin', sw, sw >= 20 ? 60 : 25, T.seasonWin, `${sw}勝`, 'pitcher'));
    }
  }
  return stories;
}

function milestone(w: World, rng: Rng, date: string, pid: number, kind: string, n: number, base: number, tpl: string[], big: string, scene: Scene): Story {
  const p = w.players[pid];
  const tid = p.teamId ?? 0;
  const t = teamById(w, tid);
  return {
    id: `${kind}-${pid}-${n}`, score: score(base, w, [tid]), kind, headline: pick(rng, tpl, { h: shortName(p.name), p: shortName(p.name), n }),
    sub: `${t.nickname}・${p.name}`, scene, tids: [tid], pids: [pid], big,
    body: `${t.city}${t.nickname}の${p.name}が${fmtDate(date)}の試合で${kind.startsWith('season') ? 'シーズン' : '通算'}${big}に到達した。${kind.startsWith('season') ? '' : `プロ${w.year - (p.debutYear ?? w.year) + 1}年目、${p.age}歳での達成となった。`}`,
  };
}

/** 1日分の紙面を書く */
export function writeDailyNews(w: World, date: string, played: Played[], before: DaySnapshot): NewsIssue | null {
  const rng = new Rng(hash(date + w.seed));
  for (const p of played) {
    if (p.kind === 'AS') {
      const g = p.summary;
      const mvp = w.allStar?.mvp[(w.allStar?.games.length ?? 1) - 1] ?? null;
      const win = g.homeRuns > g.awayRuns ? teamById(w, g.home) : teamById(w, g.away);
      addStory(w, date, {
        id: `as${g.id}`, score: 50, kind: 'allstar', gameId: g.id,
        headline: pick(rng, T.allstar, { lg: g.tie ? '両リーグ' : win.city, no: g.label ?? '', h: mvp ? shortName(w.players[mvp].name) : '' }),
        sub: `オールスター${g.label ?? ''} ${g.awayRuns}-${g.homeRuns}`,
        body: `夢の球宴${g.label ?? ''}が${g.parkName ?? ''}で行われ、${g.tie ? '引き分けに終わった' : `${win.city}が${Math.max(g.awayRuns, g.homeRuns)}-${Math.min(g.awayRuns, g.homeRuns)}で勝利した`}。${mvp ? `MVPには${w.players[mvp].name}（${teamById(w, w.players[mvp].teamId!).nickname}）が選ばれた。` : ''}`,
        scene: 'allstar', tids: [], pids: mvp ? [mvp] : [],
      });
      continue;
    }
    for (const s of gameStory(w, p, rng, date)) addStory(w, date, s);
  }
  if (w.phase === 'regular' || (played.length && played.every((p) => p.kind === 'L' || p.kind === 'I'))) {
    const playedTeams = new Set(played.filter((p) => p.kind === 'L' || p.kind === 'I').flatMap((p) => [p.summary.away, p.summary.home]));
    for (const lg of ['C', 'P'] as const) {
      const st = computeStandings(w, lg);
      // 連勝・連敗
      for (const r of st) {
        if (!playedTeams.has(r.tid)) continue;
        const m = r.streak.match(/(\d+)(連勝|連敗)/);
        if (!m) continue;
        const n = Number(m[1]);
        const t = teamById(w, r.tid);
        if (m[2] === '連勝' && n >= 5) addStory(w, date, { id: `ws-${r.tid}-${date}`, score: score(16 + n * 3, w, [r.tid]), kind: 'winStreak', headline: pick(rng, T.winStreak, { tn: t.nickname, n }), sub: `${t.city}${t.nickname} ${r.w}勝${r.l}敗`, body: `${t.city}${t.nickname}が${n}連勝。${LEAGUE_NAMES[lg]}${st.indexOf(r) + 1}位で、首位とのゲーム差は${r.gb ?? 0}。勢いが止まらない。`, scene: 'streak', tids: [r.tid], pids: [], big: `${n}連勝` });
        if (m[2] === '連敗' && n >= 6) addStory(w, date, { id: `ls-${r.tid}-${date}`, score: score(12 + n * 2, w, [r.tid]), kind: 'loseStreak', headline: pick(rng, T.loseStreak, { tn: t.nickname, n }), sub: `${t.city}${t.nickname} ${r.w}勝${r.l}敗`, body: `${t.city}${t.nickname}が${n}連敗を喫した。打開策が見えない。`, scene: 'slump', tids: [r.tid], pids: [], big: `${n}連敗` });
      }
      // 首位交代
      const leader = st[0].tid;
      if (before.leaders[lg] && leader !== before.leaders[lg] && st[0].g >= 10) {
        const t = teamById(w, leader);
        addStory(w, date, { id: `top-${lg}-${date}`, score: score(32, w, [leader]), kind: 'firstPlace', headline: pick(rng, T.firstPlace, { tn: t.nickname }), sub: `${LEAGUE_NAMES[lg]} 首位交代`, body: `${t.city}${t.nickname}が${teamById(w, before.leaders[lg]).nickname}に代わって${LEAGUE_NAMES[lg]}の首位に立った（${st[0].w}勝${st[0].l}敗${st[0].t}分）。`, scene: 'crowd', tids: [leader], pids: [] });
      }
      // マジック・優勝
      const mg = magicNumber(w, lg);
      const t = teamById(w, mg.tid);
      const clinched = mg.magic === 0 || (st[0].remaining === 0);
      if (clinched && !w.flags[`clinch-${lg}-${w.year}`]) {
        w.flags[`clinch-${lg}-${w.year}`] = true;
        addStory(w, date, { id: `clinch-${lg}`, score: score(95, w, [mg.tid]), kind: 'clinch', headline: pick(rng, T.clinch, { tn: t.nickname, lg: LEAGUE_NAMES[lg], y: w.year }), sub: `${t.city}${t.nickname} ${LEAGUE_NAMES[lg]}優勝`, body: `${t.city}${t.nickname}が${fmtDate(date)}、${w.year}年の${LEAGUE_NAMES[lg]}優勝を決めた。グラウンドに歓喜の輪ができ、監督が${st[0].w}勝の重みを噛みしめるように宙を舞った。クライマックスシリーズではファイナルステージから登場する。`, scene: 'doage', tids: [mg.tid], pids: [], big: 'V' });
      } else if (!clinched && mg.magic !== null && mg.magic <= st[0].remaining) {
        const lit = !w.flags[`magic-${lg}-${w.year}`];
        if (lit && mg.magic <= 40) {
          w.flags[`magic-${lg}-${w.year}`] = true;
          addStory(w, date, { id: `magic-${lg}-${date}`, score: score(55, w, [mg.tid]), kind: 'magicLit', headline: pick(rng, T.magicLit, { tn: t.nickname, m: mg.magic }), sub: `${LEAGUE_NAMES[lg]} 優勝へカウントダウン`, body: `${t.city}${t.nickname}に優勝へのマジックナンバー${mg.magic}が点灯した。残り${st[0].remaining}試合で、他球団の結果に関係なく${mg.magic}勝すれば優勝が決まる。`, scene: 'magic', tids: [mg.tid], pids: [], big: `M${mg.magic}` });
        } else if (!lit && mg.magic !== before.magic[lg] && mg.magic <= 5) {
          addStory(w, date, { id: `magic-${lg}-${date}`, score: score(28 + (6 - mg.magic) * 4, w, [mg.tid]), kind: 'magic', headline: pick(rng, T.magic, { tn: t.nickname, m: mg.magic }), sub: `${LEAGUE_NAMES[lg]} 優勝マジック`, body: `${t.city}${t.nickname}の優勝マジックが${mg.magic}になった。`, scene: 'magic', tids: [mg.tid], pids: [], big: `M${mg.magic}` });
        }
      }
    }
  }
  const issue = w.news[date];
  if (issue) issue.stories = issue.stories.slice(0, 12);
  return issue ?? null;
}
