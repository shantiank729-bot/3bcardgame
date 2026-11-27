/* =========================================================
   つなぎ：じょうたい・ちず・ボスの あと・タイトル
   ========================================================= */
Object.assign(PPAL,{
  mio:{h:'#3a2a5a',g:'#7a5ac8',r:'#f0d040'},
  garm:{h:'#8a5a2a',g:'#7a7a8a',r:'#c84a4a',s:'#e0a878'},
  riri:{h:'#e0a020',g:'#3a6a3a',r:'#a83a3a'},
  olga:{h:'#d8d8e0',g:'#3a2a4a',r:'#8a3aa0'},
  jin:{h:'#1a1a22',g:'#2a2a3a',r:'#c04060'},
  father:{h:'#5a4a3a',g:'#2a4a6a',r:'#e8e0d0',s:'#d8a070'},
  mumei:{h:'#e8e8f0',g:'#3a3a6a',r:'#a080ff'},
});
const MAPS={};
let S=null;
let mode='title';
const P={x:0,y:0,dir:'down',moving:false,fx:0,fy:0,t:0};
let trail=[], fdir=['down','down','down','down'];
let npcs=[], stepsSince=0, scripting=false, B=null, titleUI=null, endUI=null;
function newGame(name){
  S={party:[mkMember('hero',name,1,{w:'sword1',a:'light1'})],reserve:[],gold:50,items:{herb:3},flags:{},map:'akari_0',x:5,y:6,dir:'up',ch:0,
    visited:['akari'],lastTown:'akari',time:.3,abil:{},keys:{},q:{},frags:0,cut:{},ship:null,air:null,veh:null};
}
const hero=()=>S.party[0];
const HN=()=>S.party[0].name;
const atkOf=m=>m.str+(m.eq.w?IT[m.eq.w].atk:0);
const defOf=m=>Math.floor(m.agi/2)+(m.eq.a?IT[m.eq.a].def:0)+(m.eq.s?IT[m.eq.s].def:0);
const aliveP=()=>S.party.filter(m=>m.hp>0);
const has=id=>(S.items[id]||0)>0;
function addItem(id,n=1){S.items[id]=(S.items[id]||0)+n;}
function delItem(id,n=1){S.items[id]=(S.items[id]||0)-n; if(S.items[id]<=0) delete S.items[id];}
function saveGame(){autoOff=false; S.x=P.x; S.y=P.y; S.dir=P.dir; S.at=Date.now(); return store.set(SAVE_KEY,JSON.stringify(S));}
// じどう セーブ：まちや ダンジョンに でいりした とき・せんとうの あと・ページを とじる とき（かこへんの さいちゅうは しない）
const AUTO_KEY='hoshikage2-auto-v1';
let autoOff=false;   // まえの データが ある とき、 はじめからの ぼうけんは さいしょに きろくするまで じどうセーブしない（まえの データを けさない）
function autoSave(){if(!S||mode==='title'||mode==='ending'||S.saved||autoOff) return; try{store.set(AUTO_KEY,JSON.stringify(Object.assign({},S,{x:P.x,y:P.y,dir:P.dir,at:Date.now()})));}catch(e){}}
addEventListener('pagehide',autoSave);
document.addEventListener('visibilitychange',()=>{if(document.hidden) autoSave();});
// てどうセーブと じどうセーブの あたらしい ほうを よむ
function loadSave(){const rd=k=>{try{const t=store.get(k); return t?JSON.parse(t):null;}catch(e){return null}}; const a=rd(SAVE_KEY), b=rd(AUTO_KEY);
  if(!a) return b; if(!b) return a; return (b.at||0)>(a.at||0)?b:a;}
function goal(){const g=GOALS[S.ch||1]; if(g) return g();
  if((S.ch||1)>24) return S.flags.boss_ruins7?'すべての しれんを のりこえた！ のこりの クエストや ほしのかけらを さがして みよう。':'きたひがしの はての しまの『ほしかげの いせき』で、 さいごの しれんに いどもう。（めやす Lv70・そらとぶ ふねで）';
  return 'すすもう。';}

