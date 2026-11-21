/* ---------- クエスト（サブクエスト・なかまの ものがたり） ---------- */
// QUESTS[id] = {t:'なまえ', g:'いらいぬし', area:'ばしょ', steps:['だんかい1の せつめい', ...]}
const QUESTS={};
const qState=id=>(S.q||{})[id];
function qStart(id){S.q=S.q||{}; if(S.q[id]==null){S.q[id]=0; toast(`クエスト「${QUESTS[id].t}」を うけた`); sfx.ok();}}
function qSet(id,step){S.q=S.q||{}; S.q[id]=step;}
async function qDone(id,reward){
  S.q=S.q||{}; if(S.q[id]==='done') return; S.q[id]='done'; sfx.lvl();
  await say(`クエスト「${QUESTS[id].t}」を たっせいした！`,{wait:'auto',ms:900});
  if(reward) await giveLoot(reward);
}
const activeQuests=()=>Object.keys(S.q||{}).filter(k=>S.q[k]!=='done'&&QUESTS[k]);
async function questMenu(){
  const act=activeQuests(), done=Object.keys(S.q||{}).filter(k=>S.q[k]==='done'&&QUESTS[k]);
  const list=[...act.map(k=>({k,label:QUESTS[k].t,right:'すすめちゅう'})),...done.map(k=>({k,label:QUESTS[k].t,right:'たっせい'}))];
  if(!list.length){msgClear(); await say('まだ クエストを うけていない。 まちの ひとの こまりごとに みみを かたむけよう。'); msgClose(); return;}
  const m=new Menu({title:`クエスト（たっせい ${done.length}／${Object.keys(QUESTS).length}）`,items:list,style:{left:'6%',top:'5%',width:'88%'},
    desc:i=>{const q=QUESTS[list[i].k], st=S.q[list[i].k]; return `${q.g}（${q.area}）：${st==='done'?'たっせい！':q.steps[Math.min(st,q.steps.length-1)]}`;}});
  await m.pick(); m.close();
}

