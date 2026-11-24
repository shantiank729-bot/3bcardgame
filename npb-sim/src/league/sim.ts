import { addLine, addField, emptyBat, emptyField, emptyPitch } from '../engine/box';
import { GameSim, simulateGame, type GameResult, type PAObserver } from '../engine/game';
import type { TeamGameInput } from '../engine/types';
import { Rng } from '../engine/rng';
import { dayDiff, addDays, weekday } from './calendar';
import { finalizeDraft, startDraft } from './draft';
import { computeNorm } from './norm';
import { draftClassFromAmateur, removeDrafted } from '../amateur/draftSupply';
import { amateurTick } from '../amateur/season';
import { scoutedOverall } from '../amateur/scout';
import { addServiceDay, dailyInjuries, inbox, weeklyAiMoves } from './rosterOps';
import { aiTrades } from './trade';
import { startOffseason } from './offseason';
import { shortName } from '../news/text';
import { applySeriesResult, postseasonDone, postseasonGamesOn, seriesStatus, setupPostseason, type Series } from './postseason';
import { gameHero, playAllStarGame } from './allstar';
import { regularSeasonAwards } from './awards';
import { addStory, snapshot, writeDailyNews, type Played } from '../news/daily';
import { LEAGUE_NAMES } from './teams';
import { assignBullpen, autoLineup } from './roster';
import type { LeagueId } from './teams';
import { rosterOf, teamById, type GameKind, type GameSummary, type PlayerSeason, type RunEnvAcc, type World } from './world';

export function dayIndex(w: World, date = w.date) {
  return dayDiff(w.calendar.opening, date);
}