/* ---------- タイル（2さくめ ついか） ---------- */
function buildTilesG2b(){
  const T=(ch,fn)=>{TILES[ch]=[mkTile(g=>fn(g,0)),mkTile(g=>fn(g,1))];};
  T('無',g=>R(g,'#000000',0,0,16,16));
  T('路',g=>{grass(g,3); R(g,'#c8b07a',0,3,16,10); R(g,'#a8905a',0,3,16,1); R(g,'#a8905a',0,12,16,1); R(g,'#dcc894',3,6,3,1); R(g,'#dcc894',10,9,3,1);});
  T('割',g=>{R(g,'#4c4038',0,0,16,16); R(g,'#2c241e',7,1,1,5); R(g,'#2c241e',5,5,3,1); R(g,'#2c241e',4,6,1,5); R(g,'#2c241e',8,6,4,1); R(g,'#2c241e',11,7,1,6);});
}
for(const c of ['赤','青','緑','藁','黒','白','紫','壁','窓','煉','剣','薬','宿','教','酒','本','鎚','杖','換','城','学','柵','井','噴','像','墓','灯','標','樹','寝','机','暖','祭','鍛','炉','■','格','藪','岩','割','錠','無']) SOLID.add(c);
Object.assign(ENC_RATE,{'路':48,'畑':0});

/* ---------- せかいの ばしょ（てきの ちいき） ---------- */
function worldZone(x,y){
  if(S&&S.veh==='ship') return y<50?'sea2':'sea1';
  if(y<18&&x>=66&&x<=90) return 'sky';
  if(y<45&&x<70) return 'ice';
  if(y<50&&x>=90) return x>=130?'kinoko':'academy';
  if(x<=96&&y>=54){
    if(x<=32&&y>=98) return 'akari';
    if(x<38&&y>=82) return 'flora';
    if(x<57) return 'golde';
    if(x<70) return 'river';
    if(y>=95) return 'ghost';
    if(y>=72) return 'sand';
    return 'fort';
  }
  if(x>=105&&x<135&&y>=95) return 'namino';
  if(x>=135&&y>=85) return 'homura';
  if(x>=108&&y>=50&&y<75) return 'lake';
  return 'sea2';
}
function makeWorldMap(){
  MAPS.world={id:'world',name:'あおばの せかい',rows:makeWorld().map(r=>r.join('')),out:'~',kind:'world',bgm:'field',enc:(x,y)=>worldZone(x,y),links:{},npcs:[],chests:[],objs:[],hid:[],dyn:{}};
}

/* ---------- ボスの いやらしい わざ（9しょう いこうの しょうボス） ----------
   ・きょうかけし：かならず 1ターン まえに よこくする（そのあいだに こうげきを あてる・ぼうぎょする）
   ・じゅもんふうじ：3ターン じゅもんが つかえない（じょうか・めざましベルで なおる） */
function addBossTricks(){
  for(const [id,m] of Object.entries(MON)){
    if(!m.boss||!m.phases||m.phases.length<2||(m.ml||0)<16) continue;
    if((m.ml||0)>=16) m.phases[0].moves.push(M_('prep',1,'%sの まわりに つめたい ひかりが あつまっていく…',{next:M_('dispel',0,'%sは かきけしの ひかりを はなった！')}));
    if((m.ml||0)<24){m.phases[m.phases.length-1].moves.push(M_('prep',1.5,'%sの まわりに つめたい ひかりが あつまっていく…',{next:M_('dispel',0,'%sは かきけしの ひかりを はなった！')})); continue;}
    m.phases[0].moves.push(M_('silence',1,'%sは ことばを うばう のろいを はなった！',{ch:.45,all:(m.ml||0)>=44}));
    m.phases[m.phases.length-1].moves.push(M_('prep',1.5,'%sの まわりに つめたい ひかりが あつまっていく…',{next:M_('dispel',0,'%sは かきけしの ひかりを はなった！')}));
  }
}

