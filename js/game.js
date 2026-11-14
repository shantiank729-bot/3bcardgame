'use strict';
// ===== ゲーム進行と画面 =====

const SAVE_KEY = 'hakkyu-road-save-v1';
const BOARD_SIZE = 24;

let S = null;          // 保存されるゲーム状態
const UI = { screen: 'title', selCard: null, expanded: null, moving: false, starterId: null, match: null, rosterSort: 'grade', toast: null };

// ---------- 保存 ----------
function save() {
  if (!S) return;
  S.nextPid = getNextPid();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境 */ }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.v === 1 ? s : null;
  } catch (e) { return null; }
}
function deleteSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* noop */ } }

// ---------- 新規ゲーム ----------
function newGame(school) {
  setNextPid(1);
  const players = [];
  const add = (grade, base, n, forced = []) => {
    for (let i = 0; i < n; i++) players.push(makePlayer(grade, base, { pos: forced[i] }));
  };
  add(3, 34, 5, ['投', '捕', '遊', '外']);
  add(2, 29, 5, ['投', '二', '三']);
  add(1, 23, 6, ['投', '捕', '一', '外']);
  S = {
    v: 1,
    school: school || '県立白球高',
    year: 1, week: 0, rep: 8,
    pos: 0,
    board: makeBoard(),
    stars: [],
    hand: [drawCard(), drawCard(), drawCard(), drawCard(), drawCard()],
    players,
    aceId: null,
    prospects: [],
    history: [],
    totals: { w: 0, l: 0, summerApp: 0, springApp: 0, bestSummer: '', bestSpring: '', titles: [] },
    senbatsu: false,
    regQualified: false,
    tourney: null,
    report: [],
    nextPid: getNextPid(),
  };
  refreshStars();
  S.report = [
    `${S.school}野球部の監督に就任した。部員は${players.length}人。`,
    'カードを1枚選んで練習ボードを進もう。止まったマスの練習に全員で取り組む。',
    '7月の夏の県大会を勝ち抜けば全国大会だ。',
  ];
  UI.screen = 'home';
  save();
  render();
}

function refreshStars() {
  S.stars = shuffle([...Array(BOARD_SIZE).keys()]).slice(0, 3);
}

// ---------- 週の進行 ----------
const isWinter = (w) => w >= 32 && w <= 43;
const isCamp = (w) => w >= 17 && w <= 19;
const TALENT_MULT = [0, 0.75, 0.9, 1.0, 1.18, 1.4];

function autoMenu(p) {
  if (p.fatigue >= 68) return 'rest';
  if (p.pos === '投') {
    const pit = (p.velo + p.ctrl + p.brk) / 3;
    if (p.stam < pit - 6) return 'sta';
    if (p.power < 25 && chance(0.15)) return 'pow';
    return 'pit';
  }
  const opts = [['bat', p.meet], ['pow', p.power], ['run', p.speed], ['fld', (p.def + p.arm) / 2]];
  opts.sort((a, b) => a[1] - b[1]);
  return opts[0][0];
}

const GROW_MAP = {
  bat: () => ['meet'],
  pow: (p) => (p.pos === '投' ? ['power', 'velo'] : ['power']),
  run: () => ['speed'],
  fld: () => ['def', 'arm'],
  pit: () => ['velo', 'ctrl', 'brk'],
  sta: () => ['stam'],
};
function growCost(stat, v) { return (8 + v * 0.24) * (stat === 'velo' ? 1.35 : 1); }

/** 経験値を能力に変換。上がった能力の一覧を返す */
function grow(p) {
  const ups = {};
  for (const cat of Object.keys(p.exp)) {
    let guard = 0;
    while (guard++ < 20) {
      const stats = GROW_MAP[cat](p).filter((s) => p[s] < 99);
      if (!stats.length) break;
      stats.sort((a, b) => p[a] - p[b]);
      const s = stats[0];
      const c = growCost(s, p[s]);
      if (p.exp[cat] < c) break;
      p.exp[cat] -= c;
      p[s]++;
      ups[s] = (ups[s] || 0) + 1;
    }
  }
  return ups;
}

function giveExp(p, cat, amt) {
  if (cat === 'pit' && p.pos !== '投') return;
  p.exp[cat] = (p.exp[cat] || 0) + amt;
}

function practiceWeek(sq, card, mult) {
  const season = isWinter(S.week) ? 1.2 : isCamp(S.week) && !S.tourney ? 1.3 : 1;
  const msgs = [];
  const bigUps = [];
  for (const p of S.players) {
    if (p.injury > 0) {
      p.injury--;
      p.fatigue = Math.max(0, p.fatigue - 12);
      if (p.injury === 0) msgs.push(`${p.name}がケガから復帰した。`);
      continue;
    }
    const tm = TALENT_MULT[p.talent] * season;
    const menu = p.menu === 'auto' ? autoMenu(p) : p.menu;
    p.lastMenu = menu;
    const fatigueMul = 1.25 - p.stam / 220;
    if (menu === 'rest') {
      p.fatigue = Math.max(0, p.fatigue - 35);
    } else {
      giveExp(p, menu, 20 * tm);
      p.fatigue = clamp(p.fatigue + (menu === 'pow' || menu === 'sta' ? 11 : 8) * fatigueMul, 0, 100);
    }
    if (GROW_MAP[sq]) {
      const amt = (menu === sq ? 10 : 5) * tm * mult;
      giveExp(p, sq, amt);
    }
    if (card.kind === 'team') for (const c of Object.keys(GROW_MAP)) giveExp(p, c, 2 * tm);
    const ups = grow(p);
    const tot = Object.values(ups).reduce((a, b) => a + b, 0);
    if (tot >= 2) bigUps.push(`${p.name.split(' ')[0]}(${Object.entries(ups).map(([k, n]) => STAT_LABEL[k] + '+' + n).join(' ')})`);
    // ケガ判定
    if (p.fatigue > 62 && chance((p.fatigue - 62) * 0.009)) {
      p.injury = ri(1, 4);
      p.fatigue = 40;
      msgs.push(`⚠ ${p.name}が練習中にケガをした（${p.injury}週間）`);
    }
  }
  if (sq === 'rest') {
    for (const p of S.players) p.fatigue = Math.max(0, p.fatigue - 25 * mult);
  }
  if (bigUps.length) msgs.unshift('成長: ' + bigUps.slice(0, 6).join('、') + (bigUps.length > 6 ? ` ほか${bigUps.length - 6}人` : ''));
  if (season > 1) msgs.unshift(isWinter(S.week) ? '冬の強化期間：練習効率アップ' : '夏合宿：練習効率アップ');
  return msgs;
}

