/* ---------- 戦闘 ---------- */
const BG={
  field:['#3a6ad0','#9ac8f0','#4a9a3c','#2e6a26'], forest:['#2a5a6a','#7ab0a0','#2e6a2a','#1a4a1c'],
  beach:['#3a7ae0','#bfe4f8','#e0c886','#b89a5a'], swamp:['#3a2a5a','#8a7aa8','#5a3a6a','#3a2448'],
  cave:['#120c0a','#3a2e26','#5a4a3c','#3a2e24'], tower:['#1a2a24','#4a6a5a','#5a6a52','#34442e'],
  castle:['#140a24','#3e2460','#4a3a5a','#2a1e38'], lake:['#0e1e34','#2a4a6a','#3a5a78','#24384e'],
  sewer:['#141a12','#34402c','#3a5a4a','#26362c'], crypt:['#0a0812','#2a2038','#3a3444','#24202c'],
  volcano:['#2a0a04','#8a2a10','#5a3a30','#3a201a'], abyss:['#04041a','#1a1a50','#24245a','#141438'],
  sea:['#2a5ab0','#9ad0f0','#2a62c4','#1a4490'], ice:['#5a8ac0','#d8ecfa','#e0eef8','#a8c0d8'],
  desert:['#d88a3a','#f8d890','#e0c070','#b89848'], sky:['#4a8ae0','#e0f0ff','#f4f6ff','#c8d0f0'],
  dark:['#08040e','#2a1438','#2a1e34','#140a1c'], nox:['#000000','#1a0a2a','#1a1430','#0a0814'],
};
function mkEnemy(id,zone,ml){
  let d=MON[id];
  if(!d.boss){const z=zone&&ZONE_ML[zone]; const L=ml||(z&&z[0]); if(L) d=scaledMon(id,L,ml?chOfLevel(ml):z[1],zone);}
  return {id,d,name:d.n,hp:d.hp,mhp:d.hp,atk:d.atk,def:d.def,agi:d.agi,flashT:0,dieT:0,x:0,sleep:false};}
