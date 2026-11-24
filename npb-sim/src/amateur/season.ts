/**
 * アマチュア野球の年間行事を日付で進める（プロの日程と並行して裏で進行）。
 *  3月 センバツ / 4月 新年度・大学春季リーグ / 6月 全日本大学選手権 / 7月 夏の地方大会 / 8月 夏の甲子園
 *  9月 秋季都道府県大会・大学秋季リーグ / 10月 プロ志望届・秋季地区大会 / 11月 明治神宮大会 / 1月 センバツ選考
 */
import { Rng } from '../engine/rng';
import { addDays, weekday } from '../league/calendar';
import { overall } from '../players/development';
import { addStory } from '../news/daily';
import { shortName } from '../news/text';
import type { World } from '../league/world';
import { PREFS, REGIONS, SPLIT_NAMES, UNI_LEAGUES, type RegionKey } from './data';
import { AM_PARKS, amateurNorm, heroOf, playAmateurGame, prunePitchLog, recordAmateurGame, type AmGameOpts } from './games';
import { leagueStandings, makeKnockout, makeLeague, playLeagueDay, playTourneyDay, type PlayFn } from './tourney';
import type { AmateurWorld, Tourney } from './types';
import { amateurGrowth, baseHype, newSchoolYear, schoolsOf } from './world';
import { weeklyScouting } from './scout';

const hashSeed = (...xs: number[]) => xs.reduce((h, x) => Math.imul(h ^ x, 16777619) >>> 0, 2166136261);
const strHash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

const d = (y: number, md: string) => `${y}-${md}`;
const range = (from: string, n: number) => [...Array(n)].map((_, i) => addDays(from, i));
const weekends = (from: string, to: string) => {
  const out: string[] = [];
  for (let x = from; x <= to; x = addDays(x, 1)) if (weekday(x) === 0 || weekday(x) === 6) out.push(x);
  return out;
};

export function norms(am: AmateurWorld) {
  if (!am.norm) am.norm = { HS: amateurNorm(am, 'HS'), UNI: amateurNorm(am, 'UNI'), SHA: amateurNorm(am, 'SHA') };
  return am.norm;
}

/** トーナメントの1試合を行う関数を作る */
function player(w: World, t: Tourney, park: AmGameOpts['park'], statKey: string, hypeW: number): PlayFn {
  const am = w.amateur;
  return (a, b, date, g) => {
    const seed = hashSeed(w.seed, strHash(t.id), g.round, a, b);
    const res = playAmateurGame(am, a, b, date, { park, seed, norm: norms(am)[t.stage], stage: t.stage });
    recordAmateurGame(am, res, date, statKey, hypeW, t.leaders);
    const aWins = res.awayRuns > res.homeRuns || (res.awayRuns === res.homeRuns && (seed & 1) === 0);
    const homeIds = new Set(res.appeared.get(b) ?? []);
    return { res, aWins, hero: heroOf(res, aWins ? 'away' : 'home', homeIds) };
  };
}

/** 観戦用に、トーナメントの試合と同じ条件を返す */
export function gameSetup(w: World, t: Tourney, a: number, b: number, round: number): AmGameOpts {
  const park = t.level === 'national' ? (t.stage === 'HS' && !t.id.includes('jingu') ? AM_PARKS.KOSHIEN : AM_PARKS.JINGU) : AM_PARKS.LOCAL;
  return { park, seed: hashSeed(w.seed, strHash(t.id), round, a, b), norm: norms(w.amateur)[t.stage], stage: t.stage };
}

function parkFor(t: Tourney) {
  return t.level === 'national' ? (t.stage === 'HS' && !t.id.includes('jingu') ? AM_PARKS.KOSHIEN : AM_PARKS.JINGU) : AM_PARKS.LOCAL;
}
function keyFor(t: Tourney) {
  return t.level === 'national' ? `${t.year}${t.stage === 'HS' ? 'K' : 'N'}` : `${t.year}`;
}
function hypeFor(t: Tourney) {
  return t.level === 'national' ? 1 : t.level === 'region' ? 0.5 : t.level === 'league' ? 0.35 : 0.3;
}

function districts(am: AmateurWorld) {
  const m = new Map<string, number[]>();
  for (const s of schoolsOf(am, 'HS')) (m.get(s.district) ?? m.set(s.district, []).get(s.district)!).push(s.id);
  return m;
}
function prefSchools(am: AmateurWorld) {
  const m = new Map<number, number[]>();
  for (const s of schoolsOf(am, 'HS')) (m.get(s.pref) ?? m.set(s.pref, []).get(s.pref)!).push(s.id);
  return m;
}

