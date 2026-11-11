'use strict';
// ===== 基本ユーティリティとデータ定義 =====

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const chance = (p) => Math.random() < p;
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SURNAMES = '佐藤 鈴木 高橋 田中 伊藤 渡辺 山本 中村 小林 加藤 吉田 山田 佐々木 山口 松本 井上 木村 林 斎藤 清水 山崎 森 池田 橋本 阿部 石川 山下 中島 石井 小川 前田 岡田 長谷川 藤田 後藤 近藤 村上 遠藤 青木 坂本 福田 太田 西村 藤井 金子 岡本 藤原 中野 三浦 原田 松田 竹内 中川 小野 田村 北村 上田 柴田 酒井 宮崎 工藤 横山 宮本 内田 高木 安藤 島田 谷口 大野 丸山 今井 河野 武田 村田 上野 杉山 増田 平野 大塚 千葉 久保 松井 小島 岩崎 桜井 野口 松尾 野村 木下 菊地 佐野 大西 杉本 新井 浜田 菅原 市川 水野 小松 東 南 西田 北川 秋山 早川 堀 星野 白石'.split(' ');
const GIVEN = '翔太 大輝 拓海 蓮 颯太 陸 悠斗 大和 湊 樹 奏太 陽翔 健太 涼介 隼人 航 蒼 優斗 海斗 一輝 雄大 光 誠 直樹 智也 亮 大地 翼 将太 和也 秀人 達也 慎吾 啓太 圭 竜也 晴 巧 剛 純平 勇気 拓真 新 瑛太 迅 創 律 碧 大翔 朔 駿 慧 輝 塁 球児 真吾 豪 匠 爽 恭平 康介 雅人 俊 武 賢 力也 鉄平 晃'.split(' ');

const SCHOOL_HEAD = ['北山', '南陵', '東雲', '西ノ宮', '桜台', '青葉', '白鷺', '緑ヶ丘', '朝日', '光陵', '明星', '清流', '若葉', '鳳翔', '翔洋', '常盤', '旭川東', '浜風', '黒潮', '霧島', '月見', '星ヶ浦', '山吹', '鷹ノ巣', '雷鳴', '紅葉台', '千歳', '大鳥', '川端', '湖南', '峰岸', '柏木', '松陰', '飛鳥', '天城', '高嶺', '宮前', '砂丘', '港南', '尾花'];
const SCHOOL_TAIL = ['高', '高', '高', '学園', '実業', '商業', '工業', '第一', '学院', '大附属'];

function makeSchoolName(exclude) {
  for (let i = 0; i < 50; i++) {
    const n = pick(SCHOOL_HEAD) + pick(SCHOOL_TAIL);
    if (n !== exclude) return n;
  }
  return '無名高';
}

// 守備位置
const POSITIONS = ['投', '捕', '一', '二', '三', '遊', '外'];
const POS_NAME = { '投': '投手', '捕': '捕手', '一': '一塁手', '二': '二塁手', '三': '三塁手', '遊': '遊撃手', '外': '外野手' };

// 練習カテゴリー
const MENUS = {
  bat: { label: '打撃', desc: 'ミート上昇' },
  pow: { label: '筋力', desc: 'パワー上昇' },
  run: { label: '走塁', desc: '走力上昇' },
  fld: { label: '守備', desc: '守備力・肩力上昇' },
  pit: { label: '投球', desc: '球速・制球・変化球上昇' },
  sta: { label: '体力', desc: 'スタミナ上昇' },
  rest: { label: '休養', desc: '疲労を大きく回復' },
  auto: { label: 'おまかせ', desc: '苦手を自動で選ぶ' },
};

// 能力
const STAT_LABEL = {
  meet: 'ミート', power: 'パワー', speed: '走力', arm: '肩力', def: '守備',
  velo: '球速', ctrl: '制球', stam: 'スタミナ', brk: '変化球',
};
const BAT_STATS = ['meet', 'power', 'speed', 'arm', 'def'];
const PIT_STATS = ['velo', 'ctrl', 'stam', 'brk'];