function labelEnemies(en){
  const cnt={}; en.forEach(e=>cnt[e.id]=(cnt[e.id]||0)+1); const seen={};
  en.forEach(e=>{if(cnt[e.id]>1){seen[e.id]=(seen[e.id]||0)+1; e.label=e.name+' '+'ABCDEF'[seen[e.id]-1];} else e.label=e.name;});
}
const escale=e=>e.form&&e.d.form2?e.d.form2.scale:(e.d.scale||3);
function layoutEnemies(){
  const vis=B.en.filter(e=>!(e.dieT&&performance.now()-e.dieT>420));
  const gap=8; const total=vis.reduce((s,e)=>s+16*escale(e),0)+gap*(vis.length-1);
  let x=SW/2-total/2; for(const e of vis){e.x=x+8*escale(e); x+=16*escale(e)+gap;}
}
const alive=()=>B.en.filter(e=>e.hp>0);
function enemySprite(e){
  if(e.form&&e.d.form2){const k=e.id+'#form'; if(!monCache[k]){const f=e.d.form2; monCache[k]=art(MSPR[f.s],Object.assign({k:'#140c18',w:'#f4f2ea',e:'#ff3040'},f.p));} return monCache[k];}
  return monSprite(e.id,e.alt);
}
function drawBattle(now){
  ctx.fillStyle='#000'; ctx.fillRect(0,0,SW,SH);
  const c=BG[B.area]||BG.field; const bx=10,by=50,bw=SW-20,bh=68;
  let g=ctx.createLinearGradient(0,by,0,by+bh*.62); g.addColorStop(0,c[0]); g.addColorStop(1,c[1]);
  ctx.fillStyle=g; ctx.fillRect(bx,by,bw,bh*.62);
  g=ctx.createLinearGradient(0,by+bh*.62,0,by+bh); g.addColorStop(0,c[2]); g.addColorStop(1,c[3]);
  ctx.fillStyle=g; ctx.fillRect(bx,by+bh*.62,bw,bh*.38);
  if(['castle','cave','tower','crypt','sewer','dark','nox','lake'].includes(B.area)){ctx.fillStyle='rgba(255,255,255,.06)'; for(let i=0;i<6;i++) ctx.fillRect(bx+12+i*38,by+6,10,bh*.56);}
  if(B.area==='nox'||B.area==='abyss'||B.area==='sky'){ctx.fillStyle='rgba(255,250,220,.7)'; for(let i=0;i<14;i++){const sx=(i*53+17)%bw, sy=(i*29)%(bh*.5); ctx.fillRect(bx+sx,by+4+sy,1,1);}}
  ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(bx+.5,by+.5,bw-1,bh-1);
  for(let i=0;i<B.en.length;i++){
    const e=B.en[i]; const sp=enemySprite(e); const sc=escale(e);
    if(e.dieT&&now-e.dieT>420) continue;
    if(e.flashT&&now-e.flashT<360&&Math.floor((now-e.flashT)/60)%2===0) continue;
    const w=16*sc, h=(sp.bot+1)*sc; const bob=e.d.boss||e.sleep?0:Math.sin(now/300+i)*1.2;
    const x=Math.round(e.x-w/2), y=Math.round(112-h+bob);
    ctx.save();
    if(e.dieT){const k=(now-e.dieT)/420; ctx.globalAlpha=1-k; ctx.drawImage(sp,0,0,16,sp.height,x,y+k*10,w,sp.height*sc*(1-k*.4));}
    else ctx.drawImage(sp,0,0,16,sp.height,x,y,w,sp.height*sc);
    ctx.restore();
    if(e.prep&&e.hp>0&&Math.floor(now/200)%2===0){ctx.strokeStyle='#ffe060'; ctx.strokeRect(x-1,y-1,w+2,h+2);}
    if(e.sleep&&e.hp>0){ctx.fillStyle='#fff'; ctx.font='8px monospace'; const z=Math.floor(now/400)%3; ctx.fillText('z'.repeat(z+1),x+w-6,y+4-z*2);}
    if(B.hi===i&&e.hp>0&&Math.floor(now/250)%2===0){ctx.fillStyle='#fff'; const tx=Math.round(e.x); ctx.beginPath(); ctx.moveTo(tx-4,y-8); ctx.lineTo(tx+4,y-8); ctx.lineTo(tx,y-3); ctx.fill();}
  }
}
async function encounterFx(boss){
  sfx.enc(); stopBgm(); if(FAST) return;
  for(let i=0;i<(boss?2:3);i++){fadeEl.style.transitionDuration='0ms'; fadeEl.style.background='#fff'; fadeEl.style.opacity='.85'; await sleep(55); fadeEl.style.opacity='0'; await sleep(55);}
  fadeEl.style.background='#000'; await fadeOut(180);
}
function clearBuffs(){for(const p of S.party){p.silence=0; p.sleep=false; p.defend=false; p.atkUp=false; p.defUp=false; p.covering=false; p.counter=false;}}
async function battle(ids,opt={}){
  await encounterFx(opt.boss);
  B={en:ids.map(id=>mkEnemy(id,opt.zone)),area:opt.area||'field',zone:opt.zone,boss:!!opt.boss,guard:false,hi:-1,act:-1,lastCmd:[],turn:0};
  labelEnemies(B.en); layoutEnemies(); clearBuffs();
  mode='battle'; playBgm(opt.bgm||(opt.boss?'boss':'battle')); msgClear();
  showStatus({left:'3%',top:'2.5%'});
  await fadeIn(160);
  if(B.en.length===1) await say(`${B.en[0].name}が あらわれた！`,{wait:'auto'});
  else if(new Set(ids).size===1) await say(`${B.en[0].name}が ${B.en.length}ひき あらわれた！`,{wait:'auto'});
  else await say(opt.boss?`${B.en.map(e=>e.name).join('と ')}が あらわれた！`:'まものの むれが あらわれた！',{wait:'auto'});
  let res=null;
  const check=()=>!alive().length?'win':!aliveP().length?'lose':null;
  while(!res){
    B.turn++;
    const cmds=await partyCommands();
    msgClear(); msgEl.hidden=false;
    S.party.forEach((p,i)=>{p.defend=!!(cmds[i]&&cmds[i].t==='defend'); const c=cmds[i]; if(c&&c.t==='spell'&&p.mp>=SP[c.k].mp){if(SP[c.k].t==='cover'){p.covering=true;} if(SP[c.k].t==='counter'){p.counter=true;}}});
    const order=[...S.party.map((p,i)=>({p,i,sp:p.agi*(.6+Math.random()*.6)})).filter(a=>a.p.hp>0),
      ...alive().map(e=>({e,sp:e.agi*(.6+Math.random()*.6)}))].sort((a,b)=>b.sp-a.sp);
    for(const a of order){
      if(a.p){if(a.p.hp>0) res=await memberAct(a.p,cmds[a.i]);}
      else if(a.e.hp>0&&aliveP().length) await enemyAct(a.e);
      if(!res) res=check();
      if(res) break;
    }
    if(!res){
      for(const p of aliveP()) if(p.poison){
        const d=Math.max(1,Math.floor(p.mhp/12)); flash('rgba(120,255,80,.35)',160);
        await say(`${p.name}は どくに むしばまれている！`,{wait:'auto',ms:300}); await hurtMember(p,d,{raw:1});
      }
      res=check();
    }
    S.party.forEach(p=>{p.defend=false; p.covering=false; p.counter=false; if(p.silence) p.silence--;});
    if(!res){ const ends=[];
      if(B.guard&&--B.guardT<=0){B.guard=false; ends.push('なかまたちを まもる ちからが きえた。');}
      for(const p of S.party){ if(p.defUp&&--p.defT<=0){p.defUp=false; ends.push(`${p.name}の まもりが もとに もどった。`);} if(p.atkUp&&--p.atkT<=0){p.atkUp=false; ends.push(`${p.name}の こうげきりょくが もとに もどった。`);} }
      for(const t of ends) await say(t,{wait:'auto',ms:420}); if(ends.length) updStatus(); }
    if(opt.limit&&B.turn>=opt.limit&&!res) res='timeout';
    if(B.turn>200&&!res) res='lose';
  }
  window.__lastTurns=B.turn;
  if(res==='win') await victory();
  clearBuffs();
  if(res==='lose'&&!opt.noDefeat){await defeat(); return 'lose';}
  await fadeOut(220); hideStatus(); msgClose(); B=null; mode='field'; playBgm(mapBgm()); await fadeIn(220);
  if(res==='win') autoSave();
  return res;
}
async function partyCommands(){
  const cmds=[]; const idx=S.party.map((p,i)=>i).filter(i=>S.party[i].hp>0&&!S.party[i].sleep);
  let k=0;
  while(k<idx.length){
    const i=idx[k]; B.act=i; updStatus();
    const c=AUTO?autoCmd(S.party[i]):await memberCommand(S.party[i],i,k>0);
    if(c==='back'){k--; continue;}
    cmds[i]=c; k++;
  }
  B.act=-1; updStatus(); return cmds;
}
async function memberCommand(p,i,canBack){
  msgClear(); msgEl.hidden=true;
  const enList=win('',{right:'3%',bottom:'3%',width:'47%',height:'30%'});
  const updList=()=>{enList.innerHTML=alive().map(e=>`<div>${e.label}${e.sleep?'（ねむり）':''}${e.prep?'（！）':''}</div>`).join('');};
  updList();
  const flash2=async t=>{enList.textContent=t; sfx.bump(); await sleep(750); updList();};
  const cm=new Menu({title:p.name,items:['たたかう',['garm','riri','jin'].includes(p.cls)?'わざ':'じゅもん','どうぐ','ぼうぎょ','にげる'],cols:2,cancel:canBack,start:B.lastCmd[i]||0,style:{left:'3%',bottom:'3%',width:'48%'}});
  try{
    while(true){
      const c=await cm.pick(); if(c<0) return 'back'; B.lastCmd[i]=c;
      if(c===0){const t=await pickTarget(); if(t>=0) return {t:'attack',target:t}; continue;}
      if(c===1){
        const ks=learned(p).filter(k=>SP[k].battle); const WAZA=['garm','riri','jin'].includes(p.cls);
        if(!ks.length){await flash2(WAZA?'まだ わざを おぼえていない':'じゅもんを おぼえていない'); continue;}
        const sm=new Menu({items:ks.map(k=>({label:SP[k].n,right:SP[k].mp,disabled:p.mp<SP[k].mp})),title:`${WAZA?'わざ':'じゅもん'}（MP ${p.mp}）`,style:{left:'26%',bottom:'3%',right:'3%'},desc:j=>SP[ks[j]].d});
        const j=await sm.pick(); sm.close(); if(j<0) continue;
        const sp=SP[ks[j]];
        if(p.silence&&isMagic(sp)){await flash2('じゅもんを ふうじられている！'); continue;}
        if(p.mp<sp.mp){await flash2('MPが たりない！'); continue;}
        const tg=await pickFor(sp.tg,i); if(tg===undefined) continue;
        return {t:'spell',k:ks[j],target:tg};
      }
      if(c===2){
        const list=bagList(it=>!it.slot&&!it.key&&it.t!=='return');
        if(!list.length){await flash2('つかえる どうぐが ない'); continue;}
        const im=new Menu({items:list,title:'どうぐ',style:{left:'26%',bottom:'3%',right:'3%'},desc:j=>IT[list[j].id].d});
        const j=await im.pick(); im.close(); if(j<0) continue;
        const tg=await pickFor(IT[list[j].id].tg); if(tg===undefined) continue;
        return {t:'item',id:list[j].id,target:tg};
      }
      if(c===3) return {t:'defend'};
      if(c===4) return {t:'flee'};
    }
  } finally {cm.close(); enList.remove(); B.hi=-1;}
}
async function pickFor(tg,self){
  if(tg==='self') return self;
  if(tg==='one'){const t=await pickTarget(); return t<0?undefined:t;}
  if(tg==='ally'){if(S.party.length===1) return 0; const m=await pickMember('だれに？',x=>x.hp>0,{right:'3%',bottom:'3%',width:'47%'}); return m?S.party.indexOf(m):undefined;}
  if(tg==='dead'){const m=await pickMember('だれに？',x=>x.hp<=0,{right:'3%',bottom:'3%',width:'47%'}); return m?S.party.indexOf(m):undefined;}
  return null;
}
async function pickTarget(){
  const al=alive(); if(al.length===1) return B.en.indexOf(al[0]);
  const m=new Menu({items:al.map(e=>e.label),style:{right:'3%',bottom:'3%',width:'47%'},onMove:i=>{B.hi=B.en.indexOf(al[i]);}});
  const i=await m.pick(); m.close(); B.hi=-1; return i<0?-1:B.en.indexOf(al[i]);
}

