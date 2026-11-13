'use strict';
// ===== 試合エンジン =====

const FIELD_SLOTS = ['捕', '遊', '二', '中', '三', '右', '左', '一'];

function posFits(p, slot) {
  if (p.pos === slot) return true;
  return p.pos === '外' && (slot === '左' || slot === '中' || slot === '右');
}
const batValue = (p) => p.meet * 0.45 + p.power * 0.35 + p.speed * 0.2;
function fieldValue(p, slot) {
  let d = p.def * 0.7 + p.arm * 0.3;
  if (!posFits(p, slot)) {
    d -= 18;
    if (slot === '捕') d -= 25;
    if (p.pos === '投') d -= 8;
  }
  return d;
}
// 試合での調子補正(疲労が溜まると能力が落ちる)
const cond = (p) => 1 - Math.max(0, p.fatigue - 55) * 0.005;

/** 先発投手を除いた野手8人を選び、打順を組む */
function buildLineup(players, starter) {
  let pool = players.filter((p) => p !== starter && p.injury === 0);
  if (pool.length < 8) pool = pool.concat(players.filter((p) => p !== starter && p.injury > 0));
  // 投手は野手としては最後の手段
  const picked = [];
  for (const slot of FIELD_SLOTS) {
    let best = null, bestV = -1e9;
    for (const p of pool) {
      if (picked.some((x) => x.p === p)) continue;
      let v = batValue(p) * 0.55 + fieldValue(p, slot) * 0.45;
      if (p.pos === '投') v -= 12;
      if (p.injury > 0) v -= 40;
      if (v > bestV) { bestV = v; best = p; }
    }
    if (best) picked.push({ p: best, slot });
  }
  const all = picked.concat([{ p: starter, slot: '投' }]);
  // 打順: 4番=長打力、3番=総合、1番=俊足、2番=ミート、残りは打力順
  const rest = all.slice().sort((a, b) => batValue(b.p) - batValue(a.p));
  const top4 = rest.slice(0, 4);
  const others = rest.slice(4);
  const take = (arr, key) => {
    let bi = 0;
    for (let i = 1; i < arr.length; i++) if (key(arr[i]) > key(arr[bi])) bi = i;
    return arr.splice(bi, 1)[0];
  };
  const c4 = take(top4, (x) => x.p.power);
  const c3 = take(top4, (x) => batValue(x.p));
  const c1 = take(top4, (x) => x.p.speed);
  const c2 = top4[0];
  return [c1, c2, c3, c4, ...others];
}

function pitcherStamina(p) {
  return (55 + p.stam * 0.9) * (1 - p.fatigue / 180);
}
function pickStarter(players, preferId) {
  const pits = players.filter((p) => p.pos === '投' && p.injury === 0);
  const pref = pits.find((p) => p.id === preferId);
  if (pref && pref.fatigue < 75) return pref;
  const score = (p) => (p.velo * 0.4 + p.ctrl * 0.3 + p.brk * 0.3) * cond(p) + p.stam * 0.15 - p.fatigue * 0.25;
  let cands = pits.slice();
  if (!cands.length) cands = players.filter((p) => p.injury === 0);
  if (!cands.length) cands = players.slice();
  cands.sort((a, b) => score(b) - score(a));
  return cands[0];
}

function makeSide(name, players, starter, isUser) {
  const order = buildLineup(players, starter);
  const fielders = order.map((o) => o.p);
  const bullpen = players.filter((p) => !fielders.includes(p) && p.pos === '投' && p.injury === 0);
  const side = {
    name, isUser, players, order, bullpen,
    pitcher: starter, pc: 0, stamMax: pitcherStamina(starter),
    idx: 0, runs: 0, hits: 0, errors: 0, line: [],
    pitchLog: new Map(), // 投手ごとのアウト数/失点
  };
  side.pitchLog.set(starter.id, { p: starter, outs: 0, er: 0, k: 0, pc: 0 });
  return side;
}
function sideDefense(side) {
  let tot = 0;
  for (const o of side.order) tot += fieldValue(o.p, o.slot === '投' ? '投' : o.slot);
  return tot / side.order.length;
}
function catcherArm(side) {
  const c = side.order.find((o) => o.slot === '捕');
  return c ? c.p.arm * (posFits(c.p, '捕') ? 1 : 0.7) : 40;
}

