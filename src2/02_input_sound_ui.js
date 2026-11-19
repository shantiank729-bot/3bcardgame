/* ---------- 入力 ---------- */
const handlers=[]; const held=[];
const pushH=f=>handlers.push(f);
const popH=f=>{const i=handlers.lastIndexOf(f); if(i>=0) handlers.splice(i,1);};
const isDir=b=>b==='up'||b==='down'||b==='left'||b==='right';
function press(b){
  audioInit();
  const h=handlers[handlers.length-1];
  if(h){h(b); return;}
  if(mode==='field'&&!scripting) fieldPress(b);
}
function hold(b){if(isDir(b)&&!held.includes(b)) held.push(b);}
function release(b){const i=held.indexOf(b); if(i>=0) held.splice(i,1);}
const KEYMAP={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',KeyW:'up',KeyS:'down',KeyA:'left',KeyD:'right',
  KeyZ:'a',Enter:'a',NumpadEnter:'a',Space:'a',KeyX:'b',Escape:'b',Backspace:'b',KeyM:'menu'};
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT') return;
  const b=KEYMAP[e.code]; if(!b) return;
  e.preventDefault(); hold(b);
  if(!e.repeat||isDir(b)) press(b);
});
addEventListener('keyup',e=>{const b=KEYMAP[e.code]; if(b) release(b);});
addEventListener('blur',()=>{held.length=0; setDpad(null);});
// タッチ: 十字キーは指をすべらせても方向が変わる
const dpad=document.getElementById('dpad'); let dpadDir=null, repT=null;
function setDpad(d){
  if(d===dpadDir) return;
  if(dpadDir) release(dpadDir);
  clearInterval(repT); dpadDir=d; dpad.dataset.dir=d||'';
  if(d){hold(d); press(d); let n=0; repT=setInterval(()=>{if(++n>3&&handlers.length) press(d);},90);}
}
function dpadFrom(e){
  const r=dpad.getBoundingClientRect(); const x=e.clientX-r.left-r.width/2, y=e.clientY-r.top-r.height/2;
  if(Math.hypot(x,y)<12) return dpadDir;
  return Math.abs(x)>Math.abs(y)?(x>0?'right':'left'):(y>0?'down':'up');
}
dpad.addEventListener('pointerdown',e=>{e.preventDefault(); dpad.setPointerCapture(e.pointerId); setDpad(dpadFrom(e));});
dpad.addEventListener('pointermove',e=>{if(dpadDir) setDpad(dpadFrom(e));});
['pointerup','pointercancel','lostpointercapture'].forEach(t=>dpad.addEventListener(t,()=>setDpad(null)));
document.querySelectorAll('.pbtn[data-b]').forEach(btn=>{
  btn.addEventListener('pointerdown',e=>{e.preventDefault(); btn.classList.add('on'); press(btn.dataset.b);});
  ['pointerup','pointercancel','pointerleave'].forEach(t=>btn.addEventListener(t,()=>btn.classList.remove('on')));
  btn.addEventListener('click',e=>e.preventDefault());
});
document.addEventListener('contextmenu',e=>{if(e.target.closest('.pad')) e.preventDefault();});

/* ---------- サウンド（WebAudioの小さなチップチューン） ---------- */
const Snd={on:store.get('hoshikage-sound')!=='off',ac:null,master:null,want:null,cur:null,song:null,timer:null};
const sndBtn=document.getElementById('snd');
function sndLabel(){sndBtn.textContent=Snd.on?'♪ おと ON':'♪ おと OFF'; sndBtn.setAttribute('aria-pressed',String(Snd.on));}
sndLabel();
sndBtn.addEventListener('click',()=>{audioInit(); Snd.on=!Snd.on; store.set('hoshikage-sound',Snd.on?'on':'off'); sndLabel();
  if(Snd.master) Snd.master.gain.value=Snd.on?1:0; sndBtn.blur();});
