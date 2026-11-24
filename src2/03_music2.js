/* =========================================================
   ほしかげの剣 II の おんがく（すべて オリジナル きょく）
   しらべた プロの やりかた（docs/design2.md §9）を とりいれている：
   ・クラシックの かきかた：てんかいけいで なめらかに うごく ベース（D7/F# など）、
     ときどき いがいな わおん（♭VI・♭VII など ほかの ちょうから かりる）
   ・どだいから つみあげる オーケストラ：オクターブで かさねた ふとい ベース
     → ひくい げんの きざみ（オスティナート）→ メロディ（きんかん／げん）
     → もっかんは きんかんの 1オクターブ うえで たいせんりつ
   ・しゅだいが 2どめに でるときは がっきを かえて もりあげる（1かいめは ひかえめ）
   ・どうにゅうぶ（イントロ）と ループを わける（くりかえしで もりあがりが きれない）
   ・メインテーマ（タイトルの しゅだい）を さいごの たたかいと エンディングで ふたたび つかう
   ・ごうせい：きんかんは ふきはじめの ピッチの ゆれと フィルターの へんか、
     げんは なんぼんも かさねて すこし ずらす（コーラス）
   ========================================================= */
function fxBus(){
  const a=Snd.ac; if(!a) return null; if(Snd.bus) return Snd.bus;
  const comp=a.createDynamicsCompressor(); comp.threshold.value=-18; comp.ratio.value=3; comp.connect(Snd.master);
  const len=Math.floor(a.sampleRate*2.6), ir=a.createBuffer(2,len,a.sampleRate);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3.2);}
  const conv=a.createConvolver(); conv.buffer=ir; const wet=a.createGain(); wet.gain.value=.3; conv.connect(wet); wet.connect(comp);
  const bus=a.createGain(); bus.gain.value=.9; bus.connect(comp); bus.connect(conv);
  // げんの コーラス（ゆれる ディレイ）
  const ch=a.createGain(), dl=a.createDelay(.05), lfo=a.createOscillator(), lg=a.createGain();
  dl.delayTime.value=.018; lfo.frequency.value=.6; lg.gain.value=.004; lfo.connect(lg); lg.connect(dl.delayTime); lfo.start();
  ch.connect(bus); ch.connect(dl); const dg=a.createGain(); dg.gain.value=.7; dl.connect(dg); dg.connect(bus);
  Snd.chorus=ch;
  return Snd.bus=bus;
}
function env(g,t,dur,v,atk,rel){g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v,t+atk); g.gain.setValueAtTime(v,Math.max(t+atk,t+dur-rel)); g.gain.linearRampToValueAtTime(0,t+dur);}
function osc(type,f,t,end,det=0){const o=Snd.ac.createOscillator(); o.type=type; o.frequency.setValueAtTime(f,t); o.detune.value=det; o.start(t); o.stop(end+.05); return o;}
function vib(o,t,f,depth,delay=.18){const a=Snd.ac, l=a.createOscillator(), lg=a.createGain(); l.frequency.value=5.4; lg.gain.setValueAtTime(0,t); lg.gain.linearRampToValueAtTime(f*depth,t+delay+.2); l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t+30);}
function noiseBuf(){if(Snd.nb) return Snd.nb; const a=Snd.ac, n=a.sampleRate, b=a.createBuffer(1,n,a.sampleRate), d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1; return Snd.nb=b;}
function nz(t,dur,v,type,freq){const a=Snd.ac, s=a.createBufferSource(); s.buffer=noiseBuf(); const f=a.createBiquadFilter(); f.type=type; f.frequency.value=freq; const g=a.createGain();
  g.gain.setValueAtTime(v,t); g.gain.exponentialRampToValueAtTime(.001,t+dur); s.connect(f); f.connect(g); g.connect(fxBus()); s.start(t); s.stop(t+dur+.02);}