class Match {
  /**
   * @param {object} away 先攻チーム(side)
   * @param {object} home 後攻チーム(side)
   * @param {object} opts { mercy:boolean }
   */
  constructor(away, home, opts = {}) {
    this.sides = [away, home];
    this.inning = 1;
    this.top = true;
    this.outs = 0;
    this.bases = [null, null, null];
    this.over = false;
    this.mercy = !!opts.mercy;
    this.log = [];
    this.batStats = new Map();
    this.sides[0].line.push(0);
    this.defense().def = sideDefense(this.defense());
    this.offense().def = sideDefense(this.offense());
    this.resultNote = '';
  }
  offense() { return this.sides[this.top ? 0 : 1]; }
  defense() { return this.sides[this.top ? 1 : 0]; }
  batter() { const s = this.offense(); return s.order[s.idx % 9].p; }
  pitcher() { return this.defense().pitcher; }
  say(text, cls = '') { this.log.push({ text, cls, inning: this.inning, top: this.top }); }

  bs(p) {
    if (!this.batStats.has(p.id)) this.batStats.set(p.id, { p, ab: 0, h: 0, hr: 0, rbi: 0 });
    return this.batStats.get(p.id);
  }
  plog(p) {
    const d = this.defense();
    if (!d.pitchLog.has(p.id)) d.pitchLog.set(p.id, { p, outs: 0, er: 0, k: 0, pc: 0 });
    return d.pitchLog.get(p.id);
  }

  stuff() {
    const d = this.defense();
    const p = d.pitcher;
    const t = d.pc / d.stamMax;
    const tired = t < 0.75 ? 1 : Math.max(0.55, 1 - (t - 0.75) * 0.6);
    return (p.velo * 0.4 + p.brk * 0.32 + p.ctrl * 0.28) * cond(p) * tired;
  }
  tiredRatio() { const d = this.defense(); return d.pc / d.stamMax; }

  // ---- 走者処理 ----
  score(runner, batter) {
    const o = this.offense();
    o.runs++;
    o.line[o.line.length - 1]++;
    if (batter) this.bs(batter).rbi++;
    this.plog(this.pitcher()).er++;
  }
  addOut(n = 1) {
    this.outs += n;
    this.plog(this.pitcher()).outs += n;
  }
  advanceAll(n, batter, rbiBatter) {
    // 全走者をn個進める
    for (let i = 2; i >= 0; i--) {
      const r = this.bases[i];
      if (!r) continue;
      this.bases[i] = null;
      if (i + n >= 3) this.score(r, rbiBatter);
      else this.bases[i + n] = r;
    }
    if (batter) {
      if (n >= 4) this.score(batter, rbiBatter);
      else this.bases[n - 1] = batter;
    }
  }
  forceWalk(batter) {
    if (this.bases[0]) {
      if (this.bases[1]) {
        if (this.bases[2]) this.score(this.bases[2], batter);
        this.bases[2] = this.bases[1];
      }
      this.bases[1] = this.bases[0];
    }
    this.bases[0] = batter;
  }