function rank(v) {
  if (v >= 90) return 'S';
  if (v >= 80) return 'A';
  if (v >= 70) return 'B';
  if (v >= 60) return 'C';
  if (v >= 50) return 'D';
  if (v >= 40) return 'E';
  if (v >= 20) return 'F';
  return 'G';
}
const kmh = (velo) => Math.round(112 + velo * 0.46);

let _pid = 1;
function setNextPid(n) { _pid = n; }
function getNextPid() { return _pid; }

function talentRoll(bonus = 0) {
  const r = Math.random() + bonus;
  if (r > 1.02) return 5;
  if (r > 0.9) return 4;
  if (r > 0.62) return 3;
  if (r > 0.25) return 2;
  return 1;
}

/**
 * 選手を生成する
 * @param {number} grade 学年
 * @param {number} base 基本能力の目安(1-99)
 */
function makePlayer(grade, base, opts = {}) {
  const pos = opts.pos || pick(['投', '投', '捕', '一', '二', '三', '遊', '外', '外', '外']);
  const talent = opts.talent || talentRoll(opts.talentBonus || 0);
  const v = (b = 0, spread = 9) => clamp(Math.round(base + b + rnd(-spread, spread)), 5, 99);
  const p = {
    id: _pid++,
    name: pick(SURNAMES) + ' ' + pick(GIVEN),
    grade,
    pos,
    talent,
    hand: chance(0.28) ? '左' : '右',
    meet: v(), power: v(), speed: v(), arm: v(), def: v(),
    velo: v(-25, 6), ctrl: v(-25, 6), stam: v(-25, 6), brk: v(-25, 6),
    exp: { bat: 0, pow: 0, run: 0, fld: 0, pit: 0, sta: 0 },
    fatigue: ri(0, 15),
    injury: 0,
    menu: 'auto',
    stats: { g: 0, ab: 0, h: 0, hr: 0, rbi: 0, outs: 0, er: 0, k: 0 },
    career: { g: 0, ab: 0, h: 0, hr: 0, rbi: 0, outs: 0, er: 0, k: 0 },
  };
  if (pos === '投') {
    p.velo = v(4); p.ctrl = v(2); p.stam = v(2); p.brk = v(0);
    p.meet = v(-12); p.power = v(-10); p.def = v(-5);
  }
  if (pos === '捕') { p.arm = v(6); p.def = v(6); p.speed = v(-8); }
  if (pos === '遊' || pos === '二') { p.def = v(5); p.speed = v(5); p.power = v(-6); }
  if (pos === '一' || pos === '三') { p.power = v(6); p.speed = v(-4); }
  if (pos === '外') { p.speed = v(4); p.arm = v(2); }
  if (opts.boost) {
    for (const k of [...BAT_STATS, ...PIT_STATS]) p[k] = clamp(p[k] + opts.boost, 5, 99);
  }
  return p;
}

function overall(p) {
  if (p.pos === '投') return Math.round((p.velo + p.ctrl + p.stam + p.brk) / 4);
  return Math.round((p.meet * 1.2 + p.power * 1.1 + p.speed * 0.9 + p.arm * 0.8 + p.def) / 5);
}

// ===== 練習ボード =====
const SQUARE_TYPES = {
  bat:   { label: '打撃', short: '打', desc: '全員の打撃経験値アップ' },
  pow:   { label: '筋力', short: '筋', desc: '全員の筋力経験値アップ' },
  run:   { label: '走塁', short: '走', desc: '全員の走塁経験値アップ' },
  fld:   { label: '守備', short: '守', desc: '全員の守備経験値アップ' },
  pit:   { label: '投球', short: '投', desc: '投手の投球経験値アップ' },
  sta:   { label: '体力', short: '体', desc: '全員の体力経験値アップ' },
  rest:  { label: '休養', short: '休', desc: '部員全員の疲労回復' },
  event: { label: 'イベント', short: '？', desc: '何かが起こる' },
  game:  { label: '練習試合', short: '試', desc: '練習試合を行う' },
  scout: { label: 'スカウト', short: '探', desc: '有望な中学生を探す' },
  rep:   { label: '地域交流', short: '名', desc: '学校の評判アップ' },
};