/* ---------- メニュー ---------- */
async function fieldMenu(){
  showStatus({left:'3%',top:'2.5%'});
  const m=new Menu({items:['もくてき','つよさ','どうぐ','じゅもん','そうび','ならびかえ','クエスト','セーブ'],cols:2,style:{left:'3%',top:'31%',width:'46%'}});
  try{
    while(true){
      const c=await m.pick(); if(c<0) break;
      let r=null;
      if(c===0) await showGoal();
      if(c===1){const p=await pickMember('だれの？',null,null,[...S.party,...(S.reserve||[])]); if(p) await showStats(p);}
      if(c===2) r=await bagMenu();
      if(c===3) r=await spellMenuField();
      if(c===4){const p=await pickMember('だれの？',null,null,[...S.party,...(S.reserve||[])]); if(p) await equipMenu(p);}
      if(c===5) await rosterMenu();
      if(c===6) await questMenu();
      if(c===7){msgClear(); if(saveGame()){sfx.ok(); await say('ぼうけんのしょに きろくしました。');} else await say('この ブラウザでは きろくできませんでした。'); msgClose();}
      updStatus(); if(r==='warp') break;
    }
  } finally {m.close(); hideStatus(); msgClose();}
}
// なかまの いれかえ（せんとうに でるのは 4にん。 ひかえも けいけんちを はんぶん もらえる）
async function rosterMenu(){
  S.reserve=S.reserve||[];
  if(!S.reserve.length){msgClear(); await say('いまは ひかえの なかまが いない。'); msgClose(); return;}
  const a=await pickMember('だれと いれかえる？',x=>x.cls!=='hero');
  if(!a&&S.party.length<4){}
  const b=await pickMember('ひかえから だれを だす？',null,{left:'40%',top:'34%',width:'40%'},S.reserve);
  if(!b) return;
  if(a){const i=S.party.indexOf(a), j=S.reserve.indexOf(b); S.party[i]=b; S.reserve[j]=a;}
  else if(S.party.length<4){S.reserve.splice(S.reserve.indexOf(b),1); S.party.push(b);}
  trail=[]; sfx.ok(); updStatus();
}
const JOB={hero:'ゆうしゃ',mio:'ほしよみ',garm:'きし',riri:'とうぞく',olga:'まじょ',jin:'けんし',mumei:'えいゆう',father:'とうだいもり'};
async function showStats(p){
  const nx=p.lv>=MAXLV?'-':expFor(p.lv+1)-p.exp;
  const eqn=s=>p.eq[s]?IT[p.eq[s]].n:'なし';
  const w=win('big',{left:'8%',right:'8%',top:'5%'},
   `<div class="row"><span>${p.name}（${JOB[p.cls]||''}）</span><span>レベル ${p.lv}</span></div>
    <div class="row"><span>HP ${p.hp}/${p.mhp}</span><span>MP ${p.mp}/${p.mmp}</span></div>
    <div class="row"><span>ちから ${p.str}</span><span>すばやさ ${p.agi}</span></div>
    <div class="row"><span>こうげき ${atkOf(p)}</span><span>しゅび ${defOf(p)}</span></div>
    <div class="row"><span>つぎのレベルまで</span><span>${nx}</span></div>
    <div class="row"><span>ゴールド</span><span>${S.gold}</span></div>
    <div class="row"><span>ぶき</span><span>${eqn('w')}</span></div>
    <div class="row"><span>よろい</span><span>${eqn('a')}</span></div>
    <div class="row"><span>たて</span><span>${eqn('s')}</span></div>`);
  await waitKey(); sfx.blip(); w.remove();
}
function bagList(filter){return Object.keys(S.items).filter(id=>IT[id]&&(!filter||filter(IT[id]))).map(id=>({id,label:IT[id].n,right:IT[id].key?'':'×'+S.items[id]}));}
async function bagMenu(){
  let list=bagList(it=>!it.slot);
  if(!list.length){msgClear(); await say('どうぐを なにも もっていない。'); msgClose(); return;}
  const m=new Menu({items:list,style:{left:'14%',top:'5%',width:'62%'},title:'どうぐ',desc:i=>IT[list[i].id].d});
  try{
    while(true){
      const i=await m.pick(); if(i<0) return;
      const r=await useItemField(list[i].id); updStatus();
      if(r==='warp') return 'warp';
      list=bagList(it=>!it.slot); if(!list.length) return; m.setItems(list);
    }
  } finally {m.close();}
}
function applyTo(src,eff,pow,tgt){
  if(eff==='heal'){if(tgt.hp<=0) return null; if(tgt.hp>=tgt.mhp) return 'full'; const v=Math.min(rnd(...pow),tgt.mhp-tgt.hp); tgt.hp+=v; sfx.heal(); return `${tgt.name}の HPが ${v}ポイント かいふくした！`;}
  if(eff==='mp'){if(tgt.hp<=0) return null; if(tgt.mp>=tgt.mmp) return 'full'; const v=Math.min(rnd(...pow),tgt.mmp-tgt.mp); tgt.mp+=v; sfx.heal(); return `${tgt.name}の MPが ${v}ポイント かいふくした！`;}
  if(eff==='cure'){if(tgt.hp<=0||!tgt.poison) return 'none'; tgt.poison=false; sfx.heal(); return `${tgt.name}の からだから どくが きえた！`;}
  if(eff==='purify'){if(tgt.hp<=0||(!tgt.poison&&!tgt.sleep)) return 'none'; tgt.poison=false; tgt.sleep=false; sfx.heal(); return `${tgt.name}の からだが きよめられた！`;}
  if(eff==='wake'){if(tgt.hp<=0||!tgt.sleep) return 'none'; tgt.sleep=false; sfx.ok(); return `${tgt.name}は めを さました！`;}
  if(eff==='seed'){tgt[src.stat]+=src.v; if(src.stat==='mhp') tgt.hp+=src.v; if(src.stat==='mmp') tgt.mp+=src.v; sfx.lvl(); return `${tgt.name}の ${{str:'ちから',mhp:'さいだいHP',mmp:'さいだいMP',agi:'すばやさ'}[src.stat]}が ${src.v} あがった！`;}
  if(eff==='revive'){if(tgt.hp>0) return 'none'; tgt.hp=src.full?tgt.mhp:Math.ceil(tgt.mhp/2); tgt.poison=false; tgt.sleep=false; sfx.heal(); flash('#fff8c0',300); return `${tgt.name}は いきかえった！`;}
  return null;
}
function healAll(pow){for(const p of aliveP()){const v=Math.min(rnd(...pow),p.mhp-p.hp); p.hp+=v;} sfx.heal(); return 'みんなの HPが かいふくした！';}
const FULLMSG={full:'その なかまは もう げんきいっぱいだ。',none:'しかし なにも おこらなかった。'};
async function useItemField(id){
  const it=IT[id]; msgClear();
  if(it.key){await say(it.d||'だいじな ものだ。'); msgClose(); return;}
  if(it.t==='return'){const r=await townWarp(it.n+'で どこへ いく？'); if(!r) return; delItem(id); return 'warp';}
  if(it.t==='wake'||it.t==='flee'){await say('いまは つかえない。'); msgClose(); return;}
  const tgt=S.party.length>1?await pickMember('だれに つかう？',it.t==='revive'?m=>m.hp<=0:null):hero();
  if(!tgt){msgClose(); return;}
  const r=applyTo(it,it.t,it.pow,tgt);
  if(!r||FULLMSG[r]){await say(FULLMSG[r]||'しかし なにも おこらなかった。'); msgClose(); return;}
  delItem(id); updStatus();
  await say(`${HN()}は ${it.n}を つかった！`,{wait:'auto',ms:350}); await say(r); msgClose();
}
// いちど いった まちへ いどう
async function townWarp(title){
  const list=(S.visited||[]).filter(id=>MAPS[id]&&MAPS[id].world&&(MAPS[id].worldMap||'world')===(curWorldOf()));
  if(!list.length){await lines(['いまは とぶ ことが できない。']); return false;}
  const m=new Menu({title,items:list.map(id=>MAPS[id].name),style:{left:'14%',top:'30%',width:'62%'}});
  const i=await m.pick(); m.close(); if(i<0) return false;
  const id=list[i], tm=MAPS[id], [wx,wy]=tm.world, wm=tm.worldMap||'world';
  msgClose(); sfx.magic(); flash('#ffffff',250); await sleep(200);
  S.veh=null;
  if(S.ship&&S.ship.map===wm){const d=dockFor(wx,wy,wm); if(d) S.ship={...d,map:wm};}
  if(S.flags.airship&&wm==='world'){const nb=[[0,1],[1,0],[-1,0],[0,-1]].map(([dx,dy])=>[wx+dx,wy+dy]).find(([x,y])=>{const t=MAPS[wm].rows[y]&&MAPS[wm].rows[y][x]; return t&&!SOLID.has(t)&&t!=='~'&&!(MAPS[wm].links||{})[x+','+y];}); if(nb) S.air={x:nb[0],y:nb[1],map:wm};}
  await gotoMap(wm,wx,wy,'down');
  return true;
}
function curWorldOf(){const m=curMap(); return m.kind==='world'?S.map:(m.worldMap||(m.parent&&MAPS[m.parent].worldMap)||'world');}
async function spellMenuField(){
  const casters=S.party.filter(m=>m.hp>0&&learned(m).some(k=>SP[k].field));
  if(!casters.length){msgClear(); await say('いま つかえる じゅもんが ない。'); msgClose(); return;}
  const c=casters.length>1?await pickMember('だれが となえる？',m=>casters.includes(m)):casters[0];
  if(!c) return;
  const ks=learned(c);
  const m=new Menu({items:ks.map(k=>({label:SP[k].n,right:SP[k].mp,disabled:!SP[k].field})),style:{left:'12%',top:'5%',width:'64%'},title:`${c.name}の じゅもん（MP ${c.mp}）`,desc:i=>SP[ks[i]].d});
  try{
    while(true){
      const i=await m.pick(); if(i<0) return;
      const k=ks[i], sp=SP[k]; msgClear();
      if(!sp.field){await say('それは せんとうで つかう わざだ。'); msgClose(); continue;}
      if(c.mp<sp.mp){await say('MPが たりない！'); msgClose(); continue;}
      if(sp.t==='sneak'){c.mp-=sp.mp; S.sneak=150; updStatus(); await say(`${c.name}は ${sp.n}を つかった！ しばらく まものに であいにくく なる。`); msgClose(); continue;}
      if(sp.t==='return'){const ok=await townWarp('どこへ いく？'); if(!ok) continue; c.mp-=sp.mp; return 'warp';}
      if(sp.t==='healAll'){c.mp-=sp.mp; await say(`${c.name}は ${sp.n}の じゅもんを となえた！`,{wait:'auto',ms:350}); await say(healAll(sp.pow)); updStatus(); msgClose(); continue;}
      const tgt=S.party.length>1?await pickMember('だれに？',sp.t==='revive'?x=>x.hp<=0:null):hero();
      if(!tgt) continue;
      const r=applyTo(sp,sp.t,sp.pow,tgt);
      if(!r||FULLMSG[r]){await say(FULLMSG[r]||'しかし なにも おこらなかった。'); msgClose(); continue;}
      c.mp-=sp.mp; updStatus(); m.o.title=`${c.name}の じゅもん（MP ${c.mp}）`; m.render();
      await say(`${c.name}は ${sp.n}の じゅもんを となえた！`,{wait:'auto',ms:350}); await say(r); msgClose();
    }
  } finally {m.close();}
}
async function equipMenu(p){
  const slots=['w','a','s'];
  const lab=()=>slots.map(s=>({label:SLOTN[s],right:p.eq[s]?IT[p.eq[s]].n:'なし'}));
  const m=new Menu({items:lab(),style:{left:'10%',top:'31%',width:'76%'},title:`${p.name}の そうび`,desc:()=>`こうげき ${atkOf(p)}　しゅび ${defOf(p)}`});
  try{
    while(true){
      const i=await m.pick(); if(i<0) return;
      const s=slots[i]; const own=Object.keys(S.items).filter(id=>IT[id]&&IT[id].slot===s&&canEquip(p,id));
      const opts=[...own.map(id=>({id,label:IT[id].n,right:s==='w'?'こう+'+IT[id].atk:'しゅ+'+IT[id].def})),{id:null,label:'はずす',right:''}];
      const sub=new Menu({items:opts,style:{left:'20%',top:'8%',width:'66%'},title:SLOTN[s]+'を えらぶ'});
      const j=await sub.pick(); sub.close();
      if(j>=0){equip(p,opts[j].id,s); sfx.ok();}
      m.setItems(lab());
    }
  } finally {m.close();}
}
function equip(p,id,slot){slot=slot||IT[id].slot; if(p.eq[slot]) addItem(p.eq[slot]); p.eq[slot]=id||null; if(id) delItem(id);}

