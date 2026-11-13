'use strict';
// ===== 試合アニメーション(Canvas 2D) =====
// バックネット裏から見下ろす視点。座標はフィート、本塁が原点、y がセンター方向。

const Anim = (() => {
  const W = 360, H = 230;
  const CAM = { hy: 30, h: 62, f: 230, d0: 78 };
  const BASE = [[63.6, 63.6], [0, 127.3], [-63.6, 63.6], [0, 0]]; // 一塁・二塁・三塁・本塁
  const FPOS = { P: [0, 58], C: [0, -6], '1B': [62, 86], '2B': [30, 132], SS: [-32, 132], '3B': [-60, 84], LF: [-150, 255], CF: [0, 305], RF: [150, 255] };
  const DEG = Math.PI / 180;
  const fenceR = (t) => 330 + 75 * Math.cos(2 * t * DEG);
  const polar = (t, r) => [r * Math.sin(t * DEG), r * Math.cos(t * DEG)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => t * t * (3 - 2 * t);
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  const UNI = {
    me: { shirt: '#f4f1e6', pants: '#f4f1e6', cap: '#b4632f', trim: '#b4632f' },
    opp: { shirt: '#8d9ab2', pants: '#dde1ea', cap: '#23345e', trim: '#23345e' },
  };

  function proj(x, y, z = 0) {
    const d = Math.max(24, y + CAM.d0);
    const k = CAM.f / d;
    return { x: W / 2 + x * k, y: CAM.hy + (CAM.h - z) * k, k };
  }

  // ---------- 背景(テーマごとにキャッシュ) ----------
  let bgCache = null, bgKey = '';
  function isNight() {
    const de = document.documentElement;
    if (de.dataset.theme === 'dark') return true;
    if (de.dataset.theme === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function background(dpr) {
    const night = isNight();
    const key = `${night}-${dpr}`;
    if (bgCache && bgKey === key) return bgCache;
    const cv = document.createElement('canvas');
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    const col = night
      ? { sky1: '#060c1f', sky2: '#1b2a4c', stand: '#252e3c', crowd: ['#3a4456', '#4d5668', '#6b6150', '#2f3a4d'], grass1: '#3c8a43', grass2: '#357c3c', dirt: '#b97c4c', wall: '#173a2a', line: '#f5f5f0' }
      : { sky1: '#8fc7ec', sky2: '#d9eef9', stand: '#7c8794', crowd: ['#a7b0ba', '#d9d2c4', '#5f6a78', '#c25b4b', '#e8e4da'], grass1: '#58a552', grass2: '#4f9a4a', dirt: '#c98a55', wall: '#22553a', line: '#ffffff' };
    // 空
    const g = c.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, col.sky1); g.addColorStop(1, col.sky2);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // スタンドと観客
    const poleL = proj(-233, 233), poleR = proj(233, 233);
    c.fillStyle = col.stand;
    c.fillRect(0, 18, W, H);
    let seed = 7;
    const rr = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 520; i++) {
      const x = rr() * W, y = 20 + rr() * (poleL.y - 18);
      c.fillStyle = col.crowd[Math.floor(rr() * col.crowd.length)];
      c.fillRect(x, y, 2, 2);
    }
    // ナイター照明
    if (night) {
      for (const lx of [40, W - 40]) {
        const rg = c.createRadialGradient(lx, 12, 1, lx, 12, 46);
        rg.addColorStop(0, 'rgba(255,250,220,0.95)'); rg.addColorStop(0.15, 'rgba(255,245,200,0.45)'); rg.addColorStop(1, 'rgba(255,245,200,0)');
        c.fillStyle = rg; c.fillRect(lx - 50, 0, 100, 60);
      }
    }
    // フェンスより手前の芝生
    const arc = [];
    for (let t = -45; t <= 45; t += 3) arc.push(proj(...polar(t, fenceR(t))));
    c.beginPath();
    c.moveTo(0, H); c.lineTo(0, poleL.y);
    for (const p of arc) c.lineTo(p.x, p.y);
    c.lineTo(W, poleR.y); c.lineTo(W, H); c.closePath();
    c.fillStyle = col.grass1; c.fill();
    // 芝目
    c.save(); c.clip();
    for (let r = 60; r < 420; r += 40) {
      c.beginPath();
      for (let t = -60; t <= 60; t += 4) { const p = proj(...polar(t, r)); t === -60 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y); }
      for (let t = 60; t >= -60; t -= 4) { const p = proj(...polar(t, r + 20)); c.lineTo(p.x, p.y); }
      c.closePath(); c.fillStyle = col.grass2; c.fill();
    }
    c.restore();
    // フェンス
    c.beginPath();
    arc.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    for (let i = arc.length - 1; i >= 0; i--) { const t = -45 + i * 3; const p = proj(...polar(t, fenceR(t)), 11); c.lineTo(p.x, p.y); }
    c.closePath(); c.fillStyle = col.wall; c.fill();
    // 内野の土
    c.beginPath();
    let p0 = proj(0, -14); c.moveTo(p0.x, p0.y);
    for (let t = -46; t <= 46; t += 2) { const p = proj(...polar(t, 152)); c.lineTo(p.x, p.y); }
    c.closePath(); c.fillStyle = col.dirt; c.fill();
    // 内野の芝
    c.beginPath();
    for (const [x, y] of [[0, 14], [52, 64], [0, 116], [-52, 64]]) { const p = proj(x, y); c.lineTo(p.x, p.y); }
    c.closePath(); c.fillStyle = col.grass1; c.fill();
    // マウンドと本塁周り
    const ell = (x, y, r, fill) => {
      const a = proj(x - r, y), b = proj(x + r, y), f = proj(x, y - r), n = proj(x, y + r);
      c.beginPath(); c.ellipse((a.x + b.x) / 2, (f.y + n.y) / 2, (b.x - a.x) / 2, Math.abs(f.y - n.y) / 2, 0, 0, Math.PI * 2);
      c.fillStyle = fill; c.fill();
    };
    ell(0, 60.5, 9, col.dirt);
    ell(0, 0, 13, col.dirt);
    // ファウルライン
    c.strokeStyle = col.line; c.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      const a = proj(0, 0), b = proj(s * 233, 233);
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
    }
    // 塁
    c.fillStyle = col.line;
    for (let i = 0; i < 3; i++) {
      const [x, y] = BASE[i];
      const pts = [[x, y - 2], [x + 2, y], [x, y + 2], [x - 2, y]].map(([a, b]) => proj(a, b));
      c.beginPath(); pts.forEach((p, j) => (j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.fill();
    }
    const plate = [[-0.8, 0.6], [0.8, 0.6], [0.8, -0.2], [0, -0.9], [-0.8, -0.2]].map(([a, b]) => proj(a * 1.6, b * 1.6));
    c.beginPath(); plate.forEach((p, j) => (j ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.fill();
    const rub = proj(0, 60.5);
    c.fillRect(rub.x - 3 * rub.k / 2, rub.y - 0.6, 3 * rub.k, 1.2);
    bgCache = cv; bgKey = key;
    return cv;
  }

  // ---------- 人物・ボール ----------
  function figure(c, x, y, uni, o = {}) {
    const p = proj(x, y);
    const s = Math.max(0.42, p.k / 2.95) * (o.scale || 1);
    c.save();
    c.globalAlpha = o.alpha == null ? 1 : o.alpha;
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath(); c.ellipse(p.x, p.y, 5.5 * s, 1.9 * s, 0, 0, Math.PI * 2); c.fill();
    const ps = o.pose;
    if (ps && ps.type === 'jump') {
      c.translate(0, -Math.sin(Math.PI * clamp(ps.f, 0, 1)) * 9 * s);
    } else if (ps && ps.type === 'reach') {
      const lean = Math.sin(Math.PI * clamp(ps.f, 0, 1)) * 0.55;
      c.translate(p.x, p.y); c.rotate((ps.dir || 1) * lean); c.translate(-p.x, -p.y);
    } else if (ps && (ps.type === 'dive' || ps.type === 'slide')) {
      // 飛び込み・スライディング: 足元を軸に体を倒す
      const lie = ps.type === 'slide' ? 1 : clamp(ps.f * 4, 0, 1) * (ps.f > 0.75 ? clamp((1 - ps.f) * 4, 0, 1) : 1);
      c.translate(p.x, p.y);
      c.rotate((ps.dir || 1) * 1.3 * lie);
      c.translate(-p.x, -p.y + lie * 1.5 * s);
    }
    const crouch = o.crouch ? 4 * s : 0;
    const legH = 7 * s - crouch;
    c.fillStyle = uni.pants;
    c.fillRect(p.x - 3.3 * s, p.y - legH, 2.7 * s, legH);
    c.fillRect(p.x + 0.6 * s, p.y - legH, 2.7 * s, legH);
    c.fillStyle = '#2a2a2a';
    c.fillRect(p.x - 3.5 * s, p.y - 1.2 * s, 3 * s, 1.2 * s);
    c.fillRect(p.x + 0.5 * s, p.y - 1.2 * s, 3 * s, 1.2 * s);
    const by = p.y - legH - 8.5 * s;
    c.fillStyle = uni.shirt;
    c.beginPath(); c.roundRect(p.x - 4.6 * s, by, 9.2 * s, 9 * s, 3 * s); c.fill();
    c.fillStyle = uni.trim;
    c.fillRect(p.x - 4.6 * s, by + 6.2 * s, 9.2 * s, 1.1 * s);
    const hy = by - 3.4 * s;
    c.fillStyle = '#f0c8a0';
    c.beginPath(); c.arc(p.x, hy, 3.6 * s, 0, Math.PI * 2); c.fill();
    c.fillStyle = uni.cap;
    c.beginPath(); c.arc(p.x, hy - 0.4 * s, 3.8 * s, Math.PI, 0); c.fill();
    c.fillRect(p.x - (o.facing === 'away' ? 3.8 : 0) * s, hy - 0.8 * s, 3.8 * s, 1.1 * s);
    if (o.bat != null) {
      c.strokeStyle = '#d9b27a'; c.lineWidth = 1.6 * s; c.lineCap = 'round';
      const hx = p.x + 3 * s, hy2 = by + 3 * s;
      c.beginPath(); c.moveTo(hx, hy2); c.lineTo(hx + Math.cos(o.bat) * 12 * s, hy2 - Math.sin(o.bat) * 12 * s); c.stroke();
    }
    c.restore();
  }
  function ball(c, b) {
    const g = proj(b.x, b.y, 0);
    const p = proj(b.x, b.y, b.z);
    const r = Math.max(1.5, 0.75 * p.k);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(g.x, g.y, r, r * 0.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff';
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 0.6;
    c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  function dust(c, pf) {
    const p = proj(pf.x, pf.y);
    const s = Math.max(0.5, p.k / 2.95);
    c.save();
    c.globalAlpha = 0.55 * (1 - pf.f);
    c.fillStyle = '#d8b48a';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26;
      const r = (2 + pf.f * 7) * s;
      c.beginPath(); c.arc(p.x + Math.cos(a) * r, p.y - 2 * s + Math.sin(a) * r * 0.4, (2.5 + pf.f * 3) * s, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  const LABEL_COL = { hr: '#ff6150', hit: '#ffd23f', score: '#ffd23f', run: '#ffd23f', walk: '#a8dcff', out: '#ffffff', info: '#ffffff' };
  function label(c, l) {
    if (!l || l.alpha <= 0) return;
    c.save();
    c.globalAlpha = l.alpha;
    const size = l.text.length > 12 ? 17 : l.text.length > 8 ? 20 : 24;
    const y = H * 0.2 - (1 - l.alpha) * 6;
    c.fillStyle = 'rgba(10,20,14,0.55)';
    c.fillRect(0, y - size * 0.95, W, size * 1.55);
    c.font = `${size}px 'Dela Gothic One', 'Hiragino Kaku Gothic StdN', sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.6)';
    c.strokeText(l.text, W / 2, y - size * 0.15);
    c.fillStyle = LABEL_COL[l.cls] || '#fff';
    c.fillText(l.text, W / 2, y - size * 0.15);
    if (l.sub) {
      c.font = "bold 12px 'Zen Kaku Gothic New', sans-serif";
      c.fillStyle = '#fff';
      c.fillText(l.sub, W / 2, y + size * 0.45);
    }
    c.restore();
  }

  function draw(cv, st) {
    const dpr = cv.width / W;
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(background(dpr), 0, 0);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 遠い順に描く
    const ents = [];
    const poses = st.poses || {};
    for (const [k, pos] of Object.entries(st.fielders)) ents.push({ y: pos[1], f: () => figure(c, pos[0], pos[1], st.def, { crouch: k === 'C' && !poses[k], facing: 'home', pose: poses[k] }) });
    for (const r of st.runners) if (r.alpha > 0) ents.push({ y: r.y, f: () => figure(c, r.x, r.y, st.off, { alpha: r.alpha, facing: 'away', pose: r.pose }) });
    for (const pf of st.puffs || []) ents.push({ y: pf.y - 0.2, f: () => dust(c, pf) });
    if (st.batter && st.batter.alpha > 0) ents.push({ y: st.batter.y + 0.5, f: () => figure(c, st.batter.x, st.batter.y, st.off, { alpha: st.batter.alpha, bat: st.batter.bat, facing: 'away' }) });
    if (st.ball) ents.push({ y: st.ball.y - 0.1, f: () => ball(c, st.ball) });
    ents.sort((a, b) => b.y - a.y);
    for (const e of ents) e.f();
    label(c, st.label);
  }

  // ---------- プレーの解釈 ----------
  function classify(text, kind) {
    if (kind === 'STEAL') return 'STEAL';
    if (kind === 'IBB') return 'IBB';
    const t = text;
    if (/ホームラン/.test(t)) return 'HR';
    if (/スリーベース/.test(t)) return '3B';
    if (/ツーベース/.test(t)) return '2B';
    if (/空振りで三塁走者/.test(t)) return 'SQX';
    if (/スクイズ|バント/.test(t) && /小フライ/.test(t)) return 'POP';
    if (/スクイズ|バント/.test(t)) return /内野安打/.test(t) ? 'BUNTHIT' : 'BUNT';
    if (/内野安打/.test(t)) return 'IH';
    if (/ヒット/.test(t)) return '1B';
    if (/三振/.test(t)) return 'K';
    if (/四球|死球/.test(t)) return 'BB';
    if (/エラー/.test(t)) return 'E';
    if (/ゲッツー/.test(t)) return 'DP';
    if (/犠牲フライ/.test(t)) return 'SF';
    if (/ファウルフライ/.test(t)) return 'FOUL';
    if (/フライ/.test(t)) return 'FO';
    if (/ライナー/.test(t)) return 'LO';
    return 'GO';
  }
  function direction(t) {
    const table = [['レフト線', -42], ['ライト線', 42], ['左中間', -18], ['右中間', 18], ['三遊間', -24], ['一二塁間', 22], ['バックスクリーン', 0],
      ['レフト', -31], ['ライト', 31], ['センター', 0], ['ショート', -15], ['サード', -35], ['セカンド', 14], ['ファースト', 37], ['ピッチャー', 0]];
    for (const [w, d] of table) if (t.includes(w)) return d + (Math.random() * 6 - 3);
    return Math.random() * 60 - 30;
  }
  function nearestFielder(pt, allowP) {
    let best = null, bd = 1e9;
    for (const [k, pos] of Object.entries(FPOS)) {
      if (k === 'C' || (k === 'P' && !allowP)) continue;
      const d = dist(pos, pt);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }
  function basePos(i) { return i < 0 ? [-1.5, 0] : BASE[Math.min(i, 3)]; }
  function pathFor(from, to) {
    const pts = [basePos(from)];
    for (let i = from + 1; i <= to; i++) pts.push(basePos(i));
    return pts;
  }
  function along(pts, f) {
    if (pts.length < 2) return pts[0];
    const seg = [];
    let tot = 0;
    for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1], pts[i]); seg.push(d); tot += d; }
    let want = tot * clamp(f, 0, 1);
    for (let i = 0; i < seg.length; i++) {
      if (want <= seg[i] || i === seg.length - 1) {
        const t = seg[i] ? Math.min(1, want / seg[i]) : 1;
        return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)];
      }
      want -= seg[i];
    }
    return pts[pts.length - 1];
  }

  /** プレーの時間軸を組み立てる。返り値の at(t) がその時刻の状態を返す */
  const IF_KEYS = ['P', '1B', '2B', 'SS', '3B'];
  const OF_KEYS = ['LF', 'CF', 'RF'];
  const FIRST = [60, 63], SECOND = [3, 125], THIRD = [-60, 63], PLATE = [0, 1];
  const BASE_COVER = [FIRST, SECOND, THIRD, PLATE];
  function nearestOf(pt, keys) {
    let best = keys[0], bd = 1e9;
    for (const k of keys) { const d = dist(FPOS[k], pt); if (d < bd) { bd = d; best = k; } }
    return best;
  }
  const pickV = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const R = (a, b) => a + Math.random() * (b - a);

  function build(m, lp) {
    const text = lp.text.split('：').slice(1).join('：') || lp.text;
    const kind = classify(text, lp.kind);
    const offSide = m.sides[lp.top ? 0 : 1];
    const off = offSide === m.me ? UNI.me : UNI.opp;
    const def = offSide === m.me ? UNI.opp : UNI.me;
    const RUN = 0.14; // ft/ms

    const balls = [], moves = [], poses = [], puffs = [], swings = [];
    const addBall = (t0, t1, a, b, o = {}) => { balls.push({ t0, t1, a, b, arc: o.arc || 0, bounce: o.bounce || 0, hide: !!o.hide }); return t1; };
    const move = (k, t0, t1, to) => moves.push({ k, t0, t1: Math.max(t0 + 1, t1), to: to.slice() });
    const pose = (k, t0, t1, type, dir = 1) => poses.push({ k, t0, t1, type, dir });
    const puff = (t, pt) => puffs.push({ t, x: pt[0], y: pt[1] });
    const throwBall = (t0, a, b, o = {}) => {
      const d = dist(a, b);
      const t1 = t0 + Math.max(200, d * (o.slow ? 3.3 : 2.4));
      addBall(t0, t1, [a[0], a[1], 5], [b[0], b[1], o.endZ || 4], { arc: Math.min(22, d * 0.05) + (o.high ? 10 : 0) });
      return t1;
    };
    const toward = (from, to, ft) => { const d = dist(from, to) || 1; const f = Math.min(1, ft / d); return [lerp(from[0], to[0], f), lerp(from[1], to[1], f)]; };
    const side = (pt) => (pt[0] < 0 ? -1 : 1);

    // ---- 走者の結末を先に決める(誰がアウトで誰が生還か) ----
    const scorers = lp.scored - (kind === 'HR' ? 1 : 0);
    let left = Math.max(0, scorers);
    const runners = [];
    for (let i = 2; i >= 0; i--) {
      const r = lp.before[i];
      if (!r) continue;
      const j = lp.after.indexOf(r);
      if (j >= 0) runners.push({ from: i, to: j, out: false });
      else if (left > 0) { left--; runners.push({ from: i, to: 3, out: false }); }
      else runners.push({ from: i, to: i + 1, out: true });
    }
    const outRunner = runners.find((r) => r.out);
    const batterSafe = lp.batter && lp.after.includes(lp.batter);

    // 結果を決める情報(各プレーが書き込む)
    const res = { tLabel: 0, batterOutAt: null, batterOutProg: 0.9, batterSafeAt: null, runnerOutAt: null, runStart: null, runnerSafeAt: null, batterStay: false, slow: false, close: false };

    // ---- 投球(勝負の一球のみ) ----
    const t = 0;
    const mound = [0.6, 56, 6];
    const pitch = (t0, end) => addBall(t0, t0 + 430, mound, end, { arc: 0.5 });
    const returnBall = (t0) => addBall(t0, t0 + 420, [0, -4, 4], mound, { arc: 7 });

    // ---- 勝負の一球 ----
    const P0 = t;
    const C = P0 + 430; // 投球が本塁に届く(インパクト)時刻
    res.runStart = C;

    const doK = () => {
      pitch(P0, [R(-1.5, 1.5), 0, R(2, 4.5)]);
      if (/空振り/.test(text)) swings.push(C - 60);
      res.tLabel = C + 60; res.batterStay = true;
    };
    const doWalk = () => {
      if (/死球/.test(text)) { pitch(P0, [-3.5, 0.2, 4]); puff(C, [-3.5, 0]); }
      else if (kind === 'IBB') { pitch(P0, [7, 0, 4]); move('C', P0, P0 + 250, [6, -6]); }
      else pitch(P0, [R(-10, 10), 0, Math.random() < 0.5 ? R(0.5, 1.5) : R(6, 8)]);
      res.tLabel = C + 80; res.runStart = C + 200; res.slow = true;
    };
    const doSteal = () => {
      const from = lp.before[0] && !lp.before[1] ? 0 : 1;
      const tgt = BASE_COVER[from + 1];
      const coverK = from === 0 ? pickV(['SS', '2B']) : '3B';
      pitch(P0, [R(-1, 1), 0, R(2, 4)]);
      res.runStart = P0 - 150;
      const success = !outRunner;
      const v = success ? pickV(['late', 'late', 'nothrow', 'high']) : pickV(['ontime', 'ontime']);
      move(coverK, P0 + 200, C + 300, tgt);
      if (v === 'nothrow') {
        res.runnerSafeAt = C + 380;
        res.tLabel = C + 420;
        returnBall(C + 500);
      } else {
        const arr = throwBall(C + 120, [0, -3], [tgt[0], tgt[1]], { endZ: v === 'high' ? 9 : 2 });
        if (v === 'high') pose(coverK, arr - 120, arr + 200, 'jump');
        if (success) res.runnerSafeAt = arr - R(40, 160);
        else res.runnerOutAt = arr + 40;
        res.close = true;
        res.tLabel = arr + 60;
        puff(arr, tgt);
      }
    };
    const doSqueezeMiss = () => {
      pitch(P0, [2, 0, 3]); swings.push(C - 80);
      res.runStart = P0 - 200;
      res.runnerOutAt = C + 380;
      move('C', C, C + 300, [-1, 6]);
      puff(C + 380, [-2, 8]);
      res.tLabel = C + 420; res.batterStay = true;
    };

    // ---- 外野へのヒット ----
    function cutoffThrow(t0, from) {
      const cut = from[0] < 0 ? [-30, 150] : [30, 150];
      const ck = from[0] < 0 ? 'SS' : '2B';
      move(ck, t0 - 400, t0, cut);
      throwBall(t0, from, cut);
    }
    // 外野からの返球先を走者の動きで決める
    function ofReturn(t0, fp) {
      const scoringFrom2 = runners.some((r) => r.from === 1 && r.to === 3);
      const firstToThird = runners.some((r) => r.from === 0 && r.to === 2);
      const x = Math.random();
      if (scoringFrom2 && x < 0.6) { move('C', t0 - 300, t0, [0, 2]); throwBall(t0, fp, PLATE, { high: true }); return; }
      if (firstToThird && x < 0.6) { move('3B', t0 - 400, t0, THIRD); throwBall(t0, fp, THIRD); return; }
      if (x < 0.35) { const k = fp[0] < 0 ? 'SS' : '2B'; move(k, t0 - 400, t0, SECOND); throwBall(t0, fp, SECOND); return; }
      cutoffThrow(t0, fp);
    }
    const IF4 = ['1B', '2B', 'SS', '3B'];
    function doSingle(th) {
      const v = pickV(['clean', 'clean', 'reach', 'dive', 'liner', 'liner-dive', 'bloop', 'bloop-reach', 'texas',
        'middle-glove', 'middle-bag', 'chopper', 'deflect', 'onehop', 'charge', 'bobble', 'line-hug']);
      res.variant = v;
      const ofField = (fp, tArrive, tFirst) => { const ok = nearestOf(fp, OF_KEYS); move(ok, tFirst, tArrive, fp); return ok; };
      // 内野を抜けるゴロ(ifPose: null / reach / dive / jump)
      const through = (t2, ifPose, ifRange, fpDist) => {
        const gp = polar(t2, 118);
        const fp = polar(t2, fpDist || R(200, 222));
        addBall(C, C + 420, [0, 2, 1], [gp[0], gp[1], 0.5], { bounce: 2 });
        addBall(C + 420, C + 1000, [gp[0], gp[1], 0.5], [fp[0], fp[1], 0.3], { bounce: 1 });
        const ik = nearestOf(gp, IF4);
        const reach = dist(FPOS[ik], gp) - (ifRange || 7);
        move(ik, C + 60, C + 380, toward(FPOS[ik], gp, Math.max(2, reach)));
        if (ifPose) pose(ik, C + 300, C + (ifPose === 'dive' ? 1100 : 650), ifPose, side([gp[0] - FPOS[ik][0], 0]));
        if (ifPose === 'dive') puff(C + 420, gp);
        ofField(fp, C + 1000, C + 100);
        res.tLabel = C + 470;
        return fp;
      };
      let fp, tDone;
      switch (v) {
        case 'clean': fp = through(th, null, 14); tDone = C + 1150; break;
        case 'reach': fp = through(th, 'reach', 9); tDone = C + 1150; break;
        case 'dive': fp = through(th, 'dive', 7); tDone = C + 1150; break;
        case 'middle-bag': {
          const t2 = R(-4, 4);
          fp = through(t2, null, 16, R(230, 250));
          const other = nearestOf(polar(t2, 118), ['SS', '2B']) === 'SS' ? '2B' : 'SS';
          move(other, C + 60, C + 400, toward(FPOS[other], SECOND, 12));
          tDone = C + 1150; break;
        }
        case 'line-hug': {
          const t2 = (th < 0 ? -1 : 1) * R(38, 43);
          fp = through(t2, 'reach', 8, R(185, 200));
          tDone = C + 1150; break;
        }
        case 'liner': case 'liner-dive': {
          const d = R(165, 185);
          const lpt = polar(th, d);
          const ok = nearestOf(lpt, OF_KEYS);
          addBall(C, C + 620, [0, 2, 3], [lpt[0], lpt[1], 0.5], { arc: R(10, 16) });
          if (v === 'liner') {
            // 前に出てワンバウンドで処理
            fp = toward(lpt, FPOS[ok], 18);
            addBall(C + 620, C + 800, [lpt[0], lpt[1], 0.5], [fp[0], fp[1], 2], { arc: 3 });
            move(ok, C + 80, C + 800, fp);
            res.tLabel = C + 640; tDone = C + 900;
          } else {
            fp = polar(th, d + 35);
            addBall(C + 620, C + 1000, [lpt[0], lpt[1], 0.5], [fp[0], fp[1], 0.3], { bounce: 1 });
            move(ok, C + 80, C + 640, toward(FPOS[ok], lpt, dist(FPOS[ok], lpt) - 4));
            pose(ok, C + 520, C + 1150, 'dive', side([lpt[0] - FPOS[ok][0], 0]));
            puff(C + 640, lpt);
            move(ok, C + 1200, C + 1500, fp);
            res.tLabel = C + 640; tDone = C + 1550;
          }
          break;
        }
        case 'bloop': case 'bloop-reach': case 'texas': {
          // テキサスヒットはライン際に落ちる打球なので、左右に引っ張った打球のときだけ
          const t2 = v === 'texas' && Math.abs(th) >= 20 ? (th < 0 ? -1 : 1) * R(34, 41) : th;
          const lpt = polar(t2, R(145, 162));
          const T = R(1000, 1200);
          addBall(C, C + T, [0, 2, 3], [lpt[0], lpt[1], 0.5], { arc: R(30, 42) });
          const ik = nearestOf(lpt, IF4);
          const ok = nearestOf(lpt, OF_KEYS);
          fp = toward(lpt, FPOS[ok], 10); // 落ちた打球は外野手の方へ弾む
          addBall(C + T, C + T + 250, [lpt[0], lpt[1], 0.5], [fp[0], fp[1], 0.3], { bounce: 1 });
          move(ik, C + 150, C + T, toward(FPOS[ik], lpt, dist(FPOS[ik], lpt) - R(15, 22)));
          move(ok, C + 150, C + T, toward(FPOS[ok], lpt, dist(FPOS[ok], lpt) - R(9, 14)));
          if (v === 'bloop-reach') pose(ik, C + T - 200, C + T + 150, 'reach', side([lpt[0] - FPOS[ik][0], 0]));
          if (v === 'texas') {
            const k3 = nearestOf(lpt, IF4.filter((k) => k !== ik));
            move(k3, C + 150, C + T, toward(FPOS[k3], lpt, dist(FPOS[k3], lpt) - 26));
          }
          move(ok, C + T + 50, C + T + 280, fp);
          res.tLabel = C + T; tDone = C + T + 350;
          break;
        }
        case 'middle-glove': {
          const t2 = th * 0.2;
          pose('P', C + 80, C + 330, 'jump');
          fp = through(t2, null, 18, R(225, 245));
          tDone = C + 1150; break;
        }
        case 'chopper': {
          const ik = nearestOf(polar(th, 118), IF4);
          const b1 = polar(th, 45);
          const gp = toward(FPOS[ik], [0, 0], 4);
          fp = polar(th, R(195, 215));
          addBall(C, C + 300, [0, 2, 1], [b1[0], b1[1], 0], { arc: 4 });
          addBall(C + 300, C + 950, [b1[0], b1[1], 0], [gp[0] * 1.35, gp[1] * 1.35, 0.5], { arc: 26 });
          addBall(C + 950, C + 1400, [gp[0] * 1.35, gp[1] * 1.35, 0.5], [fp[0], fp[1], 0.3], { bounce: 1 });
          move(ik, C + 100, C + 700, gp);
          pose(ik, C + 650, C + 1000, 'jump');
          ofField(fp, C + 1400, C + 300);
          res.tLabel = C + 900; tDone = C + 1500;
          break;
        }
        case 'deflect': {
          const gp = polar(th, 112);
          const ik = nearestOf(gp, IF4);
          const t3 = th + (Math.random() < 0.5 ? -1 : 1) * R(12, 20);
          fp = polar(t3, R(185, 205));
          addBall(C, C + 400, [0, 2, 1], [gp[0], gp[1], 0.6], { bounce: 2 });
          addBall(C + 400, C + 1050, [gp[0], gp[1], 1], [fp[0], fp[1], 0.3], { bounce: 2 });
          move(ik, C + 60, C + 380, toward(FPOS[ik], gp, dist(FPOS[ik], gp) - 3));
          pose(ik, C + 300, C + 650, 'reach', side([gp[0] - FPOS[ik][0], 0]));
          ofField(fp, C + 1050, C + 350);
          res.tLabel = C + 520; tDone = C + 1150;
          break;
        }
        case 'onehop': {
          fp = polar(th, R(205, 225));
          addBall(C, C + 500, [0, 2, 1], [fp[0], fp[1], 0.4], { bounce: 1 });
          ofField(fp, C + 540, C + 60);
          res.tLabel = C + 330; tDone = C + 650;
          break;
        }
        case 'charge': {
          fp = polar(th, R(160, 175));
          const gp = polar(th, 118);
          addBall(C, C + 520, [0, 2, 1], [gp[0], gp[1], 0.4], { bounce: 2 });
          addBall(C + 520, C + 1150, [gp[0], gp[1], 0.4], [fp[0], fp[1], 0.3], { bounce: 1 });
          const ik = nearestOf(gp, IF4);
          move(ik, C + 80, C + 450, toward(FPOS[ik], gp, Math.max(2, dist(FPOS[ik], gp) - 12)));
          ofField(fp, C + 1150, C + 120);
          res.tLabel = C + 560; tDone = C + 1180;
          break;
        }
        case 'bobble': default: {
          fp = through(th, null, 13);
          const pop = [fp[0] + R(-5, 5), fp[1] - R(4, 8)];
          addBall(C + 1000, C + 1350, [fp[0], fp[1], 1], [pop[0], pop[1], 0.3], { arc: 7 });
          const ok = nearestOf(fp, OF_KEYS);
          move(ok, C + 1350, C + 1550, pop);
          fp = pop; tDone = C + 1650;
        }
      }
      ofReturn(tDone + 100, fp);
    }
    function doExtraBase(th, triple) {
      const v = pickV(['gap', 'line', 'over', 'wall', 'dive']);
      let wallPt, tField, tl;
      if (v === 'line') {
        const t2 = (th < 0 ? -1 : 1) * 41;
        const ik = t2 < 0 ? '3B' : '1B';
        const gp = polar(t2, 95);
        wallPt = polar(t2, fenceR(t2) - 6);
        addBall(C, C + 330, [0, 2, 1], [gp[0], gp[1], 0.4], { bounce: 2 });
        addBall(C + 330, C + 1500, [gp[0], gp[1], 0.4], [wallPt[0], wallPt[1], 0.3], { bounce: 1 });
        move(ik, C + 40, C + 300, toward(FPOS[ik], gp, dist(FPOS[ik], gp) - 6));
        pose(ik, C + 220, C + 900, 'dive', t2 < 0 ? -1 : 1);
        puff(C + 330, gp);
        tl = C + 420; tField = C + 1700;
      } else if (v === 'gap' || v === 'dive') {
        const t2 = Math.abs(th) < 10 ? (Math.random() < 0.5 ? -18 : 18) : th;
        const lpt = polar(t2, R(240, 270));
        wallPt = polar(t2, fenceR(t2) - 6);
        addBall(C, C + 800, [0, 2, 3], [lpt[0], lpt[1], 0.5], { arc: 16 });
        addBall(C + 800, C + 1500, [lpt[0], lpt[1], 0.5], [wallPt[0], wallPt[1], 0.3], { bounce: 1 });
        const ok = nearestOf(lpt, OF_KEYS);
        if (v === 'dive') {
          move(ok, C + 60, C + 800, toward(FPOS[ok], lpt, dist(FPOS[ok], lpt) - 5));
          pose(ok, C + 680, C + 1300, 'dive', side([lpt[0] - FPOS[ok][0], 0]));
          puff(C + 800, lpt);
          const other = OF_KEYS.filter((k) => k !== ok).sort((a, b) => dist(FPOS[a], wallPt) - dist(FPOS[b], wallPt))[0];
          move(other, C + 200, C + 1700, wallPt);
          tField = C + 1750;
          cutoffThrow(tField + 200, wallPt);
          res.tLabel = C + 800;
          return;
        }
        tl = C + 800; tField = C + 1700;
      } else if (v === 'over') {
        const lpt = polar(th, fenceR(th) - 28);
        wallPt = polar(th, fenceR(th) - 6);
        addBall(C, C + 1450, [0, 2, 3], [lpt[0], lpt[1], 0.5], { arc: 75 });
        addBall(C + 1450, C + 1800, [lpt[0], lpt[1], 0.5], [wallPt[0], wallPt[1], 0.3], { bounce: 1 });
        tl = C + 1450; tField = C + 2000;
      } else {
        const hit = polar(th, fenceR(th) - 1);
        wallPt = polar(th, fenceR(th) - 45);
        addBall(C, C + 1350, [0, 2, 3], [hit[0], hit[1], 9], { arc: 60 });
        addBall(C + 1350, C + 1800, [hit[0], hit[1], 9], [wallPt[0], wallPt[1], 0.3], { arc: 6 });
        const ok = nearestOf(hit, OF_KEYS);
        move(ok, C + 100, C + 1250, toward(FPOS[ok], hit, dist(FPOS[ok], hit) - 4));
        pose(ok, C + 1200, C + 1500, 'jump');
        move(ok, C + 1550, C + 1850, wallPt);
        res.tLabel = C + 1360;
        tField = C + 1900;
        cutoffThrow(tField + 150, wallPt);
        return;
      }
      const ok = nearestOf(wallPt, OF_KEYS);
      move(ok, C + 100, tField, wallPt);
      if (triple) { tField += 300; }
      res.tLabel = tl;
      cutoffThrow(tField + 150, wallPt);
    }
    function doHomeRun(th) {
      const v = pickV(['high', 'liner', 'robbed', 'pole', 'deep']);
      const t2 = v === 'pole' ? (th < 0 ? -1 : 1) * 43.5 : th;
      const fr = fenceR(t2);
      const d = { high: fr + 50, liner: fr + 40, robbed: fr + 25, pole: fr + 40, deep: fr + 130 }[v];
      const T = { high: 1900, liner: 1100, robbed: 1500, pole: 1600, deep: 2100 }[v];
      const arc = { high: 130, liner: 45, robbed: 90, pole: 100, deep: 150 }[v];
      const L = polar(t2, d);
      addBall(C, C + T, [0, 2, 3], [L[0], L[1], 20], { arc, hide: false });
      balls[balls.length - 1].hideAfter = true;
      const cross = C + T * (fr / d);
      const ok = nearestOf(polar(t2, fr), OF_KEYS);
      const wall = polar(t2, fr - 4);
      move(ok, C + 100, cross - 80, toward(FPOS[ok], wall, dist(FPOS[ok], wall) * (v === 'high' || v === 'deep' ? 0.85 : 1)));
      if (v === 'robbed') pose(ok, cross - 140, cross + 200, 'jump');
      res.tLabel = cross;
      res.slow = true;
    }

    // ---- 外野フライ ----
    function doFly(th, sac) {
      const infield = /ショート|セカンド|サード|ファースト|ピッチャー/.test(text) && !sac;
      if (infield) {
        const v = pickV(['drift', 'back', 'calloff']);
        const base = /ピッチャー/.test(text) ? 55 : 125;
        const L = polar(th, base + (v === 'back' ? 35 : R(-10, 10)));
        const T = R(1000, 1300);
        addBall(C, C + T, [0, 2, 3], [L[0], L[1], 5], { arc: R(70, 95) });
        const k = nearestOf(L, IF_KEYS);
        move(k, C + 150, C + T - 100, L);
        if (v === 'calloff') {
          const k2 = nearestOf(L, IF_KEYS.filter((x) => x !== k));
          move(k2, C + 150, C + T - 300, toward(FPOS[k2], L, dist(FPOS[k2], L) - 12));
        }
        if (v === 'back') pose(k, C + T - 150, C + T + 300, 'jump');
        res.tLabel = C + T; res.batterOutAt = C + T; res.batterOutProg = 0.7; res.runStart = C + T;
        return C + T;
      }
      const v = pickV(['routine', 'back', 'divein', 'fence', 'gap', 'slide']);
      let t2 = th, d, T, arc, poseType = null;
      if (v === 'routine') { d = R(235, 270); T = 1300; arc = 85; }
      if (v === 'back') { d = fenceR(th) - 25; T = 1550; arc = 95; }
      if (v === 'divein') { d = R(165, 185); T = 1100; arc = 40; poseType = 'dive'; }
      if (v === 'fence') { d = fenceR(th) - 5; T = 1600; arc = 100; poseType = 'jump'; }
      if (v === 'gap') { t2 = Math.abs(th) < 10 ? (Math.random() < 0.5 ? -19 : 19) : th; d = R(270, 300); T = 1400; arc = 90; }
      if (v === 'slide') { t2 = (th < 0 ? -1 : 1) * 40; d = R(215, 245); T = 1250; arc = 70; poseType = 'dive'; }
      if (sac) { d = Math.max(d, 270); }
      const L = polar(t2, d);
      const ok = nearestOf(L, OF_KEYS);
      addBall(C, C + T, [0, 2, 3], [L[0], L[1], poseType === 'jump' ? 9 : 4], { arc });
      move(ok, C + 120, C + T - (poseType ? 120 : 250), L);
      if (poseType) { pose(ok, C + T - 160, C + T + 500, poseType, side([L[0] - FPOS[ok][0], 0])); if (poseType === 'dive') puff(C + T, L); }
      if (v === 'gap') {
        const k2 = OF_KEYS.filter((k) => k !== ok).sort((a, b) => dist(FPOS[a], L) - dist(FPOS[b], L))[0];
        move(k2, C + 120, C + T - 100, toward(FPOS[k2], L, dist(FPOS[k2], L) - 15));
      }
      res.tLabel = C + T; res.batterOutAt = C + T; res.batterOutProg = 0.85; res.runStart = C + T;
      if (sac) {
        const arr = throwBall(C + T + 150, L, [0, 1], { high: true });
        move('C', C + T, C + T + 200, [0, 2]);
        res.runnerSafeAt = arr - R(60, 200);
        res.close = true;
        puff(res.runnerSafeAt, [0, 1]);
        res.tLabel = res.runnerSafeAt + 40;
      }
      return C + T;
    }

    // ---- 内野ゴロ系 ----
    const coverFirst = (fk, t0) => {
      if (fk === '1B') { move('P', t0, t0 + 700, FIRST); return 'P'; }
      move('1B', t0, t0 + 350, FIRST);
      return '1B';
    };
    function doGrounder(th) {
      const r = Math.abs(th) < 6 ? 54 : Math.abs(th) < 22 ? 118 : 92;
      let fk = nearestOf(polar(th, r), IF_KEYS.filter((k) => r > 70 || k === 'P'));
      if (r <= 70) fk = 'P';
      const isIH = kind === 'IH';
      const isE = kind === 'E';
      const isDP = kind === 'DP';
      let v = pickV(['routine', 'routine', 'dive', 'charge', 'backhand', 'deflect', 'bangbang']);
      if (isE) v = pickV(['legs', 'bobble', 'wildthrow']);
      if (isDP) v = pickV(['routine', 'routine', 'dive']);
      if (v === 'deflect' && fk === 'P') v = 'routine';
      let fieldPt, tField, tThrow;
      const fpos = FPOS[fk];
      if (v === 'deflect') {
        addBall(C, C + 260, [0, 2, 1], [0, 54, 1], { bounce: 1 });
        pose('P', C + 120, C + 420, 'jump');
        fk = Math.random() < 0.5 ? 'SS' : '2B';
        fieldPt = toward(FPOS[fk], [0, 100], 14);
        addBall(C + 260, C + 760, [0, 54, 1], [fieldPt[0], fieldPt[1], 0.5], { bounce: 2 });
        move(fk, C + 260, C + 760, fieldPt);
        tField = C + 760; tThrow = tField + 120;
      } else if (v === 'charge') {
        fieldPt = polar(th, R(50, 70));
        if (fk === 'P') fieldPt = polar(th, 40);
        addBall(C, C + 1000, [0, 2, 1], [fieldPt[0], fieldPt[1], 0.3], { bounce: 1 });
        move(fk, C + 80, C + 980, fieldPt);
        tField = C + 1000; tThrow = tField + 40;
      } else if (v === 'dive' || v === 'backhand') {
        const dir = fpos[0] < 0 ? -1 : 1;
        const sidePt = [fpos[0] + (Math.random() < 0.5 ? -1 : 1) * 17, fpos[1] + (v === 'backhand' ? 10 : 0)];
        if (fk === 'P') { sidePt[0] = fpos[0] + dir * 8; }
        fieldPt = sidePt;
        addBall(C, C + 520, [0, 2, 1], [fieldPt[0], fieldPt[1], 0.4], { bounce: 2 });
        move(fk, C + 60, C + 500, fieldPt);
        if (v === 'dive') { pose(fk, C + 380, C + 1050, 'dive', side([fieldPt[0] - fpos[0], 0])); puff(C + 520, fieldPt); tThrow = C + 1050; }
        else tThrow = C + 780;
        tField = C + 520;
      } else if (v === 'legs') {
        fieldPt = polar(th, r);
        const past = polar(th, r + 70);
        addBall(C, C + 560, [0, 2, 1], [fieldPt[0], fieldPt[1], 0.3], { bounce: 2 });
        addBall(C + 560, C + 1100, [fieldPt[0], fieldPt[1], 0.3], [past[0], past[1], 0.2], { bounce: 1 });
        move(fk, C + 60, C + 540, fieldPt);
        const ok = nearestOf(past, OF_KEYS);
        move(ok, C + 300, C + 1300, past);
        res.tLabel = C + 600;
        return;
      } else if (v === 'bobble') {
        fieldPt = polar(th, r);
        const drop = [fieldPt[0] + R(-6, 6), fieldPt[1] + R(-8, -3)];
        addBall(C, C + 560, [0, 2, 1], [fieldPt[0], fieldPt[1], 2], { bounce: 2 });
        addBall(C + 560, C + 1000, [fieldPt[0], fieldPt[1], 2], [drop[0], drop[1], 0.2], { arc: 10 });
        move(fk, C + 60, C + 540, fieldPt);
        move(fk, C + 1000, C + 1250, drop);
        pose(fk, C + 1000, C + 1300, 'dive', 1);
        res.tLabel = C + 950;
        return;
      } else {
        fieldPt = polar(th, r);
        addBall(C, C + 560, [0, 2, 1], [fieldPt[0], fieldPt[1], 0.4], { bounce: 2 });
        move(fk, C + 60, C + 540, fieldPt);
        tField = C + 560; tThrow = tField + (v === 'bangbang' ? 380 : 140);
      }

      if (isDP) {
        const pivotK = fieldPt[0] < -8 ? '2B' : 'SS';
        move(pivotK, C + 100, tThrow - 20, SECOND);
        const a1 = throwBall(tThrow, fieldPt, SECOND);
        const cov = coverFirst(fk, C + 100);
        const a2 = throwBall(a1 + R(80, 200), SECOND, FIRST);
        puff(a1, SECOND);
        res.runnerOutAt = a1 + 30;
        res.batterOutAt = a2; res.batterOutProg = 0.95;
        res.tLabel = a2;
        void cov;
        return;
      }
      if (v === 'wildthrow') {
        coverFirst(fk, C + 100);
        const miss = [88, R(30, 50)];
        const arr = throwBall(tThrow, fieldPt, miss, { endZ: 1 });
        pose('1B', arr - 260, arr + 150, 'jump');
        res.tLabel = arr - 150;
        return;
      }
      // 打者走者との競争
      const cov = coverFirst(fk, C + 100);
      if (fk === '1B' && v !== 'deflect' && v !== 'charge' && dist(fieldPt, FIRST) < 40) {
        // 一塁手が自分でベースを踏む
        move('1B', tField + 50, tField + 450, FIRST);
        res.batterOutAt = tField + 470; res.batterOutProg = 0.85;
        res.tLabel = tField + 470;
        if (isIH) { res.batterSafeAt = tField + 400; res.batterOutAt = null; res.close = true; }
        return;
      }
      void cov;
      const arr = throwBall(tThrow, fieldPt, FIRST, { slow: v === 'charge' && Math.random() < 0.4 });
      res.tLabel = arr + 40;
      if (isIH) { res.batterSafeAt = arr - R(30, 140); res.close = true; }
      else { res.batterOutAt = arr; res.batterOutProg = v === 'routine' ? 0.88 : 0.97; res.close = v !== 'routine'; }
    }
    function doLiner(th) {
      const r = Math.abs(th) < 6 ? 56 : Math.abs(th) < 22 ? 120 : 94;
      const base = polar(th, r);
      const fk = r < 70 ? 'P' : nearestOf(base, ['1B', '2B', 'SS', '3B']);
      const v = pickV(['chest', 'dive', 'leap', 'stab']);
      let L = base.slice(), z = 4;
      if (v === 'dive') L = [FPOS[fk][0] + (Math.random() < 0.5 ? -1 : 1) * 12, FPOS[fk][1] + 2];
      if (v === 'leap') { L = FPOS[fk].slice(); z = 10; }
      if (v === 'stab') L = [FPOS[fk][0] + R(-4, 4), FPOS[fk][1]];
      const T = v === 'leap' ? 380 : R(260, 340);
      addBall(C, C + T, [0, 2, 3], [L[0], L[1], z], { arc: v === 'leap' ? 10 : 3 });
      move(fk, C + 20, C + T - 20, L);
      if (v === 'dive') { pose(fk, C + T - 120, C + T + 600, 'dive', side([L[0] - FPOS[fk][0], 0])); puff(C + T, L); }
      if (v === 'leap') pose(fk, C + T - 160, C + T + 200, 'jump');
      res.tLabel = C + T; res.batterOutAt = C + T + 150; res.batterOutProg = 0.25; res.runStart = C + T + 200;
    }
    function doFoulFly() {
      const v = pickV(['backstop', 'third', 'first', 'dugout']);
      let L, k;
      if (v === 'backstop') { L = [R(-20, 20), R(-30, -18)]; k = 'C'; }
      if (v === 'third') { L = [R(-90, -70), R(30, 50)]; k = '3B'; }
      if (v === 'first') { L = [R(70, 90), R(30, 50)]; k = '1B'; }
      if (v === 'dugout') { const s = Math.random() < 0.5 ? -1 : 1; L = [s * R(45, 60), R(-5, 10)]; k = s < 0 ? '3B' : '1B'; }
      const T = R(1000, 1300);
      addBall(C, C + T, [0, 1, 3], [L[0], L[1], 4], { arc: R(55, 80) });
      move(k, C + 150, C + T - 100, L);
      if (Math.random() < 0.35) { pose(k, C + T - 140, C + T + 500, 'dive', side([L[0] - FPOS[k][0], 0])); puff(C + T, L); }
      res.tLabel = C + T; res.batterOutAt = C + T; res.batterOutProg = 0.3; res.runStart = C + T;
    }
    function doBunt(popped) {
      const fk = pickV(['P', '3B', '1B', 'C']);
      const thb = fk === '3B' ? R(-32, -20) : fk === '1B' ? R(20, 32) : R(-8, 8);
      const L = fk === 'C' ? [R(-4, 4), 12] : polar(thb, R(26, 38));
      swings.push(C - 40);
      if (fk !== 'P') move('P', C + 100, C + 500, toward(FPOS.P, L, 10));
      if (popped) {
        const T = R(650, 900);
        addBall(C, C + T, [0, 2, 3], [L[0], L[1], 3], { arc: R(16, 28) });
        move(fk, C + 60, C + T - 40, L);
        if (Math.random() < 0.5) { pose(fk, C + T - 150, C + T + 500, 'dive', 1); puff(C + T, L); }
        res.tLabel = C + T; res.batterOutAt = C + T; res.batterOutProg = 0.4; res.runStart = C + T + 300;
        return;
      }
      const T = R(700, 950);
      addBall(C, C + T, [0, 2, 1], [L[0], L[1], 0.2], { bounce: 1 });
      move(fk, C + 80, C + T, L);
      if (fk === '1B') move('2B', C + 100, C + 700, FIRST);
      else move('1B', C + 80, C + 450, FIRST);
      const target = outRunner && batterSafe ? BASE_COVER[outRunner.to] : FIRST;
      if (target !== FIRST) move(target === THIRD ? 'SS' : 'SS', C + 100, C + 700, target);
      const arr = throwBall(C + T + 120, L, target);
      res.tLabel = arr + 30;
      if (target !== FIRST) { res.runnerOutAt = arr + 20; res.batterSafeAt = arr - 200; }
      else if (kind === 'BUNTHIT' || batterSafe) { res.batterSafeAt = arr - R(40, 140); res.close = true; }
      else { res.batterOutAt = arr; res.batterOutProg = 0.85; }
    }

    // ---- 振り分け ----
    if (kind === 'K') doK();
    else if (kind === 'BB' || kind === 'IBB') doWalk();
    else if (kind === 'STEAL') doSteal();
    else if (kind === 'SQX') doSqueezeMiss();
    else {
      pitch(P0, [0, 0.5, 3]);
      if (kind !== 'BUNT' && kind !== 'BUNTHIT' && kind !== 'POP') swings.push(C - 60);
      const th = direction(text);
      switch (kind) {
        case 'HR': doHomeRun(th); break;
        case '3B': doExtraBase(th, true); break;
        case '2B': doExtraBase(th, false); break;
        case '1B': doSingle(th); break;
        case 'FO': doFly(th, false); break;
        case 'SF': doFly(th, true); break;
        case 'LO': doLiner(th); break;
        case 'FOUL': doFoulFly(); break;
        case 'POP': doBunt(true); break;
        case 'BUNT': case 'BUNTHIT': doBunt(false); break;
        default: doGrounder(th);
      }
    }

    // ---- 走者の動きを時間軸にする ----
    const speed = res.slow && kind !== 'HR' ? 0.075 : RUN;
    const rTracks = runners.map((r) => {
      const path = pathFor(r.from, r.to);
      const len = path.slice(1).reduce((a, p, i) => a + dist(path[i], p), 0);
      const t0 = kind === 'STEAL' ? res.runStart : res.runStart;
      let t1, prog = 1, fadeAt = null;
      if (r.out) {
        prog = 0.75;
        const outAt = res.runnerOutAt != null ? res.runnerOutAt : res.tLabel + 300;
        t1 = Math.max(t0 + 120, outAt);
        fadeAt = t1;
      } else if (res.runnerSafeAt != null && (kind === 'STEAL' || (kind === 'SF' && r.to === 3))) {
        t1 = Math.max(t0 + 200, res.runnerSafeAt);
      } else {
        t1 = t0 + len / speed;
      }
      if ((r.out || res.runnerSafeAt != null) && res.close) puff(t1, basePos(r.to));
      return { path, t0, t1, prog, fadeAt, scoring: r.to === 3 && !r.out };
    });
    let bTrack = null;
    if (lp.batter) {
      const j = lp.after.indexOf(lp.batter);
      const t0 = kind === 'BB' || kind === 'IBB' ? res.runStart : C + 60;
      if (j >= 0) {
        const path = pathFor(-1, j);
        const len = path.slice(1).reduce((a, p, i) => a + dist(path[i], p), 0);
        let t1 = res.batterSafeAt != null && j === 0 ? Math.max(t0 + 300, res.batterSafeAt) : t0 + len / speed;
        if (res.close && res.batterSafeAt != null) puff(t1, FIRST);
        bTrack = { path, t0, t1, prog: 1 };
      } else if (kind === 'HR') {
        const path = pathFor(-1, 3);
        bTrack = { path, t0, t1: t0 + 360 / 0.11, prog: 1, scoring: true };
      } else if (res.batterStay || res.batterOutAt == null) {
        bTrack = { stay: true };
      } else {
        const path = pathFor(-1, 0);
        const t1 = Math.max(t0 + 200, res.batterOutAt);
        if (res.close) puff(t1, FIRST);
        bTrack = { path, t0, t1, prog: res.batterOutProg, fadeAt: t1 };
      }
    }

    const lastBall = Math.max(...balls.map((s) => s.t1));
    const ends = [res.tLabel, lastBall, ...rTracks.map((r) => r.t1), bTrack && bTrack.t1 ? bTrack.t1 : 0];
    const total = Math.max(...ends, res.tLabel + 700) + 650;
    const sub = lp.scored > 0 ? `${lp.scored}点！` : lp.outsAfter >= 3 ? 'スリーアウト チェンジ' : '';
    const cls = (m.log.find((l) => l.text === lp.text) || {}).cls || 'info';
    const byK = {};
    for (const mv of moves) (byK[mv.k] = byK[mv.k] || []).push(mv);
    for (const k of Object.keys(byK)) byK[k].sort((a, b) => a.t0 - b.t0);

    function swingAngle(tt) {
      let sw = null;
      for (const s of swings) if (s <= tt) sw = s;
      if (sw == null || tt > sw + 600) return 2.2;
      const f = tt - sw;
      if (f < 120) return 2.2 - (f / 120) * 2.6;
      if (f < 420) return -0.4;
      return lerp(-0.4, 2.2, (f - 420) / 180);
    }

    function at(tt) {
      const fielders = {};
      const fposes = {};
      for (const [k, pos0] of Object.entries(FPOS)) {
        let pos = pos0.slice();
        for (const mv of byK[k] || []) {
          if (tt <= mv.t0) break;
          const f = ease(clamp((tt - mv.t0) / (mv.t1 - mv.t0), 0, 1));
          const np = [lerp(pos[0], mv.to[0], f), lerp(pos[1], mv.to[1], f)];
          if (f < 1) { pos = np; break; }
          pos = mv.to.slice();
        }
        fielders[k] = pos;
      }
      for (const p of poses) if (tt >= p.t0 && tt <= p.t1) fposes[p.k] = { type: p.type, dir: p.dir, f: (tt - p.t0) / (p.t1 - p.t0) };
      // ボール
      let b = null;
      for (const s of balls) {
        if (tt >= s.t0 && tt <= s.t1) {
          const f = (tt - s.t0) / (s.t1 - s.t0);
          let z = lerp(s.a[2], s.b[2], f) + 4 * s.arc * f * (1 - f);
          if (s.bounce) z = Math.abs(Math.sin(f * Math.PI * (s.bounce + 1))) * 3 * (1 - f) + lerp(s.a[2], s.b[2], f);
          b = { x: lerp(s.a[0], s.b[0], f), y: lerp(s.a[1], s.b[1], f), z };
        }
      }
      if (!b && balls.length) {
        const last = balls.reduce((a, s) => (s.t1 <= tt && (!a || s.t1 > a.t1) ? s : a), null);
        if (last && !last.hide && !last.hideAfter) b = { x: last.b[0], y: last.b[1], z: last.b[2] };
      }
      const rs = rTracks.map((r) => {
        const f = tt <= r.t0 ? 0 : clamp((tt - r.t0) / Math.max(1, r.t1 - r.t0), 0, 1) * r.prog;
        const [x, y] = along(r.path, f);
        let alpha = 1;
        if (r.fadeAt && tt > r.fadeAt) alpha = clamp(1 - (tt - r.fadeAt) / 300, 0, 1);
        if (r.scoring && f >= 1) alpha = clamp(1 - (tt - r.t1) / 400, 0, 1);
        const sliding = r.fadeAt ? tt > r.t1 - 150 && tt < r.t1 + 250 : false;
        return { x, y, alpha, pose: sliding ? { type: 'slide', dir: 1 } : null };
      });
      let batter = null;
      if (bTrack) {
        if (bTrack.stay) {
          batter = { x: -3.5, y: 0, alpha: tt > res.tLabel + 250 ? clamp(1 - (tt - res.tLabel - 250) / 300, 0, 1) : 1, bat: swingAngle(tt) };
        } else {
          const started = tt > bTrack.t0;
          const f = !started ? 0 : clamp((tt - bTrack.t0) / Math.max(1, bTrack.t1 - bTrack.t0), 0, 1) * bTrack.prog;
          const [x, y] = started ? along(bTrack.path, f) : [-3.5, 0];
          let alpha = 1;
          if (bTrack.fadeAt && tt > bTrack.fadeAt) alpha = clamp(1 - (tt - bTrack.fadeAt) / 300, 0, 1);
          if (bTrack.scoring && f >= 1) alpha = clamp(1 - (tt - bTrack.t1) / 400, 0, 1);
          batter = { x, y, alpha, bat: started ? null : swingAngle(tt) };
        }
      }
      const pf = puffs.filter((p) => tt >= p.t && tt < p.t + 450).map((p) => ({ x: p.x, y: p.y, f: (tt - p.t) / 450 }));
      const lab = tt >= res.tLabel ? { text, cls, sub, alpha: clamp((tt - res.tLabel) / 150, 0, 1) } : null;
      return { fielders, poses: fposes, runners: rs, batter, ball: b, label: lab, puffs: pf, off, def };
    }
    return { at, total, kind, tLabel: res.tLabel, variant: res.variant || null, poses };
  }

  // ---------- 待機中の画面 ----------
  function idleState(m) {
    const offSide = m.offense();
    const off = offSide === m.me ? UNI.me : UNI.opp;
    const def = offSide === m.me ? UNI.opp : UNI.me;
    const fielders = {};
    for (const [k, pos] of Object.entries(FPOS)) fielders[k] = pos.slice();
    const runners = [];
    if (!m.over) for (let i = 0; i < 3; i++) if (m.bases[i]) runners.push({ x: BASE[i][0] - 4 * Math.sign(BASE[i][0] || -1), y: BASE[i][1], alpha: 1 });
    const batter = m.over ? null : { x: -3.5, y: 0, alpha: 1, bat: 2.2 };
    const lab = m.over ? { text: m.winner() === m.me ? '勝利！' : '試合終了', cls: m.winner() === m.me ? 'hit' : 'out', sub: `${m.me.runs} - ${m.opp.runs}`, alpha: 1 } : null;
    return { fielders, runners, batter, ball: m.over ? null : { x: 0.6, y: 57, z: 5 }, label: lab, off, def };
  }

  let cur = null; // 再生中のアニメーション

  function canvas() {
    const cv = document.getElementById('fieldCanvas');
    if (!cv) return null;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    return cv;
  }
  function drawIdle(m) {
    const cv = canvas();
    if (!cv || cur) return;
    draw(cv, idleState(m));
  }
  /** プレーを再生して、終わったら done を呼ぶ */
  function play(m, lp, speed, done) {
    const cv = canvas();
    if (!cv) { done(); return; }
    const tl = build(m, lp);
    const start = performance.now();
    cur = { done, finished: false };
    const me = cur;
    document.body.classList.add('animating');
    const frame = (now) => {
      if (me.finished) return;
      const t = (now - start) * speed;
      draw(cv, tl.at(Math.min(t, tl.total)));
      if (t >= tl.total) finish(me);
      else requestAnimationFrame(frame);
    };
    me.jump = () => { draw(cv, tl.at(tl.total)); finish(me); };
    requestAnimationFrame(frame);
  }
  function finish(me) {
    if (me.finished) return;
    me.finished = true;
    if (cur === me) cur = null;
    document.body.classList.remove('animating');
    me.done();
  }
  function skip() { if (cur && cur.jump) cur.jump(); }
  const busy = () => !!cur;

  /** テスト用: 指定割合の時点のコマを描く */
  let drawAtCache = null;
  function drawAt(m, lp, offset) {
    const cv = canvas();
    if (!cv) return;
    if (!drawAtCache || drawAtCache.lp !== lp) drawAtCache = { lp, tl: build(m, lp) };
    const tl = drawAtCache.tl;
    draw(cv, tl.at(clamp(tl.tLabel + offset, 0, tl.total)));
  }
  return { play, drawIdle, skip, busy, _build: build, _classify: classify, _drawAt: drawAt, _drawState: (cv, st) => draw(cv, st), W, H };
})();