/* ---------- ボス・ちゅうボス ---------- */
async function dungeonMid(D,mid,flag){
  msgClear(); for(const t of mid.intro||[]) await say(t); msgClose();
  const r=await battle([mid.mon],{boss:1,area:D.area});
  if(r!=='win') return;
  S.flags[flag]=1; S.flags['mid_'+D.id]=1; loadNPCs();
  if(AFTER_MID[D.id]) await AFTER_MID[D.id](mid);
}
async function dungeonBoss(D){
  if(D.id==='final') await startChapter(24);
  if(D.id==='final'&&S.flags.mumeiDown){S.flags.boss_final=1; loadNPCs(); await afterMumei(); return;}
  msgClear(); for(const t of D.intro||[]) await say(t); msgClose();
  const r=await battle(D.group||[D.boss],{boss:1,area:D.area,bgm:D.id==='final'?'last':D.id==='ruins7'?'last':null});
  if(r!=='win') return;
  S.flags['boss_'+D.id]=1; loadNPCs();
  if(AFTER[D.id]) await AFTER[D.id]();
}
const say2=async arr=>{msgClear(); for(const t of arr) await say(typeof t==='function'?t():t); msgClose();};
const AFTER_MID={ntower:afterJin3};
const AFTER={
  seacave:()=>say2(['こぶん「ぐぐ… なまえは… ムメイさまに…」','こぶんは くろい けむりに なって きえた。',()=>`かげのこ「…いま、 なにかが すこしだけ もどった きがする。 ${HN()}の こえ、 やっぱり しってる…」`,'（アカリの やくばで ちょうちょうに ほうこくしよう）']),
  forest:()=>say2(['もりの ぬし「わしの ねっこが… なまえを はなして しまう…」','ひかりの つぶが もりから むらの ほうへ とんでいった。','かげのこ「はなの むすめさんの なまえが かえったんだ！ むらに もどろう。」']),
  mine:()=>say2(['いわくいが くずれると、 おくの いわが われて こうふたちが でてきた！','こうふ「たすかった！ …おれの なまえ、 ちゃんと おぼえてるか？ トマスだ！」','（ゴルドの さかばの きしが きになる…）']),
  ruins:()=>say2(['ばんにんが きえると、 すいもんが しずかに とじた。','たからばこに はしの せっけいずが ある！','（はしもりの つまに とどけよう）']),
  vault:async()=>{await say2(['きんこの ばんが うごかなく なった。','リリ「あった… あたしの かぞくの なまえいし！」','リリ「でも… いしが つめたい。 なまえを よんでも なにも おこらない。」','ミオ「なまえの もちぬしが、 どこか とおくに いるのかも。」','リリ「…それでも いい。 さがしだすまで、 あんたたちに ついて いくよ。」']); await startChapter(6);},
  bell:async()=>{await say2(['ぼうれいが きえると、 とうの かねが ひとりでに なりひびいた！ ゴォォン…','まちの かげびとたちが、 ひとり また ひとりと いろを とりもどしていく。','ガルム「…かねの おと。 とりでの かねと おなじだ。 …とりで。 そうだ、 きたの とりでだ！」','ガルム「おれは そこで ちかったんだ。 たいちょうと、 なにかを！」']); await startChapter(7);},
  fortu:async()=>{await say2(['わすれの たいちょうの よろいが くだけ、 くろい もやが ほどけた。','たいちょう「…ガルム。 おまえは わたしの… たてだった。」','たいちょう「ちかいを わすれるな。『よわき ものの なまえを まもる』… それが きしの ちかいだ…」','たいちょうは ひかりに なって きえた。 なまえは もどらなかった。','ガルム「…たいちょう。 おれは、 わすれない。」','かげのこ「…あの、 ねえ。 なんだか からだが へん…。 とうだいが よんでる きが する。」']); await startChapter(8);},
  lhouse:afterShogun,
  tide:async()=>{await say2(['まじゅうが うみの あわに なって きえた。 しまの ひとびとの なまえが もどっていく！','オルガ「ふん、 わたしの つみも これで はれたかね。」','ふなのりの うわさ：「ひがしの おきに、 よるだけ ゆうれいせんが でる」']); await startChapter(10);},
  gship:async()=>{await say2(['ジン「…くっ。 また まけるとは。」','ジン「なぜだ。 おまえたちは なぜ、 そこまで して ひとの なまえを まもる？」','ミオ「わたしが なまえを なくした とき、 だれも わたしを みてくれなかった。 その さみしさを、 だれにも あじわって ほしくないの。」','ジン「……。」 ジンは うみへ とびこみ、 すがたを けした。','せんちょう「わしの なまえは グレイ！ …ありがとう。 これで みなとへ かえれる。」']); await startChapter(11);},
  icecastle:async()=>{S.guest=null; trail=[]; await say2(['にせの おうが くだけ、 こおりの けしょうが はがれおちた。','ろうじん「…おもいだした。 わしは アイスバーン。 この くにの おうじゃ！」','おう「れいを いう。 ひがしの『がくえん とし ステラ』に、 なまえの ひみつを しる ほしよみが いると きく。」','（おうは しろの ひろまへ もどっていった）']); await startChapter(12);},
  library:async()=>{await say2(['きんしょの ばんにん「…しれ。 せんねんまえ、 ひとりの えいゆうが わすれの かみを みずからに ふうじた。」','ばんにん「ふういんを まもる ため、 ひとびとは その なを れきしから けした。」','ばんにん「よばれぬ なは、 いつか かみに くわれる… それが ムメイ…」','ミオ「ムメイは… わすれられた えいゆう？」','（たからばこに ほしよみの つえ が はいっている）']); await startChapter(13);},
  root:async()=>{await say2(['どくぐもが きえると、 ねっこの なかから たくさんの ひかりが あふれだした。','こびとたち「ちょうろう！ ポコじいちゃん！」','ちょうろう「みなみの『みずうみの むら』で、 なきつづける まじょの うわさが ある。 …オルガどの、 こころあたりは？」','オルガ「……いや。 ない はずだよ。」']); await startChapter(14);},
  lakeD:afterKanashimi,
  lava:()=>say2(['ようがんりゅう「…みごとだ。 わしの うろこ、 もっていけ。」','（りゅうの うろこを でんせつの かじやへ もっていこう）']),
  ntower:afterBunshin,
  cloud:async()=>{await say2(['まりゅう「…ムメイさまは… ほんとうは… ずっと…」','まりゅうが きえた あとに、 ぎんいろに ひかる かけらが のこった。','そらの おさの こえ「その かがみの かけらを、 アカリの とうだいへ。 ひかりが うらがえしの せかいを ひらく。」']); await startChapter(18);},
  mlight:async()=>{await say2(['かがみの じぶん「…おまえは、 わすれた ことを くやんで いるか。」',()=>`${HN()}は うなずいた。`,'かがみの じぶん「なら いい。 わすれた ことを おぼえて いる かぎり、 おまえは もう にどと わすれない。」','かがみの じぶんは ほほえんで、 ひかりに とけていった。','ミオ「…にいさん。 うらがえしの とりでから、 なつかしい けはいが する。 ガルムの…」']); await startChapter(19);},
  mfortD:async()=>{await say2(['バルド「…みごとだ。 その ちかいの いちげき、 たしかに うけとった。」','ガルム「たいちょう！ あなたの なまえは バルド！ わすれの とりでの たいちょう バルドだ！」','バルド「…ああ。 よばれた。 これで わたしも かえれる。」','バルドの たましいは、 おもての せかいの とりでへ かえっていった。','ガルム「…ちかいは まだ おわっちゃいない。 よわき ものの なまえを まもる。 さいごまでだ。」']);
    const g=memberOf('garm'); if(g){g.str+=6; g.mhp+=30;} sfx.lvl(); await say2(['ガルムの ちからと HPが あがった！','リリ「…ねえ。 うらがえしの サンドラに、 あたしの かぞくが いる きが するの。」']); await startChapter(20);},
  mvault:async()=>{await say2(['おやかた「ば…かな… なまえいしが…」','おやかたの もっていた なまえいしが いっせいに ひかりだした！','リリ「…うらがえしの サンドラの『リリの かぞくの いえ』へ いこう。 あたしの いしを もって。」']);},
  waste:afterKyojin,
  final:afterMumei,
  ruins7:()=>say2(['ほしかげの まぼろし「…みごと。 おまえたちの『なまえを よぶ ちから』、 たしかに みとどけた。」','まぼろし「せんねんまえ、 わたしは ひとりで たたかい、 ひとりで わすれられた。 だが おまえたちは ちがう。」','まぼろし「よびあう なかまが いる かぎり、 ほしかげは きえない。」','（ほしの よろいを てにいれた！ すべての しれんを のりこえた！）']),
};
// だいじな ものを てに いれた とき
async function afterKeyItem(id){
  S.abil=S.abil||{};
  if(id==='hammerItem'){S.abil.hammer=1; S.flags.hammer=1; delItem('hammerItem'); sfx.lvl(); await say('いわや ひびわれた かべを くだける ように なった！');}
  if(id==='lantern'){S.abil.lantern=1; delItem('lantern'); sfx.lvl(); await say('くらやみを てらせる ように なった！ かくされた みちが うっすら ひかって みえる。');}
  if(id==='fisherCharm'&&qState('charm')!=null) qSet('charm',1);
  if(id==='blueprint') qSet('widow',1);
  if(id==='hat') qSet('kobito',Math.max(0,qState('kobito')||0));
}

