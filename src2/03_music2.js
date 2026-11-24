/* =========================================================
   ほしかげの剣 II の おんがく（すべて オリジナル きょく）
   ・がっき：きんかん・げん・フルート・ハープ・オルガン・ティンパニ・たいこ を WebAudio で ごうせい
   ・ホールの ひびき（リバーブ）と コンプレッサー
   ・きょくは「コード ＋ メロディ」で かき、 ハモり・ばんそう・ベース・だがっきは じどうで つける
   ========================================================= */
function fxBus(){
  const a=Snd.ac; if(!a) return null; if(Snd.bus) return Snd.bus;
  const comp=a.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3; comp.connect(Snd.master);
  const len=Math.floor(a.sampleRate*2.6), ir=a.createBuffer(2,len,a.sampleRate);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
  const conv=a.createConvolver(); conv.buffer=ir; const wet=a.createGain(); wet.gain.value=.3; conv.connect(wet); wet.connect(comp);
  const bus=a.createGain(); bus.gain.value=.9; bus.connect(comp); bus.connect(conv);
  return Snd.bus=bus;
}
function env(g,t,dur,v,atk,rel){g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+atk); g.gain.setValueAtTime(v,Math.max(t+atk,t+dur-rel)); g.gain.linearRampToValueAtTime(0,t+dur);}
function osc(type,f,t,end,det=0){const o=Snd.ac.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t); o.detune.value=det; o.start(t); o.stop(end+.05); return o;}
function vib(o,t,f,depth,delay=.18){const a=Snd.ac, l=a.createOscillator(), lg=a.createGain(); l.frequency.value=5.4; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*depth,t+delay+.2); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t+30);}
function noiseBuf(){if(Snd.nb) return Snd.nb; const a=Snd.ac, n=a.sampleRate, b=a.createBuffer(1,n,a.sampleRate), d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return Snd.nb=b;}
function nz(t,dur,v,type,freq){const a=Snd.ac, s=a.createBufferSource(); s.buffer=noiseBuf(); const f=a.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=a.createGain();
  g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f); f.connect(g); g.connect(fxBus()); s.start(t); s.stop(t+dur+.02);}