/* ---------- みせ・やど・きょうかい・こうかんじょ ---------- */
async function inn(per,name){
  msgClear(); const price=per*S.party.length;
  await say(`${name}へ ようこそ。 ひとり ${per}ゴールド、 みなさんで ${price}ゴールドですが おとまりに なりますか？`,{wait:'none'});
  const g=goldWin(); const ok=await yesNo();
  if(!ok){await say('またの おこしを おまちしております。'); g.remove(); msgClose(); return;}
  if(S.gold<price){await say('おや、 ゴールドが たりないようですね…'); g.remove(); msgClose(); return;}
  S.gold-=price; g.upd();
  msgClear(); await say('いつまで おやすみに なりますか？',{wait:'none'});
  const wm=new Menu({items:['あさまで','よるまで'],style:{right:'3%',bottom:'35%',width:'30%'}}); const night=(await wm.pick())===1; wm.close();
  await say('では ごゆっくり おやすみください。',{wait:'auto'});
  msgClose(); g.remove(); stopBgm(); await fadeOut(500);
  const ms=sfx.inn(); await sleep(Math.max(1200,ms||0));
  restoreAll(); S.time=night?.66:.05; loadNPCs(); saveGame(); playBgm(curMap().bgm);
  await fadeIn(500);
  msgClear(); await say(night?'こんばんは。 よるの まちは ひるとは ちがう かおを みせますよ。':'おはようございます。 みなさん すっかり げんきに なりましたね。');
  await say('（ぼうけんのしょに きろくしました）'); msgClose();
}
function restoreAll(){for(const p of [...S.party,...(S.reserve||[])]){p.hp=p.mhp; p.mp=p.mmp; p.poison=false; p.sleep=false;}}
async function churchTalk(sp){
  msgClear();
  await say('「ほしの かみの いえへ ようこそ。 どのような ごようですか？」',{wait:'none'});
  const m=new Menu({items:['いのる（きろく）','いきかえらせる','どくを はらう','やめる'],style:{left:'3%',top:'3%',width:'40%'}});
  const c=await m.pick(); m.close(); msgClear();
  if(c===0){if(saveGame()){sfx.ok(); await say('「あなたの たびの きろくを ほしに きざみました。」');} else await say('「…きろくに しっぱい しました。」');}
  else if(c===1){const dead=S.party.filter(p=>p.hp<=0); if(!dead.length) await say('「いきかえらせる ひとは いないようですね。」');
    else{const cost=dead.reduce((s,p)=>s+p.lv*10,0); await say(`「${dead.map(p=>p.name).join('と ')}を いきかえらせるには ${cost}ゴールドが ひつようです。」`,{wait:'none'});
      if(await yesNo()){if(S.gold<cost) await say('「…ゴールドが たりないようですね。」'); else{S.gold-=cost; dead.forEach(p=>{p.hp=p.mhp;}); sfx.heal(); flash('#fff8c0',300); await say('「ほしの かみよ… この ものたちに いのちを！」'); await say('なかまが いきかえった！');}}}}
  else if(c===2){const ps=S.party.filter(p=>p.poison); if(!ps.length) await say('「どくに おかされた ひとは いないようですね。」'); else{ps.forEach(p=>p.poison=false); sfx.heal(); await say('「どくを はらいました。」');}}
  else await say('「ほしの かみの ごかごが ありますように。」');
  msgClose();
}
// ほしのかけら こうかんじょ
const FRAG_SHOP=[[5,'fseed1'],[10,'fring1'],[15,'fseed2'],[20,'fbell'],[30,'fsword'],[40,'frobe'],[50,'fseed3'],[60,'fshield'],[75,'faxe'],[90,'fcrown'],[100,'fstar']];
async function fragShop(){
  msgClear(); S.fragsSpent=S.fragsSpent||[];
  await say(`「ほしのかけらを あつめて いるのかい？ もってきた かずに おうじて、 とくべつな しなと こうかん しよう。」（いま ${S.frags||0}こ）`,{wait:'none'});
  const items=FRAG_SHOP.map(([n,id])=>({label:IT[id].n,right:S.fragsSpent.includes(id)?'こうかんずみ':`${n}こ`,disabled:S.fragsSpent.includes(id)||(S.frags||0)<n}));
  const m=new Menu({items,style:{left:'20%',top:'3%',right:'3%'},desc:i=>IT[FRAG_SHOP[i][1]].d||eqInfo(FRAG_SHOP[i][1])});
  while(true){
    const i=await m.pick(); if(i<0) break;
    const [n,id]=FRAG_SHOP[i];
    if(S.fragsSpent.includes(id)||(S.frags||0)<n){sfx.bump(); continue;}
    S.fragsSpent.push(id); addItem(id); sfx.chest(); msgClear(); await say(`${IT[id].n}を うけとった！（かけらは へらないよ。 あつめた かずの ごほうびだからね）`,{wait:'none'});
    items[i].right='こうかんずみ'; items[i].disabled=true; m.setItems(items);
  }
  m.close(); msgClear(); await say('「また かけらを みつけたら おいで。 せかいじゅうに 100こ ちらばって いるよ。」'); msgClose();
}
async function shop(goods,greet){
  msgClear(); await say(greet+' なにを なさいますか？',{wait:'none'});
  const g=goldWin({left:'3%',top:'33%',width:'27%',textAlign:'right'});
  const top=new Menu({items:['かう','うる','やめる'],style:{left:'3%',top:'3%',width:'27%'}});
  try{
    while(true){
      const c=await top.pick(); if(c<0||c===2) break;
      if(c===0) await shopBuy(goods,g); else await shopSell(g);
      msgClear(); await say('ほかにも なにか？',{wait:'none'});
    }
  } finally {top.close(); g.remove();}
  msgClear(); await say('ありがとうございました！'); msgClose();
}
function eqInfo(id){const it=IT[id]; if(!it.slot) return it.d||'';
  const who=[...S.party,...(S.reserve||[])].filter(m=>canEquip(m,id)).map(m=>m.name).join('・')||'いまの なかまは そうびできない';
  return `${SLOTN[it.slot]} ${it.slot==='w'?'こうげき':'しゅび'}+${it.slot==='w'?it.atk:it.def}　そうび：${who}`;}