// ---------- イベント ----------
const EVENTS = [
  () => { for (const p of S.players) p.fatigue = Math.max(0, p.fatigue - 15); return 'OBから差し入れが届いた！ 部員全員の疲労が少し回復した。'; },
  () => {
    const p = pick(S.players.filter((x) => x.injury === 0));
    if (!p) return null;
    const cat = p.pos === '投' ? 'pit' : pick(['bat', 'pow', 'run', 'fld']);
    giveExp(p, cat, 30); grow(p);
    return `${p.name}が居残りで自主練習。${MENUS[cat].label}の経験値が大きく増えた。`;
  },
  () => {
    const c = S.players.filter((x) => x.talent >= 3 && x.injury === 0);
    if (!c.length) return null;
    const p = pick(c);
    const stats = p.pos === '投' ? PIT_STATS : BAT_STATS;
    const s = pick(stats);
    const n = ri(3, 6);
    p[s] = clamp(p[s] + n, 1, 99);
    return `${p.name}が何かをつかんだ！ ${STAT_LABEL[s]}が${n}上がった。`;
  },
  () => { S.rep = clamp(S.rep + 2, 0, 100); return '地元の新聞に練習風景が載った。評判が上がった。'; },
  () => { for (const p of S.players) giveExp(p, 'bat', 4); return '近所のバッティングセンターと提携。全員の打撃経験値アップ。'; },
  () => {
    const pits = S.players.filter((x) => x.pos === '投' && x.injury === 0);
    if (!pits.length) return null;
    const p = pick(pits);
    p.brk = clamp(p.brk + 4, 1, 99);
    return `${p.name}が新しい変化球を練習中。変化球が4上がった。`;
  },
  () => {
    const p = pick(S.players);
    if (!p || p.injury) return null;
    if (chance(0.5)) return '雨で練習は室内トレーニングに。特に何も起きなかった。';
    p.injury = 1;
    return `${p.name}が体育の授業で足をひねった。1週間練習を休む。`;
  },
  () => { for (const p of S.players) p.fatigue = clamp(p.fatigue + 8, 0, 100); for (const p of S.players) giveExp(p, 'sta', 6); return '鬼の階段ダッシュ！ 体力経験値が増えたが、全員少し疲れた。'; },
  () => {
    if (S.players.length >= 22) return null;
    const p = makePlayer(1, 20 + S.rep * 0.15, { talentBonus: 0.1 });
    S.players.push(p);
    return `入部希望者が現れた！ ${POS_NAME[p.pos]}の${p.name}（${p.grade}年）が加入。`;
  },
];
function runEvent() {
  for (let i = 0; i < 6; i++) {
    const m = pick(EVENTS)();
    if (m) return m;
  }
  return '特に何も起きなかった。';
}

// ---------- マス効果 ----------
function resolveSquare(card) {
  const sq = S.board[S.pos];
  const star = S.stars.includes(S.pos);
  const mult = (card.kind === 'double' ? 2 : 1) * (star ? 1.5 : 1);
  const msgs = [];
  const info = SQUARE_TYPES[sq];
  msgs.push(`【${info.label}】マスに止まった${star ? '（★ボーナス）' : ''}${card.kind === 'double' ? '（×2カード）' : ''}。`);
  if (sq === 'event') msgs.push(runEvent());
  if (sq === 'rep') { const n = Math.round(3 * mult); S.rep = clamp(S.rep + n, 0, 100); msgs.push(`地域の少年野球教室を手伝った。評判 +${n}`); }
  if (sq === 'scout') msgs.push(scoutProspect(mult));
  if (sq === 'game') msgs.push(...practiceGame());
  msgs.push(...practiceWeek(sq, card, mult));
  return msgs;
}

function scoutProspect(mult) {
  if (S.prospects.length >= 3) {
    S.rep = clamp(S.rep + 1, 0, 100);
    return '中学の試合を視察した。来年の入部予定者はもう十分だ。（評判 +1）';
  }
  const base = 26 + S.rep * 0.22 + (mult > 1 ? 4 : 0);
  const p = makePlayer(1, base, { talentBonus: 0.25 + (mult > 1 ? 0.15 : 0) });
  S.prospects.push(p);
  return `有望な中学生を発見！ ${POS_NAME[p.pos]}の${p.name}（素質${'★'.repeat(p.talent)}）が来春入部予定。`;
}

function practiceGame() {
  const mine = teamStrength(S.players);
  const opp = makeOpponent(mine + ri(-8, 6));
  const r = playAutoMatch(opp, true);
  const msgs = [`練習試合 vs ${opp.name}：${r.us}-${r.them}で${r.win ? '勝利' : r.us === r.them ? '引き分け' : '敗戦'}。`];
  for (const p of r.played) { for (const c of Object.keys(GROW_MAP)) giveExp(p, c, 3); }
  if (r.win) S.rep = clamp(S.rep + 1, 0, 100);
  return msgs;
}

// ---------- カードを使う ----------
function playCard(i) {
  if (UI.moving || !S.hand[i]) return;
  const card = S.hand[i];
  UI.moving = true;
  UI.selCard = null;
  const steps = card.v;
  let n = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    S.pos = (S.pos + 1) % BOARD_SIZE;
    n++;
    renderBoardOnly();
    if (n < steps) setTimeout(tick, reduce ? 0 : 140);
    else finishMove(i, card);
  };
  setTimeout(tick, reduce ? 0 : 60);
}

function finishMove(i, card) {
  S.hand.splice(i, 1);
  S.hand.push(drawCard());
  const msgs = resolveSquare(card);
  S.report = msgs;
  UI.moving = false;
  advanceWeek();
}

function advanceWeek() {
  S.week++;
  if (S.week >= 48) newYear();
  if (S.week % 4 === 0) refreshStars();
  checkSchedule();
  save();
  render();
}

function weekLabel(w = S.week) {
  return `${monthOf(w)}月 第${weekOfMonth(w)}週`;
}

function nextEvent() {
  const list = [
    ['summerPref', SCHEDULE.summerPref],
    ['autumnPref', SCHEDULE.autumnPref],
  ];
  if (S.regQualified) list.push(['autumnReg', SCHEDULE.autumnReg]);
  if (S.senbatsu) list.push(['springNat', SCHEDULE.springNat]);
  let best = null;
  for (const [k, w] of list) {
    const d = (w - S.week + 48) % 48;
    if (!best || d < best.d) best = { k, d };
  }
  return best;
}

function checkSchedule() {
  const w = S.week;
  const pre = [SCHEDULE.summerPref, SCHEDULE.autumnPref, S.regQualified && SCHEDULE.autumnReg, S.senbatsu && SCHEDULE.springNat];
  if (pre.includes(w + 1)) {
    for (const p of S.players) p.fatigue = Math.max(0, p.fatigue - 25);
    S.report.push('来週から大会。練習量を落として調整した（全員の疲労回復）。');
  }
  if (w === SCHEDULE.summerPref) startTourney('summerPref');
  else if (w === SCHEDULE.autumnPref) startTourney('autumnPref');
  else if (w === SCHEDULE.autumnReg && S.regQualified) startTourney('autumnReg');
  else if (w === SCHEDULE.springNat && S.senbatsu) startTourney('springNat');
  else if (w === SCHEDULE.senbatsuAnnounce) {
    S.report.push(S.senbatsu ? '🌸 春の全国大会の出場校に選ばれた！ 3月に開幕だ。' : '春の全国大会の出場校発表…今年は選ばれなかった。');
  }
}

function newYear() {
  S.week = 0;
  S.year++;
  const leaving = S.players.filter((p) => p.grade >= 3);
  S.players = S.players.filter((p) => p.grade < 3);
  for (const p of S.players) { p.grade++; p.stats = { g: 0, ab: 0, h: 0, hr: 0, rbi: 0, outs: 0, er: 0, k: 0 }; }
  S.rep = Math.round(S.rep * 0.88);
  // 新入部員
  const n = 4 + Math.floor(S.rep / 18) + ri(0, 1);
  const base = 22 + S.rep * 0.3;
  const fresh = [];
  for (let i = 0; i < n; i++) fresh.push(makePlayer(1, base + rnd(-3, 3), { talentBonus: S.rep / 300 }));
  for (const p of S.prospects) { p.grade = 1; fresh.push(p); }
  S.prospects = [];
  S.players.push(...fresh);
  // 投手・捕手が足りなければ補充
  const need = (pos, k) => { while (S.players.filter((p) => p.pos === pos).length < k) S.players.push(makePlayer(1, base, { pos })); };
  need('投', 3); need('捕', 2);
  while (S.players.length < 11) S.players.push(makePlayer(1, base));
  S.senbatsu = false;
  S.regQualified = false;
  S.report.push(`🌸 ${S.year}年目の春。新入部員${fresh.length}人が入部した。`);
  if (leaving.length) S.report.push(`${leaving.map((p) => p.name).join('、')}が卒業した。`);
  if (S.aceId && !S.players.some((p) => p.id === S.aceId)) S.aceId = null;
}