// ---------------- 行事の開始 ----------------
function startSenbatsu(w: World, y: number, rng: Rng) {
  const am = w.amateur;
  const ent = am.senbatsu[y] ?? selectSenbatsuFallback(am, rng);
  am.senbatsu[y] = ent;
  const s = d(y, '03-19');
  const dates = [range(s, 4), range(addDays(s, 4), 3), [addDays(s, 8)], [addDays(s, 10)], [addDays(s, 12)]];
  am.tourneys[`${y}-senbatsu`] = makeKnockout(rng, `${y}-senbatsu`, `第${y - 1928}回 選抜高等学校野球大会（センバツ）`, 'センバツ', 'HS', 'national', y, ent, dates);
}

function selectSenbatsuFallback(am: AmateurWorld, rng: Rng): number[] {
  const out: number[] = [];
  for (const r of REGIONS) {
    const list = schoolsOf(am, 'HS').filter((s) => s.region === r.key).sort((a, b) => b.strength + rng.next() * 20 - a.strength);
    out.push(...list.slice(0, r.senbatsu).map((s) => s.id));
  }
  const rest = schoolsOf(am, 'HS').filter((s) => !out.includes(s.id)).sort(() => rng.next() - 0.5);
  out.push(...rest.slice(0, 32 - out.length).map((s) => s.id));
  return out;
}

function startSummer(w: World, y: number, rng: Rng) {
  const am = w.amateur;
  const dates = [[d(y, '07-12')], [d(y, '07-19')], [d(y, '07-24')], [d(y, '07-28')]];
  for (const [dist, ids] of districts(am)) {
    am.tourneys[`${y}-summer-${dist}`] = makeKnockout(rng, `${y}-summer-${dist}`, `${dist}大会`, `${dist}`, 'HS', 'pref', y, ids, dates, dist);
  }
}

function startKoshien(w: World, y: number, rng: Rng) {
  const am = w.amateur;
  const reps = Object.values(am.tourneys).filter((t) => t.year === y && t.id.startsWith(`${y}-summer-`) && t.champion).map((t) => t.champion!);
  const s = d(y, '08-06');
  const dates = [range(s, 4), range(addDays(s, 4), 4), range(addDays(s, 8), 2), [addDays(s, 11)], [addDays(s, 13)], [addDays(s, 15)]];
  am.tourneys[`${y}-koshien`] = makeKnockout(rng, `${y}-koshien`, `第${y - 1918}回 全国高等学校野球選手権大会（夏の甲子園）`, '夏の甲子園', 'HS', 'national', y, reps, dates);
  for (const id of reps) {
    const sc = am.schools[id];
    sc.koshien.apps++;
  }
}

function startFall(w: World, y: number, rng: Rng) {
  const am = w.amateur;
  const dates = [[d(y, '09-07')], [d(y, '09-14')], [d(y, '09-21')], [d(y, '09-23')]];
  for (const [pi, ids] of prefSchools(am)) {
    const name = PREFS[pi][0];
    am.tourneys[`${y}-fall-${pi}`] = makeKnockout(rng, `${y}-fall-${pi}`, `秋季${name}大会`, `秋季${name}`, 'HS', 'pref', y, ids, dates, name);
  }
}

function startRegionals(w: World, y: number, rng: Rng) {
  const am = w.amateur;
  const dates = [[d(y, '10-11')], [d(y, '10-18')], [d(y, '10-25')], [d(y, '10-27')]];
  for (const r of REGIONS) {
    const ent: number[] = [];
    for (let pi = 0; pi < PREFS.length; pi++) {
      if (PREFS[pi][1] !== r.key) continue;
      const t = am.tourneys[`${y}-fall-${pi}`];
      if (!t) continue;
      // 都道府県の上位（東京・北海道は1都道で4校、ほかは2校）
      const n = r.key === 'tokyo' || r.key === 'hokkaido' ? 4 : 2;
      ent.push(...Object.entries(t.reached).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => Number(k)));
    }
    am.tourneys[`${y}-region-${r.key}`] = makeKnockout(rng, `${y}-region-${r.key}`, `秋季${r.name}大会`, `秋季${r.name}`, 'HS', 'region', y, ent, dates, r.name);
  }
}