/* ---------- じょうけんの しあげ（ちず どうしの つなぎ） ---------- */
function glueFix(){
  // とりでの ちかどう：おおひろまの おくの かいだん
  const fu=DUNGEONS.find(d=>d.id==='fortu');
  fu.from=stairsIn('fort_castle',14,11,'fortu1',()=>S.flags.siege?null:['ちかへの かいだん。 へいしが みはっている。「いまは とおせん！ まものが せめて くるぞ！」']);
  // ギルドの ちかこ
  const gm=bldMap('sandra','guild'); const vd=DUNGEONS.find(d=>d.id==='vault');
  vd.from=stairsIn(gm,11,7,'vault1',()=>S.flags.ririMet?null:['うけつけの おくの かいだん。「かんけいしゃ いがい たちいり きんし」']);
  // とりでの なふだ（1〜3は とりでの まちに おちている）
  const fm=MAPS.fort, sp=fm.spots; fm.hid=fm.hid||[]; const pk=[...sp.park,...sp.plaza];
  ['tag1','tag2','tag3'].forEach((t,i)=>{const p=pk[Math.floor((i+1)*pk.length/4)]||sp.road[i*3]; fm.hid.push({id:t,x:p[0],y:p[1],loot:t});});
  // ゴルド：こうざんから かえった こうふ（おべんとう・こうかん）
  const gd=MAPS.golde; const rp=gd.spots.road[Math.floor(gd.spots.road.length*.3)];
  gd.npcs.push({x:rp[0],y:rp[1]+1,pal:'merchant',dir:'down',cond:F('boss_mine'),talk:minerTalk});
  // みずうみの ほとりの いえ：はいると オルガが…
  const nh=mapByName('みずうみの ほとりの いえ'); if(nh) MAPS[nh].onEnter=async()=>{if((S.ch||1)>=14&&!S.flags.olgaLeft&&memberOf('olga')) await olgaLeaves();};
  // アカリの きょうかい：100ねんごしの てがみ
  // くだんの つきあたりの ほんだなに ヒント
}
async function minerTalk(){
  msgClear();
  if(qState('lunch')!=null&&qState('lunch')!=='done'&&has('lunch')){delItem('lunch'); await say('こうふ トマス「これは… つまの おべんとう！ まだ あったかい…！」'); await say('トマス「つまの なまえ… マーサだ。 わすれて なかった。 ありがとう！」'); await qDone('lunch','herb2'); msgClose(); return;}
  if(qState('trade')===1&&has('tako')){delItem('tako'); addItem('ore'); qSet('trade',2); sfx.chest(); await say('トマス「ひかりダコ！ こいつは うまいんだ。 かわりに ほしの こうせきを やるよ。」'); await say('ほしの こうせきを てにいれた！'); msgClose(); return;}
  await say('こうふ トマス「こうざんから だして くれて ありがとうな。 また ほりに もどるさ。」'); msgClose();
}
const _church=churchTalk;
churchTalk=async function(sp){
  if(sp&&sp.id==='akari'&&has('ghostLetter')){
    msgClear(); delItem('ghostLetter');
    await say('ぼくし「…100ねんまえの てがみ？ この ふうとうの もんしょう、 わたしの そうそふの ものだ。」');
    await say('ぼくし「そうそふは しょうがい、 とどかなかった てがみを まっていたと きく。 …ありがとう。 そうそふの はかに そなえるよ。」');
    await qDone('ghostletter','fseed3'); msgClose(); return;
  }
  return _church(sp);
};
// ばしょ IDの ない リンク（[id,0,0]）を、 いきさきの いりぐちに そろえる
function fixLinks(){
  for(const m of Object.values(MAPS)) for(const [k,l] of Object.entries(m.links||{})){
    if(l[1]===0&&l[2]===0&&MAPS[l[0]]){const e=MAPS[l[0]].entry; m.links[k]=[l[0],e[0],e[1],e[2]];}
  }
}