  // ---- 打席 ----
  /**
   * mode: normal / power / contact / bunt / squeeze / ibb
   */
  plateAppearance(mode = 'normal') {
    if (this.over) return;
    const off = this.offense();
    const def = this.defense();
    const B = this.batter();
    const P = def.pitcher;
    const plog = this.plog(P);
    const st = this.stuff();
    const meet = B.meet * cond(B);
    const power = B.power * cond(B);
    const speed = B.speed * cond(B);
    const name = `${(off.idx % 9) + 1}番 ${B.name.split(' ')[0]}`;
    const runsBefore = off.runs;
    const snap = this.snapshot();
    const bstat = this.bs(B);
    let pitches = 4;

    if (mode === 'ibb') {
      this.forceWalk(B);
      this.say(`${name}：敬遠`, 'walk');
      pitches = 4;
    } else if (mode === 'bunt' || mode === 'squeeze') {
      const succ = clamp(0.58 + (meet - 40) * 0.006 - (st - 50) * 0.002, 0.3, 0.93);
      const r = Math.random();
      if (mode === 'squeeze' && this.bases[2]) {
        if (r < succ) {
          bstat.ab++;
          if (chance(0.12 + (speed - 50) * 0.004)) {
            this.advanceAll(1, B, B);
            bstat.h++; off.hits++;
            this.say(`${name}：スクイズ成功！ 打者も生きた(内野安打)`, 'hit');
          } else {
            this.addOut();
            bstat.ab--; // 犠打は打数に含めない
            this.advanceAll(1, null, B);
            this.say(`${name}：スクイズ成功！ 三塁走者生還`, 'run');
          }
        } else {
          bstat.ab++;
          this.addOut();
          if (chance(0.6)) {
            this.bases[2] = null;
            if (this.outs < 3) this.addOut();
            this.say(`${name}：スクイズ失敗…空振りで三塁走者もアウト`, 'out');
          } else {
            this.say(`${name}：スクイズ失敗…小フライ`, 'out');
          }
        }
        pitches = 2;
      } else {
        if (r < succ) {
          if (chance(0.06 + Math.max(0, speed - 60) * 0.006)) {
            bstat.ab++; bstat.h++; off.hits++;
            this.advanceAll(1, B, B);
            this.say(`${name}：セーフティバント成功！ 内野安打`, 'hit');
          } else {
            this.addOut();
            this.advanceAll(1, null, B);
            this.say(`${name}：送りバント成功`, 'out');
          }
        } else if (r < succ + 0.5 * (1 - succ)) {
          bstat.ab++;
          // 先頭走者が封殺される
          let lead = this.bases[2] && this.bases[1] && this.bases[0] ? 2 : this.bases[1] && this.bases[0] ? 1 : 0;
          if (this.bases[lead]) {
            for (let i = lead; i > 0; i--) this.bases[i] = this.bases[i - 1];
            this.bases[0] = B;
            this.addOut();
            this.say(`${name}：バント失敗…先頭走者が封殺`, 'out');
          } else {
            this.addOut();
            this.say(`${name}：バント失敗`, 'out');
          }
        } else {
          bstat.ab++;
          this.addOut();
          this.say(`${name}：バントは小フライ…アウト`, 'out');
        }
        pitches = 2;
      }
    } else {
      const diff = meet - st;
      let pK = 0.17 - diff * 0.0017;
      let pBB = 0.085 - (P.ctrl * cond(P) - 50) * 0.0012 + Math.max(0, this.tiredRatio() - 0.8) * 0.08;
      let pHit = 0.335 + diff * 0.0021 - (def.def - 45) * 0.0009 + (speed - 50) * 0.0006;
      let hrBoost = 0;
      if (mode === 'power') { pK += 0.06; pHit -= 0.02; hrBoost = 0.05; }
      if (mode === 'contact') { pK -= 0.07; pHit += 0.025; hrBoost = -0.03; }
      pK = clamp(pK, 0.03, 0.48);
      pBB = clamp(pBB, 0.02, 0.2);
      pHit = clamp(pHit, 0.12, 0.55);
      const r = Math.random();
      if (r < pK) {
        bstat.ab++;
        this.addOut();
        plog.k++;
        this.say(`${name}：${pick(['空振り三振', '見逃し三振', '空振り三振'])}`, 'out');
        pitches = ri(4, 7);
      } else if (r < pK + pBB) {
        this.forceWalk(B);
        this.say(`${name}：${chance(0.12) ? '死球' : '四球'}`, 'walk');
        pitches = ri(4, 7);
      } else if (Math.random() < pHit) {
        bstat.ab++; bstat.h++; off.hits++;
        const hr = clamp(0.03 + Math.max(0, power - 38) * 0.0042 + hrBoost - (st - 50) * 0.0008, 0.004, 0.35);
        const tr = clamp(0.025 + (speed - 50) * 0.0009, 0.005, 0.07);
        const db = clamp(0.17 + (power - 50) * 0.0025, 0.08, 0.32);
        const x = Math.random();
        if (x < hr) {
          bstat.hr++;
          this.advanceAll(4, B, B);
          this.say(`${name}：${pick(['レフトスタンドへ', 'バックスクリーンへ', 'ライトスタンドへ'])}ホームラン！`, 'hr');
        } else if (x < hr + tr) {
          this.advanceAll(3, B, B);
          this.say(`${name}：${pick(['右中間', '左中間'])}を破るスリーベース！`, 'hit');
        } else if (x < hr + tr + db) {
          // 二塁打: 二三塁走者は生還、一塁走者は生還 or 三塁
          const r1 = this.bases[0];
          if (this.bases[2]) { this.score(this.bases[2], B); this.bases[2] = null; }
          if (this.bases[1]) { this.score(this.bases[1], B); this.bases[1] = null; }
          this.bases[0] = null;
          if (r1) {
            if (chance(0.38 + (r1.speed - 50) * 0.008) && this.outs === 2) this.score(r1, B);
            else if (chance(0.28 + (r1.speed - 50) * 0.008)) this.score(r1, B);
            else this.bases[2] = r1;
          }
          this.bases[1] = B;
          this.say(`${name}：${pick(['レフト線', 'ライト線', '左中間', '右中間'])}へツーベース！`, 'hit');
        } else {
          // 単打
          const [r1, r2, r3] = this.bases;
          this.bases = [null, null, null];
          if (r3) this.score(r3, B);
          if (r2) {
            if (chance(0.5 + (r2.speed - 50) * 0.01 + (this.outs === 2 ? 0.25 : 0))) this.score(r2, B);
            else this.bases[2] = r2;
          }
          if (r1) {
            if (!this.bases[2] && chance(0.22 + (r1.speed - 50) * 0.008)) this.bases[2] = r1;
            else this.bases[1] = r1;
          }
          this.bases[0] = B;
          this.say(`${name}：${pick(['センター前ヒット', 'レフト前ヒット', 'ライト前ヒット', '三遊間を破るヒット', '一二塁間を抜けるヒット', '内野安打'])}`, 'hit');
        }
        pitches = ri(2, 6);
      } else {
        // 凡打
        bstat.ab++;
        pitches = ri(1, 5);
        const errP = clamp(0.03 + (45 - def.def) * 0.0012, 0.006, 0.09);
        if (chance(errP)) {
          def.errors++;
          this.advanceAll(1, B, null);
          this.say(`${name}：${pick(['ショート', 'サード', 'セカンド', 'ファースト'])}のエラーで出塁`, 'walk');
        } else {
          const kind = Math.random();
          if (kind < 0.5) {
            // ゴロ
            if (this.bases[0] && this.outs < 2 && chance(clamp(0.5 - (speed - 50) * 0.008, 0.15, 0.75))) {
              this.bases[0] = null;
              this.addOut(2);
              if (this.outs < 3) {
                if (this.bases[2]) { this.score(this.bases[2], null); this.bases[2] = null; }
                if (this.bases[1]) { this.bases[2] = this.bases[1]; this.bases[1] = null; }
              }
              this.say(`${name}：${pick(['ショート', 'セカンド', 'サード'])}ゴロ、ゲッツー`, 'out');
            } else {
              this.addOut();
              if (this.outs < 3) {
                // 進塁打
                if (this.bases[2] && chance(0.45)) { this.score(this.bases[2], B); this.bases[2] = null; }
                if (this.bases[1] && !this.bases[2]) { this.bases[2] = this.bases[1]; this.bases[1] = null; }
                if (this.bases[0] && !this.bases[1]) { this.bases[1] = this.bases[0]; this.bases[0] = null; }
              }
              this.say(`${name}：${pick(['ショートゴロ', 'セカンドゴロ', 'サードゴロ', 'ファーストゴロ', 'ピッチャーゴロ'])}`, 'out');
            }
          } else if (kind < 0.9) {
            this.addOut();
            if (this.outs < 3 && this.bases[2] && chance(0.3 + power * 0.005)) {
              this.score(this.bases[2], B);
              this.bases[2] = null;
              bstat.ab--;
              this.say(`${name}：${pick(['センター', 'レフト', 'ライト'])}への犠牲フライ`, 'run');
            } else {
              this.say(`${name}：${pick(['センターフライ', 'レフトフライ', 'ライトフライ', 'ショートフライ', 'キャッチャーファウルフライ'])}`, 'out');
            }
          } else {
            this.addOut();
            this.say(`${name}：${pick(['ショートライナー', 'セカンドライナー', 'ピッチャーライナー', 'サードライナー'])}`, 'out');
          }
        }
      }
    }
    def.pc += pitches;
    plog.pc += pitches;
    const scored = off.runs - runsBefore;
    this.recordPlay(snap, B, mode === 'ibb' ? 'IBB' : null);
    if (scored > 0) this.say(`${off.name} ${scored}点！（${this.sides[0].runs}-${this.sides[1].runs}）`, 'score');
    off.idx++;
    this.afterPlay();
  }