function audioInit(){
  if(Snd.ac){if(Snd.ac.state==='suspended') Snd.ac.resume(); return;}
  try{Snd.ac=new (window.AudioContext||window.webkitAudioContext)(); Snd.master=Snd.ac.createGain();
    Snd.master.gain.value=Snd.on?1:0; Snd.master.connect(Snd.ac.destination);}catch(e){Snd.ac=null; return;}
  if(Snd.want){const w=Snd.want; Snd.cur=null; playBgm(w);}
}
function tone(f,t,dur,type='square',vol=.05){
  const a=Snd.ac; if(!a) return; const o=a.createOscillator(), g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.008);
  g.gain.setValueAtTime(vol,t+dur*.6); g.gain.linearRampToValueAtTime(0,t+dur);
  o.connect(g); g.connect(Snd.master); o.start(t); o.stop(t+dur+.03);
}
function noise(t,dur,vol=.08){
  const a=Snd.ac; if(!a) return; const n=Math.floor(a.sampleRate*dur), buf=a.createBuffer(1,n,a.sampleRate), d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
  const s=a.createBufferSource(), g=a.createGain(); s.buffer=buf; g.gain.value=vol; s.connect(g); g.connect(Snd.master); s.start(t);
}
const NOTE={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
function freq(n){const m=n.match(/^([A-G][#b]?)(\d)$/); if(!m) return 0; return 440*Math.pow(2,(NOTE[m[1]]+(+m[2]+1)*12-69)/12);}
function seq(str,unit){ // "C4 . E4 -" : '.' のばす, '-' やすみ
  const out=[]; let t=0, cur=null;
  for(const tok of str.replace(/\|/g,' ').trim().split(/\s+/)){
    if(tok==='.'){if(cur) cur.len+=unit;}
    else if(tok==='-'){cur=null;}
    else {cur={f:freq(tok),st:t,len:unit}; out.push(cur);}
    t+=unit;
  }
  return {ev:out,len:t};
}
function song(bpm,mel,bass,mw='square',bw='triangle',mv=.035,bv=.06){
  const m=seq(mel,1), b=seq(bass,2);
  const ev=[...m.ev.map(e=>({...e,w:mw,v:mv})),...b.ev.map(e=>({...e,w:bw,v:bv}))].sort((x,y)=>x.st-y.st);
  return {bpm,ev,len:Math.max(m.len,b.len)};
}
const SONGS={
 field:song(116,
  'E4 G4 C5 . B4 A4 G4 . | A4 F4 A4 C5 B4 . G4 . | E4 G4 C5 E5 D5 C5 B4 A4 | G4 . . . . . - - | F4 A4 C5 . A4 G4 F4 . | E4 G4 C5 . G4 E4 C4 . | D4 F4 A4 C5 B4 A4 G4 B4 | C5 . . . . . - -',
  'C3 G2 C3 G2 | F2 C3 G2 D3 | C3 E3 F2 F3 | G2 D3 G2 B2 | F2 C3 F2 C3 | C3 G2 C3 E3 | D3 F3 G2 G2 | C3 G2 C3 -'),
 town:song(96,
  'C5 . A4 F4 G4 . A4 . | Bb4 . A4 G4 F4 . . - | A4 . C5 A4 G4 . F4 . | E4 F4 G4 A4 G4 . . - | C5 . A4 F4 G4 . A4 . | Bb4 . D5 C5 A4 . F4 . | G4 . A4 Bb4 A4 . G4 . | F4 . . . . . - -',
  'F2 C3 F2 C3 | Bb2 F3 F2 C3 | F2 C3 C3 E3 | C3 G3 C3 E3 | F2 C3 F2 A2 | Bb2 D3 F2 A2 | C3 E3 C3 E3 | F2 C3 F2 -','triangle','triangle',.06,.06),
 battle:song(152,
  'A4 A4 C5 A4 E5 . D5 C5 | B4 B4 D5 B4 G5 . F5 E5 | A4 A4 C5 A4 E5 . D5 C5 | B4 G4 E4 G4 B4 . . - | F4 A4 C5 F5 E5 . C5 A4 | G4 B4 D5 G5 F5 . D5 B4 | A4 C5 E5 A5 G#5 . E5 B4 | A4 . E4 . A4 . - -',
  'A2 A3 A2 A3 | G2 G3 G2 G3 | A2 A3 A2 A3 | E2 E3 E2 E3 | F2 F3 F2 F3 | G2 G3 G2 G3 | A2 A3 E2 E3 | A2 E2 A2 -','square','triangle',.03,.07),
 boss:song(168,
  'D5 D5 F5 D5 A5 . G5 F5 | E5 E5 G5 E5 C6 . Bb5 A5 | D5 D5 F5 D5 A5 . G5 F5 | E5 C#5 A4 C#5 E5 . . - | Bb4 D5 F5 Bb5 A5 . F5 D5 | C5 E5 G5 C6 Bb5 . G5 E5 | D5 F5 A5 D6 C#6 . A5 E5 | D5 . A4 . D5 . - -',
  'D2 D3 D2 D3 | C2 C3 C2 C3 | D2 D3 D2 D3 | A1 A2 A1 A2 | Bb1 Bb2 Bb1 Bb2 | C2 C3 C2 C3 | D2 D3 A1 A2 | D2 A1 D2 -','square','triangle',.03,.07),
 dungeon:song(84,
  'D4 . F4 . A4 . G4 F4 | E4 . . - C4 . . - | D4 . F4 . A4 . Bb4 A4 | G4 . . . . . - - | F4 . E4 . D4 . C4 D4 | E4 . A3 . C#4 . E4 . | D4 . . . . . - - | - - - - - - - -',
  'D2 . A2 . | C2 . G2 . | Bb1 . F2 . | G1 . D2 . | D2 . A2 . | A1 . E2 . | D2 . A2 . | D2 . . -','triangle','triangle',.05,.06),
};
function playBgm(name){
  Snd.want=name; if(Snd.cur===name) return;
  stopBgm(); Snd.cur=name; Snd.want=name;
  if(!Snd.ac||!name||!SONGS[name]) return;
  Snd.song=SONGS[name]; Snd.t0=Snd.ac.currentTime+.08; Snd.ptr=0; Snd.loop=0;
  Snd.timer=setInterval(bgmTick,40); bgmTick();
}
function stopBgm(){clearInterval(Snd.timer); Snd.timer=null; Snd.song=null; Snd.cur=null;}
function bgmTick(){
  const s=Snd.song, a=Snd.ac; if(!s||!a) return; const step=60/s.bpm/2, loopDur=s.len*step;
  for(let guard=0;guard<64;guard++){
    const e=s.ev[Snd.ptr]; const t=Snd.t0+Snd.loop*loopDur+e.st*step;
    if(t>a.currentTime+.3) break;
    if(t>=a.currentTime-.02) tone(e.f,t,e.len*step*.92,e.w,e.v);
    if(++Snd.ptr>=s.ev.length){Snd.ptr=0; Snd.loop++;}
  }
}
function jingle(notes,unit=.11,type='square',vol=.05){
  const a=Snd.ac; if(!a) return 0; let t=a.currentTime+.02;
  for(const n of notes){const [nm,len=1]=n.split(':'); if(nm!=='-') tone(freq(nm),t,unit*len*.95,type,vol); t+=unit*len;}
  return (t-a.currentTime)*1000;
}
const sfx={
  blip(){const a=Snd.ac; a&&tone(1180,a.currentTime,.035,'square',.03);},
  ok(){const a=Snd.ac; if(a){tone(880,a.currentTime,.04,'square',.04); tone(1320,a.currentTime+.045,.05,'square',.04);}},
  bump(){const a=Snd.ac; a&&tone(110,a.currentTime,.07,'square',.05);},
  hit(){const a=Snd.ac; if(a){noise(a.currentTime,.12,.12); tone(220,a.currentTime,.08,'square',.04);}},
  crit(){const a=Snd.ac; if(a){noise(a.currentTime,.25,.16); tone(660,a.currentTime,.06,'square',.05); tone(330,a.currentTime+.06,.12,'square',.05);}},
  hurt(){const a=Snd.ac; if(a){noise(a.currentTime,.18,.14); tone(140,a.currentTime,.15,'sawtooth',.05);}},
  miss(){const a=Snd.ac; a&&tone(440,a.currentTime,.12,'triangle',.06);},
  magic(){const a=Snd.ac; if(a){for(let i=0;i<6;i++) tone(500+i*160,a.currentTime+i*.035,.05,'square',.03);}},
  heal(){jingle(['C5','E5','G5','C6:2'],.07,'triangle',.08);},
  fire(){const a=Snd.ac; if(a){noise(a.currentTime,.35,.1); tone(300,a.currentTime,.3,'sawtooth',.03);}},
  bolt(){const a=Snd.ac; if(a){for(let i=0;i<3;i++) noise(a.currentTime+i*.09,.08,.18);}},
  enc(){const a=Snd.ac; if(a){for(let i=0;i<8;i++) tone(i%2?392:523,a.currentTime+i*.045,.04,'square',.05);}},
  stairs(){jingle(['G4','E4','C4'],.07);},
  chest(){jingle(['G4','C5','E5','G5:2'],.08);},
  buy(){jingle(['E6','C6:2'],.06);},
  win(){return jingle(['C5','E5','G5','C6','-','G5','C6:4'],.1);},
  lvl(){return jingle(['G4','C5','E5','G5:2','E5','G5','C6:4'],.1);},
  inn(){return jingle(['C5:2','E5:2','G5:2','F5','E5','D5','E5','C5:4'],.16,'triangle',.08);},
  lose(){return jingle(['E4:2','D4:2','C4:2','B3:2','C4:6'],.16,'triangle',.08);},
};

/* ---------- UIウインドウ ---------- */
function win(cls,style,html){const d=document.createElement('div'); d.className='win '+(cls||''); Object.assign(d.style,style||{}); if(html!=null) d.innerHTML=html; ui.appendChild(d); return d;}
function msgClear(){msgEl.innerHTML='';}
function msgClose(){msgEl.hidden=true; msgClear();}
function waitKey(){if(FAST) return Promise.resolve('a'); return new Promise(res=>{const h=b=>{if(b==='a'||b==='b'){popH(h); res(b);}}; pushH(h);});}
function waitOrKey(ms){if(FAST) return Promise.resolve(); return new Promise(res=>{let done=false; const fin=()=>{if(done) return; done=true; popH(h); clearTimeout(t); res();};
  const h=b=>{if(b==='a'||b==='b') fin();}; pushH(h); const t=setTimeout(fin,ms);});}
async function say(text,opt={}){
  const wait=opt.wait||'key';
  msgEl.hidden=false;
  if(FAST){const p=document.createElement('p'); p.textContent=text; msgEl.appendChild(p); while(msgEl.querySelectorAll('p').length>10) msgEl.querySelector('p').remove(); return;}
  const p=document.createElement('p'); msgEl.appendChild(p);
  while(msgEl.querySelectorAll('p').length>10) msgEl.querySelector('p').remove();
  let skip=false; const h=b=>{if(b==='a'||b==='b') skip=true;}; pushH(h);
  for(let i=1;i<=text.length;i++){
    if(skip){p.textContent=text; break;}
    p.textContent=text.slice(0,i);
    if(i%3===0&&text[i-1]!==' ') sfx.blip();
    await sleep(opt.speed||22);
  }
  popH(h);
  if(wait==='key'){const m=document.createElement('span'); m.className='more'; m.textContent='▼'; msgEl.appendChild(m); await waitKey(); sfx.blip(); m.remove();}
  else if(wait==='auto') await waitOrKey(opt.ms||650);
}
async function lines(arr){msgClear(); for(const t of arr) await say(t); msgClose();}

class Menu{
  constructor(o){this.o=o; this.i=o.start||0; this.items=o.items; this.el=win('menu',o.style); this.render();}
  setItems(it){this.items=it; this.i=clamp(this.i,0,it.length-1); this.render();}
  render(){
    const o=this.o, cols=o.cols||1;
    let h=o.title?`<div class="wt">${o.title}</div>`:'';
    h+=`<div class="grid" style="grid-template-columns:repeat(${cols},minmax(0,1fr))">`;
    this.items.forEach((it,k)=>{const x=typeof it==='string'?{label:it}:it;
      h+=`<div class="it${k===this.i?' sel':''}${x.disabled?' dis':''}"><span class="cur">${k===this.i?'▶':''}</span><span class="lb">${x.label}</span><span class="rt">${x.right??''}</span></div>`;});
    h+='</div>';
    if(o.desc){const d=o.desc(this.i); if(d) h+=`<div class="desc">${d}</div>`;}
    this.el.innerHTML=h; this.el.classList.toggle('active',!!this.active);
  }
  pick(){
    return new Promise(res=>{
      this.active=true; this.render(); const n=this.items.length, cols=this.o.cols||1;
      const h=b=>{
        let j=this.i;
        if(b==='up') j=(this.i-cols+n*cols)%n;
        else if(b==='down') j=(this.i+cols)%n;
        else if(b==='left'&&cols>1) j=(this.i-1+n)%n;
        else if(b==='right'&&cols>1) j=(this.i+1)%n;
        else if(b==='a'){popH(h); this.active=false; this.render(); sfx.ok(); res(this.i); return;}
        else if(b==='b'||b==='menu'){if(this.o.cancel===false) return; popH(h); this.active=false; this.render(); sfx.blip(); res(-1); return;}
        if(j!==this.i){this.i=j; sfx.blip(); this.render(); this.o.onMove&&this.o.onMove(j);}
      };
      pushH(h); this.o.onMove&&this.o.onMove(this.i);
    });
  }
  close(){this.el.remove();}
}
async function yesNo(){const m=new Menu({items:['はい','いいえ'],style:{right:'3%',bottom:'35%',width:'24%'}}); const c=await m.pick(); m.close(); return c===0;}