/* ---------- エンディングの そら ---------- */
const stars=[...Array(90)].map(()=>({x:Math.random()*SW,y:Math.random()*SH*.8,p:Math.random()*6,s:Math.random()<.15?2:1}));
let endStars=0;
function drawSky(now,count){
  const g=ctx.createLinearGradient(0,0,0,SH); g.addColorStop(0,'#05061a'); g.addColorStop(1,'#1c2250');
  ctx.fillStyle=g; ctx.fillRect(0,0,SW,SH);
  for(let i=0;i<Math.min(count,stars.length);i++){const s=stars[i]; const a=.5+.5*Math.sin(now/500+s.p); ctx.fillStyle=`rgba(255,250,220,${a})`; ctx.fillRect(s.x|0,s.y|0,s.s,s.s);}
  ctx.fillStyle='#0b0e24'; ctx.beginPath(); ctx.moveTo(0,SH); for(let x=0;x<=SW;x+=8) ctx.lineTo(x,SH-28-Math.sin(x/30)*8-Math.sin(x/11)*3); ctx.lineTo(SW,SH); ctx.fill();
  // とうだい
  ctx.fillStyle='#1a1e3a'; ctx.fillRect(196,SH-70,10,46); ctx.fillStyle='#ffe070'; ctx.fillRect(194,SH-78,14,8);
  if(Math.floor(now/900)%2){ctx.fillStyle='rgba(255,240,160,.12)'; ctx.beginPath(); ctx.moveTo(201,SH-74); ctx.lineTo(0,SH-110); ctx.lineTo(0,SH-60); ctx.fill();}
}