// ---------- 大会 ----------
function startTourney(key) {
  const def = TOURNEYS[key];
  const opps = [];
  for (let r = 0; r < def.rounds.length; r++) {
    opps.push(makeOpponent(def.base + def.step * r + ri(-6, 6), S.school));
  }
  S.tourney = { key, name: def.name, rounds: def.rounds, opps, round: 0, results: [], done: false, champion: false };
  S.report.push(`${def.name}が開幕！`);
  UI.screen = 'tourney';
  UI.starterId = null;
}

function oppStars(s) { return clamp(Math.round((s - 12) / 13), 1, 5); }

function userSideFor(players) {
  const chosen = UI.starterId && players.find((p) => p.id === UI.starterId && p.injury === 0);
  const starter = chosen || pickStarter(players, S.aceId);
  return makeSide(S.school, players, starter, true);
}

function startMatch() {
  const t = S.tourney;
  const opp = t.opps[t.round];
  const me = userSideFor(S.players);
  const os = makeSide(opp.name, opp.players, pickStarter(opp.players), false);
  const weHome = chance(0.5);
  const m = weHome ? new Match(os, me, { mercy: TOURNEYS[t.key].mercy }) : new Match(me, os, { mercy: TOURNEYS[t.key].mercy });
  m.me = me; m.opp = os; m.weHome = weHome;
  m.say(`${t.name} ${t.rounds[t.round]}　${m.sides[0].name}(先攻) 対 ${m.sides[1].name}(後攻)`, 'info');
  m.say(`先発：${me.pitcher.name}　対　${os.pitcher.name}`, 'info');
  UI.match = m;
  UI.screen = 'match';
  UI.showBullpen = false;
  render();
  startFlow(900);
}

/** 自動で一試合(練習試合用) */
function playAutoMatch(opp, mercy) {
  const me = userSideFor(S.players);
  const os = makeSide(opp.name, opp.players, pickStarter(opp.players), false);
  const m = chance(0.5) ? new Match(os, me, { mercy }) : new Match(me, os, { mercy });
  m.me = me; m.opp = os;
  m.simToEnd();
  applyMatchStats(m, false);
  return { us: me.runs, them: os.runs, win: m.winner() === me, played: me.order.map((o) => o.p), m };
}

function applyMatchStats(m, official) {
  const me = m.me;
  for (const o of me.order) {
    o.p.fatigue = clamp(o.p.fatigue + 5, 0, 100);
  }
  for (const [, l] of me.pitchLog) {
    l.p.fatigue = clamp(l.p.fatigue + l.pc * 0.42, 0, 100);
  }
  if (!official) return;
  const add = (p, k, n) => { p.stats[k] += n; p.career[k] += n; };
  const counted = new Set();
  for (const [, b] of m.batStats) {
    if (!S.players.includes(b.p)) continue;
    add(b.p, 'ab', b.ab); add(b.p, 'h', b.h); add(b.p, 'hr', b.hr); add(b.p, 'rbi', b.rbi);
    if (!counted.has(b.p)) { add(b.p, 'g', 1); counted.add(b.p); }
  }
  for (const [, l] of me.pitchLog) {
    add(l.p, 'outs', l.outs); add(l.p, 'er', l.er); add(l.p, 'k', l.k);
    if (!counted.has(l.p)) { add(l.p, 'g', 1); counted.add(l.p); }
  }
  for (const o of me.order) for (const c of Object.keys(GROW_MAP)) giveExp(o.p, c, 4);
  for (const o of me.order) grow(o.p);
}

function finishMatch() {
  stopFlow();
  const m = UI.match;
  const t = S.tourney;
  const win = m.winner() === m.me;
  applyMatchStats(m, true);
  t.results.push({ opp: m.opp.name, us: m.me.runs, them: m.opp.runs, win, note: m.resultNote });
  if (win) S.totals.w++; else S.totals.l++;
  // 試合間の休養
  for (const p of S.players) p.fatigue = Math.max(0, p.fatigue - 14);
  const nat = t.key === 'summerNat' || t.key === 'springNat';
  if (win) S.rep = clamp(S.rep + (nat ? 2 : 1), 0, 100);
  if (!win) t.done = true;
  else if (t.round >= t.rounds.length - 1) { t.done = true; t.champion = true; }
  else t.round++;
  UI.match = null;
  UI.starterId = null;
  UI.screen = 'tourney';
  save();
  render();
}

function resultLabel(t) {
  if (t.champion) return '優勝';
  const last = t.rounds[t.results.length - 1];
  if (!last) return '-';
  if (last === '決勝') return '準優勝';
  if (last === '準決勝') return 'ベスト4';
  if (last === '準々決勝') return 'ベスト8';
  return `${last}敗退`;
}
const RESULT_ORDER = ['1回戦敗退', '2回戦敗退', '3回戦敗退', 'ベスト8', 'ベスト4', '準優勝', '優勝'];

function closeTourney() {
  const t = S.tourney;
  const label = resultLabel(t);
  S.history.unshift({ year: S.year, name: t.name, key: t.key, label, games: t.results.map((r) => `${r.win ? '○' : '●'}${r.us}-${r.them} ${r.opp}`) });
  const msgs = [`${t.name}：${label}（${t.results.filter((r) => r.win).length}勝）`];
  const champBonus = { summerPref: 8, summerNat: 18, autumnPref: 4, autumnReg: 6, springNat: 14 };
  if (t.champion) {
    S.rep = clamp(S.rep + champBonus[t.key], 0, 100);
    S.totals.titles.push(`${S.year}年目 ${t.name}`);
  }
  const better = (a, b) => RESULT_ORDER.indexOf(a) > RESULT_ORDER.indexOf(b);
  if (t.key === 'summerNat') { S.totals.summerApp++; if (!S.totals.bestSummer || better(label, S.totals.bestSummer)) S.totals.bestSummer = label; }
  if (t.key === 'springNat') { S.totals.springApp++; if (!S.totals.bestSpring || better(label, S.totals.bestSpring)) S.totals.bestSpring = label; }
  S.tourney = null;
  UI.screen = 'home';
  // 次の段階
  if (t.key === 'summerPref' && t.champion) {
    msgs.push('🏆 県大会優勝！ 夏の全国大会への出場が決まった！');
    S.week = SCHEDULE.summerNat;
    S.report = msgs;
    startTourney('summerNat');
    save(); render();
    return;
  }
  if (t.key === 'summerPref' || t.key === 'summerNat') {
    if (t.key === 'summerNat' && t.champion) msgs.push('🏆🏆 夏の全国制覇！ 歴史に名を刻んだ！');
    msgs.push(...retireSeniors());
    if (t.key === 'summerPref') S.week = SCHEDULE.summerPref + 1;
    else S.week = SCHEDULE.summerNat + 1;
  } else if (t.key === 'autumnPref') {
    S.regQualified = t.champion || label === '準優勝';
    msgs.push(S.regQualified ? '秋季地区大会への出場が決まった！ 春の全国大会につながる大事な大会だ。' : '秋の戦いは終わった。冬の練習で力をつけよう。');
    S.week = SCHEDULE.autumnPref + 1;
  } else if (t.key === 'autumnReg') {
    S.senbatsu = t.results.filter((r) => r.win).length >= 2;
    msgs.push(S.senbatsu ? '地区大会で決勝進出！ 春の全国大会への出場が有力だ。' : '地区大会で敗退。春の全国大会は厳しそうだ。');
    S.week = SCHEDULE.autumnReg + 1;
  } else if (t.key === 'springNat') {
    if (t.champion) msgs.push('🏆 春の全国大会優勝！');
    S.week = SCHEDULE.springNat + 1;
  }
  S.report = msgs;
  save();
  render();
}

