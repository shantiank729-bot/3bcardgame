/* ステータス窓（なかま ひとりずつ） */
let statusBox=null;
function showStatus(style){hideStatus(); statusBox=document.createElement('div'); statusBox.className='party'; Object.assign(statusBox.style,style||{}); ui.appendChild(statusBox); updStatus();}
function hideStatus(){if(statusBox){statusBox.remove(); statusBox=null;}}
function stLine(m){if(m.hp<=0) return 'しに'; if(m.sleep) return 'ねむり'; if(m.poison) return 'どく'; return 'Lv '+m.lv;}
function updStatus(){
  if(!statusBox) return;
  statusBox.innerHTML=S.party.map((m,i)=>{
    const cls=['win','stat',m.hp<=0?'dead':m.hp<=m.mhp/4?'low':'',m.poison&&m.hp>0?'poison':'',B&&B.act===i?'act':''].join(' ');
    return `<div class="${cls}"><div class="nm">${m.name}</div><div class="row"><span>H</span><span>${m.hp}</span></div><div class="row"><span>M</span><span>${m.mp}</span></div><div class="row lv"><span>${stLine(m)}</span></div></div>`;
  }).join('');
}
function goldWin(style){const w=win('',style||{right:'3%',top:'3%',minWidth:'26%',textAlign:'right'}); w.upd=()=>w.innerHTML=`${S.gold} G`; w.upd(); return w;}
let toastEl=null, toastT=null;
function toast(text){
  if(!text||FAST) return; if(toastEl) toastEl.remove(); clearTimeout(toastT);
  toastEl=win('toast',{},text); const el=toastEl;
  toastT=setTimeout(()=>{el.style.opacity='0'; setTimeout(()=>el.remove(),450);},1500);
}
function fadeOut(ms=220){fadeEl.style.transitionDuration=(FAST?0:ms)+'ms'; fadeEl.style.opacity='1'; return sleep(ms+20);}
function fadeIn(ms=220){fadeEl.style.transitionDuration=(FAST?0:ms)+'ms'; fadeEl.style.opacity='0'; return sleep(ms+20);}
function shake(){if(reduceMotion||FAST) return; screenEl.classList.remove('shake'); void screenEl.offsetWidth; screenEl.classList.add('shake');}
let flashFx=null;
function flash(color,ms=180){if(FAST) return; flashFx={color,t0:performance.now(),ms};}
async function pickMember(title,filter,style,pool){
  const list=(pool||S.party).filter(m=>!filter||filter(m));
  if(!list.length) return null;
  const buff=x=>(x.atkUp?'こう↑':'')+(x.defUp?'しゅ↑':'');
  const m=new Menu({title,items:list.map(x=>({label:x.name+(buff(x)?`<small>（${buff(x)}）</small>`:''),right:x.hp<=0?'しに':`H${x.hp}`})),style:style||{left:'34%',top:'34%',width:'40%'}});
  const i=await m.pick(); m.close(); return i<0?null:list[i];
}

/* ---------- しょう（チャプター）と もくてき ---------- */
const CHAPTERS=[null,'ともしびの まち','はなまつりの むら','いわの まち','かわの せきしょ','バザールの まち','ゆうれいの まち','ちかいの とりで','ただいま',
  'しまの さいばん','ゆうれいせん','こおりの おうさま','ほしの がくえん','こびとの もり','なみだの みずうみ','ほむらの まち','なまえの とう',
  'そらの みやこ','うらがえしの せかい','ふたたびの ちかい','かぞくの なまえ','ちちの せなか','ムメイの きおく','わすれの とう','なまえを よぶ'];