  // ---- アニメーション用の記録 ----
  snapshot() {
    return { bases: this.bases.slice(), outs: this.outs, runs: this.offense().runs, logAt: this.log.length, top: this.top };
  }
  recordPlay(snap, batter, kind) {
    const line = this.log[snap.logAt];
    this.playSeq = (this.playSeq || 0) + 1;
    this.lastPlay = {
      seq: this.playSeq,
      kind,
      text: line ? line.text : '',
      before: snap.bases,
      after: this.bases.slice(),
      outsBefore: snap.outs,
      outsAfter: Math.min(3, this.outs),
      scored: this.offense().runs - snap.runs,
      batter,
      top: snap.top,
    };
  }

  // ---- 盗塁 ----
  canSteal() {
    return (this.bases[0] && !this.bases[1]) || (this.bases[1] && !this.bases[2] && !this.bases[0]);
  }
  steal() {
    if (!this.canSteal()) return;
    const from = this.bases[0] && !this.bases[1] ? 0 : 1;
    const runner = this.bases[from];
    const snap = this.snapshot();
    const p = clamp(0.62 + (runner.speed * cond(runner) - 50) * 0.009 - (catcherArm(this.defense()) - 50) * 0.006 - (from === 1 ? 0.08 : 0), 0.15, 0.94);
    this.bases[from] = null;
    const short = runner.name.split(' ')[0];
    if (chance(p)) {
      this.bases[from + 1] = runner;
      this.say(`${short}：${from === 0 ? '二盗' : '三盗'}成功！`, 'hit');
    } else {
      this.addOut();
      this.say(`${short}：盗塁失敗…タッチアウト`, 'out');
    }
    this.defense().pc += 1;
    this.recordPlay(snap, null, 'STEAL');
    this.afterPlay();
  }