/* ---------- タイトル ---------- */
async function titleScreen(){
  mode='title'; playBgm('title');
  titleUI=document.createElement('div'); titleUI.className='title';
  titleUI.innerHTML='<div class="logo">ほしかげの剣 II</div><div class="sub">― なまえを なくした せかい ―</div><div class="foot">A：けってい　B：もどる</div>';
  ui.appendChild(titleUI);
  // てどうセーブ（きろく）と じどうセーブは べつべつに えらべる。 どちらも かってに けさない
  const rd=k=>{try{const t=store.get(k); return t?JSON.parse(t):null;}catch(e){return null}};
  const man=rd(SAVE_KEY), auto=rd(AUTO_KEY);
  const info=s=>s?`${s.party&&s.party[0]?s.party[0].name+' Lv'+s.party[0].lv:''}　${(s.ch||1)>24?'クリアご':'だい'+(s.ch||1)+'しょう'}　${MAPS[s.map]?MAPS[s.map].name:''}`:'';
  const items=[{label:'はじめから'},{label:'きろくから つづける',disabled:!man},{label:'じどうセーブから つづける',disabled:!auto}];
  const m=new Menu({items,cancel:false,start:man?1:auto?2:0,style:{left:'50%',top:'52%',transform:'translateX(-50%)',width:'78%'},
    desc:i=>i===1?(man?info(man):'まだ きろくが ない'):i===2?(auto?info(auto):'まだ じどうセーブが ない'):(man||auto?'あたらしく はじめても、 いまの きろくは けされません。':'')});
  let c;
  while(true){c=await m.pick(); if((c===1&&!man)||(c===2&&!auto)){sfx.bump(); continue;} break;}
  m.close();
  if(c>0){
    titleUI.remove(); titleUI=null;
    await fadeOut(300);
    await resumeSave(c===1?man:auto); return;
  }
  const name=await askName();
  titleUI.remove(); titleUI=null;
  await beginStory(name);
}
async function resumeSave(sv){
  autoOff=false; S=sv; if(!MAPS[S.map]) S.map='akari';
  P.x=S.x; P.y=S.y; P.dir=S.dir||'down'; P.moving=false; trail=[]; mode='field'; loadNPCs(); playBgm(mapBgm());
  await fadeIn(300); toast(curMap().name||'フィールド');
}
async function beginStory(name){
  autoOff=!!(store.get(SAVE_KEY)||store.get(AUTO_KEY));
  newGame(name); await fadeOut(400);
  mode='ending'; endStars=stars.length; playBgm('title'); await fadeIn(400);
  msgClear();
  await say('この せかいでは、 ひとは にど しぬ と いわれている。');
  await say('いちどめは、 いのちが つきた とき。 にどめは、 だれにも なまえを よばれなく なった とき。');
  await say('さいきん、 せかいの あちこちで「なまえ」が きえはじめた。 きえた ひとの ことは、 みんな すぐに わすれて しまう。');
  await say(`ともしびの まち アカリ。 とうだいもりの むすこ ${HN()}は、 その あさも いつもどおりに めを さました…`);
  msgClose(); await fadeOut(500);
  scripting=true;
  try{
    mode='field'; P.x=S.x; P.y=S.y; P.dir=S.dir; P.moving=false; trail=[]; loadNPCs(); playBgm('town');
    await fadeIn(500);
    await startChapter(1);
    toast('じぶんの いえ');
    await motherTalk();
    msgClear(); await say('（ははに はなしかけたり、 まちを たんけん しよう。 つぼや たるを しらべると なにか みつかるかも）'); msgClose();
  } finally {scripting=false;}
}
function askName(){
  return new Promise(res=>{
    const w=win('namebox',{},'<div>なまえを いれてください</div><input id="hero-name" maxlength="6" value="ソラ" autocomplete="off" aria-label="しゅじんこうの なまえ"><button type="button" id="name-ok">けってい</button>');
    const inp=w.querySelector('input'), btn=w.querySelector('button');
    const done=()=>{const v=(inp.value||'').trim().slice(0,6)||'ソラ'; popH(h); w.remove(); sfx.ok(); res(v);};
    const h=b=>{if(b==='a') done();};
    pushH(h);
    inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault(); done();}});
    btn.addEventListener('click',done);
    setTimeout(()=>{if(matchMedia('(pointer:fine)').matches) inp.focus();},50);
  });
}