const ACTS={1:'だい1ぶ　わすれられた ひとびと',9:'だい2ぶ　うみの むこうの なまえ',17:'だい3ぶ　なまえの ない せかい'};
async function startChapter(n){
  if((S.ch??1)>=n) return; S.ch=n; if(FAST) return;
  const w=document.createElement('div'); w.className='chap';
  w.innerHTML=`<div class="win">${ACTS[n]?`<div class="no">${ACTS[n]}</div>`:''}<div class="no">${n===24?'さいしゅうしょう':`だい ${n} しょう`}</div><div class="tt">${CHAPTERS[n]}</div></div>`;
  ui.appendChild(w); jingle(['C5','G5','C6:3'],.12,'triangle',.07);
  await sleep(ACTS[n]?3000:2200); w.classList.add('out'); await sleep(450); w.remove();
}
async function showGoal(){
  const ch=S.ch||1, q=activeQuests().length;
  const w=win('big',{left:'6%',right:'6%',top:'30%'},`<div class="row"><span>${ch>24?'クリアご':ch===24?'さいしゅうしょう':'だい '+ch+' しょう'}</span><span>${CHAPTERS[Math.min(ch,24)]}</span></div><p style="margin:.4em 0 0;white-space:normal">${goal()}</p><p style="margin:.4em 0 0;color:var(--sub);font-size:.85em">めやす Lv ${LV_OF_CH[Math.min(ch,25)]||70}　／　うけている クエスト ${q}けん　／　ほしのかけら ${S.frags||0}こ</p>`);
  await waitKey(); sfx.blip(); w.remove();
}