const INST={
  // きんかん：ふきはじめは すこし ひくく ゆれて（ピッチ エンベロープ）から おちつく。 フィルターも ひらいて とじる
  brass(f,t,d,v){const a=Snd.ac, lp=a.createBiquadFilter(), g=a.createGain();
    lp.type='lowpass'; lp.Q.value=1.2; lp.frequency.setValueAtTime(400,t); lp.frequency.linearRampToValueAtTime(2800,t+.05); lp.frequency.linearRampToValueAtTime(1800,t+.35); lp.frequency.linearRampToValueAtTime(900,t+d+.08);
    for(const det of [0,7]){const o=osc('sawtooth',f,t,t+d+.1,det); o.detune.setValueAtTime(det-35,t); o.detune.linearRampToValueAtTime(det,t+.05); vib(o,t,f,.006); o.connect(lp);}
    lp.connect(g); env(g,t,d+.08,v*.5,.04,Math.min(.14,d/3)); fxBus(); g.connect(Snd.bus);},
  horn(f,t,d,v){const a=Snd.ac, lp=a.createBiquadFilter(), g=a.createGain(); lp.type='lowpass'; lp.frequency.setValueAtTime(300,t); lp.frequency.linearRampToValueAtTime(1200,t+.08);
    const o=osc('sawtooth',f,t,t+d+.1), o2=osc('triangle',f,t,t+d+.1); o.connect(lp); o2.connect(lp); lp.connect(g); env(g,t,d+.08,v*.55,.06,Math.min(.15,d/3)); fxBus(); g.connect(Snd.bus);},
  // げん：3ぼんを すこし ずらし、 コーラスに とおす
  strings(f,t,d,v){const a=Snd.ac, lp=a.createBiquadFilter(), g=a.createGain(); lp.type='lowpass'; lp.frequency.value=1600;
    for(const det of [-11,0,11]){const o=osc('sawtooth',f,t,t+d+.2,det); vib(o,t,f,.004,.25); o.connect(lp);} lp.connect(g); env(g,t,d+.15,v*.3,Math.min(.16,d/3),Math.min(.3,d/2)); fxBus(); g.connect(Snd.chorus);},
  stac(f,t,d,v){const a=Snd.ac, lp=a.createBiquadFilter(), g=a.createGain(); lp.type='lowpass'; lp.frequency.value=2000;
    for(const det of [-8,8]){const o=osc('sawtooth',f,t,t+.2,det); o.connect(lp);} lp.connect(g); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(v*.35,t+.01); g.gain.exponentialRampToValueAtTime(.001,t+Math.min(.18,d)); fxBus(); g.connect(Snd.chorus);},
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
const CHORD_Q={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],dim:[0,3,6],sus4:[0,5,7],m7b5:[0,3,6,10],add9:[0,4,7,14]};
// 「D7/F#」の ように ／の あとが ベースの おと（てんかいけい）
function chordPcs(sym){const [c,bs]=sym.split('/'); const m=c.match(/^([A-G][#b]?)(m7b5|maj7|m7|add9|m|7|dim|sus4)?$/); const r=NOTE[m[1]];
  return {root:r,bass:bs?NOTE[bs]:r,pcs:CHORD_Q[m[2]||''].map(i=>(r+i)%12)};}
const mf=n=>440*Math.pow(2,(n-69)/12);
const midiOf=n=>{const m=n.match(/^([A-G][#b]?)(\d)$/); return NOTE[m[1]]+(+m[2]+1)*12;};
const pcIn=(pcs,n)=>pcs.includes(((n%12)+12)%12);
function nearBelow(pcs,top,lo){for(let n=top;n>=lo;n--) if(pcIn(pcs,n)) return n; return null;}
function nearAbove(pcs,lo,hi){for(let n=lo;n<=hi;n++) if(pcIn(pcs,n)) return n; return null;}
// ひとつの「とおり」（1かいめ・2かいめ）を つくる。 L：レイヤー せってい
function layer(o,bars,off,L,ev){
  const BL=o.beat||8, add=(inst,st,len,f,v)=>ev.push({inst,st,len,f,v});
  bars.forEach(([ch,mel],bi)=>{
    const st0=off+bi*BL, C=chordPcs(ch), toks=mel.trim().split(/\s+/);
    if(toks.length!==BL) console.warn('bar',bi,'len',toks.length,mel);
    const notes=[]; let cur=null;
    toks.forEach((tk,i)=>{ if(tk==='.'){if(cur) cur.len++;} else if(tk==='-') cur=null; else {cur={st:st0+i,len:1,m:midiOf(tk)}; notes.push(cur);} });
    // メロディ（2かいめは ちがう がっきで、 もっかんを 1オクターブ うえに かさねる）
    for(const n of notes){add(L.lead,n.st,n.len,mf(n.m),L.lv||.09); if(L.dbl) add(L.dbl,n.st,n.len,mf(n.m+12),L.dv||.035);}
    // ハモり（わおんの なかの 3〜6どした）
    if(L.harm) for(const n of notes){const h=nearBelow(C.pcs,n.m-3,n.m-9); if(h) add(L.harm,n.st,n.len,mf(h),L.hv||.05);}
    // たいせんりつ：メロディが のばしている あいだに うごく もっかん（わおんの おとを たどる）
    if(L.counter) for(const n of notes) if(n.len>=3){const top=nearAbove(C.pcs,n.m+3,n.m+10)||n.m+12; const seqn=[top,nearBelow(C.pcs,top-1,top-7)||top-3,nearBelow(C.pcs,top-4,top-12)||top-5];
      for(let k=1;k<n.len&&k<4;k++) add(L.counter,n.st+k,1,mf(seqn[(k-1)%3]),L.cv||.03);}
    // げんの わおん（パッド）
    if(L.pad){const base=55; for(const pc of C.pcs.slice(0,3)){const n=base+((pc-base%12+12)%12); add(L.pad,st0,BL,mf(n),L.pv||.045);}}
    // ふとい ベース（オクターブで かさねる）と てんかいけい
    const R=36+C.bass, Rr=36+C.root, F5=Rr+7>R+9?Rr-5:Rr+7, bv=L.bv||.1;
    const bassN=(st,len,n)=>{add('bass',st,len,mf(n),bv); if(L.cello) add('strings',st,len,mf(n+12),.03);};
    if(L.bass==='march') [0,2,4,6].forEach((b,i)=>bassN(st0+b,1.6,i%2?F5:R));
    if(L.bass==='pulse') for(let b=0;b<BL;b++) add('bass',st0+b,.8,mf(b%4===3?R+12:R),bv*.9);
    if(L.bass==='long') bassN(st0,BL,R);
    if(L.bass==='walk') [0,2,4,6].forEach((b,i)=>bassN(st0+b,1.8,[R,F5,R+12,F5][i]));
    if(L.bass==='waltz'){bassN(st0,2,R); for(const b of [2,4]) for(const pc of C.pcs.slice(0,3)) add('harp',st0+b,1.5,mf(60+pc),.035);}
    // ひくい げんの きざみ（オスティナート）
    if(L.ost){const lo=nearAbove(C.pcs,48,60), hi=nearAbove(C.pcs,lo+1,lo+8)||lo+7; for(let b=0;b<BL;b++) add('stac',st0+b,1,mf([lo,lo,hi,lo][b%4]),L.ov||.06);}
    // ハープの アルペジオ
    if(L.arp){const ns=[]; for(let n=60;n<84&&ns.length<8;n++) if(pcIn(C.pcs,n)) ns.push(n); const pat=[0,1,2,3,4,3,2,1]; for(let b=0;b<BL;b++) add('harp',st0+b,1,mf(ns[pat[b%8]%ns.length]),L.av||.03);}
    // だがっき
    const D=L.drums;
    if(D==='march'){add('snare',st0+3,1,0,.05); add('snare',st0+3.5,1,0,.04); add('snare',st0+7,1,0,.05); add('kick',st0,1,0,.08); add('kick',st0+4,1,0,.06);}
    if(D==='battle'||D==='heavy'){for(let b=0;b<BL;b++) add('hat',st0+b,1,0,.05); add('kick',st0,1,0,.1); add('kick',st0+4,1,0,.1); if(D==='heavy') add('kick',st0+5,1,0,.08); add('snare',st0+2,1,0,.07); add('snare',st0+6,1,0,.07);}
    if(D==='soft'){add('hat',st0+2,1,0,.03); add('hat',st0+6,1,0,.03);}
    if(L.timp&&bi%L.timp===0) add('timp',st0,2,mf(Rr),.09);
    if(L.cym&&bi%L.cym===0) add('cym',st0,2,0,.05);
  });
}
// o = {bpm, beat, intro:[bars], bars:[bars], passes:[レイヤー, …]}  イントロは いちどだけ、 bars は passes の かずだけ くりかえして ループ
function score(o){
  const ev=[], BL=o.beat||8, introLen=(o.intro||[]).length*BL;
  if(o.intro) layer(o,o.intro,0,o.introL||o.passes[o.passes.length-1],ev);
  o.passes.forEach((L,pi)=>layer(o,o.bars,introLen+pi*o.bars.length*BL,L,ev));
  ev.sort((a,b)=>a.st-b.st);
  return {bpm:o.bpm,ev,len:introLen+o.passes.length*o.bars.length*BL,loopStart:introLen};
}
const BARS=(s)=>s.trim().split('\n').map(l=>{const i=l.indexOf(':'); return [l.slice(0,i).trim(),l.slice(i+1).trim()];});
// メインテーマ（タイトルの しゅだい）。 さいごの たたかい・エンディングでも つかう
const MAIN_THEME=`
  D: D5 . . . A4 . D5 E5
  G/B: F#5 . E5 D5 E5 . . -
  Bm: D5 . . . F#4 . B4 C#5
  A: D5 . C#5 B4 A4 . . -
  G: B4 . . . G4 . B4 D5
  D/F#: A5 . . F#5 D5 . E5 F#5
  Em7: G5 . F#5 E5 D5 . C#5 D5
  A7: E5 . . . . . - -
  D: D5 . A4 . D5 . F#5 .
  F#m: A5 . . G5 F#5 . E5 .
  G: D5 . E5 F#5 G5 . . .
  Em: G5 . F#5 E5 B4 . . -
  Bm: D5 . C#5 B4 F#5 . . .
  Bb: F5 . G5 A5 D6 . . .
  A7: C#6 . B5 A5 G5 . E5 .
  D: D5 . . . . . - -`;
const SONGS={
 // タイトル：ほしかげの じょきょく。 1かいめ：げんと ホルンで しずかに → 2かいめ：きんかんの マーチ
 title:score({bpm:96,
  intro:BARS(`
  D: D5 - D5 - D5 . A4 .
  A7/C#: E5 . . . C#5 . . .`),
  introL:{lead:'brass',harm:'brass',pad:'strings',bass:'march',cello:1,timp:1,cym:2},
  bars:BARS(MAIN_THEME),
  passes:[{lead:'strings',lv:.11,harm:'horn',hv:.04,pad:'strings',pv:.03,bass:'long',cello:1,arp:1,av:.022,timp:8},
          {lead:'brass',dbl:'flute',harm:'brass',pad:'strings',bass:'march',cello:1,drums:'march',timp:4,cym:8,counter:'flute'}]}),
 // フィールド：あおばの たびじ
 field:score({bpm:112,
  intro:BARS(`
  F: F4 . A4 . C5 . F5 .
  C7/E: E5 . . . G4 . . .`),
  bars:BARS(`
  F: C5 . . A4 F4 . A4 C5
  Bb: D5 . . C5 Bb4 . A4 G4
  F/A: A4 . . G4 F4 . G4 A4
  C: G4 . . . . . - -
  Dm: A4 . . F4 D4 . F4 A4
  Bb: D5 . . F5 E5 . D5 C5
  G7/B: B4 . C5 D5 G4 . A4 B4
  C7: C5 . . . . . - -
  F: F5 . . E5 D5 . C5 .
  Am/E: E5 . . D5 C5 . A4 .
  Bb: D5 . . C5 Bb4 . D5 F5
  F/A: A5 . . G5 F5 . . -
  Gm: G5 . F5 E5 D5 . Bb4 .
  Db: F5 . Ab5 . Db6 . C6 .
  C7: Bb5 . A5 . G5 . E5 .
  F: F5 . . . . . - -`),
  introL:{lead:'brass',harm:'horn',pad:'strings',bass:'walk',cello:1,timp:1},
  passes:[{lead:'strings',lv:.11,harm:'horn',hv:.04,pad:'strings',pv:.03,bass:'walk',cello:1,arp:1,av:.025,drums:'soft'},
          {lead:'brass',dbl:'flute',harm:'strings',pad:'strings',bass:'walk',cello:1,ost:1,ov:.04,drums:'soft',timp:8,counter:'flute'}]}),
 // まち：ともしびの ワルツ
 town:score({bpm:150,beat:6,
  bars:BARS(`
  G: B4 . D5 . G5 .
  D/F#: F#5 . E5 . D5 .
  C/E: E5 . . . C5 .
  G/D: D5 . . . - -
  Em: G4 . B4 . E5 .
  Am: E5 . D5 . C5 .
  D7: D5 . C5 . A4 .
  G: B4 . . . - -
  C: E5 . G5 . E5 .
  G/B: D5 . B4 . G4 .
  Am: C5 . E5 . A5 .
  D: F#5 . . . D5 .
  G: G5 . F#5 . E5 .
  Eb: G5 . . . Eb5 .
  D7: D5 . C5 . F#4 .
  G: G4 . . . - -`),
  passes:[{lead:'flute',pad:'strings',pv:.025,bass:'waltz'},{lead:'strings',lv:.1,dbl:'flute',dv:.03,pad:'strings',pv:.025,bass:'waltz',counter:'harp',cv:.04}]}),
 // ダンジョン：わすれられた みち
 dungeon:score({bpm:72,
  bars:BARS(`
  Dm: D4 . . . F4 . . .
  Bb: E4 . D4 . F4 . . .
  Gm/Bb: G4 . . . Bb4 . A4 G4
  A: A4 . . . . . - -
  Dm: D5 . . . C5 . A4 .
  Bb: Bb4 . . . A4 . F4 .
  Gm: G4 . F4 . E4 . F4 G4
  A7/C#: A4 . . . C#4 . . .
  F: F4 . A4 . C5 . . .
  Gm: Bb4 . A4 . G4 . . .
  Eb: G4 . F4 . Eb4 . D4 .
  A: C#4 . . . . . - -`),
  passes:[{lead:'strings',lv:.1,pad:'strings',pv:.03,bass:'long',timp:4},{lead:'horn',lv:.1,pad:'strings',pv:.035,bass:'long',cello:1,timp:2,counter:'flute',cv:.02}]}),
 // せんとう：たたかいの とき
 battle:score({bpm:160,
  intro:BARS(`
  Em: E5 - E5 - E5 - D#5 .
  B7: B4 . . . - - - -`),
  bars:BARS(`
  Em: E5 . B4 . E5 F#5 G5 .
  C: G5 F#5 E5 . C5 . E5 .
  D: F#5 . D5 . F#5 G5 A5 .
  B: B5 . A5 G5 F#5 . D#5 .
  Em: E5 . G5 . B5 . A5 G5
  Am/C: A5 . E5 . C5 . E5 .
  B7/D#: F#5 . E5 D#5 E5 . F#5 .
  Em: E5 . . . B4 . - -
  C: C5 . E5 . G5 . E5 .
  D: D5 . F#5 . A5 . F#5 .
  G/B: G5 . B4 . D5 . G5 .
  Em: B5 . . . E5 . . .
  Am: A5 . G5 F#5 E5 . C5 .
  B: D#5 . F#5 . B5 . A5 .
  C: G5 . F#5 . E5 . D#5 .
  B7: B4 . D#5 F#5 B5 . - -`),
  passes:[{lead:'brass',harm:'brass',hv:.04,bass:'pulse',ost:1,drums:'battle',cym:8,timp:4}]}),
 // ボス：たちはだかる もの
 boss:score({bpm:172,
  intro:BARS(`
  Cm: C5 - C5 - C5 - - -
  G7/B: B4 - B4 - D5 . G4 .`),
  bars:BARS(`
  Cm: C5 . G4 . C5 D5 Eb5 .
  Cm/Eb: G5 . F5 Eb5 D5 . C5 .
  Ab: Ab5 . G5 F5 Eb5 . C5 .
  G: D5 . G4 . B4 . D5 .
  Fm: F5 . Ab5 . C6 . Ab5 .
  Cm/G: G5 . Eb5 . C5 . G4 .
  Ab: Ab4 . C5 . Eb5 . G5 .
  G7: F5 . D5 . B4 . G4 .
  Cm: C6 . . . G5 . Eb5 .
  Bb: D5 . F5 . Bb5 . . .
  Ab: C6 . Ab5 . Eb5 . C5 .
  G: B4 . D5 . G5 . . .
  Fm: Ab5 . G5 F5 Eb5 . F5 .
  Db: F5 . Ab5 . Db6 . C6 .
  G: B5 . . . G5 . F5 .
  G7: D5 . B4 . G4 . - -`),
  passes:[{lead:'brass',harm:'organ',hv:.04,pad:'strings',pv:.03,bass:'pulse',ost:1,drums:'heavy',timp:2,cym:8}]}),
 // うみ：かぜを うけて（ふね）
 sea:score({bpm:120,beat:6,
  bars:BARS(`
  A: E5 . . . C#5 .
  D/F#: F#5 . E5 . D5 .
  A/E: C#5 . . . A4 .
  E: B4 . . . - -
  F#m: C#5 . . . A4 .
  D: D5 . F#5 . A5 .
  E: G#5 . F#5 . E5 .
  A: A5 . . . - -
  D: F#5 . . . D5 .
  A/C#: E5 . . . C#5 .
  Bm: D5 . C#5 . B4 .
  E: E5 . . . - -
  F: A5 . . . F5 .
  A/E: E5 . . . C#5 .
  E7: D5 . B4 . G#4 .
  A: A4 . . . - -`),
  passes:[{lead:'strings',lv:.11,bass:'waltz'},{lead:'strings',lv:.11,harm:'horn',hv:.035,bass:'waltz',counter:'flute',timp:8}]}),
 // そら：ほしの つばさ（ひこうせん）
 sky:score({bpm:126,
  intro:BARS(`
  Eb: Eb5 . Bb4 . Eb5 . G5 .
  Bb7/D: Bb5 . . . F5 . . .`),
  bars:BARS(`
  Eb: Bb4 . Eb5 . G5 . . .
  Ab: Ab5 . G5 F5 Eb5 . . .
  Bb: F5 . D5 . Bb4 . D5 F5
  Eb: G5 . . . . . - -
  Cm: G5 . Eb5 . C5 . Eb5 G5
  Ab: C6 . . Bb5 Ab5 . G5 .
  F/A: A5 . F5 . C5 . F5 A5
  Bb: Bb5 . . . . . - -
  Eb: Eb6 . . D6 C6 . Bb5 .
  Gm/D: Bb5 . G5 . D5 . G5 .
  Ab: Ab5 . C6 . Eb6 . C6 .
  Eb/G: G5 . . . Bb5 . . .
  Cm: C6 . Bb5 Ab5 G5 . Eb5 .
  Db: F5 . Ab5 . Db6 . C6 .
  Bb7: Ab5 . G5 . F5 . D5 .
  Eb: Eb5 . . . . . - -`),
  passes:[{lead:'brass',dbl:'flute',harm:'strings',pad:'strings',bass:'walk',cello:1,arp:1,av:.022,drums:'soft',timp:4,cym:8,counter:'flute'}]}),
 // うらがえしの せかい
 mirror:score({bpm:92,beat:6,
  bars:BARS(`
  Bm: F#5 . . . B4 .
  G: D5 . C#5 . B4 .
  Em/G: G5 . . . E5 .
  F#: A#4 . . . - -
  Bm: B4 . D5 . F#5 .
  G: G5 . F#5 . E5 .
  C: E5 . . . C5 .
  F#: C#5 . . . - -`),
  passes:[{lead:'flute',lv:.08,pad:'strings',pv:.04,bass:'waltz',timp:4},{lead:'strings',lv:.09,pad:'strings',pv:.035,bass:'waltz',timp:4,counter:'harp',cv:.03}]}),
 // さいごの たたかい：メインテーマが あらしの なかで ひびく
 last:score({bpm:184,
  intro:BARS(`
  F#m: F#5 - F#5 - F#5 - E5 .
  C#7: C#5 . . . - - - -`),
  bars:BARS(`
  F#m: F#5 . C#5 . F#5 . A5 .
  D: A5 G#5 F#5 . D5 . F#5 .
  E: G#5 . E5 . B4 . E5 .
  C#: F5 . C#5 . G#4 . C#5 .
  F#m: F#5 A5 C#6 . B5 A5 G#5 .
  Bm/D: F#5 . D5 . B4 . D5 .
  D: A5 . F#5 . D5 . A4 .
  C#7: G#5 . F5 . C#5 . - -
  D: D6 . . . A5 . D6 E6
  A/C#: F#6 . E6 D6 E6 . . -
  Bm: D6 . . . F#5 . B5 C#6
  C#: F6 . C#6 . G#5 . F5 .
  Bm: D6 . C#6 B5 A5 . F#5 .
  C#: G#5 . F5 . C#5 . F5 .
  D: A5 . F#5 . D6 . C#6 .
  C#7: B5 . G#5 . F5 . C#5 .`),
  passes:[{lead:'organ',lv:.1,harm:'brass',hv:.045,pad:'strings',pv:.035,bass:'pulse',ost:1,drums:'heavy',timp:2,cym:4}]}),
 // エンディング：なまえを よぶ こえ（さいしょの 2しょうせつは メインテーマ）
 ending:score({bpm:72,
  bars:BARS(`
  C: C5 . . . G4 . C5 D5
  F/A: E5 . D5 C5 D5 . . -
  F: A4 . . . C5 . F5 E5
  G: D5 . . . . . - -
  Em: G5 . . . E5 . C5 E5
  F: F5 . . E5 D5 . C5 .
  Dm7: D5 . E5 F5 A5 . G5 F5
  G: E5 . . . D5 . . .
  F: C6 . . . A5 . F5 .
  G/B: B5 . . . G5 . D5 .
  Em: G5 . . . E5 . B4 .
  Am: C5 . . . E5 . A5 .
  Ab: C6 . . . Ab5 . Eb5 .
  Bb: D6 . . . Bb5 . F5 .
  G7: F5 . E5 . D5 . G5 .
  C: C5 . . . . . - -`),
  passes:[{lead:'strings',lv:.12,pad:'strings',pv:.025,bass:'long',cello:1,arp:1,av:.022,timp:8},
          {lead:'brass',lv:.08,dbl:'strings',dv:.05,harm:'horn',hv:.03,pad:'strings',pv:.03,bass:'walk',cello:1,arp:1,av:.022,timp:4,cym:8,counter:'flute'}]}),
};
function playBgm(name){
  Snd.want=name; if(Snd.cur===name) return;
  stopBgm(); Snd.cur=name; Snd.want=name;
  if(!Snd.ac||!name||!SONGS[name]) return;
  fxBus(); Snd.song=SONGS[name]; Snd.t0=Snd.ac.currentTime+.1; Snd.ptr=0; Snd.loop=0;
  Snd.timer=setInterval(bgmTick,40); bgmTick();
}
function stopBgm(){clearInterval(Snd.timer); Snd.timer=null; Snd.song=null; Snd.cur=null;}
// イントロは いちどだけ。 そのあとは loopStart から さいごまでを くりかえす
function bgmTick(){
  const s=Snd.song, a=Snd.ac; if(!s||!a) return; const step=60/s.bpm/2, loopDur=(s.len-s.loopStart)*step;
  for(let guard=0;guard<400;guard++){
    const e=s.ev[Snd.ptr]; const t=Snd.t0+Snd.loop*loopDur+e.st*step;
    if(t>a.currentTime+.35) break;
    if(t>=a.currentTime-.02){try{INST[e.inst](e.f,t,e.len*step*.95,e.v);}catch(err){}}
    if(++Snd.ptr>=s.ev.length){Snd.loop++; Snd.ptr=s.ev.findIndex(x=>x.st>=s.loopStart);}
  }
}