/* ---------- メインループ ---------- */
let last=performance.now();
function frame(now){
  const dt=Math.min(50,now-last); last=now;
  if(mode==='field'&&S){updateField(dt); drawField(now);}
  else if(mode==='battle'&&B) drawBattle(now);
  else if(mode==='title') drawSky(now,stars.length);
  else if(mode==='ending') drawSky(now,endStars);
  if(flashFx){const k=(now-flashFx.t0)/flashFx.ms; if(k>=1) flashFx=null; else{ctx.save(); ctx.globalAlpha=(1-k)*.8; ctx.fillStyle=flashFx.color; ctx.fillRect(0,0,SW,SH); ctx.restore();}}
  requestAnimationFrame(frame);
}
function initWorld(){
  buildTiles2(); buildTilesG2(); buildTilesG2b(); buildObjArt();
  makeWorldMap();
  defineCh1(); defineCh2(); defineCh3(); defineCh4(); defineCh5(); defineCh6(); defineCh7(); defineCh8();
  defineCh9(); defineCh10(); defineCh11(); defineCh12(); defineCh13(); defineCh14(); defineCh15(); defineCh16();
  defineCh17(); defineCh18(); defineCh19(); defineCh20(); defineCh21(); defineCh22(); defineCh23(); definePost();
  glueFix(); defineSideQuests(); addBossTricks(); buildDungeons(); placeIcons(); placeWorldFrags(); fixLinks(); applyTune();
}
initWorld();
requestAnimationFrame(frame);
// ゲームが こうしんされても、 あそんでいた ばしょから つづける
function start(data){
  const sv=data&&data.save?(()=>{try{return JSON.parse(data.save);}catch(e){return null}})():null;
  if(sv) resumeSave(sv); else titleScreen();
}
const hot=window.claude&&window.claude.hot;
if(hot&&hot.snapshot) try{hot.snapshot(()=>({save:S&&mode!=='title'&&mode!=='ending'&&!S.saved?JSON.stringify(Object.assign({},S,{x:P.x,y:P.y,dir:P.dir})):null}));}catch(e){}
if(hot&&hot.ready) hot.ready(start); else start(hot&&hot.data||{});
// テストプレイ・バランス ちょうせい よう
window.__rpg={get busy(){return scripting||handlers.length>0}, get S(){return S}, set S(v){S=v;}, get B(){return B}, P, MAPS, MON, MSPR, IT, SP, ENC, DUNGEONS, QUESTS, WORLD_ICONS, ICON_GATE, LINK_GATE, ZONE_ML,
  battle, gotoMap, enterMap, press, get mode(){return mode}, expFor, mkMember, joinParty, startChapter, dockFor, fstat, bstat, expectParty, loadNPCs, tileAt, blocked, SOLID, AFTER, GOALS, LV_OF_CH,
  setFast(v){FAST=!!v;}, setAuto(v){AUTO=v===true?true:v||false;}, newGame, beginStory, TUNE, applyTune, EXPMUL, NMUL, ZONE_MUL, run:fn=>run(fn), get npcs(){return npcs}, saveGame, flashback, worldZone};