function startJingu(w: World, y: number, rng: Rng) {
  const am = w.amateur;
  const s = d(y, '11-14');
  const dates = [[s, addDays(s, 1)], [addDays(s, 2)], [addDays(s, 3)], [addDays(s, 4)]];
  const hs = REGIONS.map((r) => am.tourneys[`${y}-region-${r.key}`]?.champion).filter((x): x is number => !!x);
  am.tourneys[`${y}-jingu-hs`] = makeKnockout(rng, `${y}-jingu-hs`, `明治神宮野球大会 高校の部`, '神宮大会(高校)', 'HS', 'national', y, hs, dates);
  const uni = UNI_LEAGUES.map((_, li) => am.tourneys[`${y}-unifall-${li}`]?.champion).filter((x): x is number => !!x);
  am.tourneys[`${y}-jingu-uni`] = makeKnockout(rng, `${y}-jingu-uni`, `明治神宮野球大会 大学の部`, '神宮大会(大学)', 'UNI', 'national', y, uni, dates);
}

function startUniLeagues(w: World, y: number, season: 'spring' | 'fall') {
  const am = w.amateur;
  const dates = season === 'spring' ? weekends(d(y, '04-10'), d(y, '05-24')) : weekends(d(y, '09-06'), d(y, '10-19'));
  UNI_LEAGUES.forEach((lg, li) => {
    const ids = schoolsOf(am, 'UNI').filter((s) => s.league === li).map((s) => s.id);
    const id = `${y}-uni${season}-${li}`;
    am.tourneys[id] = makeLeague(id, `${lg.name} ${season === 'spring' ? '春季' : '秋季'}リーグ`, `${lg.name.replace('学生', '').replace('野球', '').replace('連盟', '').replace('リーグ', '')}${season === 'spring' ? '春' : '秋'}`, y, ids, dates);
  });
}

function startUniChamp(w: World, y: number, rng: Rng) {
  const am = w.amateur;
  const ent: number[] = [];
  UNI_LEAGUES.forEach((_, li) => {
    const t = am.tourneys[`${y}-unispring-${li}`];
    if (t) ent.push(...leagueStandings(t).slice(0, 2).map((r) => r[0]));
  });
  const s = d(y, '06-09');
  const dates = [[s, addDays(s, 1)], [addDays(s, 2)], [addDays(s, 3)], [addDays(s, 4)], [addDays(s, 5)]];
  am.tourneys[`${y}-unichamp`] = makeKnockout(rng, `${y}-unichamp`, '全日本大学野球選手権大会', '大学選手権', 'UNI', 'national', y, ent, dates);
}

/** センバツの選考（地区大会の成績＋神宮枠＋21世紀枠） */
function selectSenbatsu(w: World, fallYear: number, rng: Rng) {
  const am = w.amateur;
  const out: number[] = [];
  const jingu = am.tourneys[`${fallYear}-jingu-hs`]?.champion;
  const jinguRegion = jingu ? am.schools[jingu].region : null;
  for (const r of REGIONS) {
    const t = am.tourneys[`${fallYear}-region-${r.key}`];
    if (!t) continue;
    const n = r.senbatsu + (r.key === jinguRegion ? 1 : 0);
    out.push(...Object.entries(t.reached).sort((a, b) => b[1] - a[1] || am.schools[Number(b[0])].strength - am.schools[Number(a[0])].strength).slice(0, n).map(([k]) => Number(k)));
  }
  // 21世紀枠: 地区大会に出た比較的無名の学校から2校
  const cands = schoolsOf(am, 'HS').filter((s) => !out.includes(s.id) && s.strength < 50 && Object.values(am.tourneys).some((t) => t.id.startsWith(`${fallYear}-region-`) && t.entrants.includes(s.id)));
  const c21 = cands.sort(() => rng.next() - 0.5).slice(0, 2).map((s) => s.id);
  out.push(...c21);
  (am.senbatsu21 ??= {})[fallYear + 1] = c21;
  am.senbatsu[fallYear + 1] = out.slice(0, 32);
  const nm = (id: number) => am.schools[id].name;
  addStory(w, w.date, {
    id: `senbatsu-select-${fallYear + 1}`, score: 24, kind: 'amateur', headline: `センバツ出場32校決まる`, sub: `21世紀枠に${c21.map(nm).join('・')}`,
    body: `第${fallYear + 1 - 1928}回センバツの出場校が発表された。明治神宮大会を制した${jingu ? nm(jingu) : '-'}の地区に神宮枠が与えられ、21世紀枠には${c21.map(nm).join('、')}が選ばれた。`,
    scene: 'koshien', tids: [], pids: [],
  });
}