  // ---- 投手交代 ----
  changePitcher(newP) {
    const d = this.defense();
    const idx = d.order.findIndex((o) => o.p === d.pitcher);
    d.bullpen = d.bullpen.filter((p) => p !== newP);
    const old = d.pitcher;
    d.pitcher = newP;
    d.pc = 0;
    d.stamMax = pitcherStamina(newP);
    if (idx >= 0) d.order[idx] = { p: newP, slot: '投' };
    if (!d.pitchLog.has(newP.id)) d.pitchLog.set(newP.id, { p: newP, outs: 0, er: 0, k: 0, pc: 0 });
    this.say(`${d.name}：投手交代 ${old.name.split(' ')[0]} → ${newP.name.split(' ')[0]}`, 'info');
  }
  // 現在守備中のチーム用(攻撃中に呼ぶ場合は次の守備で反映)
  bestReliever(side) {
    const cands = side.bullpen.filter((p) => p.injury === 0);
    if (!cands.length) return null;
    cands.sort((a, b) => (b.velo + b.ctrl + b.brk) * cond(b) - (a.velo + a.ctrl + a.brk) * cond(a));
    return cands[0];
  }
  aiPitchingChange() {
    const d = this.defense();
    const t = d.pc / d.stamMax;
    const close = Math.abs(this.sides[0].runs - this.sides[1].runs) <= 3;
    if (t > 1.0 || (t > 0.85 && close && this.inning >= 7)) {
      const r = this.bestReliever(d);
      if (r && pitcherStamina(r) * 0.6 > (d.stamMax - d.pc)) this.changePitcher(r);
    }
  }

  // ---- AI の攻撃作戦 ----
  aiCommand() {
    const B = this.batter();
    const off = this.offense();
    const def = this.defense();
    const diff = off.runs - def.runs;
    const close = Math.abs(diff) <= 2;
    // 敬遠: 守備側のAIは強打者+一塁空き+終盤接戦で
    if (this.canSteal() && this.bases[0] && this.bases[0].speed > 62 && chance(0.25)) return 'steal';
    if (this.bases[2] && this.outs < 2 && close && this.inning >= 7 && batValue(B) < 50 && chance(0.25)) return 'squeeze';
    if ((this.bases[0] || this.bases[1]) && !this.bases[2] && this.outs === 0 && close && batValue(B) < 52 && chance(0.55)) return 'bunt';
    if (B.power > 65 && chance(0.4)) return 'power';
    if (B.meet > B.power + 10 && chance(0.4)) return 'contact';
    return 'normal';
  }
  aiDefenseCommand() {
    const B = this.batter();
    const off = this.offense();
    const def = this.defense();
    if (!this.bases[0] && (this.bases[1] || this.bases[2]) && this.inning >= 8 && Math.abs(off.runs - def.runs) <= 1 && batValue(B) > 68 && chance(0.6)) return 'ibb';
    return null;
  }