async function shopBuy(goods,g){
  const m=new Menu({items:goods.map(id=>({label:IT[id].n,right:IT[id].price+'G'})),style:{left:'32%',top:'3%',right:'3%'},desc:i=>eqInfo(goods[i])});
  try{
    while(true){
      msgClear(); await say('どれに なさいますか？',{wait:'none'});
      const i=await m.pick(); if(i<0) return;
      const id=goods[i], it=IT[id]; msgClear();
      await say(`${it.n}ですね。 ${it.price}ゴールドに なりますが よろしいですか？`,{wait:'none'});
      if(!(await yesNo())) continue;
      if(S.gold<it.price){msgClear(); await say('おきゃくさん、 ゴールドが たりませんよ。'); continue;}
      S.gold-=it.price; addItem(id); g.upd(); sfx.buy();
      const pool=[...S.party,...(S.reserve||[])], can=pool.filter(p=>canEquip(p,id));
      if(it.slot&&can.length){
        msgClear(); await say('まいど！ いま ここで そうびして いきますか？',{wait:'none'});
        const p=await pickMember('だれが そうびする？',x=>canEquip(x,id),{right:'3%',bottom:'35%',width:'34%'},pool);
        if(p){equip(p,id); msgClear(); await say(`${p.name}は ${it.n}を そうびした！`);}
      }else{msgClear(); await say('まいど ありがとうございます！');}
    }
  } finally {m.close();}
}
async function shopSell(g){
  const mk=()=>bagList(it=>!it.key).map(x=>({...x,right:Math.floor((IT[x.id].price||0)/2)+'G'}));
  let list=mk();
  if(!list.length){msgClear(); await say('うれる ものを もっていないようですね。'); return;}
  const m=new Menu({items:list,style:{left:'32%',top:'3%',right:'3%'}});
  try{
    while(true){
      msgClear(); await say('どれを うって くれますか？',{wait:'none'});
      const i=await m.pick(); if(i<0) return;
      const id=list[i].id, p=Math.floor((IT[id].price||0)/2); msgClear();
      await say(`${IT[id].n}なら ${p}ゴールドで ひきとりましょう。 よろしいですか？`,{wait:'none'});
      if(!(await yesNo())) continue;
      delItem(id); S.gold+=p; g.upd(); sfx.buy();
      list=mk(); if(!list.length) return; m.setItems(list);
    }
  } finally {m.close();}
}
async function joinParty(cls,name,minLv,eq,o={}){
  const lv=Math.max(minLv,hero().lv-1);
  const m=mkMember(cls,name,lv,eq); Object.assign(m,o);
  if(S.party.length<4) S.party.push(m); else {S.reserve=S.reserve||[]; S.reserve.push(m);}
  S.flags['join_'+cls]=1; loadNPCs(); trail=[];
  stopBgm(); const ms=sfx.lvl(); await say(`${name}が なかまに くわわった！`+(S.party.includes(m)?'':'（ひかえに はいった。 メニューの「ならびかえ」で いれかえられる）'),{wait:'auto',ms:Math.max(900,ms||0)}); playBgm(curMap().bgm);
  return m;
}
function memberOf(cls){return [...S.party,...(S.reserve||[])].find(m=>m.cls===cls);}
function leaveParty(cls){const m=memberOf(cls); if(!m) return null; S.party=S.party.filter(x=>x!==m); S.reserve=(S.reserve||[]).filter(x=>x!==m); S.away=S.away||{}; S.away[cls]=m; return m;}
function rejoinParty(cls){const m=S.away&&S.away[cls]; if(!m) return; delete S.away[cls]; if(S.party.length<4) S.party.push(m); else S.reserve.push(m);}