/** プロ志望届（高校3年・大学4年） */
function shibouDecisions(w: World) {
  const am = w.amateur;
  const val = (p: (typeof am.players)[number]) => overall(p) + p.pot * 0.6 + p.hype * 0.25;
  const pick = (list: (typeof am.players)[number][], n: number) => list.sort((a, b) => val(b) - val(a)).slice(0, n);
  const hs = pick(Object.values(am.players).filter((p) => p.stage === 'HS' && p.grade === 3), 60);
  const uni = pick(Object.values(am.players).filter((p) => p.stage === 'UNI' && p.grade === 4), 70);
  for (const p of [...hs, ...uni]) {
    p.shibou = true;
    p.notes.push({ year: Number(w.date.slice(0, 4)), text: 'プロ志望届を提出' });
  }
  const star = [...hs, ...uni].sort((a, b) => b.hype - a.hype)[0];
  if (star) {
    addStory(w, w.date, {
      id: `shibou-${w.date}`, score: 22 + star.hype / 5, kind: 'amateur', headline: `${shortName(star.name)} プロ志望届を提出`,
      sub: `${am.schools[star.schoolId].name}`, body: `${am.schools[star.schoolId].name}の${star.name}がプロ志望届を提出した。今秋のドラフトの目玉として複数球団が注目している。高校生${hs.length}人、大学生${uni.length}人が提出した。`,
      scene: 'draft', tids: [], pids: [],
    });
  }
}

/** 大会終了時の記録（経歴・学校の実績・新聞） */
function finishTourney(w: World, t: Tourney) {
  const am = w.amateur;
  if (!t.champion) return;
  const champ = am.schools[t.champion];
  champ.history.push({ year: t.year, text: `${t.short}優勝` });
  if (t.level !== 'national') return;
  const isKoshien = t.id.endsWith('koshien') || t.id.endsWith('senbatsu');
  if (isKoshien) {
    champ.koshien.titles++;
    for (const g of t.games) if (g.winner) am.schools[g.winner].koshien.wins++;
  }
  const roundName = (r: number) => (r >= t.rounds ? '優勝' : r === t.rounds - 1 ? '準優勝' : r === t.rounds - 2 ? 'ベスト4' : r === t.rounds - 3 ? 'ベスト8' : '出場');
  // 出場選手の経歴
  const key = keyFor(t);
  for (const p of Object.values(am.players)) {
    if (!t.entrants.includes(p.schoolId)) continue;
    if (!p.sbat[key] && !p.spit[key]) continue;
    const res = roundName(t.reached[p.schoolId] + (p.schoolId === t.champion ? 1 : 0));
    const b = p.sbat[key], pi = p.spit[key];
    const line = pi && pi[1] >= 9 ? `${pi[0]}試合 ${Math.floor(pi[1] / 3)}回 ${pi[5]}奪三振 防御率${((pi[3] * 27) / Math.max(1, pi[1])).toFixed(2)}` : b ? `${b[1]}打数${b[2]}安打 ${b[5]}本塁打 ${b[6]}打点` : '';
    p.notes.push({ year: t.year, text: `${t.short}${res}（${am.schools[p.schoolId].name}）${line ? '・' + line : ''}` });
  }
  // 優勝投手・大会の主役
  const L = t.leaders ?? {};
  const hr = Object.entries(L).sort((a, b) => b[1][2] - a[1][2])[0];
  const kk = Object.entries(L).sort((a, b) => b[1][4] - a[1][4])[0];
  const finals = t.games.find((g) => g.round === t.rounds);
  const hero = finals?.hero ? am.players[finals.hero] : null;
  if (hero) hero.notes.push({ year: t.year, text: `${t.short}決勝のヒーロー` });
  const ace = Object.values(am.players).filter((p) => p.schoolId === t.champion && p.spit[key]).sort((a, b) => b.spit[key][1] - a.spit[key][1])[0];
  if (ace) ace.notes.push({ year: t.year, text: `${t.short}優勝投手` });
  const score = t.id.endsWith('koshien') ? 72 : t.id.endsWith('senbatsu') ? 58 : 32;
  const runner = t.runnerUp ? am.schools[t.runnerUp].name : '';
  addStory(w, w.date, {
    id: `${t.id}-champ`, score, kind: 'amateur',
    headline: [`${champ.name} ${t.short}制覇`, `${champ.name}が頂点 ${t.short}`, `${champ.name} 悲願の${t.short}優勝`][t.year % 3],
    sub: `決勝 ${champ.name} ${finals?.score ? `${Math.max(...finals.score)}-${Math.min(...finals.score)}` : ''} ${runner}`,
    body: `${t.name}は${champ.name}が決勝で${runner}を破り、優勝した。${ace ? `エースの${ace.name}（${ace.grade}年）が${ace.spit[key][0]}試合に登板し、計${Math.floor(ace.spit[key][1] / 3)}回を投げた。` : ''}${hero && hero !== ace ? `決勝では${hero.name}が活躍した。` : ''}`,
    scene: 'koshien', tids: [], pids: [], big: '優勝',
  });
  // スター誕生
  const star = hr && hr[1][2] >= 3 ? { pid: Number(hr[0]), text: `大会${hr[1][2]}本塁打` } : kk && kk[1][4] >= 30 ? { pid: Number(kk[0]), text: `大会${kk[1][4]}奪三振` } : null;
  if (star && t.stage === 'HS' && am.players[star.pid]) {
    const p = am.players[star.pid];
    p.hype = Math.min(100, p.hype + 15);
    p.notes.push({ year: t.year, text: `${t.short}で${star.text}` });
    addStory(w, w.date, {
      id: `${t.id}-star`, score: score - 18, kind: 'amateur', headline: `${t.short}のスター誕生 ${shortName(p.name)}`, sub: `${am.schools[p.schoolId].name} ${p.grade}年・${star.text}`,
      body: `${am.schools[p.schoolId].name}の${p.grade}年生、${p.name}が${t.short}で${star.text}をマーク。プロのスカウトの評価も急上昇している。`,
      scene: p.isPitcher ? 'pitcher' : 'homer', tids: [], pids: [], big: star.text.replace('大会', ''),
    });
  }
}