  /** AIが1プレー進める(盗塁 or 打席) */
  autoStep() {
    if (this.over) return;
    this.aiPitchingChange();
    const ibb = this.aiDefenseCommand();
    if (ibb) { this.plateAppearance('ibb'); return; }
    const cmd = this.aiCommand();
    if (cmd === 'steal') this.steal();
    else this.plateAppearance(cmd);
  }

  // ---- イニング管理 ----
  afterPlay() {
    const home = this.sides[1], away = this.sides[0];
    // サヨナラ
    if (!this.top && this.inning >= 9 && home.runs > away.runs) {
      this.say(`サヨナラ！ ${home.name}の勝利！`, 'end');
      this.endGame();
      return;
    }
    // コールド(裏の途中でも成立)
    if (!this.top && this.checkMercy(true)) return;
    if (this.outs >= 3) this.endHalf();
  }
  checkMercy(midBottom) {
    if (!this.mercy) return false;
    const home = this.sides[1], away = this.sides[0];
    const d = home.runs - away.runs;
    // 表終了時: 後攻がリードしていれば裏不要。裏の途中: 後攻が規定点差でリードした時点
    if (midBottom && !(this.inning >= 5 && ((this.inning >= 7 && d >= 7) || d >= 10))) return false;
    if (!midBottom) {
      const diff = Math.abs(d);
      const leader = d > 0 ? home : away;
      // 表終了時は後攻リードでのみ成立、裏終了時はどちらでも
      if (this.top && d <= 0) return false;
      if (!(this.inning >= 5 && ((this.inning >= 7 && diff >= 7) || diff >= 10))) return false;
      this.say(`${this.inning}回コールドゲーム。${leader.name}の勝利`, 'end');
      this.resultNote = `${this.inning}回コールド`;
      this.endGame();
      return true;
    }
    this.say(`${this.inning}回コールドゲーム。${home.name}の勝利`, 'end');
    this.resultNote = `${this.inning}回コールド`;
    this.endGame();
    return true;
  }
  endHalf() {
    const home = this.sides[1], away = this.sides[0];
    this.outs = 0;
    this.bases = [null, null, null];
    if (this.top) {
      if (this.inning >= 9 && home.runs > away.runs) { this.say(`試合終了 ${home.name}の勝利`, 'end'); this.endGame(); return; }
      if (this.checkMercy(false)) return;
      this.top = false;
      home.line.push(0);
    } else {
      if (this.inning >= 9 && home.runs !== away.runs) {
        const w = home.runs > away.runs ? home : away;
        this.say(`試合終了 ${w.name}の勝利`, 'end');
        this.endGame();
        return;
      }
      if (this.checkMercy(false)) return;
      if (this.inning >= 15) {
        // 決着つかず: 抽選
        const w = chance(0.5) ? home : away;
        this.say(`15回引き分け。抽選の結果、${w.name}が勝ち上がり`, 'end');
        this.resultNote = '抽選';
        this.lotteryWinner = w;
        this.endGame();
        return;
      }
      this.inning++;
      this.top = true;
      away.line.push(0);
    }
    this.defense().def = sideDefense(this.defense());
    // タイブレーク(10回以降は無死一二塁から)
    if (this.inning >= 10) {
      const o = this.offense();
      const n = o.order.length;
      this.bases[1] = o.order[(o.idx - 1 + n * 10) % 9].p;
      this.bases[0] = o.order[(o.idx - 2 + n * 10) % 9].p;
      this.say(`${this.inning}回${this.top ? '表' : '裏'} タイブレーク：無死一二塁から`, 'info');
    }
  }
  endGame() {
    this.over = true;
  }
  winner() {
    if (!this.over) return null;
    if (this.lotteryWinner) return this.lotteryWinner;
    const [a, h] = this.sides;
    return a.runs > h.runs ? a : h;
  }

  /** 最後まで自動で進める */
  simToEnd() {
    let guard = 0;
    while (!this.over && guard++ < 2000) this.autoStep();
  }
  /** 現在のハーフイニングを自動で進める */
  simHalf() {
    const startTop = this.top, startInning = this.inning;
    let guard = 0;
    while (!this.over && this.top === startTop && this.inning === startInning && guard++ < 300) this.autoStep();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { Match, makeSide, buildLineup, pickStarter, pitcherStamina };
}