const INST={
  brass(f,t,d,v){const a=Snd.ac, o=osc('sawtooth',f,t,t+d), o2=osc('sawtooth',f,t,t+d,8), lp=a.createBiquadFilter(), g=a.createGain();
    lp.type='lowpass'; lp.frequency.setValueAtTime(500,t); lp.frequency.linearRampToValueAtTime(2600,t+.06); lp.frequency.linearRampToValueAtTime(1700,t+.3);
    vib(o,t,f,.006); vib(o2,t,f,.006); o.connect(lp); o2.connect(lp); lp.connect(g); env(g,t,d,v*.55,.035,Math.min(.12,d/3)); g.connect(fxBus());},
  strings(f,t,d,v){const a=Snd.ac, lp=a.createBiquadFilter(), g=a.createGain(); lp.type='lowpass'; lp.frequency.value=1500;
    for(const det of [-9,0,9]){const o=osc('sawtooth',f,t,t+d,det); vib(o,t,f,.004,.3); o.connect(lp);} lp.connect(g); env(g,t,d,v*.32,Math.min(.18,d/3),Math.min(.3,d/3)); g.connect(fxBus());},
  flute(f,t,d,v){const a=Snd.ac, o=osc('triangle',f,t,t+d), o2=osc('sine',f*2,t,t+d), g=a.createGain(), g2=a.createGain(); g2.gain.value=.18; vib(o,t,f,.008,.12);
    o.connect(g); o2.connect(g2); g2.connect(g); env(g,t,d,v*1.1,.05,Math.min(.1,d/3)); g.connect(fxBus()); nz(t,.05,v*.15,'highpass',4000);},
  organ(f,t,d,v){const a=Snd.ac, lp=a.createBiquadFilter(), g=a.createGain(); lp.type='lowpass'; lp.frequency.value=3200;
    for(const [m,l] of [[1,1],[2,.35],[.5,.5]]){const o=osc('square',f*m,t,t+d), og=a.createGain(); og.gain.value=l; o.connect(og); og.connect(lp);} lp.connect(g); env(g,t,d,v*.32,.01,.05); g.connect(fxBus());},
  harp(f,t,d,v){const a=Snd.ac, o=osc('triangle',f,t,t+1.4), g=a.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*1.2,t+.005); g.gain.exponentialRampToValueAtTime(.001,t+Math.max(.5,Math.min(1.4,d*1.6))); o.connect(g); g.connect(fxBus());},
  bass(f,t,d,v){const a=Snd.ac, o=osc('triangle',f,t,t+d), o2=osc('sawtooth',f,t,t+d), lp=a.createBiquadFilter(), g=a.createGain(), g2=a.createGain(); lp.type='lowpass'; lp.frequency.value=420; g2.gain.value=.35;
    o2.connect(g2); g2.connect(lp); o.connect(lp); lp.connect(g); env(g,t,d,v*1.3,.01,Math.min(.08,d/3)); g.connect(fxBus());},
  timp(f,t,d,v){const a=Snd.ac, o=osc('sine',f,t,t+.9), g=a.createGain(); o.frequency.exponentialRampToValueAtTime(f*.82,t+.4); g.gain.setValueAtTime(v*2.2,t); g.gain.exponentialRampToValueAtTime(.001,t+.9); o.connect(g); g.connect(fxBus()); nz(t,.12,v*.6,'lowpass',500);},
  kick(f,t,d,v){const a=Snd.ac, o=osc('sine',130,t,t+.25), g=a.createGain(); o.frequency.exponentialRampToValueAtTime(42,t+.14); g.gain.setValueAtTime(v*3,t); g.gain.exponentialRampToValueAtTime(.001,t+.25); o.connect(g); g.connect(fxBus());},
  snare(f,t,d,v){nz(t,.16,v*1.6,'highpass',1200); const a=Snd.ac, o=osc('triangle',190,t,t+.08), g=a.createGain(); g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+.08); o.connect(g); g.connect(fxBus());},
  hat(f,t,d,v){nz(t,.035,v*.7,'highpass',7500);},
  cym(f,t,d,v){nz(t,1.4,v*.9,'highpass',5000);},
};
/* ---------- きょくの くみたて ---------- */
const CHORD_Q={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],dim:[0,3,6],sus4:[0,5,7],m7b5:[0,3,6,10]};
function chordPcs(sym){const m=sym.match(/^([A-G][#b]?)(m7b5|maj7|m7|m|7|dim|sus4)?$/); const r=NOTE[m[1]]; return {root:r,pcs:CHORD_Q[m[2]||''].map(i=>(r+i)%12)};}
const mf=n=>440*Math.pow(2,(n-69)/12);
const midiOf=n=>{const m=n.match(/^([A-G][#b]?)(\d)$/); return NOTE[m[1]]+(+m[2]+1)*12;};
function nearBelow(pcs,top,lo){for(let n=top;n>=lo;n--) if(pcs.includes(((n%12)+12)%12)) return n; return null;}
// o = {bpm, beat:8|6, lead, harm, pad, bass:'march'|'pulse'|'waltz'|'long'|'walk', arp, drums:'march'|'battle'|'heavy'|'soft'|'', timp, bars:[[chord, melody]...]}
function score(o){
  const ev=[], BL=o.beat||8, add=(inst,st,len,f,v)=>ev.push({inst,st,len,f,v});
  o.bars.forEach(([ch,mel],bi)=>{
    const st0=bi*BL, C=chordPcs(ch), toks=mel.trim().split(/\s+/);
    if(toks.length!==BL) console.warn('bar',bi,'len',toks.length,mel);
    // メロディと ハモり
    let cur=null; toks.forEach((tk,i)=>{ if(tk==='.'){if(cur) cur.len++;} else if(tk==='-') cur=null; else {cur={inst:o.lead,st:st0+i,len:1,f:mf(midiOf(tk)),v:o.lv||.09,m:midiOf(tk)}; ev.push(cur);} });
    if(o.harm) for(const e of ev.filter(e=>e.m&&e.st>=st0&&e.st<st0+BL)){const h=nearBelow(C.pcs,e.m-3,e.m-9); if(h) add(o.harm,e.st,e.len,mf(h),(o.hv||.05));}
    // パッド（げんの ちょうおん）
    if(o.pad){const base=55; for(const pc of C.pcs.slice(0,3)){let n=base+((pc-base%12+12)%12); add(o.pad,st0,BL,mf(n),o.pv||.05);}}
    // ベース
    const R=36+((C.root-0+12)%12), F5=R+7;
    const bs=o.bass;
    if(bs==='march') [0,2,4,6].forEach((b,i)=>add('bass',st0+b,1.6,mf(i%2?F5-12+12:R),.1));
    if(bs==='pulse') for(let b=0;b<BL;b++) add('bass',st0+b,.8,mf(b%4===3?R+12:R),.09);
    if(bs==='long') add('bass',st0,BL,mf(R),.1);
    if(bs==='walk') [0,2,4,6].forEach((b,i)=>add('bass',st0+b,1.8,mf([R,R+7,R+12,R+7][i]),.09));
    if(bs==='waltz'){add('bass',st0,2,mf(R),.1); for(const b of [2,4]) for(const pc of C.pcs.slice(0,3)) add('harp',st0+b,1.5,mf(60+((pc-0+12)%12)),.035);}
    // アルペジオ（ハープ）
    if(o.arp){const ns=[]; for(let n=60;n<84&&ns.length<8;n++) if(C.pcs.includes(n%12)) ns.push(n); const pat=[0,1,2,3,4,3,2,1]; for(let b=0;b<BL;b++) add('harp',st0+b,1,mf(ns[pat[b%8]%ns.length]),o.av||.03);}
    // だがっき
    const D=o.drums;
    if(D==='march'){add('snare',st0+3,1,0,.05); add('snare',st0+3.5,1,0,.04); add('snare',st0+7,1,0,.05); add('kick',st0,1,0,.08); add('kick',st0+4,1,0,.06);}
    if(D==='battle'||D==='heavy'){for(let b=0;b<BL;b++) add('hat',st0+b,1,0,.05); add('kick',st0,1,0,.1); add('kick',st0+4,1,0,.1); if(D==='heavy') add('kick',st0+5,1,0,.08); add('snare',st0+2,1,0,.07); add('snare',st0+6,1,0,.07);}
    if(D==='soft'){add('hat',st0+2,1,0,.03); add('hat',st0+6,1,0,.03);}
    if(o.timp&&bi%o.timp===0) add('timp',st0,2,mf(R),.09);
    if(o.cym&&bi%o.cym===0) add('cym',st0,2,0,.05);
  });
  ev.sort((a,b)=>a.st-b.st);
  return {bpm:o.bpm,ev,len:o.bars.length*BL};
}
const BARS=(s)=>s.trim().split('\n').map(l=>{const i=l.indexOf(':'); return [l.slice(0,i).trim(),l.slice(i+1).trim()];});
const SONGS={
 // タイトル：ほしかげの じょきょく（ニちょうちょうの マーチ）
 title:score({bpm:96,lead:'brass',harm:'brass',pad:'strings',bass:'march',drums:'march',timp:4,cym:8,bars:BARS(`
  D: D5 . . . A4 . D5 E5
  G: F#5 . E5 D5 E5 . . -
  Bm: D5 . . . F#4 . B4 C#5
  A: D5 . C#5 B4 A4 . . -
  G: B4 . . . G4 . B4 D5
  D: A5 . . F#5 D5 . E5 F#5
  Em: G5 . F#5 E5 D5 . C#5 D5
  A7: E5 . . . . . - -
  D: D5 . A4 . D5 . F#5 .
  F#m: A5 . . G5 F#5 . E5 .
  G: D5 . E5 F#5 G5 . . .
  Em: G5 . F#5 E5 B4 . . -
  Bm: D5 . C#5 B4 F#5 . . .
  G: G5 . A5 B5 D6 . . .
  A7: C#6 . B5 A5 G5 . E5 .
  D: D5 . . . . . - -`)}),
 // フィールド：あおばの たびじ
 field:score({bpm:112,lead:'brass',harm:'strings',pad:'strings',bass:'walk',arp:1,drums:'soft',timp:8,bars:BARS(`
  F: C5 . . A4 F4 . A4 C5
  Bb: D5 . . C5 Bb4 . A4 G4
  F: A4 . . G4 F4 . G4 A4
  C: G4 . . . . . - -
  Dm: A4 . . F4 D4 . F4 A4
  Bb: D5 . . F5 E5 . D5 C5
  G7: B4 . C5 D5 G4 . A4 B4
  C7: C5 . . . . . - -
  F: F5 . . E5 D5 . C5 .
  Am: E5 . . D5 C5 . A4 .
  Bb: D5 . . C5 Bb4 . D5 F5
  F: A5 . . G5 F5 . . -
  Gm: G5 . F5 E5 D5 . Bb4 .
  C: E5 . D5 C5 G4 . A4 Bb4
  C7: A4 . Bb4 C5 D5 . E5 .
  F: F5 . . . . . - -`)}),
 // まち：ともしびの ワルツ
 town:score({bpm:150,beat:6,lead:'flute',pad:'strings',pv:.03,bass:'waltz',bars:BARS(`
  G: B4 . D5 . G5 .
  D: F#5 . E5 . D5 .
  C: E5 . . . C5 .
  G: D5 . . . - -
  Em: G4 . B4 . E5 .
  Am: E5 . D5 . C5 .
  D7: D5 . C5 . A4 .
  G: B4 . . . - -
  C: E5 . G5 . E5 .
  G: D5 . B4 . G4 .
  Am: C5 . E5 . A5 .
  D: F#5 . . . D5 .
  G: G5 . F#5 . E5 .
  Em: B4 . . . E5 .
  D7: D5 . C5 . F#4 .
  G: G4 . . . - -`)}),
 // ダンジョン：わすれられた みち
 dungeon:score({bpm:72,lead:'strings',lv:.1,pad:'strings',pv:.035,bass:'long',timp:4,bars:BARS(`
  Dm: D4 . . . F4 . . .
  Bb: E4 . D4 . F4 . . .
  Gm: G4 . . . Bb4 . A4 G4
  A: A4 . . . . . - -
  Dm: D5 . . . C5 . A4 .
  Bb: Bb4 . . . A4 . F4 .
  Gm: G4 . F4 . E4 . F4 G4
  A7: A4 . . . C#4 . . .
  F: F4 . A4 . C5 . . .
  Gm: Bb4 . A4 . G4 . . .
  Eb: G4 . F4 . Eb4 . D4 .
  A: C#4 . . . . . - -`)}),
 // せんとう：たたかいの とき
 battle:score({bpm:160,lead:'brass',harm:'brass',hv:.04,pad:'strings',pv:.03,bass:'pulse',drums:'battle',cym:8,bars:BARS(`
  Em: E5 . B4 . E5 F#5 G5 .
  C: G5 F#5 E5 . C5 . E5 .
  D: F#5 . D5 . F#5 G5 A5 .
  B: B5 . A5 G5 F#5 . D#5 .
  Em: E5 . G5 . B5 . A5 G5
  Am: A5 . E5 . C5 . E5 .
  B7: F#5 . E5 D#5 E5 . F#5 .
  Em: E5 . . . B4 . - -
  C: C5 . E5 . G5 . E5 .
  D: D5 . F#5 . A5 . F#5 .
  G: G5 . B4 . D5 . G5 .
  Em: B5 . . . E5 . . .
  Am: A5 . G5 F#5 E5 . C5 .
  B: D#5 . F#5 . B5 . A5 .
  C: G5 . F#5 . E5 . D#5 .
  B7: B4 . D#5 F#5 B5 . - -`)}),
 // ボス：たちはだかる もの
 boss:score({bpm:172,lead:'brass',harm:'organ',hv:.04,pad:'strings',pv:.035,bass:'pulse',drums:'heavy',timp:2,cym:8,bars:BARS(`
  Cm: C5 . G4 . C5 D5 Eb5 .
  Cm: G5 . F5 Eb5 D5 . C5 .
  Ab: Ab5 . G5 F5 Eb5 . C5 .
  G: D5 . G4 . B4 . D5 .
  Fm: F5 . Ab5 . C6 . Ab5 .
  Cm: G5 . Eb5 . C5 . G4 .
  Ab: Ab4 . C5 . Eb5 . G5 .
  G7: F5 . D5 . B4 . G4 .
  Cm: C6 . . . G5 . Eb5 .
  Bb: D5 . F5 . Bb5 . . .
  Ab: C6 . Ab5 . Eb5 . C5 .
  G: B4 . D5 . G5 . . .
  Fm: Ab5 . G5 F5 Eb5 . F5 .
  Db: F5 . Ab5 . Db6 . C6 .
  G: B5 . . . G5 . F5 .
  G7: D5 . B4 . G4 . - -`)}),
 // うみ：かぜを うけて（ふね）
 sea:score({bpm:120,beat:6,lead:'strings',lv:.11,harm:'flute',hv:.035,bass:'waltz',arp:0,timp:8,bars:BARS(`
  A: E5 . . . C#5 .
  D: F#5 . E5 . D5 .
  A: C#5 . . . A4 .
  E: B4 . . . - -
  F#m: C#5 . . . A4 .
  D: D5 . F#5 . A5 .
  E: G#5 . F#5 . E5 .
  A: A5 . . . - -
  D: F#5 . . . D5 .
  A: E5 . . . C#5 .
  Bm: D5 . C#5 . B4 .
  E: E5 . . . - -
  D: A5 . . . F#5 .
  A: E5 . . . C#5 .
  E7: D5 . B4 . G#4 .
  A: A4 . . . - -`)}),
 // そら：ほしの つばさ（ひこうせん）
 sky:score({bpm:126,lead:'brass',harm:'strings',pad:'strings',bass:'walk',arp:1,av:.025,drums:'soft',timp:4,cym:8,bars:BARS(`
  Eb: Bb4 . Eb5 . G5 . . .
  Ab: Ab5 . G5 F5 Eb5 . . .
  Bb: F5 . D5 . Bb4 . D5 F5
  Eb: G5 . . . . . - -
  Cm: G5 . Eb5 . C5 . Eb5 G5
  Ab: C6 . . Bb5 Ab5 . G5 .
  F: A5 . F5 . C5 . F5 A5
  Bb: Bb5 . . . . . - -
  Eb: Eb6 . . D6 C6 . Bb5 .
  Gm: Bb5 . G5 . D5 . G5 .
  Ab: Ab5 . C6 . Eb6 . C6 .
  Eb: G5 . . . Bb5 . . .
  Cm: C6 . Bb5 Ab5 G5 . Eb5 .
  Ab: F5 . G5 Ab5 C6 . Bb5 .
  Bb7: Ab5 . G5 . F5 . D5 .
  Eb: Eb5 . . . . . - -`)}),
 // うらがえしの せかい
 mirror:score({bpm:92,beat:6,lead:'flute',lv:.08,pad:'strings',pv:.04,bass:'waltz',timp:4,bars:BARS(`
  Bm: F#5 . . . B4 .
  G: D5 . C#5 . B4 .
  Em: G5 . . . E5 .
  F#: A#4 . . . - -
  Bm: B4 . D5 . F#5 .
  G: G5 . F#5 . E5 .
  C: E5 . . . C5 .
  F#: C#5 . . . - -`)}),
 // さいごの たたかい
 last:score({bpm:184,lead:'organ',lv:.1,harm:'brass',hv:.045,pad:'strings',pv:.04,bass:'pulse',drums:'heavy',timp:2,cym:4,bars:BARS(`
  F#m: F#5 . C#5 . F#5 . A5 .
  D: A5 G#5 F#5 . D5 . F#5 .
  E: G#5 . E5 . B4 . E5 .
  C#: F5 . C#5 . G#4 . C#5 .
  F#m: F#5 A5 C#6 . B5 A5 G#5 .
  Bm: F#5 . D5 . B4 . D5 .
  D: A5 . F#5 . D5 . A4 .
  C#7: G#5 . F5 . C#5 . - -
  D: D6 . . . A5 . F#5 .
  E: E6 . . . B5 . G#5 .
  C#m: C#6 . B5 A5 G#5 . E5 .
  F#m: F#5 . . . C#5 . - -
  Bm: D6 . C#6 B5 A5 . F#5 .
  C#: G#5 . F5 . C#5 . F5 .
  D: A5 . F#5 . D6 . C#6 .
  C#7: B5 . G#5 . F5 . C#5 .`)}),
 // エンディング：なまえを よぶ こえ
 ending:score({bpm:72,lead:'strings',lv:.12,harm:'flute',hv:.03,pad:'strings',pv:.03,bass:'long',arp:1,av:.025,timp:8,bars:BARS(`
  C: E5 . . . G4 . C5 D5
  Am: E5 . . D5 C5 . . .
  F: A4 . . . C5 . F5 E5
  G: D5 . . . . . - -
  Em: G5 . . . E5 . C5 E5
  F: F5 . . E5 D5 . C5 .
  Dm7: D5 . E5 F5 A5 . G5 F5
  G: E5 . . . D5 . . .
  F: C6 . . . A5 . F5 .
  G: B5 . . . G5 . D5 .
  Em: G5 . . . E5 . B4 .
  Am: C5 . . . E5 . A5 .
  F: A5 . . . G5 . F5 .
  C: E5 . . . G5 . C6 .
  Dm: F5 . E5 . D5 . G5 .
  C: C5 . . . . . - -`)}),
};
function playBgm(name){
  Snd.want=name; if(Snd.cur===name) return;
  stopBgm(); Snd.cur=name; Snd.want=name;
  if(!Snd.ac||!name||!SONGS[name]) return;
  Snd.song=SONGS[name]; Snd.t0=Snd.ac.currentTime+.1; Snd.ptr=0; Snd.loop=0;
  Snd.timer=setInterval(bgmTick,40); bgmTick();
}
function stopBgm(){clearInterval(Snd.timer); Snd.timer=null; Snd.song=null; Snd.cur=null;}
function bgmTick(){
  const s=Snd.song, a=Snd.ac; if(!s||!a) return; const step=60/s.bpm/2, loopDur=s.len*step;
  for(let guard=0;guard<400;guard++){
    const e=s.ev[Snd.ptr]; const t=Snd.t0+Snd.loop*loopDur+e.st*step;
    if(t>a.currentTime+.35) break;
    if(t>=a.currentTime-.02){try{INST[e.inst](e.f,t,e.len*step*.95,e.v);}catch(err){}}
    if(++Snd.ptr>=s.ev.length){Snd.ptr=0; Snd.loop++;}
  }
}