/** その日のアマチュア行事を進める */
function amateurDay(w: World, date: string) {
  const am = w.amateur;
  const y = Number(date.slice(0, 4));
  const md = date.slice(5);
  const rng = new Rng(hashSeed(w.seed, strHash(date), 31));
  if (md === '03-19') startSenbatsu(w, y, rng);
  if (md === '04-01') {
    amateurGrowth(am, rng, false);
    newSchoolYear(am, rng, y, () => w.nextPlayerId++);
    for (const p of Object.values(am.players)) p.hype = Math.round(Math.max(baseHype(p), p.hype * 0.6));
    am.norm = undefined;
    // 古い都道府県大会は削除（容量節約）
    for (const id of Object.keys(am.tourneys)) {
      const t = am.tourneys[id];
      if (t.year <= y - 1 && t.level !== 'national') delete am.tourneys[id];
      else if (t.year <= y - 1 && t.leaders) {
        // 全国大会の個人成績は上位だけ残す
        const keep = new Set([...Object.entries(t.leaders).sort((a, b) => b[1][2] - a[1][2]).slice(0, 10), ...Object.entries(t.leaders).sort((a, b) => b[1][4] - a[1][4]).slice(0, 10), ...Object.entries(t.leaders).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10), ...Object.entries(t.leaders).sort((a, b) => b[1][3] - a[1][3]).slice(0, 10)].map((x) => x[0]));
        for (const k of Object.keys(t.leaders)) if (!keep.has(k)) delete t.leaders[Number(k)];
        delete t.bracket;
      }
    }
  }
  if (md === '04-08') startUniLeagues(w, y, 'spring');
  if (md === '06-01') startUniChamp(w, y, rng);
  if (md === '07-01') startSummer(w, y, rng);
  if (md === '08-01') startKoshien(w, y, rng);
  if (md === '08-25') {
    for (const p of Object.values(am.players)) if (p.stage === 'HS' && p.grade === 3) p.retiredFromClub = true;
    amateurGrowth(am, rng, true);
    am.norm = undefined;
  }
  if (md === '09-01') { startFall(w, y, rng); startUniLeagues(w, y, 'fall'); }
  if (md === '10-01') { shibouDecisions(w); startRegionals(w, y, rng); }
  if (md === '11-10') startJingu(w, y, rng);
  if (md === '01-24') selectSenbatsu(w, y - 1, rng);
  // 今日の試合
  for (const t of Object.values(am.tourneys)) {
    if (t.done || (t.year !== y && t.year !== y - 1)) continue;
    const wasDone = t.done;
    const fn = player(w, t, parkFor(t), keyFor(t), hypeFor(t));
    if (t.level === 'league') playLeagueDay(t, date, fn);
    else playTourneyDay(t, date, fn);
    if (!wasDone && t.done) finishTourney(w, t);
  }
  if (weekday(date) === 1) weeklyScouting(w, rng);
  prunePitchLog(am, date);
}

/** lastTick の翌日から toDate までを進める */
export function amateurTick(w: World, toDate: string) {
  const am = w.amateur;
  if (!am) return;
  let x = addDays(am.lastTick, 1);
  let guard = 0;
  while (x <= toDate && guard++ < 800) {
    amateurDay(w, x);
    am.lastTick = x;
    x = addDays(x, 1);
  }
}

export const tourneyKey = keyFor;
export { SPLIT_NAMES };
export type { RegionKey };