/* テストプレイ用の じどう せんとう（そこそこ うまい プレイヤーの まね） */
const OFFENSE={hero:['dawn','judge','starrain','lsword'],mio:['secret','nova','meteor','spear','blaze','ice','bolt','fire'],garm:['pride','quake','oath','smash'],
  riri:['flash','storm','needle','triple','shadowcut','double'],olga:['curse'],jin:['starcut','first','musou','steel','swallow','iai'],mumei:['mlight']};
function autoCmd(p){
  const al=aliveP(), dead=S.party.filter(m=>m.hp<=0), en=alive(), idx=m=>S.party.indexOf(m);
  const ks=learned(p).filter(k=>SP[k].battle&&p.mp>=SP[k].mp&&!(p.silence&&isMagic(SP[k]))), can=k=>ks.includes(k);
  const low=al.filter(m=>m.hp<m.mhp*.5).sort((a,b)=>a.hp/a.mhp-b.hp/b.mhp);
  const healer=p.cls==='olga'||(p.cls==='hero'&&!S.party.some(m=>m.cls==='olga'&&m.hp>0&&!m.sleep));
  if(dead.length){const k=['ofull','orev','revive'].find(can); if(k) return {t:'spell',k,target:idx(dead[0])}; if(has('life')&&(healer||p.cls==='garm')) return {t:'item',id:'life',target:idx(dead[0])};}
  if(low.length>=2){const k=['witch','oallbig','hheal','oall','mheal'].find(can); if(k) return {t:'spell',k};}
  if(low.length&&(healer||low[0].hp<low[0].mhp*.3)){const k=['obig','heal2','oheal','heal'].find(can); if(k) return {t:'spell',k,target:idx(low[0])};
    if(low[0].hp<low[0].mhp*.3){for(const it of ['herb3','herb2','herb']) if(has(it)) return {t:'item',id:it,target:idx(low[0])};}}
  const sleeper=al.find(m=>m.sleep||(m.silence&&['olga','mio','hero'].includes(m.cls))); if(sleeper&&can('purify')) return {t:'spell',k:'purify',target:idx(sleeper)};
  if(sleeper&&sleeper.silence&&has('bell')&&p!==sleeper) return {t:'item',id:'bell',target:idx(sleeper)};
  if(B.boss&&!B.guard){const k=['wall','guard'].find(can); if(k&&(p.cls==='garm'||p.cls==='hero'&&!S.party.some(m=>m.cls==='garm'&&m.hp>0))) return {t:'spell',k};}
  if(!B.boss&&AUTO==='trash'){const tgt=en.slice().sort((a,b)=>a.hp-b.hp)[0]; return {t:'attack',target:B.en.indexOf(tgt)};}
  if(B.boss&&can('power')){const t=al.find(m=>['garm','jin','hero','riri'].includes(m.cls)&&!m.atkUp); if(t) return {t:'spell',k:'power',target:idx(t)};}
  if(B.boss&&can('focus')&&!p.atkUp) return {t:'spell',k:'focus',target:idx(p)};
  if(en.some(e=>e.prep)&&['mio','olga'].includes(p.cls)&&p.hp<p.mhp*.6) return {t:'defend'};
  const reserve={hero:.45,olga:.7,mio:0,garm:.2,riri:.2,jin:.2,mumei:0}[p.cls]||0;
  if(p.mp>p.mmp*reserve){
    const off=(OFFENSE[p.cls]||[]).filter(can);
    const allK=off.find(k=>SP[k].tg==='all'), oneK=off.find(k=>SP[k].tg==='one');
    const k=en.length>=2&&allK?allK:(oneK||allK);
    if(k){const tgt=en.slice().sort((a,b)=>a.hp-b.hp)[0]; return {t:'spell',k,target:SP[k].tg==='one'?B.en.indexOf(tgt):null};}
  }
  const tgt=en.slice().sort((a,b)=>a.hp-b.hp)[0];
  return {t:'attack',target:B.en.indexOf(tgt)};
}