function retireSeniors() {
  const seniors = S.players.filter((p) => p.grade === 3);
  if (!seniors.length) return [];
  S.players = S.players.filter((p) => p.grade !== 3);
  if (S.aceId && !S.players.some((p) => p.id === S.aceId)) S.aceId = null;
  const msgs = [`3年生${seniors.length}人が引退した。お疲れさま、${seniors.map((p) => p.name.split(' ')[0]).join('・')}。`];
  if (S.players.length < 10) {
    while (S.players.length < 10) S.players.push(makePlayer(1, 20 + S.rep * 0.15));
    msgs.push('部員が足りないため、他の部から助っ人が入部した。');
  }
  return msgs;
}

// ---------- 試合中の操作 ----------
function userIsBatting(m) { return m.offense() === m.me; }

// 試合は基本的に自動で進み、「タイム」をかけたときだけ監督が指示を出す
UI.flow = { token: 0, paused: false, timeReq: false, timer: null };

function flowGap() { return UI.animMode === 'fast' ? 250 : UI.animMode === 'off' ? 800 : 550; }
function stopFlow() {
  UI.flow.token++;
  clearTimeout(UI.flow.timer);
  UI.flow.timer = null;
}
function startFlow(delay) {
  stopFlow();
  UI.flow.paused = false;
  UI.flow.timeReq = false;
  const token = UI.flow.token;
  UI.flow.timer = setTimeout(() => flowStep(token), delay == null ? flowGap() : delay);
}
function flowStep(token) {
  const m = UI.match;
  if (token !== UI.flow.token || !m || m.over || UI.screen !== 'match') return;
  if (UI.flow.timeReq) { pauseFlow(); return; }
  const seq = m.playSeq;
  m.autoStep();
  showPlay(m, seq, () => {
    if (token !== UI.flow.token) return;
    if (m.over) { render(); return; }
    if (UI.flow.timeReq) { pauseFlow(); return; }
    UI.flow.timer = setTimeout(() => flowStep(token), flowGap());
  });
}
function pauseFlow() {
  stopFlow();
  UI.flow.paused = true;
  UI.flow.timeReq = false;
  render();
}
/** タイムをかける。プレーの途中なら、そのプレーが終わってから止まる */
function callTime(btn) {
  if (UI.flow.paused) return;
  if (Anim.busy()) {
    UI.flow.timeReq = true;
    if (btn) { btn.textContent = 'タイム要求中…'; btn.disabled = true; }
    return;
  }
  pauseFlow();
}

function matchCmd(cmd) {
  const m = UI.match;
  if (!m || m.over) return;
  if (Anim.busy()) return;
  if (cmd === 'autoAll') { stopFlow(); m.simToEnd(); render(); return; }
  if (cmd === 'resume') { UI.showBullpen = false; startFlow(300); render(); return; }
  const seq = m.playSeq;
  UI.flow.paused = false;
  UI.showBullpen = false;
  if (userIsBatting(m)) {
    m.aiPitchingChange();
    if (cmd === 'steal') m.steal();
    else {
      const ibb = m.aiDefenseCommand();
      if (ibb) m.plateAppearance('ibb');
      else m.plateAppearance(cmd);
    }
  } else {
    if (cmd === 'ibb') m.plateAppearance('ibb');
    else {
      const ai = m.aiCommand();
      if (ai === 'steal') m.steal();
      else m.plateAppearance(ai);
    }
  }
  // 指示したプレーが終わったら自動進行に戻る
  render();
  showPlay(m, seq, () => {
    if (m.over) { render(); return; }
    if (UI.flow.timeReq) pauseFlow(); else { render(); startFlow(); }
  });
}

// ---------- アニメーション設定 ----------
const ANIM_KEY = 'hakkyu-road-anim';
UI.animMode = (() => {
  try { const v = localStorage.getItem(ANIM_KEY); if (v) return v; } catch (e) { /* noop */ }
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'normal';
})();
function setAnimMode(k) {
  UI.animMode = k;
  try { localStorage.setItem(ANIM_KEY, k); } catch (e) { /* noop */ }
  render();
}
/** 直前のプレーを再生してから画面を更新する */
function showPlay(m, prevSeq, then) {
  const done = then || (() => render());
  const lp = m.lastPlay;
  if (UI.animMode === 'off' || !lp || lp.seq === prevSeq) { render(); if (then) then(); return; }
  Anim.play(m, lp, UI.animMode === 'fast' ? 2.2 : 1, done);
}

function changeMyPitcher(id) {
  const m = UI.match;
  const p = m.me.bullpen.find((x) => x.id === id);
  if (!p) return;
  m.changePitcher(p);
  UI.showBullpen = false;
  render();
}

// ---------- 画面描画 ----------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function rankBadge(v) {
  const r = rank(v);
  return `<span class="rk rk-${r}">${r}</span>`;
}
function fatigueInfo(p) {
  if (p.injury > 0) return { cls: 'inj', label: `ケガ ${p.injury}週` };
  if (p.fatigue >= 80) return { cls: 'bad', label: '限界' };
  if (p.fatigue >= 60) return { cls: 'warn', label: '疲労' };
  if (p.fatigue >= 30) return { cls: 'ok', label: '普通' };
  return { cls: 'good', label: '好調' };
}

function render() {
  const root = $('app');
  document.body.dataset.screen = UI.screen;
  if (UI.screen === 'title') { root.innerHTML = renderTitle(); return; }
  root.innerHTML = renderHeader() + `<main class="main">${renderScreen()}</main>` + renderNav();
  if (UI.screen === 'match') {
    const lg = $('mlog');
    if (lg) lg.scrollTop = lg.scrollHeight;
    Anim.drawIdle(UI.match);
  }
}

function renderScreen() {
  switch (UI.screen) {
    case 'home': return renderHome();
    case 'roster': return renderRoster();
    case 'records': return renderRecords();
    case 'tourney': return renderTourney();
    case 'match': return renderMatch();
    default: return '';
  }
}