/* ---------- マップと しかけ ---------- */
function curMap(){return MAPS[S.map];}
const FLOOR_OF=m=>m.floor||(m.town?'道':'.');
function rawTile(x,y){const m=curMap(); if(m.dyn){const d=m.dyn[x+','+y]; if(d) return d();} const r=m.rows[y]; if(!r||x<0||x>=r.length) return m.out; return r[x];}
function tileAt(x,y){
  const t=rawTile(x,y), m=curMap(), k=`${S.map}:${x},${y}`;
  if((t==='藪'||t==='岩'||t==='割')&&S.cut&&S.cut[k]) return t==='割'?FLOOR_OF(m):(m.town?'.':m.kind==='world'?'.':FLOOR_OF(m));
  if(t==='錠'&&S.flags['open_'+k]) return FLOOR_OF(m);
  if(t==='格'&&S.flags['sw_'+S.map]) return '開';
  if(t==='釦'&&S.flags['sw_'+S.map]) return '押';
  return t;
}
function inBounds(x,y){const m=curMap(); return y>=0&&y<m.rows.length&&x>=0&&x<m.rows[y].length;}
const isNight=()=>(S.time||0)>=.62;
function npcVisible(n){return (!n.cond||n.cond())&&(!n.time||(n.time==='night')===isNight());}
function loadNPCs(){
  const m=curMap();
  npcs=(m.npcs||[]).filter(npcVisible).map(n=>({...n,def:n,ox:n.x,oy:n.y,fx:n.x,fy:n.y,t:1,moving:false,wt:1000+Math.random()*2000}));
  NIGHT_LOADED=isNight();
}
let NIGHT_LOADED=false;
function npcAt(x,y){return npcs.find(n=>(n.x===x&&n.y===y)||(n.moving&&n.fx===x&&n.fy===y));}
function npcById(id){return npcs.find(n=>n.id===id);}
function chestAt(x,y){return (curMap().chests||[]).find(c=>c.x===x&&c.y===y);}
function objAt(x,y){return (curMap().objs||[]).find(o=>o.x===x&&o.y===y);}
function markAt(x,y){return (curMap().marks||[]).find(o=>x>=o.x&&x<o.x+o.w&&y>=o.y&&y<o.y+o.h);}
function blocked(x,y){
  if(!inBounds(x,y)) return !curMap().edgeExit;
  const t=tileAt(x,y);
  if(t==='隠') return false;
  if(SOLID.has(t)) return true;
  if(npcAt(x,y)||objAt(x,y)) return true;
  return false;
}
const DV={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
let lastBump=0, lastHint='';
const isWorld=()=>curMap().kind==='world';
const onShip=()=>S.veh==='ship', onAir=()=>S.veh==='air';
function bump(hint){const n=performance.now(); if(n-lastBump>260){sfx.bump(); lastBump=n;} if(hint&&hint!==lastHint){lastHint=hint; run(()=>lines([hint]));}}
function startMove(nx,ny){trail.unshift({x:P.x,y:P.y}); trail.length=Math.min(trail.length,5); P.fx=P.x; P.fy=P.y; P.x=nx; P.y=ny; P.t=0; P.moving=true;}
function cutTile(x,y,msg){S.cut=S.cut||{}; S.cut[`${S.map}:${x},${y}`]=1; sfx.hit(); flash('#ffffff',80); if(msg) toast(msg);}
function tryMove(d){
  P.dir=d; const [dx,dy]=DV[d]; const nx=P.x+dx, ny=P.y+dy;
  if(isWorld()){
    if(!inBounds(nx,ny)){bump(); return;}
    const t=tileAt(nx,ny);
    if(onAir()){P.fx=P.x; P.fy=P.y; P.x=nx; P.y=ny; P.t=0; P.moving=true; return;}
    if(onShip()){
      if(t==='~'){P.fx=P.x; P.fy=P.y; P.x=nx; P.y=ny; P.t=0; P.moving=true; return;}
      if(SOLID.has(t)||t==='='){bump(); return;}
      S.ship={x:P.x,y:P.y,map:S.map}; S.veh=null; trail=[];
    }
    if(S.ship&&S.ship.map===S.map&&S.ship.x===nx&&S.ship.y===ny){S.veh='ship'; trail=[]; sfx.ok(); P.fx=P.x; P.fy=P.y; P.x=nx; P.y=ny; P.t=0; P.moving=true; return;}
    if(S.air&&S.air.map===S.map&&S.air.x===nx&&S.air.y===ny){S.veh='air'; S.air=null; trail=[]; sfx.magic(); P.fx=P.x; P.fy=P.y; P.x=nx; P.y=ny; P.t=0; P.moving=true; return;}
    const gate=ICON_GATE[S.map+':'+nx+','+ny]&&ICON_GATE[S.map+':'+nx+','+ny]();
    if(gate){run(()=>lines(gate)); return;}
  }
  if(!inBounds(nx,ny)&&curMap().edgeExit){run(exitToWorld); return;}
  const t=tileAt(nx,ny);
  if(t==='藪'){ if(S.abil&&S.abil.sickle){cutTile(nx,ny,'かまで くさむらを かりとった！');} else {bump('くさむらが しげって すすめない。 なにか かる どうぐが あれば…'); return;} }
  else if(t==='岩'||t==='割'){ if(S.abil&&S.abil.hammer){cutTile(nx,ny,'ハンマーで いわを くだいた！');} else {bump(t==='岩'?'ひびの はいった おおきな いわが ふさいでいる。':'かべに ひびが はいっている…'); return;} }
  else if(t==='錠'){
    const dg=curMap().dg||S.map; const k=(S.keys||{})[dg]||0;
    if(k>0){S.keys[dg]=k-1; S.flags[`open_${S.map}:${nx},${ny}`]=1; sfx.chest(); toast('ちいさなカギで とびらを あけた！');}
    else {bump('カギの かかった とびらだ。 この ダンジョンの どこかに カギが あるはず…'); return;}
  }
  if(blocked(nx,ny)){
    const o=objAt(nx,ny); if(o&&o.k==='spark'){}
    bump(); return;
  }
  startMove(nx,ny);
}
async function run(fn){if(scripting) return; scripting=true; try{await fn();}finally{scripting=false;}}
function onStep(){
  const m=curMap(), t=tileAt(P.x,P.y);
  // じかんが すすむ（ひる → よる）
  if(!m.interior&&!onAir()){S.time=((S.time||0)+(isWorld()?1/420:1/700))%1; if(isNight()!==NIGHT_LOADED){loadNPCs(); if(isNight()) toast('よるに なった…'); else toast('あさが きた！');}}
  if(isWorld()&&onAir()) return;
  if(m.links&&m.links[P.x+','+P.y]){
    const key=S.map+':'+P.x+','+P.y, gate=LINK_GATE[key]&&LINK_GATE[key]();
    if(gate){run(async()=>{await lines(gate); const [dx,dy]=DV[P.dir]; P.x-=dx; P.y-=dy;}); return;}
    const l=m.links[P.x+','+P.y]; run(()=>gotoMap(l[0],l[1],l[2],l[3])); return;
  }
  if(t==='U'){run(exitToWorld); return;}
  if(t==='釦'){S.flags['sw_'+S.map]=1; sfx.chest(); shake(); run(()=>lines(['カチッ！ どこかで こうしの あがる おとが した。']));}
  if(m.onStep&&m.onStep(P.x,P.y)) return;
  if(m.guards&&checkGuards()) return;
  if(!onShip()){
    let hurt=false;
    for(const p of aliveP()){ let d=0; if(p.poison) d++; if(t==='%') d++; if(t==='L') d+=3; if(d&&p.hp>1){p.hp=Math.max(1,p.hp-d); hurt=true;} }
    if(hurt){flash(t==='L'?'rgba(255,90,20,.5)':t==='%'?'rgba(150,40,200,.45)':'rgba(120,255,80,.35)',160); const a=Snd.ac; a&&tone(180,a.currentTime,.06,'square',.03);}
  }
  if(m.enc){
    stepsSince++;
    let rate=ENC_RATE[t]||(onShip()?24:0); if(S.sneak>0){S.sneak--; rate*=4; if(!S.sneak) toast('しのびあしの こうかが きれた');}
    if(rate&&stepsSince>4&&Math.random()<1/rate){
      const zone=m.enc(P.x,P.y); stepsSince=0;
      const area=onShip()?'sea':m.area||(isWorld()?areaOfZone(zone,t):'cave');
      if(ENC[zone]) run(()=>battle(pickR(ENC[zone]),{area,zone}));
    }
  }
}
function areaOfZone(zone,t){return ZONE_AREA[zone]||(t==='T'?'forest':t===':'?'beach':t==='%'?'swamp':'field');}
// みはりの しせん（3マス）に はいると みつかる
function checkGuards(){
  for(const n of npcs){ if(!n.guard) continue;
    const [dx,dy]=DV[n.dir]; let x=n.x, y=n.y;
    for(let i=0;i<(n.sight||3);i++){x+=dx; y+=dy; if(SOLID.has(tileAt(x,y))||objAt(x,y)) break; if(x===P.x&&y===P.y){run(caught); return true;}}
  }
  return false;
}
async function caught(){
  sfx.bump(); shake(); flash('#ff4040',200);
  await lines(['みはり「そこに いるのは だれだ！」','つまみだされて しまった…']);
  const m=curMap(); await gotoMap(S.map,m.entry[0],m.entry[1],m.entry[2]);
}
async function gotoMap(id,x,y,dir){
  sfx.stairs(); await fadeOut();
  if(!MAPS[id].kind||MAPS[id].kind!=='world'){ if(S.veh==='ship') S.ship={x:P.x,y:P.y,map:S.map}; S.veh=null; }
  S.map=id; P.x=x; P.y=y; P.dir=dir; P.moving=false; trail=[]; stepsSince=0;
  if(curMap().kind==='world'&&rawTile(x,y)==='~'&&!(curMap().links||{})[x+','+y]){S.veh='ship'; S.ship={x,y,map:id};}
  loadNPCs(); playBgm(onShip()?'field':curMap().bgm);
  if(curMap().town){S.visited=S.visited||[]; if(!S.visited.includes(id)) S.visited.push(id); S.lastTown=id;}
  await fadeIn(); if(!curMap().interior) toast(curMap().name);
  const m=curMap(); if(m.onEnter) await m.onEnter();
}
async function enterMap(id){const m=MAPS[id]; await gotoMap(id,m.entry[0],m.entry[1],m.entry[2]);}
async function exitToWorld(){const m=curMap(); const w=m.world||[0,0]; await gotoMap(m.worldMap||'world',w[0],w[1],'down');}
function fieldPress(b){
  if(b==='menu'||b==='b'){run(fieldMenu); return;}
  if(b!=='a'||P.moving) return;
  if(isWorld()&&onAir()){run(landAir); return;}
  if(isWorld()&&onShip()){run(()=>lines(['うみの うえだ。 りくちに ちかづくと ふねから おりられる。'])); return;}
  const [dx,dy]=DV[P.dir]; let fx=P.x+dx, fy=P.y+dy;
  if(tileAt(fx,fy)==='c'){fx+=dx; fy+=dy;}
  const n=npcAt(fx,fy);
  if(n){run(async()=>{const back={up:'down',down:'up',left:'right',right:'left'}; if(!n.mon&&!n.guard) n.dir=back[P.dir]; await n.talk(n); msgClose();}); return;}
  const o=objAt(P.x+dx,P.y+dy); if(o){run(()=>searchObj(o)); return;}
  const c=chestAt(P.x,P.y)||chestAt(P.x+dx,P.y+dy); if(c){run(()=>openChest(c)); return;}
  const m=curMap(), sk=`${P.x+dx},${P.y+dy}`;
  if(tileAt(P.x+dx,P.y+dy)==='標'){run(()=>lines([`かんばんが ある。「${(m.signs&&m.signs[sk])||m.name||'…'}」`])); return;}
  const h=(m.hid||[]).find(o=>(o.x===P.x&&o.y===P.y)&&!S.flags['hid_'+o.id]); if(h){run(()=>takeHidden(h)); return;}
  run(async()=>{msgClear(); await say(`${HN()}は あしもとを しらべた。`,{wait:'auto',ms:300}); await say('しかし なにも みつからなかった。'); msgClose();});
}
const OBJ_NAME={pot:'つぼ',barrel:'たる',drawer:'タンス',shelf:'ほんだな',crate:'きばこ',spark:'きらきら'};
async function searchObj(o){
  msgClear();
  if(o.k==='shelf'){await say(`${HN()}は ほんだなを しらべた。`,{wait:'auto',ms:300}); await say(o.text||curMap().book||'むずかしそうな ほんが ならんでいる。'); msgClose(); return;}
  if(o.talk){await o.talk(o); msgClose(); return;}
  const took=S.flags['obj_'+o.id];
  await say(`${HN()}は ${OBJ_NAME[o.k]||'それ'}を しらべた。`,{wait:'auto',ms:300});
  if(o.loot&&!took){S.flags['obj_'+o.id]=1; await giveLoot(o.loot);}
  else await say(o.text||'しかし なにも はいって いなかった。');
  msgClose();
}
async function takeHidden(h){msgClear(); S.flags['hid_'+h.id]=1; sfx.chest(); await say(`${HN()}は あしもとを しらべた。`,{wait:'auto',ms:300}); await giveLoot(h.loot); msgClose();}
async function giveLoot(L){
  if(L==='frag'){S.frags=(S.frags||0)+1; sfx.chest(); await say(`ほしのかけらを みつけた！（${S.frags}こめ）`); return;}
  if(typeof L==='object'&&L.gold){S.gold+=L.gold; sfx.chest(); await say(`${L.gold}ゴールドを みつけた！`); return;}
  if(typeof L==='object'&&L.key){S.keys=S.keys||{}; S.keys[L.key]=(S.keys[L.key]||0)+1; sfx.chest(); await say('ちいさなカギを てにいれた！'); return;}
  addItem(L); sfx.chest(); await say(`${IT[L].n}を みつけた！`); if(IT[L].key&&IT[L].d) await say(IT[L].d);
  if(typeof afterKeyItem==='function') await afterKeyItem(L);
}
async function landAir(){
  const t=tileAt(P.x,P.y);
  if(t==='~'||SOLID.has(t)||(curMap().links||{})[P.x+','+P.y]||t==='='){await lines(['ここには おりられない。 ひらけた ちめんの うえで おりよう。']); return;}
  S.air={x:P.x,y:P.y,map:S.map}; S.veh=null; trail=[]; sfx.ok();
}
async function openChest(c){
  msgClear();
  if(S.flags['ch_'+c.id]){await say('たからばこは からっぽだ。'); msgClose(); return;}
  S.flags['ch_'+c.id]=1; sfx.chest();
  await say(`${HN()}は たからばこを あけた！`,{wait:'auto',ms:400});
  if(c.gold) {S.gold+=c.gold; await say(`${c.gold}ゴールドを てにいれた！`);}
  else if(c.key){S.keys=S.keys||{}; S.keys[c.key]=(S.keys[c.key]||0)+1; await say('ちいさなカギを てにいれた！ （この ダンジョンの とびらを ひとつ あけられる）');}
  else if(c.item==='frag'){S.frags=(S.frags||0)+1; await say(`ほしのかけらを てにいれた！（${S.frags}こめ）`);}
  else {addItem(c.item); await say(`${IT[c.item].n}を てにいれた！`); if(IT[c.item].key&&IT[c.item].d) await say(IT[c.item].d);}
  msgClose();
  if(c.item&&typeof afterKeyItem==='function') await afterKeyItem(c.item);
}
/* ---------- えんしゅつ（イベント） ---------- */
async function walkNpc(n,dirs,speed=220){
  for(const d of dirs){const [dx,dy]=DV[d]; n.dir=d; n.fx=n.x; n.fy=n.y; n.x+=dx; n.y+=dy; n.t=0; n.moving=true; await sleep(speed); n.t=1; n.moving=false;}
}
async function walkHero(dirs,speed=180){for(const d of dirs){const [dx,dy]=DV[d]; P.dir=d; startMove(P.x+dx,P.y+dy); await sleep(speed); P.t=1; P.moving=false;}}
function emote(n,ch,ms=900){n.emote=ch; n.emoteT=performance.now()+ms;}
function followerSpots(){
  const out=[]; const k=P.moving?P.t:1;
  if(S.veh) return out;
  const fol=[...S.party.slice(1)]; if(S.guest) fol.push({guest:1,hp:1,cls:S.guest.pal,name:S.guest.name,pal:S.guest.pal});
  let prevTo={x:P.x,y:P.y}, prevFrom=P.moving?{x:P.fx,y:P.fy}:{x:P.x,y:P.y};
  for(let i=0;i<fol.length;i++){
    const to=trail[i]||prevTo; const from=P.moving?(trail[i+1]||prevFrom):to;
    if(from.x!==to.x||from.y!==to.y) fdir[i]=to.x>from.x?'right':to.x<from.x?'left':to.y>from.y?'down':'up';
    out.push({x:from.x+(to.x-from.x)*k,y:from.y+(to.y-from.y)*k,tx:to.x,ty:to.y,dir:fdir[i]||'down',m:fol[i]});
    prevTo=to; prevFrom=from;
  }
  return out;
}
let guardTurnT=0;
function updateField(dt){
  if(P.moving){P.t+=dt/(onAir()?95:onShip()?140:170); if(P.t>=1){P.t=1; P.moving=false; onStep();}}
  if(!P.moving&&!scripting&&!handlers.length&&mode==='field'){
    const d=held[held.length-1]; if(d) tryMove(d);
  }
  const fol=followerSpots();
  guardTurnT+=dt;
  for(const n of npcs){
    if(n.guard&&guardTurnT>1800&&!scripting){const order=n.turns||['down','left','up','right']; n.ti=((n.ti||0)+1)%order.length; n.dir=order[n.ti];}
    if(n.moving){n.t+=dt/260; if(n.t>=1){n.t=1; n.moving=false;}}
    else if(n.wander&&!scripting){
      n.wt-=dt; if(n.wt<=0){n.wt=1200+Math.random()*2200;
        const d=pickR(['up','down','left','right']); const [dx,dy]=DV[d]; const nx=n.x+dx, ny=n.y+dy; n.dir=d;
        if(Math.abs(nx-n.ox)<=2&&Math.abs(ny-n.oy)<=2&&inBounds(nx,ny)&&!SOLID.has(tileAt(nx,ny))&&!npcAt(nx,ny)&&!objAt(nx,ny)&&!chestAt(nx,ny)&&!['戸','出','d','u','U'].includes(tileAt(nx,ny))
          &&!(curMap().links||{})[nx+','+ny]&&!(nx===P.x&&ny===P.y)&&!(P.moving&&nx===P.fx&&ny===P.fy)&&!fol.some(f=>f.tx===nx&&f.ty===ny)){n.fx=n.x; n.fy=n.y; n.x=nx; n.y=ny; n.t=0; n.moving=true;}}
    }
  }
  if(guardTurnT>1800){guardTurnT=0; if(curMap().guards&&!scripting&&mode==='field'&&!P.moving) checkGuards();}
}
const LM_CACHE={};
function groundOf(m){return m.kind==='world'?'.':m.town?(m.ground||'.'):FLOOR_OF(m);}
function drawField(now){
  const m=curMap(); const k=P.moving?P.t:1;
  const pxx=P.moving?(P.fx+(P.x-P.fx)*k):P.x, pyy=P.moving?(P.fy+(P.y-P.fy)*k):P.y;
  const camX=Math.round(pxx*TS-(SW/2-8)), camY=Math.round(pyy*TS-(SH/2-8));
  const fr=Math.floor(now/500)%2;
  const x0=Math.floor(camX/TS), y0=Math.floor(camY/TS);
  const lantern=S.abil&&S.abil.lantern;
  for(let ty=y0;ty<=y0+VH+1;ty++) for(let tx=x0;tx<=x0+VW+1;tx++){
    let ch=tileAt(tx,ty); if(ch==='隠') ch=m.out||'#'; if(ch==='■') ch=m.lmGround||(m.town?(m.plaza||'s'):'.');
    if(ch==='割'){const w=TILES[m.out]||TILES['#']; ctx.drawImage(w[0],tx*TS-camX,ty*TS-camY); ctx.fillStyle='rgba(0,0,0,.55)'; const X=tx*TS-camX,Y=ty*TS-camY; ctx.fillRect(X+7,Y+1,1,5); ctx.fillRect(X+5,Y+5,3,1); ctx.fillRect(X+4,Y+6,1,5); ctx.fillRect(X+8,Y+6,4,1); ctx.fillRect(X+11,Y+7,1,6); continue;}
    const t=TILES[ch]||TILES['.']; ctx.drawImage(t[ANIM_T.has(ch)?fr:0],tx*TS-camX,ty*TS-camY);
    if(lantern&&rawTile(tx,ty)==='隠'&&fr){ctx.fillStyle='rgba(255,240,160,.35)'; ctx.fillRect(tx*TS-camX+5,ty*TS-camY+5,6,6);}
  }
  for(const mk of (m.marks||[])){const c=LM_CACHE[mk.kind]||(LM_CACHE[mk.kind]=landmarkArt(mk.kind)); ctx.drawImage(c,mk.x*TS-camX,(mk.y+mk.h)*TS-camY-c.height);}
  for(const c of (m.chests||[])) ctx.drawImage(S.flags['ch_'+c.id]?chestOpen:chestClosed,c.x*TS-camX,c.y*TS-camY+1);
  for(const o of (m.objs||[])) ctx.drawImage(OBJ_ART[o.k]||OBJ_ART.pot,o.x*TS-camX,o.y*TS-camY);
  for(const h of (m.hid||[])) if(!S.flags['hid_'+h.id]&&(Math.floor(now/300+h.x)%4===0)) ctx.drawImage(OBJ_ART.spark,h.x*TS-camX,h.y*TS-camY);
  if(m.kind==='world'){
    if(S.ship&&S.ship.map===S.map&&!onShip()) ctx.drawImage(SHIP_ART,S.ship.x*TS-camX,S.ship.y*TS-camY+(fr?1:0));
    if(S.air&&S.air.map===S.map&&!onAir()) ctx.drawImage(AIR_ART,S.air.x*TS-camX,S.air.y*TS-camY-2+(fr?1:0));
  }
  const walk=Math.floor(now/260)%2;
  const actors=npcs.map(n=>{const kk=n.moving?n.t:1; return {y:n.fy+(n.y-n.fy)*kk,x:n.fx+(n.x-n.fx)*kk,n,z:0};});
  followerSpots().forEach((f,i)=>actors.push({x:f.x,y:f.y,f,z:-1-i}));
  actors.push({x:pxx,y:pyy,hero:1,z:1});
  actors.sort((a,b)=>a.y-b.y||a.z-b.z);
  for(const a of actors){
    const sx=Math.round(a.x*TS-camX), sy=Math.round(a.y*TS-camY);
    if(a.hero){
      if(m.kind==='world'&&onShip()) ctx.drawImage(SHIP_ART,sx,sy+(fr?1:0));
      else if(m.kind==='world'&&onAir()){ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(sx+3,sy+12,10,3); ctx.drawImage(AIR_ART,sx,sy-6+(fr?1:0));}
      else ctx.drawImage(hero().hp>0?personSprite(hero().cls==='mumei'?'mumei':'hero',P.dir,walk):graveArt,sx,sy-2);
    }
    else if(a.f){const fm=a.f.m; if(fm.shadow&&!fm.seen){ctx.save(); ctx.globalAlpha=.45;} ctx.drawImage(fm.hp>0?personSprite(fm.pal||fm.cls,a.f.dir,walk):graveArt,sx,sy-2); if(fm.shadow&&!fm.seen) ctx.restore();}
    else if(a.n.mon){const sp=monSprite(a.n.mon); ctx.drawImage(sp,sx,sy-2+(walk?0:-1));}
    else {if(a.n.shadow){ctx.save(); ctx.globalAlpha=.45;} ctx.drawImage(personSprite(a.n.pal,a.n.dir,a.n.wander||a.n.moving?walk:0),sx,sy-2); if(a.n.shadow) ctx.restore();
      if(a.n.guard){ctx.fillStyle='rgba(255,60,60,.18)'; const [dx,dy]=DV[a.n.dir]; let x=a.n.x,y=a.n.y; for(let i=0;i<(a.n.sight||3);i++){x+=dx;y+=dy; if(SOLID.has(tileAt(x,y))) break; ctx.fillRect(x*TS-camX,y*TS-camY,TS,TS);}}}
    if(a.n&&a.n.emote&&now<a.n.emoteT){ctx.fillStyle='#fff'; ctx.fillRect(sx+3,sy-14,10,10); ctx.fillStyle='#000'; ctx.font='9px monospace'; ctx.fillText(a.n.emote,sx+5,sy-6);}
  }
  if(m.tint){ctx.fillStyle=m.tint; ctx.fillRect(0,0,SW,SH);}
  // よる・くらやみ
  if(!m.interior&&isNight()){ctx.fillStyle=m.town?'rgba(10,20,70,.38)':'rgba(10,20,70,.5)'; ctx.fillRect(0,0,SW,SH);
    if(m.town) for(const mk of (m.lamps||[])) {}}
  if(m.dark){
    const rad=m.dark===2&&!lantern?26:lantern?120:110;
    const g=ctx.createRadialGradient(SW/2,SH/2,Math.max(8,rad-90),SW/2,SH/2,rad); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,`rgba(0,0,0,${m.dark===2&&!lantern?.97:.72})`);
    ctx.fillStyle=g; ctx.fillRect(0,0,SW,SH);
  }
}
const ANIM_T=new Set(['~','=','%','L','B','噴','暖','炉','桟']);