function physDmg(atk,def){const base=(atk-def/2)/2; if(base<1) return rnd(0,1); return Math.max(1,Math.floor(base*(.85+Math.random()*.3)));}
const battleAtk=p=>Math.round(atkOf(p)*(p.atkUp?1.4:1));
function a_kill(){const a=Snd.ac; a&&tone(880,a.currentTime,.12,'square',.04);}
async function hitEnemy(e,dmg){
  e.hp=Math.max(0,e.hp-dmg); e.flashT=performance.now();
  await say(dmg>0?`${e.label}に ${dmg}ポイントの ダメージ！`:`${e.label}に ダメージを あたえられない！`,{wait:'auto',ms:520});
  if(e.hp<=0){e.dieT=performance.now(); e.prep=null; a_kill(); await say(`${e.label}を やっつけた！`,{wait:'auto',ms:480}); return;}
  if(e.sleep&&dmg>0&&Math.random()<.3){e.sleep=false; await say(`${e.label}は めを さました！`,{wait:'auto',ms:400});}
}
const pickAliveEnemy=t=>{const e=B.en[t]; return e&&e.hp>0?e:alive()[0];};
async function memberAct(p,cmd){
  const n=p.name;
  if(p.sleep){
    if(Math.random()<.4){p.sleep=false; updStatus(); await say(`${n}は めを さました！`,{wait:'auto'});}
    else await say(`${n}は ねむっている。`,{wait:'auto',ms:450});
    return null;
  }
  if(!cmd) return null;
  if(cmd.t==='defend'){await say(`${n}は みを まもっている。`,{wait:'auto',ms:400}); return null;}
  if(cmd.t==='attack'){
    const e=pickAliveEnemy(cmd.target); if(!e) return null;
    await say(`${n}の こうげき！`,{wait:'auto',ms:300});
    if(Math.random()<1/32){sfx.miss(); await say(`ミス！ ${e.label}は ひらりと みをかわした！`,{wait:'auto'}); return null;}
    if(Math.random()<CLS[p.cls].crit){sfx.crit(); flash('#ffffff',160); shake(); await say('かいしんの いちげき！',{wait:'auto',ms:350});
      await hitEnemy(e,Math.floor(battleAtk(p)*(.85+Math.random()*.15))); return null;}
    sfx.hit(); await hitEnemy(e,physDmg(battleAtk(p),e.def)); return null;
  }
  if(cmd.t==='spell'){
    const sp=SP[cmd.k];
    if(p.silence&&isMagic(sp)){await say(`${n}は ${sp.n}を となえようとした。 しかし じゅもんを ふうじられている！`,{wait:'auto'}); return null;}
    if(p.mp<sp.mp){await say(`${n}は ${sp.n}を つかおうとした。 しかし MPが たりない！`,{wait:'auto'}); return null;}
    // かさねがけは できない：もう かかっていれば MPを つかわずに おしえる
    {const bt=S.party[cmd.target];
     const already=sp.t==='guard'?(B.guard&&'ひかりの かべは もう はられている！'):
       sp.t==='buffAtk'?(bt&&bt.hp>0&&bt.atkUp&&`${bt.name}の こうげきりょくは もう あがっている！`):
       sp.t==='buffDef'?(bt&&bt.hp>0&&bt.defUp&&`${bt.name}の まもりは もう かたまっている！`):null;
     if(already){await say(`${n}は ${sp.n}を となえようとした。 しかし ${already} これいじょうは あがらない。`,{wait:'auto'}); await say('（MPは へらなかった）',{wait:'auto',ms:400}); return null;}}
    p.mp-=sp.mp; updStatus();
    if(['phys','roar','multi','steal','cover','counter'].includes(sp.t)||['garm','riri','jin'].includes(p.cls)) await say(`${n}の ${sp.n}！`,{wait:'auto',ms:350});
    else {await say(`${n}は ${sp.n}の じゅもんを となえた！`,{wait:'auto',ms:350}); sfx.magic(); await sleep(200);}
    if(sp.t==='cover'){p.covering=true; await say(`${n}は なかまの まえに たちはだかった！`,{wait:'auto'}); return null;}
    if(sp.t==='counter'){p.counter=true; await say(`${n}は かたなに てを かけ、 しずかに かまえた…`,{wait:'auto'}); return null;}
    if(sp.t==='steal'){
      const e=pickAliveEnemy(cmd.target); if(!e) return null;
      if(e.stolen||e.d.boss&&!e.d.steal){await say(`${e.label}は なにも もっていない ようだ。`,{wait:'auto'}); return null;}
      if(Math.random()<.55+p.agi/400){e.stolen=1; const it=e.d.steal||stealItem(e); addItem(it); sfx.chest(); await say(`${n}は ${e.label}から ${IT[it].n}を ぬすんだ！`,{wait:'auto'});}
      else await say('しかし ぬすめなかった！',{wait:'auto'});
      return null;
    }
    if(sp.t==='multi'){
      sfx.hit(); const e0=pickAliveEnemy(cmd.target);
      for(let h=0;h<sp.hits;h++){const e=e0&&e0.hp>0?e0:alive()[0]; if(!e) break; await hitEnemy(e,Math.max(1,Math.round(physDmg(battleAtk(p),e.def)*sp.mult)));}
      return null;
    }
    if(sp.t==='guard'){B.guard=true; B.guardT=4; flash('#a0c8ff',260); await say(p.cls==='garm'?'まもりの じんが なかまたちを つつみこんだ！':'ひかりの かべが なかまたちを つつみこんだ！',{wait:'auto'}); return null;}
    if(sp.t==='sleep'||sp.t==='roar'){
      flash(sp.t==='roar'?'#ffffff':'#c0a0ff',260); if(sp.t==='roar') shake();
      for(const e of alive()){
        if(e.d.boss) await say(`${e.label}には ききめが なかった！`,{wait:'auto',ms:450});
        else if(!e.sleep&&Math.random()<(sp.t==='roar'?.5:.6)){e.sleep=true; await say(sp.t==='roar'?`${e.label}は ひるんで うごけなく なった！`:`${e.label}は ねむってしまった！`,{wait:'auto',ms:450});}
        else await say(`${e.label}には きかなかった！`,{wait:'auto',ms:400});
      }
      return null;
    }
    if(sp.t==='phys'){
      sfx.crit(); shake();
      const targets=sp.tg==='all'?alive():[pickAliveEnemy(cmd.target)];
      for(const e of targets) if(e&&e.hp>0) await hitEnemy(e,Math.round(physDmg(battleAtk(p),e.def)*sp.mult));
      return null;
    }
    if(sp.t==='atk'){
      if(['bolt','spear','curse'].includes(cmd.k)){sfx.bolt(); flash('#ffffff',300); shake();}
      else if(['lsword','starrain','judge','dawn','nova','meteor','secret','mlight'].includes(cmd.k)){sfx.bolt(); flash('#fff4b0',380);}
      else if(cmd.k==='ice'){sfx.bolt(); flash('#a0e8ff',300);}
      else {sfx.fire(); flash('#ff8a3a',260);}
      const targets=sp.tg==='all'?alive():[pickAliveEnemy(cmd.target)];
      for(const e of targets) if(e&&e.hp>0) await hitEnemy(e,rnd(...sp.pow));
      return null;
    }
    if(sp.t==='healAll'){flash('#7dffb0',260); await say(healAll(sp.pow),{wait:'auto'}); updStatus(); return null;}
    if(sp.t==='buffAtk'||sp.t==='buffDef'){
      const tgt=S.party[cmd.target]; if(!tgt||tgt.hp<=0){await say('しかし こうかが なかった！',{wait:'auto'}); return null;}
      if(sp.t==='buffAtk'){tgt.atkUp=true; tgt.atkT=5; flash('#ff8080',200); await say(`${tgt.name}の ちからが みなぎってきた！`,{wait:'auto'});}
      else {tgt.defUp=true; tgt.defT=5; flash('#a0c8ff',200); await say(tgt===p&&p.cls==='garm'?`${tgt.name}は たてを かまえ、 みを かためた！`:`${tgt.name}は まもりの ちからに つつまれた！`,{wait:'auto'});}
      return null;
    }
    const tgt=S.party[cmd.target]; const r=tgt&&applyTo(sp,sp.t,sp.pow,tgt);
    updStatus(); flash('#7dffb0',200);
    await say(r&&!FULLMSG[r]?r:'しかし こうかが なかった！',{wait:'auto'}); return null;
  }
  if(cmd.t==='item'){
    const it=IT[cmd.id];
    if(!has(cmd.id)){await say(`${n}は どうぐを さがしたが みつからなかった！`,{wait:'auto'}); return null;}
    delItem(cmd.id);
    await say(`${n}は ${it.n}を つかった！`,{wait:'auto',ms:350});
    if(it.t==='flee'){if(B.boss){await say('しかし けむりは すぐに かきけされた！',{wait:'auto'}); return null;}
      await say('あたりが けむりに つつまれた！',{wait:'auto'}); await say('みんなは うまく にげきった！',{wait:'auto'}); return 'fled';}
    const tgt=S.party[cmd.target]; const r=tgt&&applyTo(it,it.t,it.pow,tgt); updStatus();
    await say(r&&!FULLMSG[r]?r:'しかし こうかが なかった！',{wait:'auto'}); return null;
  }
  if(cmd.t==='flee'){
    await say(`${n}たちは にげだした！`,{wait:'auto',ms:350});
    const mx=Math.max(...alive().map(e=>e.sleep?0:e.agi)), my=Math.max(...aliveP().map(x=>x.agi));
    const ch=B.boss?0:clamp(.55+(my-mx)/40,.25,.92);
    if(Math.random()<ch){sfx.stairs(); return 'fled';}
    await say(B.boss?'しかし にげられない！':'しかし まわりこまれてしまった！',{wait:'auto'}); return null;
  }
  return null;
}
async function hurtMember(p,dmg,o={}){
  if(!p) return;
  if(!o.raw){let k=1; if(B.guard) k*=.75; if(p.defUp) k*=.7; k=Math.max(.6,k); if(p.defend) k*=.6; dmg=Math.ceil(dmg*k);}   // まもりの じゅもんは かさねても 4わり げんまで
  p.hp=Math.max(0,p.hp-dmg); updStatus();
  if(dmg>0){sfx.hurt(); shake(); flash('rgba(255,40,40,.5)',140);}
  await say(dmg>0?`${p.name}は ${dmg}ポイントの ダメージを うけた！`:`${p.name}は ダメージを うけなかった！`,{wait:'auto',ms:520});
  if(p.hp<=0){p.poison=false; p.sleep=false; p.atkUp=false; p.defUp=false; updStatus(); await say(`${p.name}は ちからつきた…`,{wait:'auto',ms:600});}
  else if(p.sleep&&dmg>0&&!o.raw&&Math.random()<.3){p.sleep=false; updStatus(); await say(`${p.name}は いたみで めを さました！`,{wait:'auto',ms:400});}
}
async function poisonMember(p,ch=.6){
  if(!p||p.hp<=0||p.poison) return; if(Math.random()>=ch) return;
  p.poison=true; updStatus(); await say(`${p.name}は どくに おかされた！`,{wait:'auto',ms:450});
}
async function sleepMember(p,ch){
  if(!p||p.hp<=0||p.sleep) return;
  if(Math.random()<ch){p.sleep=true; updStatus(); await say(`${p.name}は うごけなく なった！`,{wait:'auto',ms:450});}
  else await say(`${p.name}は もちこたえた！`,{wait:'auto',ms:380});
}
const randAlly=()=>pickR(aliveP());
async function enemyAttack(e,mult=1,silent,tgt){
  let p=tgt||randAlly(); if(!p) return;
  const cv=aliveP().find(m=>m.covering&&m!==p&&!m.sleep); if(cv&&Math.random()<.85){if(!silent) await say(`${e.label}の こうげき！`,{wait:'auto',ms:300}); silent=true; await say(`${cv.name}が ${p.name}を かばった！`,{wait:'auto',ms:380}); p=cv;}
  if(!silent) await say(`${e.label}の こうげき！`,{wait:'auto',ms:300});
  if(Math.random()<1/40){sfx.miss(); await say(`${p.name}は すばやく みをかわした！`,{wait:'auto'}); return;}
  let dmg;
  if(!e.d.boss&&Math.random()<1/48){await say('つうこんの いちげき！',{wait:'auto',ms:300}); dmg=Math.floor(e.atk*.5*(1+Math.random()*.2));}
  else dmg=Math.floor(physDmg(e.atk,defOf(p))*mult);
  if(e.charge){dmg*=2; e.charge=false;}
  if(p.covering) dmg=Math.ceil(dmg*.7);
  await hurtMember(p,dmg);
  if(p.counter&&p.hp>0&&e.hp>0&&!p.sleep){p.counter=false; sfx.crit(); await say(`${p.name}の みかえし！`,{wait:'auto',ms:300}); await hitEnemy(e,Math.round(physDmg(battleAtk(p),e.def)*1.5));}
}
async function hitAll(lo,hi){for(const p of aliveP()) await hurtMember(p,rnd(lo,hi));}
function pickSkill(d){if(!d.sk) return null; let r=Math.random(); for(const s of d.sk){if(r<s.r) return s; r-=s.r;} return null;}
async function enemyAct(e){
  if(e.sleep){
    if(Math.random()<.35){e.sleep=false; await say(`${e.label}は めを さました！`,{wait:'auto',ms:420});}
    else await say(`${e.label}は うごけない。`,{wait:'auto',ms:380});
    return;
  }
  const d=e.d;
  if(d.ai==='gen') return genAct(e);
  await enemyMove(e);
  if(d.acts&&aliveP().length&&e.hp>0&&Math.random()<.4) await enemyMove(e);
}
async function enemyMove(e){
  let sk=pickSkill(e.d); if(e.charge) sk=null;
  if(!sk) return enemyAttack(e);
  return doMove(e,sk);
}
// だんかいつき ボスの こうどう
async function genAct(e){
  const d=e.d; let ph=e.ph||0;
  while(d.phases[ph+1]&&e.hp<=e.mhp*d.phases[ph+1].at){
    ph++; e.ph=ph; const P=d.phases[ph];
    if(P.alt) e.alt=true;
    if(P.form){e.form=true; e.name=d.form2.n; e.label=e.name; layoutEnemies();}
    flash('#ff2050',400); shake();
    if(P.say) await say(P.say,{wait:FAST?'auto':'key'});
  }
  const P=d.phases[ph];
  await genMove(e,P);
  const acts=ph>=1&&(d.ml||0)>=10?1:(P.acts||0);   // こうはん（HP はんぶん いか）は まいターン 2かい こうどう
  if(acts&&Math.random()<acts&&aliveP().length&&e.hp>0) await genMove(e,P);
}
async function genMove(e,P){
  if(e.prep){const mv=e.prep; e.prep=null; return doMove(e,mv);}
  const tot=P.moves.reduce((s,m)=>s+m.r,0); let r=Math.random()*tot, mv=P.moves[0];
  for(const m of P.moves){if(r<m.r){mv=m; break;} r-=m.r;}
  return doMove(e,mv);
}
async function doMove(e,mv){
  const msg=mv.m?mv.m.replace('%s',e.label):'';
  const ref=e.d.hpRef||60;
  const dm=()=>Math.round((mv.f?ref*mv.f*(.9+Math.random()*.2):rnd(...mv.pow))*(e.d.dmg||1));
  switch(mv.t){
    case 'attack': return enemyAttack(e);
    case 'str': await say(msg,{wait:'auto',ms:380}); return enemyAttack(e,1.5,true);
    case 'charge': await say(msg,{wait:'auto',ms:420}); e.charge=true; return;
    case 'prep': await say(msg,{wait:'auto',ms:600}); e.prep=mv.next; sfx.magic(); return;
    case 'mag': await say(msg,{wait:'auto',ms:380}); sfx.fire(); flash('#ff8a3a',200); return hurtMember(randAlly(),dm());
    case 'breath': await say(msg,{wait:'auto',ms:380}); sfx.fire(); flash(mv.f>.25?'#ffffff':'#ff8a3a',mv.f>.25?400:220); if(mv.f>.25) shake(); for(const p of aliveP()) await hurtMember(p,dm()); return;
    case 'poison': {const p=randAlly(); await say(msg,{wait:'auto',ms:380}); await enemyAttack(e,1,true,p); return poisonMember(p);}
    case 'sleep1': await say(msg,{wait:'auto',ms:380}); flash('#c0a0ff',200); return sleepMember(randAlly(),.5);
    case 'dispel': {
      await say(msg,{wait:'auto',ms:420}); flash('#c0f0ff',360); shake();
      const had=B.guard||S.party.some(p=>p.atkUp||p.defUp);
      B.guard=false; for(const p of S.party){p.atkUp=false; p.defUp=false;} updStatus();
      return say(had?'なかまたちに かかっていた ちからが すべて かきけされた！':'しかし なにも おこらなかった。',{wait:'auto'});
    }
    case 'silence': {
      await say(msg,{wait:'auto',ms:400}); flash('#8080c0',240);
      const tg=mv.all?aliveP():[aliveP().filter(p=>p.mmp>10).sort(()=>Math.random()-.5)[0]||randAlly()];
      for(const p of tg){ if(!p||p.hp<=0) continue; if(p.silence){await say(`${p.name}は もう じゅもんを ふうじられている。`,{wait:'auto',ms:350}); continue;}
        if(Math.random()<(mv.ch||.5)){p.silence=3; updStatus(); await say(`${p.name}は じゅもんを ふうじられた！`,{wait:'auto',ms:450});} else await say(`${p.name}は のろいを はねかえした！`,{wait:'auto',ms:380}); }
      return;
    }
    case 'sleepAll': await say(msg,{wait:'auto',ms:380}); flash('#ffc0e0',240); for(const p of aliveP()) await sleepMember(p,mv.ch||.35); return;
    case 'mist': await say(msg,{wait:'auto',ms:380}); flash('rgba(120,255,80,.4)',260); for(const p of aliveP()){await hurtMember(p,dm()); await poisonMember(p,.35);} return;
    case 'summon': {
      if(alive().length>=3) return enemyAttack(e);
      await say(msg,{wait:'auto',ms:420}); const n=mkEnemy(mv.id,null,e.d.ml||30); n.noexp=1; B.en.push(n); labelEnemies(B.en); layoutEnemies(); return;
    }
    case 'heal': {
      e.heals=e.heals||0; if(e.heals>=(mv.max||2)||e.hp>e.mhp*.7) return enemyAttack(e);
      e.heals++; await say(msg,{wait:'auto',ms:380}); const v=Math.min(Math.round(e.mhp*(mv.f||.1)),e.mhp-e.hp); e.hp+=v; return say(`${e.label}の きずが ${v}ポイント かいふくした！`,{wait:'auto'});
    }
    case 'healAlly': {
      const tg=alive().filter(x=>x.hp<x.mhp*.7).sort((a,b)=>a.hp/a.mhp-b.hp/b.mhp)[0]; if(!tg) return enemyAttack(e);
      await say(msg,{wait:'auto',ms:350}); const v=Math.min(mv.f?Math.round(tg.mhp*mv.f):rnd(...mv.pow),tg.mhp-tg.hp); tg.hp+=v; return say(`${tg.label}の きずが ${v}ポイント かいふくした！`,{wait:'auto'});
    }
  }
  return enemyAttack(e);
}
async function victory(){
  const km=B.boss?1:(EXPMUL[B.zone]??EXP_FIELD);
  const exp=Math.round(B.en.filter(e=>!e.noexp).reduce((s,e)=>s+e.d.exp,0)*km), gold=Math.round(B.en.filter(e=>!e.noexp).reduce((s,e)=>s+e.d.g,0)*(km+1)/2);
  stopBgm(); const ms=sfx.win();
  await say(B.en.length>1?'まものたちを やっつけた！':`${B.en[0].name}を たおした！`,{wait:'auto',ms:Math.max(500,(ms||0)-200)});
  if(exp){aliveP().forEach(p=>p.exp+=exp); (S.reserve||[]).forEach(p=>p.exp+=Math.round(exp/2)); await say(S.party.length>1?`みんなは けいけんち ${exp}ポイントを かくとく！`:`けいけんち ${exp}ポイントを かくとく！`,{wait:'auto'});}
  if(gold){S.gold+=gold; await say(`${gold}ゴールドを てにいれた！`,{wait:'auto'});}
  if(!B.boss&&Math.random()<.1){const it=stealItem(B.en[0]); addItem(it); await say(`まものは ${IT[it].n}を おとしていった！`,{wait:'auto'});}
  for(const p of (S.reserve||[])) while(p.lv<MAXLV&&p.exp>=expFor(p.lv+1)){growth(p); p.hp=Math.min(p.hp,p.mhp);}
  for(const p of aliveP()){
    while(p.lv<MAXLV&&p.exp>=expFor(p.lv+1)){
      const before=learned(p); const d=growth(p); p.hp+=d.hp; p.mp+=d.mp; updStatus();
      const lms=sfx.lvl();
      await say(`${p.name}は レベル ${p.lv}に あがった！`,{wait:'auto',ms:Math.max(700,lms||0)});
      await say(`ちから+${d.str} すばやさ+${d.agi} さいだいHP+${d.hp}`+(d.mp?` さいだいMP+${d.mp}`:''),{wait:'auto',ms:800});
      for(const k of learned(p)) if(!before.includes(k)) await say(`${p.name}は ${SP[k].n}を おぼえた！`,{wait:'auto',ms:900});
    }
  }
  if(!FAST){const m=document.createElement('span'); m.className='more'; m.textContent='▼'; msgEl.appendChild(m); await waitKey(); m.remove();}
}
async function defeat(){
  stopBgm(); const ms=sfx.lose();
  await say(S.party.length>1?'ぜんめつ してしまった…':`${HN()}は ちからつきた…`,{wait:'auto',ms:Math.max(1200,ms||0)});
  if(!FAST){const m=document.createElement('span'); m.className='more'; m.textContent='▼'; msgEl.appendChild(m); await waitKey(); m.remove();}
  await fadeOut(700); hideStatus(); msgClose(); B=null; mode='field';
  restoreAll(); S.gold=Math.floor(S.gold/2);
  const t=S.lastTown&&MAPS[S.lastTown]?S.lastTown:'akari', e=MAPS[t].entry;
  S.map=t; S.veh=null; P.x=e[0]; P.y=e[1]; P.dir='up'; P.moving=false; trail=[]; stepsSince=0; loadNPCs(); playBgm(MAPS[t].bgm);
  await sleep(400); await fadeIn(600);
  msgClear();
  await say(`…きがつくと そこは ${MAPS[t].name}の いりぐちだった。`);
  await say('「たおれていた あなたたちを、 とおりがかりの ひとが はこんで くれたのよ。」');
  await say('（もっていた ゴールドが はんぶんに なってしまった）'); msgClose();
}

function stealItem(e){const L=(e.d.ml||10); return L<15?pickR(['herb','herb','antidote','herb2']):L<35?pickR(['herb2','herb2','antidote','drop','bell']):pickR(['herb3','herb2','drop','life']);}

// ぶつりの わざ（ふうじられても つかえる）か どうか
const isMagic=sp=>!['phys','multi','steal','cover','counter','roar'].includes(sp.t)&&!['garm','riri','jin'].includes(sp.cls);
