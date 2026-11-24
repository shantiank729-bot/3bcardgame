import { settings } from "../settings";

let ctx: AudioContext | null = null;

/** 駒音（木を打つ「パチッ」という音を合成する） */
export function playPieceSound(capture = false) {
  if (!settings.get().sound) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const len = 0.09;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = capture ? 1500 : 2200;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(capture ? 1.4 : 1.0, t);
    src.connect(bp).connect(g).connect(ctx.destination);
    // 低い「コツ」
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.06);
    og.gain.setValueAtTime(0.35, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(og).connect(ctx.destination);
    src.start(t);
    osc.start(t);
    osc.stop(t + 0.08);
  } catch { /* 音が出せない環境では無視 */ }
}

export function playBeep(freq = 880, dur = 0.08) {
  if (!settings.get().sound) return;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  } catch { /* 無視 */ }
}
