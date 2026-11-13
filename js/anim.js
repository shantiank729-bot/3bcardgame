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
    for (const [k, pos] of Object.entries(st.fielders)) ents.push({ y: pos[1], f: () => figure(c, pos[0], pos[1], st.def, { crouch: k === 'C', facing: 'home' }) });
    for (const r of st.runners) if (r.alpha > 0) ents.push({ y: r.y, f: () => figure(c, r.x, r.y, st.off, { alpha: r.alpha, facing: 'away' }) });
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
  function build(m, lp) {
    const text = lp.text.split('：').slice(1).join('：') || lp.text;
    const kind = classify(text, lp.kind);
    const offSide = m.sides[lp.top ? 0 : 1];
    const off = offSide === m.me ? UNI.me : UNI.opp;
    const def = offSide === m.me ? UNI.opp : UNI.me;
    const RUN = 0.14; // ft/ms
    const PITCH = 430;
    const ballSegs = [];   // {t0,t1,a:[x,y,z],b:[x,y,z],arc,bounce}
    const moves = [];      // 野手の移動 {k,t0,t1,to}
    let tLabel = PITCH + 80;
    let swingAt = null;
    const addBall = (t0, t1, a, b, arc = 0, bounce = false) => ballSegs.push({ t0, t1, a, b, arc, bounce });
    const throwTo = (t0, a, b) => { const t1 = t0 + Math.max(220, dist(a, b) * 2.6); addBall(t0, t1, [a[0], a[1], 5], [b[0], b[1], 4], Math.min(14, dist(a, b) * 0.06)); return t1; };

    // 投球
    const pitchEnd = kind === 'IBB' ? [7, 0, 4] : [0, 0, 3.2];
    addBall(0, PITCH, [0.6, 56, 6], pitchEnd, 0.5);

    let runStart = PITCH;
    let runSpeed = RUN;
    let batterOutAt = null, batterOutProg = 0.9;
    let runnerOutAt = PITCH + 900;

    if (kind === 'K') {
      if (/空振り/.test(text)) swingAt = PITCH - 60;
      tLabel = PITCH + 60;
      batterOutAt = -1;
    } else if (kind === 'BB' || kind === 'IBB') {
      runSpeed = 0.075; runStart = PITCH + 150; tLabel = PITCH + 60;
    } else if (kind === 'STEAL') {
      runStart = 0;
      const tgt = lp.before[0] && !lp.before[1] ? BASE[1] : BASE[2];
      const tArr = throwTo(PITCH + 60, [0, -3], [tgt[0] * 0.95, tgt[1] * 0.95]);
      moves.push({ k: tgt === BASE[1] ? 'SS' : '3B', t0: PITCH - 200, t1: tArr, to: [tgt[0] * 0.95, tgt[1] * 0.95] });
      tLabel = tArr; runnerOutAt = tArr;
      runSpeed = (90 / (tArr - 0)) * 1.02;
    } else if (kind === 'SQX') {
      swingAt = PITCH - 80;
      runStart = PITCH - 250;
      tLabel = PITCH + 400; runnerOutAt = PITCH + 380; batterOutAt = -1;
    } else {
      swingAt = PITCH - 60;
      const th = direction(text);
      let L, T, arc = 0, bounce = false, catchK = null, landK = null, outThrow = null, extra = null;
      switch (kind) {
        case 'HR': L = polar(th, fenceR(th) + 60); T = 1500; arc = 110; break;
        case '3B': L = polar(th, fenceR(th) - 6); T = 950; arc = 20; landK = true; break;
        case '2B': L = polar(th, fenceR(th) - 40); T = 900; arc = 26; landK = true; extra = polar(th, fenceR(th) - 12); break;
        case '1B': L = polar(th, 170); T = 650; arc = 9; landK = true; extra = polar(th, 215); break;
        case 'IH': L = polar(th, 78); T = 520; bounce = true; landK = true; outThrow = 'late'; break;
        case 'BUNT': case 'BUNTHIT': L = polar(Math.random() * 50 - 25, 28); T = 650; bounce = true; landK = true; outThrow = kind === 'BUNT' ? '1B' : 'late'; break;
        case 'POP': L = polar(Math.random() * 30 - 15, 22); T = 800; arc = 26; catchK = true; break;
        case 'FOUL': L = [Math.random() < 0.5 ? -14 : 14, -16]; T = 950; arc = 55; catchK = 'C'; break;
        case 'FO': case 'SF': {
          const infield = /ショート|セカンド|サード|ファースト|ピッチャー/.test(text) && !/犠牲/.test(text);
          L = polar(th, infield ? 135 : kind === 'SF' ? 290 : 255 + Math.random() * 30);
          T = infield ? 1000 : 1250; arc = infield ? 70 : 85; catchK = true;
          if (kind === 'SF') outThrow = 'home';
          break;
        }
        case 'LO': L = polar(th, Math.abs(th) < 6 ? 56 : Math.abs(th) < 22 ? 118 : 95); T = 300; arc = 5; catchK = true; break;
        case 'E': case 'GO': case 'DP': default: {
          const r = Math.abs(th) < 6 ? 54 : Math.abs(th) < 22 ? 118 : 92;
          L = polar(th, r); T = 560; bounce = true; landK = true;
          outThrow = kind === 'E' ? 'error' : kind === 'DP' ? 'dp' : '1B';
        }
      }
      const tLand = PITCH + T;
      addBall(PITCH, tLand, [0, 2, 3], [L[0], L[1], kind === 'HR' ? 25 : 0.6], arc, bounce);
      const fk = catchK === 'C' ? 'C' : nearestFielder(L, dist(L, [0, 0]) < 70);
      if (catchK) {
        moves.push({ k: fk, t0: PITCH, t1: tLand, to: L });
        tLabel = tLand;
        batterOutAt = tLand; batterOutProg = 0.45;
        runnerOutAt = tLand + 300;
        if (outThrow === 'home') {
          throwTo(tLand + 120, L, [0, 1]);
          tLabel = tLand + 120;
        }
      } else if (kind === 'HR') {
        tLabel = PITCH + T * 0.75;
        moves.push({ k: nearestFielder(L, false), t0: PITCH, t1: tLand, to: polar(th, fenceR(th) - 8) });
      } else {
        // ゴロ・ヒット: 打球の処理
        let fieldPt = extra || L;
        let tField = tLand;
        if (extra) {
          tField = tLand + 380;
          addBall(tLand, tField, [L[0], L[1], 0], [extra[0], extra[1], 0], 0, true);
        }
        if (outThrow === 'error') {
          const past = polar(Math.atan2(L[0], L[1]) / DEG, dist(L, [0, 0]) + 45);
          tField = tLand + 350;
          addBall(tLand, tField, [L[0], L[1], 0], [past[0], past[1], 0], 0, true);
          moves.push({ k: fk, t0: PITCH, t1: tLand, to: L });
          tLabel = tLand;
        } else {
          moves.push({ k: fk, t0: PITCH, t1: tField + (landK && !outThrow ? 150 : 0), to: fieldPt });
          tLabel = tField;
        }
        if (outThrow === '1B' || outThrow === 'late') {
          const t1 = throwTo(tField + 120, fieldPt, [60, 63]);
          moves.push({ k: '1B', t0: tField - 300, t1: tField, to: [60, 63] });
          if (outThrow === '1B') { batterOutAt = t1; batterOutProg = 0.93; }
          tLabel = t1;
        } else if (outThrow === 'dp') {
          const t1 = throwTo(tField + 100, fieldPt, [3, 125]);
          moves.push({ k: L[0] < 0 ? '2B' : 'SS', t0: tField - 300, t1: tField, to: [3, 125] });
          const t2 = throwTo(t1 + 80, [3, 125], [60, 63]);
          moves.push({ k: '1B', t0: tField - 300, t1: tField, to: [60, 63] });
          runnerOutAt = t1; batterOutAt = t2; batterOutProg = 0.93;
          tLabel = t2;
        } else if (!outThrow && kind !== 'HR') {
          // ヒットは内野へ返球
          throwTo(tField + 150, fieldPt, [-10, 120]);
        }
      }
    }

    // 走者の動き
    const runners = [];
    const scorers = lp.scored - (kind === 'HR' ? 1 : 0);
    let left = Math.max(0, scorers);
    for (let i = 2; i >= 0; i--) {
      const r = lp.before[i];
      if (!r) continue;
      const j = lp.after.indexOf(r);
      if (j >= 0) runners.push({ path: pathFor(i, j), out: false });
      else if (left > 0) { left--; runners.push({ path: pathFor(i, 3), out: false }); }
      else runners.push({ path: pathFor(i, i + 1), out: true });
    }
    let bat = null;
    if (lp.batter) {
      const j = lp.after.indexOf(lp.batter);
      if (j >= 0) bat = { path: pathFor(-1, j), out: false };
      else if (kind === 'HR') bat = { path: pathFor(-1, 3), out: false, slow: true };
      else if (batterOutAt === -1) bat = { path: [basePos(-1)], out: true, stay: true };
      else bat = { path: pathFor(-1, 0), out: true, prog: batterOutProg, outAt: batterOutAt };
    }
    const trackOf = (rn, isBatter) => {
      const len = rn.path.length < 2 ? 0 : rn.path.slice(1).reduce((a, p, i) => a + dist(rn.path[i], p), 0);
      const speed = rn.slow ? 0.1 : runSpeed;
      const t0 = isBatter && kind !== 'BB' && kind !== 'IBB' ? PITCH + 60 : runStart;
      const endOut = rn.out ? (isBatter ? rn.outAt : runnerOutAt) : null;
      const prog = rn.out ? (isBatter ? rn.prog : 0.72) : 1;
      const t1 = rn.out && endOut ? Math.max(t0 + 50, endOut) : t0 + (len * prog) / speed;
      return { ...rn, t0, t1, prog, fadeAt: rn.out ? t1 : null };
    };
    const rTracks = runners.map((r) => trackOf(r, false));
    const bTrack = bat && !bat.stay ? trackOf(bat, true) : bat;

    let end = Math.max(tLabel, ...ballSegs.map((s) => s.t1), ...rTracks.map((r) => r.t1), bTrack && bTrack.t1 ? bTrack.t1 : 0) + 250;
    const hold = 750;
    const total = Math.max(end, tLabel + 500) + hold;
    const sub = lp.scored > 0 ? `${lp.scored}点！` : lp.outsAfter >= 3 ? 'スリーアウト チェンジ' : '';
    const cls = (m.log.find((l) => l.text === lp.text) || {}).cls || 'info';

    function at(t) {
      const fielders = {};
      for (const [k, pos] of Object.entries(FPOS)) fielders[k] = pos.slice();
      for (const mv of moves) {
        const from = fielders[mv.k];
        if (!from) continue;
        if (t <= mv.t0) continue;
        const f = ease(clamp((t - mv.t0) / (mv.t1 - mv.t0), 0, 1));
        fielders[mv.k] = [lerp(FPOS[mv.k][0], mv.to[0], f), lerp(FPOS[mv.k][1], mv.to[1], f)];
      }
      // ボール
      let b = null;
      for (const s of ballSegs) {
        if (t >= s.t0 && t <= s.t1) {
          const f = (t - s.t0) / (s.t1 - s.t0);
          let z = lerp(s.a[2], s.b[2], f) + 4 * s.arc * f * (1 - f) / 1;
          if (s.bounce) z = Math.abs(Math.sin(f * Math.PI * 3)) * 3 * (1 - f) + 0.6;
          b = { x: lerp(s.a[0], s.b[0], f), y: lerp(s.a[1], s.b[1], f), z };
        }
      }
      if (!b && ballSegs.length) {
        const last = ballSegs.reduce((a, s) => (s.t1 <= t && (!a || s.t1 > a.t1) ? s : a), null);
        if (last && kind !== 'HR') b = { x: last.b[0], y: last.b[1], z: last.b[2] };
      }
      // 走者
      const rs = rTracks.map((r) => {
        const f = t <= r.t0 ? 0 : clamp((t - r.t0) / Math.max(1, r.t1 - r.t0), 0, 1) * r.prog;
        const [x, y] = along(r.path, f);
        const alpha = r.fadeAt && t > r.fadeAt ? clamp(1 - (t - r.fadeAt) / 300, 0, 1) : r.path[r.path.length - 1] === BASE[3] && f >= 1 ? clamp(1 - (t - r.t1) / 400, 0, 1) : 1;
        return { x, y, alpha };
      });
      let batter = null;
      if (bTrack) {
        if (bTrack.stay) {
          batter = { x: -3.5, y: 0, alpha: t > tLabel + 200 ? clamp(1 - (t - tLabel - 200) / 300, 0, 1) : 1, bat: swingAngle(t) };
        } else {
          const f = t <= bTrack.t0 ? 0 : clamp((t - bTrack.t0) / Math.max(1, bTrack.t1 - bTrack.t0), 0, 1) * bTrack.prog;
          const [x, y] = t <= bTrack.t0 ? [-3.5, 0] : along(bTrack.path, f);
          let alpha = bTrack.fadeAt && t > bTrack.fadeAt ? clamp(1 - (t - bTrack.fadeAt) / 300, 0, 1) : 1;
          if (kind === 'HR' && f >= 1) alpha = clamp(1 - (t - bTrack.t1) / 400, 0, 1);
          batter = { x, y, alpha, bat: t <= bTrack.t0 ? swingAngle(t) : null };
        }
      }
      const lab = t >= tLabel ? { text, cls, sub, alpha: clamp((t - tLabel) / 150, 0, 1) } : null;
      return { fielders, runners: rs, batter, ball: b, label: lab, off, def };
    }
    function swingAngle(t) {
      if (swingAt == null || t < swingAt) return 2.2;
      return 2.2 - clamp((t - swingAt) / 120, 0, 1) * 2.6;
    }
    return { at, total };
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
  function drawAt(m, lp, frac) {
    const cv = canvas();
    if (!cv) return;
    const tl = build(m, lp);
    draw(cv, tl.at(tl.total * frac));
  }
  return { play, drawIdle, skip, busy, _build: build, _classify: classify, _drawAt: drawAt, W, H };
})();