function renderTitle() {
  const sv = loadSave();
  return `
  <section class="title-screen">
    <div class="title-board" aria-hidden="true">
      <div class="tb-row"><span>白</span><span>球</span><span>ロ</span><span>ー</span><span>ド</span></div>
    </div>
    <h1 class="title-name">白球ロード</h1>
    <p class="title-sub">無名の高校を、3年で全国の頂点へ。<br>カードで練習を選び、部員を育て、夏を勝ち抜く高校野球監督ゲーム。</p>
    <form class="title-form" id="newForm">
      <label for="schoolName">学校名</label>
      <div class="title-input-row">
        <input id="schoolName" maxlength="12" value="県立白球高" autocomplete="off">
        <button class="btn primary" type="submit">新しく始める</button>
      </div>
      ${sv ? `<p class="warn-text" id="overwriteNote">続きのデータがあります。新しく始めると上書きされます。</p>` : ''}
    </form>
    ${sv ? `<button class="btn big" data-act="continue">続きから　<small>${esc(sv.school)}・${sv.year}年目 ${weekLabel(sv.week)}</small></button>` : ''}
    <details class="howto">
      <summary>遊び方</summary>
      <ol>
        <li>手札のカードを選ぶと、その数だけ練習ボードを進みます。止まったマスの練習を部員全員で行います。</li>
        <li>部員ごとに個別の練習メニューも決められます。「おまかせ」なら苦手を自動で鍛えます。</li>
        <li>疲労が溜まるとケガの危険。休養マスや休養メニューで回復しましょう。</li>
        <li>7月は夏の県大会、9月は秋季大会。試合では打席ごとに作戦を指示します。</li>
        <li>3年生は夏の大会で引退し、4月に新入部員が入ります。スカウトマスで有望な中学生を見つけられます。</li>
      </ol>
    </details>
  </section>`;
}

function renderHeader() {
  const str = teamStrength(S.players);
  return `
  <header class="hud">
    <div class="hud-school">
      <span class="hud-name">${esc(S.school)}</span>
      <span class="hud-date">${S.year}年目　${weekLabel()}</span>
    </div>
    <dl class="hud-stats">
      <div><dt>チーム力</dt><dd>${str}<small>${rank(str)}</small></dd></div>
      <div><dt>評判</dt><dd>${S.rep}</dd></div>
      <div><dt>通算</dt><dd>${S.totals.w}<small>勝</small>${S.totals.l}<small>敗</small></dd></div>
    </dl>
  </header>`;
}

function renderNav() {
  if (UI.screen === 'match') return '';
  const inT = !!S.tourney;
  const tabs = [
    [inT ? 'tourney' : 'home', inT ? '大会' : '練習'],
    ['roster', '部員'],
    ['records', '記録'],
  ];
  const cur = UI.screen;
  return `<nav class="tabs">${tabs.map(([k, l]) => `<button class="tab ${cur === k ? 'on' : ''}" data-act="go" data-to="${k}">${l}</button>`).join('')}</nav>`;
}

// 盤面のマスを周回状に配置: 7x7の外周
function squareCell(i) {
  if (i <= 6) return [1, i + 1];
  if (i <= 12) return [i - 5, 7];
  if (i <= 18) return [7, 7 - (i - 12)];
  return [7 - (i - 18), 1];
}

function renderBoardCells() {
  const dest = UI.selCard != null && S.hand[UI.selCard] ? (S.pos + S.hand[UI.selCard].v) % BOARD_SIZE : -1;
  let html = '';
  for (let i = 0; i < BOARD_SIZE; i++) {
    const [r, c] = squareCell(i);
    const t = S.board[i];
    const info = SQUARE_TYPES[t];
    const star = S.stars.includes(i);
    html += `<div class="sq sq-${t} ${i === S.pos ? 'here' : ''} ${i === dest ? 'dest' : ''}" style="grid-row:${r};grid-column:${c}" title="${info.label}：${info.desc}">
      <span class="sq-k">${info.short}</span>${star ? '<span class="sq-star">★</span>' : ''}${i === S.pos ? '<span class="piece" aria-label="現在地"></span>' : ''}
    </div>`;
  }
  return html;
}

function renderBoardOnly() {
  const b = $('boardCells');
  if (b) b.innerHTML = renderBoardCells();
  else render();
}

function renderHome() {
  const ne = nextEvent();
  const sel = UI.selCard != null ? S.hand[UI.selCard] : null;
  const destType = sel ? S.board[(S.pos + sel.v) % BOARD_SIZE] : null;
  const destStar = sel ? S.stars.includes((S.pos + sel.v) % BOARD_SIZE) : false;
  const injured = S.players.filter((p) => p.injury > 0).length;
  const tired = S.players.filter((p) => p.injury === 0 && p.fatigue >= 60).length;
  return `
  <section class="board-wrap">
    <div class="board">
      <div id="boardCells" class="board-cells">${renderBoardCells()}</div>
      <div class="board-center">
        <div class="bc-season">${isWinter(S.week) ? '冬の強化期間' : isCamp(S.week) ? '夏合宿' : `${monthOf(S.week)}月`}</div>
        ${ne ? `<div class="bc-next"><span>${TOURNEYS[ne.k].name}まで</span><b>${ne.d}</b><span>週</span></div>` : ''}
        <div class="bc-cond">
          ${injured ? `<span class="chip inj">ケガ ${injured}人</span>` : ''}
          ${tired ? `<span class="chip warn">疲労 ${tired}人</span>` : ''}
          ${!injured && !tired ? '<span class="chip good">全員元気</span>' : ''}
        </div>
      </div>
    </div>
  </section>
  <section class="hand-wrap">
    <h2 class="sec-h">手札 <small>カードを選んで進む</small></h2>
    <div class="hand">
      ${S.hand.map((c, i) => `
        <button class="card k-${c.kind} ${UI.selCard === i ? 'sel' : ''}" data-act="sel" data-i="${i}" ${UI.moving ? 'disabled' : ''} aria-label="${c.v}マス進む${c.kind === 'double' ? '（効果2倍）' : c.kind === 'team' ? '（全体練習）' : ''}">
          <span class="card-v">${c.v}</span>
          <span class="card-k">${c.kind === 'double' ? '効果×2' : c.kind === 'team' ? '全体練習' : '練習'}</span>
        </button>`).join('')}
    </div>
    <div class="go-row">
      ${sel ? `<p class="go-desc">→ <b>${SQUARE_TYPES[destType].label}</b>${destStar ? '★' : ''}：${SQUARE_TYPES[destType].desc}</p>
        <button class="btn primary" data-act="play" ${UI.moving ? 'disabled' : ''}>${sel.v}マス進む</button>`
      : '<p class="go-desc muted">カードをタップすると行き先が光ります</p>'}
    </div>
  </section>
  <section class="report">
    <h2 class="sec-h">今週の報告</h2>
    <ul>${S.report.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
  </section>
  <section class="legend">
    ${Object.entries(SQUARE_TYPES).map(([k, v]) => `<span class="lg"><i class="sq-mini sq-${k}">${v.short}</i>${v.label}</span>`).join('')}
    <span class="lg"><i class="sq-mini star">★</i>効果1.5倍</span>
  </section>`;
}