function hashSeed(...xs: number[]) {
  let h = 2166136261;
  for (const x of xs) {
    h ^= x;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** その日の先発を決める（中6日ローテ） */
export function chooseStarter(w: World, tid: number, today: number): number {
  const ts = w.teamState[tid];
  const rot = ts.rotation.filter((id) => w.players[id]?.teamId === tid && w.players[id].status === 'active');
  if (rot.length === 0) {
    const any = rosterOf(w, tid, 'active').filter((p) => p.isPitcher);
    return any[0].id;
  }
  for (let k = 0; k < rot.length; k++) {
    const i = (ts.rotIdx + k) % rot.length;
    const last = ts.lastStart[rot[i]];
    if (last === undefined || today - last >= 6) return rot[i];
  }
  // 中5日以下しかいなければ最も間隔が空いた投手
  return [...rot].sort((a, b) => (ts.lastStart[a] ?? -99) - (ts.lastStart[b] ?? -99))[0];
}

export function buildTeamInput(w: World, tid: number, today: number, dh: boolean, vsHand?: 'L' | 'R', starter?: number): TeamGameInput {
  const ts = w.teamState[tid];
  const team = teamById(w, tid);
  const active = rosterOf(w, tid, 'active');
  const sp = starter ?? chooseStarter(w, tid, today);
  const hitters = active.filter((p) => !p.isPitcher);
  let lineup = autoLineup(hitters, dh, vsHand, sp);
  if (ts.manualOrder && tid === w.userTeamId) {
    const valid = ts.manualOrder.every((s) => s.pos === 'P' || active.some((p) => p.id === s.playerId));
    const hasDH = ts.manualOrder.some((s) => s.pos === 'DH');
    if (valid && hasDH === dh) {
      const order = ts.manualOrder.map((s) => (s.pos === 'P' ? { playerId: sp, pos: 'P' as const } : { playerId: s.playerId, pos: s.pos as never }));
      const inOrder = new Set(order.map((o) => o.playerId));
      lineup = { order, bench: hitters.filter((p) => !inOrder.has(p.id)).map((p) => p.id) };
    }
  }
  const rotSet = new Set(ts.rotation);
  const relievers = active.filter((p) => p.isPitcher && !rotSet.has(p.id) && p.id !== sp);
  const availability = new Map(
    active.filter((p) => p.isPitcher).map((p) => [p.id, { recent: [1, 2, 3].map((d) => ts.pitchLog[p.id]?.[today - d] ?? 0) }]),
  );
  return {
    teamId: tid,
    name: team.nickname,
    players: new Map(active.map((p) => [p.id, p])),
    lineup: { order: lineup.order, startingPitcher: sp, bench: lineup.bench, bullpen: assignBullpen(relievers) },
    availability,
    smallBall: team.smallBall,
  };
}

/** RE24・線形加重の集計用オブザーバ */
export function runEnvObserver(acc: RunEnvAcc): PAObserver {
  return {
    onPA(code, ob, bb, oa, ba, runs) {
      let e = acc.ev[code];
      if (!e) acc.ev[code] = e = { before: Array(24).fill(0), after: Array(25).fill(0), runs: 0, n: 0 };
      e.before[ob * 8 + bb]++;
      e.after[oa >= 3 ? 24 : oa * 8 + ba]++;
      e.runs += runs;
      e.n++;
    },
    onHalfInning(states) {
      for (const s of states) {
        const i = s.outs * 8 + s.bases;
        acc.reCount[i]++;
        acc.reRuns[i] += s.runsToEnd;
      }
    },
  };
}

function seasonEntry(store: Record<string, PlayerSeason>, pid: number, tid: number) {
  const k = `${pid}-${tid}`;
  let e = store[k];
  if (!e) store[k] = e = { pid, tid, bat: null, pitch: null, field: null };
  return e;
}

/** 試合結果を成績・順位に反映する */
export interface RecordOpts {
  /** 個人成績の記録先（ポストシーズンは別） */
  store?: Record<string, PlayerSeason>;
  /** 球場・得点環境（パークファクター）に含めるか */
  park?: boolean;
  /** 疲労・ローテの記録をするか（オールスターはしない） */
  fatigue?: boolean;
  label?: string;
  parkName?: string;
}

export function recordGame(w: World, g: { id: number; date: string; away: number; home: number; kind: GameKind }, res: GameResult, today: number, opts: RecordOpts = {}) {
  const store = opts.store ?? w.season;
  const homeIds = new Set(res.appeared.get(g.home) ?? []);
  const tidOf = (pid: number) => (homeIds.has(pid) ? g.home : g.away);
  for (const [pid, l] of res.bat) {
    const e = seasonEntry(store, pid, tidOf(pid));
    e.bat = addLine(e.bat ?? emptyBat(), l);
  }
  for (const [pid, l] of res.pitch) {
    const e = seasonEntry(store, pid, tidOf(pid));
    e.pitch = addLine(e.pitch ?? emptyPitch(), l);
  }
  for (const [pid, l] of res.field) {
    const e = seasonEntry(store, pid, tidOf(pid));
    e.field = addField(e.field ?? emptyField(), l);
  }
  if (opts.fatigue !== false) {
    for (const [pid, n] of res.pitchCounts) {
      const ts = w.teamState[w.players[pid]?.teamId ?? tidOf(pid)];
      if (ts) (ts.pitchLog[pid] ??= {})[today] = n;
    }
    for (const [tid, sp] of [[g.away, res.startersAway], [g.home, res.startersHome]] as const) {
      const ts = w.teamState[tid];
      if (!ts) continue;
      ts.lastStart[sp] = today;
      const i = ts.rotation.indexOf(sp);
      if (i >= 0) ts.rotIdx = (i + 1) % ts.rotation.length;
    }
  }
  // 球場（パークファクター用）
  let hrAway = 0, hrHome = 0;
  const hrs: { pid: number; tid: number; n: number }[] = [];
  for (const [pid, l] of res.bat) if (l.hr) {
    hrs.push({ pid, tid: tidOf(pid), n: l.hr });
    if (tidOf(pid) === g.home) hrHome += l.hr;
    else hrAway += l.hr;
  }
  if (opts.park !== false) {
    const ph = w.park[g.home];
    ph.homeGames++;
    ph.homeRuns += res.awayRuns + res.homeRuns;
    ph.homeHR += hrAway + hrHome;
    const pa = w.park[g.away];
    pa.awayGames++;
    pa.awayRuns += res.awayRuns + res.homeRuns;
    pa.awayHR += hrAway + hrHome;
  }

  const POS_CODE: Record<string, number> = { P: 1, C: 2, '1B': 3, '2B': 4, '3B': 5, SS: 6, LF: 7, CF: 8, RF: 9, DH: 10 };
  const order: [number[], number[]] = [res.appearancesAway.map((a) => a.pid), res.appearancesHome.map((a) => a.pid)];
  const boxBat: number[][] = [];
  for (const [list, tid] of [[res.appearancesAway, g.away], [res.appearancesHome, g.home]] as const) {
    const sorted = [...list].map((a, i) => ({ ...a, i })).sort((x, y) => x.slot - y.slot || x.i - y.i);
    for (const a of sorted) {
      const l = res.bat.get(a.pid);
      if (!l) continue;
      // 列: pid, tid, 守備位置コード(+100で途中出場), 打順, 打数, 得点, 安打, 打点, 四死球, 三振, 本塁打
      boxBat.push([a.pid, tid, POS_CODE[a.pos] + (a.sub ? 100 : 0), a.slot + 1, l.ab, l.r, l.h, l.rbi, l.bb + l.hbp, l.k, l.hr]);
    }
  }
  const boxPitch: number[][] = [];
  for (const [pid, l] of res.pitch) boxPitch.push([pid, tidOf(pid), l.outs, l.h, l.r, l.er, l.bb + l.hbp, l.k, l.pitches, l.hr]);
  const summary: GameSummary = {
    id: g.id, date: g.date, away: g.away, home: g.home, kind: g.kind, awayRuns: res.awayRuns, homeRuns: res.homeRuns,
    innings: res.innings, tie: res.tie, lineAway: res.lineAway, lineHome: res.lineHome,
    hits: [res.hitsAway, res.hitsHome], errors: [res.errorsAway, res.errorsHome],
    wp: res.winningPitcher, lp: res.losingPitcher, sv: res.savePitcher, sp: [res.startersAway, res.startersHome],
    hr: hrs, walkoff: res.walkoff, boxBat, boxPitch, order, label: opts.label, parkName: opts.parkName,
  };
  w.results[g.id] = summary;
  return summary;
}

/** 調子の波（毎日少しずつ変わる） */
function updateForm(w: World, rng: Rng) {
  for (const p of Object.values(w.players)) {
    if (p.status !== 'active') continue;
    const f = (p.form ?? 0) * 0.92 + rng.normal(0, 0.09);
    p.form = Math.max(-1, Math.min(1, f));
  }
}


export interface ScheduledGame {
  id: number;
  date: string;
  away: number;
  home: number;
  kind: GameKind;
  label?: string;
  seriesId?: Series['id'];
  maxInnings: number | null;
}

/** レギュラーシーズン・ポストシーズンを通して、その日に予定されている試合 */
export function scheduledOn(w: World, date: string): ScheduledGame[] {
  if (w.phase === 'regular') {
    return w.calendar.games.filter((g) => g.date === date && !w.results[g.id]).map((g) => ({ ...g, maxInnings: 12 }));
  }
  if (w.phase === 'postseason') {
    return postseasonGamesOn(w, date).map(({ s, g }) => ({
      id: g.id, date: g.date, away: g.away, home: g.home, kind: s.kind, label: `第${g.no}戦`, seriesId: s.id,
      maxInnings: s.kind === 'JS' && g.no >= 8 ? null : 12,
    }));
  }
  return [];
}

export function findScheduled(w: World, id: number): ScheduledGame | null {
  return scheduledOn(w, w.date).find((g) => g.id === id) ?? null;
}

/** リーグ基準補正（なければ計算、月初に更新） */
export function leagueNorm(w: World) {
  if (!w.norm || w.date.endsWith('-01')) w.norm = computeNorm(w);
  return w.norm;
}

/** その日の自チームの試合（未消化）*/
export function userGameToday(w: World) {
  return scheduledOn(w, w.date).find((g) => g.away === w.userTeamId || g.home === w.userTeamId) ?? null;
}

/** 観戦用に試合を準備する（自チームは手動采配が可能） */
export function prepareLiveGame(w: World, gameId: number): GameSim {
  const g = findScheduled(w, gameId)!;
  const sim = new GameSim(...gameInputs(w, g), { dh: dhFor(w, g), seed: hashSeed(w.seed, w.year, g.id, 991), log: true, maxInnings: g.maxInnings, norm: leagueNorm(w) });
  if (g.kind === 'L' || g.kind === 'I') sim.observer = runEnvObserver(w.runEnv[teamById(w, g.home).league]);
  sim.manualTeam = w.userTeamId;
  return sim;
}

const dhFor = (w: World, g: ScheduledGame) => w.settings.dh[teamById(w, g.home).league as LeagueId];

function gameInputs(w: World, g: ScheduledGame): [TeamGameInput, TeamGameInput, import('../engine/types').Park] {
  const today = dayIndex(w, g.date);
  const dh = dhFor(w, g);
  const awaySP = chooseStarter(w, g.away, today);
  const homeSP = chooseStarter(w, g.home, today);
  const ai = buildTeamInput(w, g.away, today, dh, w.players[homeSP].throws, awaySP);
  const hi = buildTeamInput(w, g.home, today, dh, w.players[awaySP].throws, homeSP);
  return [ai, hi, teamById(w, g.home).park];
}

/** 試合結果を記録し、ポストシーズンならシリーズも進める */
export function applyResult(w: World, g: ScheduledGame, res: GameResult): Played {
  const today = dayIndex(w, g.date);
  const post = g.kind === 'CS1' || g.kind === 'CS2' || g.kind === 'JS';
  const summary = recordGame(w, g, res, today, post ? { store: w.postStats, park: false, label: g.label } : {});
  if (!post) return { summary, res, kind: g.kind };
  const s = w.post!.series.find((x) => x.id === g.seriesId)!;
  applySeriesResult(w, s, g.id, res.homeRuns, res.awayRuns);
  // 勝ったチームから見た対戦成績（アドバンテージ込み）
  const winTid = res.homeRuns > res.awayRuns ? g.home : res.awayRuns > res.homeRuns ? g.away : s.high;
  const [a, b] = winTid === s.high ? s.wins : [s.wins[1], s.wins[0]];
  const view = `${a}勝${b}敗${s.ties ? s.ties + '分' : ''}${s.advantage && winTid === s.high ? '（アドバンテージ1勝含む）' : ''}`;
  void seriesStatus;
  const played: Played = { summary, res, kind: g.kind, seriesName: s.name, seriesStatus: view };
  if (s.winner) seriesWonStory(w, s, g.date);
  return played;
}

/** シリーズの最優秀選手（勝ったチームで貢献点が最大） */
function seriesMvp(w: World, s: Series): number | null {
  const pts = new Map<number, number>();
  for (const sg of s.games) {
    const sm = w.results[sg.id];
    if (!sm) continue;
    for (const r of sm.boxBat) if (r[1] === s.winner) pts.set(r[0], (pts.get(r[0]) ?? 0) + r[6] + r[10] * 3 + r[7] * 1.2 + r[8] * 0.3);
    for (const r of sm.boxPitch) if (r[1] === s.winner) pts.set(r[0], (pts.get(r[0]) ?? 0) + (r[2] / 3) * 0.8 + r[7] * 0.3 - r[5] * 1.2);
  }
  return [...pts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function seriesWonStory(w: World, s: Series, date: string) {
  const t = teamById(w, s.winner!);
  const loser = teamById(w, s.winner === s.high ? s.low : s.high);
  const mvp = seriesMvp(w, s);
  const aw = w.awards[w.year];
  if (aw) {
    if (s.kind === 'CS2') aw.csMvp[s.league!] = mvp;
    if (s.kind === 'JS') { aw.jsMvp = mvp; aw.champion = s.winner; }
  }
  const mv = mvp ? `シリーズMVPは${w.players[mvp].name}。` : '';
  const st = `${s.wins[0]}勝${s.wins[1]}敗${s.ties ? s.ties + '分' : ''}`;
  if (s.kind === 'JS') {
    addStory(w, date, {
      id: `jswin-${w.year}`, score: 140 + (s.winner === w.userTeamId ? 10 : 0), kind: 'jsWin',
      headline: [`${t.nickname} 日本一！`, `${t.nickname} ${w.year}年日本一 歓喜の胴上げ`, `頂点！${t.nickname}が日本一`][w.year % 3],
      sub: `日本シリーズ ${t.nickname}が${loser.nickname}を下す`,
      body: `日本シリーズは${t.city}${t.nickname}が${loser.city}${loser.nickname}を破り、${w.year}年の日本一に輝いた。対戦成績は${s.winner === s.high ? st : `${s.wins[1]}勝${s.wins[0]}敗${s.ties ? s.ties + '分' : ''}`}。${mv}`,
      scene: 'doage', tids: [t.id, loser.id], pids: mvp ? [mvp] : [], big: '日本一',
    });
  } else if (s.kind === 'CS2') {
    addStory(w, date, {
      id: `cs2-${s.league}-${w.year}`, score: 115 + (s.winner === w.userTeamId ? 10 : 0), kind: 'csWin',
      headline: [`${t.nickname} 日本シリーズ進出！`, `${t.nickname} CS突破 頂上決戦へ`][w.year % 2],
      sub: `CSファイナルステージ ${t.nickname} ${st}`,
      body: `${LEAGUE_NAMES[s.league!]}のクライマックスシリーズ・ファイナルステージは${t.city}${t.nickname}が${loser.nickname}を退け、日本シリーズ進出を決めた（アドバンテージ1勝を含む対戦成績は上位球団から見て${st}）。${mv}`,
      scene: 'champion', tids: [t.id], pids: mvp ? [mvp] : [], big: 'CS突破',
    });
  } else {
    addStory(w, date, {
      id: `cs1-${s.league}-${w.year}`, score: 95 + (s.winner === w.userTeamId ? 10 : 0), kind: 'cs1Win',
      headline: `${t.nickname} ファイナルステージへ`, sub: `CSファーストステージ ${LEAGUE_NAMES[s.league!]}`,
      body: `${LEAGUE_NAMES[s.league!]}のクライマックスシリーズ・ファーストステージは${t.city}${t.nickname}が勝ち抜けた。`,
      scene: 'crowd', tids: [t.id], pids: [],
    });
  }
}

/** 観戦した試合を記録する */
export function recordLiveGame(w: World, gameId: number, sim: GameSim) {
  const g = findScheduled(w, gameId)!;
  const p = applyResult(w, g, sim.result());
  (w as World & { _livePlayed?: Played[] })._livePlayed = [p];
  return p.summary;
}

export const isInSeason = (w: World) => w.phase === 'regular' || w.phase === 'postseason';

function playAllStarDay(w: World, date: string): Played[] {
  const no = w.calendar.allStar.indexOf(date) + 1;
  if (no <= 0) return [];
  const { res, parkTeam, away, home } = playAllStarGame(w, no, date, hashSeed(w.seed, w.year, 90000 + no));
  const id = 90000 + (w.year % 100) * 10 + no;
  const summary = recordGame(w, { id, date, away, home, kind: 'AS' }, res, dayIndex(w, date), { store: {}, park: false, fatigue: false, label: `第${no}戦`, parkName: parkTeam.park.name });
  w.allStar!.games.push(summary);
  w.allStar!.mvp.push(gameHero(res));
  return [{ summary, res, kind: 'AS' }];
}

/** 表彰などを選手の経歴に残す */
function endOfSeasonEvents(w: World) {
  const a = w.awards[w.year];
  if (!a) return;
  const ev = (pid: number | null, text: string) => pid && w.players[pid]?.events.push({ year: w.year, text });
  for (const lg of ['C', 'P'] as const) {
    ev(a.mvp[lg], `${LEAGUE_NAMES[lg]}MVP`);
    ev(a.roy[lg], `${LEAGUE_NAMES[lg]}新人王`);
    for (const t of a.titles[lg]) ev(t.pid, `${t.title}（${t.value}）`);
    for (const b of a.bestNine[lg]) ev(b.pid, 'ベストナイン');
    for (const g of a.goldenGlove[lg]) ev(g.pid, 'ゴールデングラブ賞');
  }
  ev(a.ace, '金剛賞（最優秀先発投手）');
  ev(a.jsMvp, '日本シリーズMVP');
  if (a.champion) for (const p of Object.values(w.players)) if (p.teamId === a.champion && p.status === 'active') p.events.push({ year: w.year, text: '日本一' });
}

function endRegularSeason(w: World, date: string) {
  w.awards[w.year] = regularSeasonAwards(w);
  w.post = setupPostseason(w);
  w.phase = 'postseason';
  const a = w.awards[w.year];
  const titles = (['C', 'P'] as const).map((lg) => a.titles[lg].filter((t) => ['首位打者', '本塁打王', '最優秀防御率'].includes(t.title)).map((t) => `${t.title}は${w.players[t.pid].name}（${t.value}）`).join('、')).join('。');
  addStory(w, date, {
    id: `titles-${w.year}`, score: 40, kind: 'titles', headline: `${w.year}年 タイトル確定`, sub: 'レギュラーシーズン全日程終了',
    body: `レギュラーシーズンの全日程が終了し、個人タイトルが確定した。${titles}。`, scene: 'award', tids: [], pids: [],
  });
}

export interface DayReport {
  date: string;
  games: GameSummary[];
  seasonOver: boolean;
  /** ユーザーの操作待ちで止まった（ドラフト会議など） */
  blocked?: 'draft';
}

/** 今日がドラフト会議でまだ終わっていないか */
export function draftPending(w: World) {
  return w.phase === 'postseason' && !!w.post?.draftDate && w.date === w.post.draftDate && (!w.draft || w.draft.stage !== 'done' || !w.flags[`draft-${w.year}`]);
}

/** ドラフトを確定し、新聞に載せる */
export function completeDraft(w: World) {
  const d = w.draft!;
  if (w.flags[`draft-${w.year}`]) return;
  finalizeDraft(w, d);
  removeDrafted(w, d.picks.map((p) => p.pid));
  w.flags[`draft-${w.year}`] = true;
  const byId = new Map(d.prospects.map((p) => [p.id, p]));
  const hot = [...d.lotteries].sort((a, b) => b.bidders.length - a.bidders.length)[0];
  const ones = d.picks.filter((p) => p.round === 1);
  const desc = ones.map((p) => `${teamById(w, p.tid).short}=${byId.get(p.pid)!.player.name}（${byId.get(p.pid)!.school}）`).join('、');
  const hp = hot ? byId.get(hot.pid)! : null;
  addStory(w, w.date, {
    id: `draft-${w.year}`, score: 65, kind: 'draft',
    headline: hp ? `${shortName(hp.player.name)}に${hot!.bidders.length}球団競合 ${teamById(w, hot!.winner).nickname}が交渉権` : `${w.year}年ドラフト 12球団の1位決まる`,
    sub: `${w.year}年ドラフト会議`,
    body: `${w.year}年のドラフト会議が行われた。${hp && hp.note ? `目玉の${hp.player.name}（${hp.school}）は「${hp.note}」の実績を持つ。` : ''}1位指名は${desc}。${d.lotteries.length ? `抽選は${d.lotteries.length}回行われた。` : ''}支配下${d.picks.filter((p) => !p.ikusei).length}人、育成${d.picks.filter((p) => p.ikusei).length}人が指名された。`,
    scene: 'draft', tids: hot ? [hot.winner] : [], pids: hp ? [hp.id] : [],
  });
  const mine = d.picks.filter((p) => p.tid === w.userTeamId);
  if (mine.length) inbox(w, `ドラフトで${mine.map((p) => `${p.label} ${byId.get(p.pid)!.player.name}`).join('、')}を指名しました`, 'roster');
}

/** 現在の日付の試合をすべて行い、日付を1日進める */
export function simulateDay(w: World): DayReport {
  const date = w.date;
  const today = dayIndex(w);
  if (!isInSeason(w)) return { date, games: [], seasonOver: true };
  if (draftPending(w)) {
    if (!w.draft) {
      w.draft = startDraft(w, date, () => draftClassFromAmateur(w));
      // ユーザー球団の見立てはスカウトの視察結果に基づく
      for (const p of w.draft.prospects) {
        const a = w.amateur.players[p.id];
        if (!a) continue;
        const v = scoutedOverall(w, a);
        const wPot = p.kind === 'HS' ? 0.7 : p.kind === 'COL' ? 0.55 : 0.4;
        w.draft.views[w.userTeamId][p.id] = v.pot * wPot + v.ovr * (1 - wPot) + p.hype * 0.05;
      }
    }
    return { date, games: [], seasonOver: false, blocked: 'draft' };
  }
  const before = snapshot(w);
  const rng = new Rng(hashSeed(w.seed, w.year, today, 77));
  const live = (w as World & { _livePlayed?: Played[] })._livePlayed ?? [];
  delete (w as World & { _livePlayed?: Played[] })._livePlayed;
  const played: Played[] = [...live];
  if (w.phase === 'regular') played.push(...playAllStarDay(w, date));
  for (const g of scheduledOn(w, date)) {
    const [ai, hi, park] = gameInputs(w, g);
    const obs = g.kind === 'L' || g.kind === 'I' ? runEnvObserver(w.runEnv[teamById(w, g.home).league]) : undefined;
    const res = simulateGame(ai, hi, park, { dh: dhFor(w, g), seed: hashSeed(w.seed, w.year, g.id), log: true, maxInnings: g.maxInnings, norm: leagueNorm(w) }, obs);
    played.push(applyResult(w, g, res));
  }
  updateForm(w, rng);
  dailyInjuries(w, rng, played.flatMap((p) => [...p.res.appeared.values()].flat()), today);
  if (w.phase === 'regular') {
    addServiceDay(w);
    if (weekday(date) === 1) weeklyAiMoves(w, today);
    if (date.slice(5) === '07-15') aiTrades(w, rng, 20);
  }
  // 古い登板記録を整理
  for (const ts of Object.values(w.teamState)) for (const pid in ts.pitchLog) {
    for (const d in ts.pitchLog[pid]) if (Number(d) < today - 7) delete ts.pitchLog[pid][d];
  }
  amateurTick(w, date);
  writeDailyNews(w, date, played, before);
  let seasonOver = false;
  if (w.phase === 'regular' && date >= w.calendar.lastDay) {
    endRegularSeason(w, date);
  } else if (w.phase === 'postseason' && postseasonDone(w)) {
    w.phase = 'offseason';
    seasonOver = true;
    endOfSeasonEvents(w);
    const a = w.awards[w.year];
    if (a) {
      const nm = (id: number | null) => (id ? `${w.players[id].name}（${teamById(w, w.players[id].teamId!).nickname}）` : '該当者なし');
      addStory(w, date, {
        id: `mvp-${w.year}`, score: 70, kind: 'award', headline: `MVPは${a.mvp.C ? w.players[a.mvp.C].name.split(' ')[0].split('・').pop() : '-'}と${a.mvp.P ? w.players[a.mvp.P].name.split(' ')[0].split('・').pop() : '-'}`,
        sub: `${w.year}年 最優秀選手・新人王`,
        body: `${w.year}年の最優秀選手（MVP）はセ・リーグが${nm(a.mvp.C)}、パ・リーグが${nm(a.mvp.P)}に決まった。新人王はセ・リーグが${nm(a.roy.C)}、パ・リーグが${nm(a.roy.P)}。最優秀先発投手の金剛賞は${nm(a.ace)}。`,
        scene: 'award', tids: [], pids: [a.mvp.C, a.mvp.P].filter((x): x is number => !!x),
      });
    }
  }
  if (!seasonOver) w.date = addDays(date, 1);
  else startOffseason(w);
  return { date, games: played.map((p) => p.summary), seasonOver };
}

/** 指定日まで（その日を含む）進める */
export function simulateUntil(w: World, until: string, onDay?: (r: DayReport) => void) {
  while (isInSeason(w) && w.date <= until) {
    const r = simulateDay(w);
    onDay?.(r);
    if (r.seasonOver || r.blocked) break;
  }
}