function makeBoard() {
  const list = [
    'bat', 'bat', 'bat', 'pow', 'pow', 'pow', 'run', 'run', 'fld', 'fld', 'fld',
    'pit', 'pit', 'pit', 'sta', 'sta', 'rest', 'rest', 'event', 'event', 'event',
    'game', 'scout', 'rep',
  ];
  // 同じ種類が隣り合いすぎないよう何度か試す
  let best = null, bestScore = 1e9;
  for (let t = 0; t < 40; t++) {
    const s = shuffle(list);
    let sc = 0;
    for (let i = 0; i < s.length; i++) if (s[i] === s[(i + 1) % s.length]) sc++;
    if (sc < bestScore) { best = s; bestScore = sc; }
    if (sc === 0) break;
  }
  return best;
}

function drawCard() {
  const v = ri(1, 6);
  const r = Math.random();
  let kind = 'normal';
  if (r < 0.1) kind = 'double';     // マス効果2倍
  else if (r < 0.16) kind = 'team';  // 全体練習: 全カテゴリ少しずつ
  return { v, kind };
}

// ===== カレンダー =====
// 1年 = 48週。0 = 4月第1週
const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];
const monthOf = (week) => MONTHS[Math.floor(week / 4)];
const weekOfMonth = (week) => (week % 4) + 1;

const SCHEDULE = {
  summerPref: 13,   // 7月第2週 夏の県大会
  summerNat: 16,    // 8月第1週 夏の全国大会
  autumnPref: 22,   // 9月第3週 秋季県大会
  autumnReg: 26,    // 10月第3週 秋季地区大会
  senbatsuAnnounce: 39, // 1月第4週 春の全国大会 出場校発表
  springNat: 46,    // 3月第3週 春の全国大会
};

const TOURNEYS = {
  summerPref: { name: '夏の県大会', rounds: ['1回戦', '2回戦', '3回戦', '準々決勝', '準決勝', '決勝'], base: 24, step: 6, mercy: true },
  summerNat: { name: '夏の全国大会', rounds: ['1回戦', '2回戦', '3回戦', '準々決勝', '準決勝', '決勝'], base: 52, step: 4, mercy: false },
  autumnPref: { name: '秋季県大会', rounds: ['1回戦', '2回戦', '準々決勝', '準決勝', '決勝'], base: 24, step: 6, mercy: true },
  autumnReg: { name: '秋季地区大会', rounds: ['準々決勝', '準決勝', '決勝'], base: 46, step: 4, mercy: true },
  springNat: { name: '春の全国大会', rounds: ['1回戦', '2回戦', '準々決勝', '準決勝', '決勝'], base: 52, step: 4, mercy: false },
  practice: { name: '練習試合', rounds: ['練習試合'], base: 0, step: 0, mercy: true },
};

const PREFS = ['北海', '青森', '岩手', '宮城', '秋田', '山形', '福島', '茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川', '新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知', '三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山', '鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知', '福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'];

/** 相手校を作る。strength は選手能力の平均目安 */
function makeOpponent(strength, excludeName) {
  const players = [];
  const s = clamp(strength, 12, 88);
  const fieldPos = ['捕', '一', '二', '三', '遊', '外', '外', '外'];
  for (const pos of fieldPos) players.push(makePlayer(ri(2, 3), s, { pos, talent: 3 }));
  players.push(makePlayer(3, s + 4, { pos: '投', talent: 3 }));
  players.push(makePlayer(2, s - 4, { pos: '投', talent: 3 }));
  players.push(makePlayer(2, s - 6, { pos: '投', talent: 3 }));
  players.push(makePlayer(2, s - 6, { pos: '外', talent: 3 }));
  for (const p of players) p.fatigue = ri(0, 20);
  return { name: makeSchoolName(excludeName), strength: s, players };
}

function teamStrength(players) {
  const healthy = players.filter((p) => p.injury === 0);
  const fielders = healthy.filter((p) => p.pos !== '投').map(overall).sort((a, b) => b - a).slice(0, 8);
  const pitchers = healthy.filter((p) => p.pos === '投').map(overall).sort((a, b) => b - a);
  const f = fielders.length ? fielders.reduce((a, b) => a + b, 0) / fielders.length : 20;
  const pt = pitchers.length ? pitchers[0] : 20;
  return Math.round(f * 0.6 + pt * 0.4);
}