const POS_ORDER = ['投', '捕', '一', '二', '三', '遊', '外'];
function renderRoster() {
  const sorted = S.players.slice().sort((a, b) => {
    if (UI.rosterSort === 'pos') return POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.grade - a.grade;
    if (UI.rosterSort === 'ovr') return overall(b) - overall(a);
    return b.grade - a.grade || POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos);
  });
  const rows = sorted.map((p) => {
    const f = fatigueInfo(p);
    const open = UI.expanded === p.id;
    const isP = p.pos === '投';
    const key = isP
      ? `<span class="kv">${kmh(p.velo)}<small>km/h</small></span><span class="kv">制${rankBadge(p.ctrl)}</span><span class="kv">ス${rankBadge(p.stam)}</span><span class="kv">変${rankBadge(p.brk)}</span>`
      : `<span class="kv">ミ${rankBadge(p.meet)}</span><span class="kv">パ${rankBadge(p.power)}</span><span class="kv">走${rankBadge(p.speed)}</span><span class="kv">守${rankBadge(p.def)}</span>`;
    return `
    <li class="pl ${open ? 'open' : ''}">
      <button class="pl-head" data-act="expand" data-id="${p.id}" aria-expanded="${open}">
        <span class="pos pos-${p.pos}">${p.pos}</span>
        <span class="pl-name">${esc(p.name)}${S.aceId === p.id ? '<em class="ace">エース</em>' : ''}<small>${p.grade}年・${p.hand}${isP ? '投' : '打'}・素質${'★'.repeat(p.talent)}</small></span>
        <span class="pl-keys">${key}</span>
        <span class="pl-ovr">${overall(p)}</span>
        <span class="fat fat-${f.cls}" title="疲労 ${Math.round(p.fatigue)}">${f.label}</span>
      </button>
      ${open ? renderPlayerDetail(p) : ''}
    </li>`;
  }).join('');
  const prospects = S.prospects.length ? `
    <section class="prospects">
      <h2 class="sec-h">来春の入部予定者</h2>
      <ul>${S.prospects.map((p) => `<li><span class="pos pos-${p.pos}">${p.pos}</span>${esc(p.name)}<small>素質${'★'.repeat(p.talent)}・総合${overall(p)}</small></li>`).join('')}</ul>
    </section>` : '';
  return `
  <section class="roster">
    <div class="roster-tools">
      <h2 class="sec-h">部員 <small>${S.players.length}人</small></h2>
      <div class="seg" role="group" aria-label="並び替え">
        ${[['grade', '学年'], ['pos', '守備'], ['ovr', '総合']].map(([k, l]) => `<button class="${UI.rosterSort === k ? 'on' : ''}" data-act="sort" data-k="${k}">${l}</button>`).join('')}
      </div>
      <button class="btn small" data-act="allAuto">全員おまかせ</button>
    </div>
    <ul class="pl-list">${rows}</ul>
  </section>
  ${prospects}`;
}

function statBar(label, v, extra = '') {
  return `<div class="sb"><span class="sb-l">${label}</span><span class="sb-track"><span class="sb-fill" style="width:${v}%"></span></span>${rankBadge(v)}<span class="sb-v">${extra || v}</span></div>`;
}

function renderPlayerDetail(p) {
  const isP = p.pos === '投';
  const menus = Object.entries(MENUS).filter(([k]) => isP || k !== 'pit');
  const st = p.stats;
  const avg = st.ab ? (st.h / st.ab).toFixed(3).replace(/^0/, '') : '-';
  const era = st.outs ? ((st.er * 27) / st.outs).toFixed(2) : '-';
  const expCat = (k) => {
    const stats = GROW_MAP[k](p);
    const s = stats.slice().sort((a, b) => p[a] - p[b])[0];
    return Math.min(100, Math.round((p.exp[k] / growCost(s, p[s])) * 100));
  };
  return `
  <div class="pl-detail">
    <div class="pd-stats">
      ${isP ? statBar('球速', clamp(p.velo, 0, 100), `${kmh(p.velo)}km/h`) + statBar('制球', p.ctrl) + statBar('スタミナ', p.stam) + statBar('変化球', p.brk) : ''}
      ${statBar('ミート', p.meet)}${statBar('パワー', p.power)}${statBar('走力', p.speed)}${statBar('肩力', p.arm)}${statBar('守備', p.def)}
      ${!isP ? statBar('スタミナ', p.stam) : ''}
    </div>
    <div class="pd-side">
      <p class="pd-season">今季：${isP ? `${Math.floor(st.outs / 3)}回${st.outs % 3 ? '' + (st.outs % 3) + '/3' : ''}　防御率 ${era}　${st.k}奪三振` : `打率 ${avg}　${st.hr}本塁打　${st.rbi}打点`}（${st.g}試合）</p>
      <p class="pd-fat">疲労 <span class="meter"><span style="width:${p.fatigue}%" class="m-${fatigueInfo(p).cls}"></span></span> ${Math.round(p.fatigue)}</p>
      <label class="pd-label" for="menu-${p.id}">練習メニュー</label>
      <div class="menu-grid" id="menu-${p.id}" role="radiogroup">
        ${menus.map(([k, m]) => `<button role="radio" aria-checked="${p.menu === k}" class="mbtn ${p.menu === k ? 'on' : ''}" data-act="menu" data-id="${p.id}" data-k="${k}">${m.label}${GROW_MAP[k] ? `<span class="mexp" style="width:${expCat(k)}%"></span>` : ''}</button>`).join('')}
      </div>
      <p class="pd-hint">${MENUS[p.menu].desc}${p.menu === 'auto' && p.lastMenu ? `（先週：${MENUS[p.lastMenu].label}）` : ''}</p>
      <div class="pd-actions">
        ${isP ? `<button class="btn small ${S.aceId === p.id ? 'on' : ''}" data-act="ace" data-id="${p.id}">${S.aceId === p.id ? 'エース指名を外す' : 'エースに指名'}</button>` : ''}
        <label class="conv">守備位置
          <select data-act="conv" data-id="${p.id}" id="conv-${p.id}">
            ${POSITIONS.map((x) => `<option value="${x}" ${p.pos === x ? 'selected' : ''}>${POS_NAME[x]}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>
  </div>`;
}

function renderRecords() {
  const t = S.totals;
  const best = (players, fn, filt) => players.filter(filt).sort((a, b) => fn(b) - fn(a))[0];
  const all = S.players;
  const hrK = best(all, (p) => p.career.hr, (p) => p.career.hr > 0);
  const avgK = best(all, (p) => p.career.h / p.career.ab, (p) => p.career.ab >= 10);
  const kK = best(all, (p) => p.career.k, (p) => p.career.k > 0);
  return `
  <section class="records">
    <h2 class="sec-h">${esc(S.school)}の歩み</h2>
    <div class="rec-grid">
      <div class="rec"><span>通算成績</span><b>${t.w}勝${t.l}敗</b></div>
      <div class="rec"><span>夏の全国</span><b>${t.summerApp}回出場</b><small>${t.bestSummer ? '最高 ' + t.bestSummer : ''}</small></div>
      <div class="rec"><span>春の全国</span><b>${t.springApp}回出場</b><small>${t.bestSpring ? '最高 ' + t.bestSpring : ''}</small></div>
      <div class="rec"><span>評判</span><b>${S.rep}</b><small>${S.rep >= 70 ? '全国的な強豪' : S.rep >= 45 ? '県内の強豪' : S.rep >= 20 ? '注目され始めた' : '無名'}</small></div>
    </div>
    ${t.titles.length ? `<h3 class="sub-h">優勝</h3><ul class="titles">${t.titles.map((x) => `<li>🏆 ${esc(x)}</li>`).join('')}</ul>` : ''}
    <h3 class="sub-h">現役部員の通算トップ</h3>
    <ul class="leaders">
      <li><span>本塁打</span>${hrK ? `${esc(hrK.name)} <b>${hrK.career.hr}本</b>` : '-'}</li>
      <li><span>打率(10打数以上)</span>${avgK ? `${esc(avgK.name)} <b>${(avgK.career.h / avgK.career.ab).toFixed(3).replace(/^0/, '')}</b>` : '-'}</li>
      <li><span>奪三振</span>${kK ? `${esc(kK.name)} <b>${kK.career.k}個</b>` : '-'}</li>
    </ul>
    <h3 class="sub-h">大会の記録</h3>
    ${S.history.length ? `<ul class="hist">${S.history.map((h) => `
      <li><div class="hist-h"><span>${h.year}年目 ${esc(h.name)}</span><b class="${h.label === '優勝' ? 'gold' : ''}">${esc(h.label)}</b></div>
      <div class="hist-g">${h.games.map((g) => `<span>${esc(g)}</span>`).join('')}</div></li>`).join('')}</ul>` : '<p class="muted">まだ公式戦の記録はありません。</p>'}
    <div class="danger-zone">
      ${UI.confirmReset ? `<p>本当にデータを消してタイトルに戻りますか？</p><button class="btn small danger" data-act="resetYes">消去する</button><button class="btn small" data-act="resetNo">やめる</button>`
      : '<button class="btn small ghost" data-act="reset">データを消して最初から</button>'}
    </div>
  </section>`;
}

function renderTourney() {
  const t = S.tourney;
  if (!t) return '';
  const pits = S.players.filter((p) => p.pos === '投' && p.injury === 0);
  const auto = (UI.starterId && pits.find((p) => p.id === UI.starterId)) || pickStarter(S.players, S.aceId);
  const rows = t.rounds.map((r, i) => {
    const res = t.results[i];
    const opp = t.opps[i];
    let state = '';
    if (res) state = `<b class="${res.win ? 'win' : 'lose'}">${res.win ? '○' : '●'} ${res.us}-${res.them}</b>${res.note ? `<small>${esc(res.note)}</small>` : ''}`;
    else if (i === t.round && !t.done) state = '<b class="next">次の試合</b>';
    else state = '<span class="muted">—</span>';
    return `<li class="tr ${i === t.round && !t.done ? 'cur' : ''}"><span class="tr-r">${r}</span><span class="tr-o">${i <= t.round || t.done ? esc(opp.name) : '？？？'}${i <= t.round ? `<small>${'★'.repeat(oppStars(opp.strength))}</small>` : ''}</span><span class="tr-s">${state}</span></li>`;
  }).join('');
  const cur = !t.done ? t.opps[t.round] : null;
  return `
  <section class="tourney">
    <h2 class="t-name">${t.name}</h2>
    <ol class="t-bracket">${rows}</ol>
    ${t.done ? `
      <div class="t-end ${t.champion ? 'champ' : ''}">
        <p class="t-end-label">${t.champion ? '🏆 優勝！' : resultLabel(t)}</p>
        <button class="btn primary big" data-act="closeT">大会を終える</button>
      </div>` : `
      <div class="pre">
        <p>次の相手：<b>${esc(cur.name)}</b>　戦力 ${'★'.repeat(oppStars(cur.strength))}${'☆'.repeat(5 - oppStars(cur.strength))}　<small>（自チーム ${teamStrength(S.players)}　相手 ${cur.strength}）</small></p>
        <label for="starterSel">先発投手</label>
        <select id="starterSel" data-act="starter">
          ${pits.map((p) => `<option value="${p.id}" ${auto === p ? 'selected' : ''}>${esc(p.name)}（${p.grade}年 ${kmh(p.velo)}km/h 疲労${Math.round(p.fatigue)}）</option>`).join('')}
        </select>
        <div class="pre-btns">
          <button class="btn primary big" data-act="startMatch">試合開始</button>
          <button class="btn" data-act="quickMatch">結果だけ見る</button>
        </div>
      </div>`}
  </section>`;
}

function renderMatch() {
  const m = UI.match;
  const inn = Math.max(9, m.inning);
  const cols = [];
  for (let i = 1; i <= inn; i++) cols.push(i);
  const lineRow = (s, idx) => {
    const cells = cols.map((i) => {
      const v = s.line[i - 1];
      const isHomeX = idx === 1 && m.over && v === undefined && i === m.inning && !m.lotteryWinner;
      return `<td>${v === undefined ? (isHomeX ? 'X' : '') : v}</td>`;
    }).join('');
    return `<tr class="${s === m.me ? 'me' : ''}"><th>${esc(s.name)}</th>${cells}<td class="R">${s.runs}</td><td class="H">${s.hits}</td></tr>`;
  };
  const off = m.offense();
  const def = m.defense();
  const B = m.batter();
  const P = def.pitcher;
  const bs = m.bs(B);
  const tired = clamp(1 - def.pc / def.stamMax, 0, 1);
  const batting = userIsBatting(m);
  const outs = [0, 1].map((i) => `<i class="out ${m.outs > i ? 'on' : ''}"></i>`).join('');
  const recent = m.log.slice(-40);
  let controls = '';
  if (m.over) {
    const win = m.winner() === m.me;
    controls = `
    <div class="m-over ${win ? 'win' : 'lose'}">
      <p class="m-res">${win ? '勝利！' : '敗戦…'}　${m.me.runs} - ${m.opp.runs}${m.resultNote ? `（${esc(m.resultNote)}）` : ''}</p>
      ${renderMatchHeroes(m)}
      <button class="btn primary big" data-act="finishMatch">次へ</button>
    </div>`;
  } else if (!UI.flow.paused) {
    controls = `
    <div class="flow-bar">
      <p class="flow-state"><span class="flow-dot"></span>${batting ? '攻撃中' : '守備中'}・自動で進行中</p>
      <div class="flow-btns">
        <button class="btn primary" data-act="timeout" ${UI.flow.timeReq ? 'disabled' : ''}>${UI.flow.timeReq ? 'タイム要求中…' : 'タイム'}</button>
        <button class="btn small ghost" data-act="cmd" data-c="autoAll">試合終了までスキップ</button>
      </div>
    </div>`;
  } else if (UI.showBullpen && !batting) {
    const bp = m.me.bullpen;
    controls = `<div class="bullpen"><p>タイム：誰に代えますか？</p>${bp.length ? bp.map((p) => `<button class="btn" data-act="relief" data-id="${p.id}">${esc(p.name)} <small>${kmh(p.velo)}km/h 制${rank(p.ctrl)} 疲労${Math.round(p.fatigue)}</small></button>`).join('') : '<p class="muted">控え投手がいません</p>'}<button class="btn ghost" data-act="bullpenClose">やめる</button></div>`;
  } else if (batting) {
    const canBunt = (m.bases[0] || m.bases[1]) && m.outs < 2;
    const canSq = m.bases[2] && m.outs < 2;
    controls = `
    <div class="cmds">
      <p class="cmd-h">タイム：攻撃の作戦<small>指示した1球が終わると自動進行に戻ります</small></p>
      <div class="cmd-grid">
        <button class="btn cmd" data-act="cmd" data-c="normal">打て</button>
        <button class="btn cmd" data-act="cmd" data-c="power">強振<small>長打狙い</small></button>
        <button class="btn cmd" data-act="cmd" data-c="contact">ミート<small>三振を減らす</small></button>
        <button class="btn cmd" data-act="cmd" data-c="bunt" ${canBunt ? '' : 'disabled'}>送りバント</button>
        <button class="btn cmd" data-act="cmd" data-c="squeeze" ${canSq ? '' : 'disabled'}>スクイズ</button>
        <button class="btn cmd" data-act="cmd" data-c="steal" ${m.canSteal() ? '' : 'disabled'}>盗塁</button>
      </div>
      <div class="cmd-auto">
        <button class="btn small" data-act="cmd" data-c="resume">指示せず再開</button>
        <button class="btn small ghost" data-act="cmd" data-c="autoAll">試合終了までスキップ</button>
      </div>
    </div>`;
  } else {
    controls = `
    <div class="cmds">
      <p class="cmd-h">タイム：守備の指示<small>指示した1球が終わると自動進行に戻ります</small></p>
      <div class="cmd-grid">
        <button class="btn cmd" data-act="cmd" data-c="pitch">勝負</button>
        <button class="btn cmd" data-act="cmd" data-c="ibb">敬遠</button>
        <button class="btn cmd" data-act="bullpen">投手交代<small>${m.me.bullpen.length}人</small></button>
      </div>
      <div class="cmd-auto">
        <button class="btn small" data-act="cmd" data-c="resume">指示せず再開</button>
        <button class="btn small ghost" data-act="cmd" data-c="autoAll">試合終了までスキップ</button>
      </div>
    </div>`;
  }
  return `
  <section class="match">
    <div class="sb-wrap">
      <table class="scoreboard">
        <thead><tr><th></th>${cols.map((i) => `<th class="${i === m.inning && !m.over ? 'cur' : ''}">${i}</th>`).join('')}<th>R</th><th>H</th></tr></thead>
        <tbody>${lineRow(m.sides[0], 0)}${lineRow(m.sides[1], 1)}</tbody>
      </table>
    </div>
    <div class="stage">
      <canvas id="fieldCanvas" class="field-cv" width="${Anim.W}" height="${Anim.H}" data-act="skipAnim" role="img" aria-label="${m.inning}回${m.top ? '表' : '裏'} ${m.outs}アウト 走者 ${[0, 1, 2].filter((i) => m.bases[i]).map((i) => i + 1 + '塁').join('・') || 'なし'}"></canvas>
      <div class="stage-hud">
        <span class="sit-inn">${m.inning}回${m.top ? '表' : '裏'}</span>
        <span class="${batting ? 'atk' : 'dfn'}">${batting ? '攻撃中' : '守備中'}</span>
        <span class="sit-outs">OUT ${outs}</span>
      </div>
      <p class="skip-hint">タップでスキップ</p>
    </div>
    <div class="anim-set" role="group" aria-label="アニメーション">
      <span>アニメ</span>
      ${[['normal', '標準'], ['fast', '速い'], ['off', 'なし']].map(([k, l]) => `<button class="${UI.animMode === k ? 'on' : ''}" data-act="animMode" data-k="${k}">${l}</button>`).join('')}
    </div>
    <div class="matchup">
      <div class="mu mu-b ${off === m.me ? 'mine' : ''}">
        <span class="mu-l">打者 ${(off.idx % 9) + 1}番 ${off.order[off.idx % 9].slot}</span>
        <b>${esc(B.name)}</b>
        <span class="mu-s">ミ${rankBadge(B.meet)} パ${rankBadge(B.power)} 走${rankBadge(B.speed)}　今日 ${bs.h}/${bs.ab}</span>
      </div>
      <div class="mu mu-p ${def === m.me ? 'mine' : ''}">
        <span class="mu-l">投手</span>
        <b>${esc(P.name)}</b>
        <span class="mu-s">${kmh(P.velo)}km/h 制${rankBadge(P.ctrl)} 変${rankBadge(P.brk)}</span>
        <span class="stam" title="残りスタミナ"><span style="width:${Math.round(tired * 100)}%" class="${tired < 0.25 ? 'low' : tired < 0.5 ? 'mid' : ''}"></span></span>
        <span class="mu-pc">${def.pc}球</span>
      </div>
    </div>
    <ol class="mlog" id="mlog">${recent.map((l) => `<li class="lg-${l.cls}">${esc(l.text)}</li>`).join('')}</ol>
    ${controls}
  </section>`;
}

function renderMatchHeroes(m) {
  const mine = [...m.batStats.values()].filter((b) => m.me.order.some((o) => o.p === b.p) || m.me.players.includes(b.p));
  const top = mine.sort((a, b) => b.h * 2 + b.hr * 3 + b.rbi * 2 - (a.h * 2 + a.hr * 3 + a.rbi * 2))[0];
  const pl = [...m.me.pitchLog.values()];
  const lines = pl.map((l) => `${esc(l.p.name.split(' ')[0])} ${Math.floor(l.outs / 3)}回${l.outs % 3 ? l.outs % 3 + '/3' : ''} ${l.k}K ${l.er}失点`).join('　');
  return `<p class="heroes">${top && top.h ? `殊勲：${esc(top.p.name)}（${top.ab}打数${top.h}安打${top.hr ? ` ${top.hr}本塁打` : ''}${top.rbi ? ` ${top.rbi}打点` : ''}）<br>` : ''}投手：${lines}</p>`;
}

// ---------- 入力 ----------
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (!t || t.tagName === 'SELECT') return;
  const act = t.dataset.act;
  const id = t.dataset.id ? Number(t.dataset.id) : null;
  switch (act) {
    case 'continue': {
      const sv = loadSave();
      if (!sv) return;
      S = sv;
      setNextPid(S.nextPid || 1000);
      UI.screen = S.tourney ? 'tourney' : 'home';
      render();
      break;
    }
    case 'go': UI.screen = t.dataset.to; UI.selCard = null; render(); window.scrollTo(0, 0); break;
    case 'sel': {
      const i = Number(t.dataset.i);
      if (UI.selCard === i) playCard(i);
      else { UI.selCard = i; render(); }
      break;
    }
    case 'play': if (UI.selCard != null) playCard(UI.selCard); break;
    case 'expand': UI.expanded = UI.expanded === id ? null : id; render(); break;
    case 'sort': UI.rosterSort = t.dataset.k; render(); break;
    case 'allAuto': for (const p of S.players) p.menu = 'auto'; save(); render(); break;
    case 'menu': {
      const p = S.players.find((x) => x.id === id);
      if (p) { p.menu = t.dataset.k; save(); render(); }
      break;
    }
    case 'ace': S.aceId = S.aceId === id ? null : id; save(); render(); break;
    case 'startMatch': startMatch(); break;
    case 'quickMatch': startMatch(); stopFlow(); UI.match.simToEnd(); render(); break;
    case 'skipAnim': Anim.skip(); break;
    case 'timeout': callTime(t); break;
    case 'animMode': setAnimMode(t.dataset.k); break;
    case 'cmd': {
      const c = t.dataset.c;
      matchCmd(c === 'pitch' ? 'normal' : c);
      break;
    }
    case 'bullpen': UI.showBullpen = true; render(); break;
    case 'bullpenClose': UI.showBullpen = false; render(); break;
    case 'relief': changeMyPitcher(id); break;
    case 'finishMatch': UI.showBullpen = false; finishMatch(); window.scrollTo(0, 0); break;
    case 'closeT': closeTourney(); window.scrollTo(0, 0); break;
    case 'reset': UI.confirmReset = true; render(); break;
    case 'resetNo': UI.confirmReset = false; render(); break;
    case 'resetYes': UI.confirmReset = false; deleteSave(); S = null; UI.screen = 'title'; render(); break;
    default: break;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.act === 'starter') { UI.starterId = Number(t.value); }
  if (t.dataset.act === 'conv') {
    const p = S.players.find((x) => x.id === Number(t.dataset.id));
    if (p) {
      p.pos = t.value;
      if (p.pos !== '投' && p.menu === 'pit') p.menu = 'auto';
      if (p.pos !== '投' && S.aceId === p.id) S.aceId = null;
      save(); render();
    }
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id !== 'newForm') return;
  e.preventDefault();
  const name = ($('schoolName').value || '').trim() || '県立白球高';
  newGame(name);
});

render();
