/* ---------- データ（ほしかげの剣 II） ---------- */
const MAXLV=70;
const expFor=lv=>lv<=1?0:Math.round(5*Math.pow(lv-1,2.2)+5*(lv-1));
const LV_OF_CH=[0,4,7,10,13,16,18,20,22,24,26,28,30,32,34,36,39,42,44,46,48,50,50,54,57,70];
const SLOTN={w:'ぶき',a:'よろい',s:'たて'};
const CLS={
  hero:{base:{hp:22,mp:4,str:7,agi:5},gr:{hp:[6,9],mp:[2,4],str:[2,3],agi:[1,3]},crit:1/24},
  mio:{base:{hp:16,mp:12,str:4,agi:7},gr:{hp:[4,6],mp:[3,5],str:[1,2],agi:[1,3]},crit:1/40},
  garm:{base:{hp:34,mp:2,str:11,agi:4},gr:{hp:[8,11],mp:[1,2],str:[3,4],agi:[1,2]},crit:1/16},
  riri:{base:{hp:20,mp:6,str:8,agi:10},gr:{hp:[5,7],mp:[1,3],str:[2,3],agi:[2,4]},crit:1/8},
  olga:{base:{hp:18,mp:14,str:5,agi:5},gr:{hp:[5,7],mp:[3,5],str:[1,2],agi:[1,2]},crit:1/40},
  jin:{base:{hp:28,mp:6,str:12,agi:8},gr:{hp:[7,10],mp:[1,3],str:[3,4],agi:[2,3]},crit:1/10},
  mumei:{base:{hp:300,mp:150,str:150,agi:90},gr:{hp:[9,12],mp:[3,5],str:[3,4],agi:[2,3]},crit:1/8},
};
function growth(m){const g=CLS[m.cls].gr; m.lv++; const d={hp:rnd(...g.hp),mp:rnd(...g.mp),str:rnd(...g.str),agi:rnd(...g.agi)};
  m.mhp+=d.hp; m.mmp+=d.mp; m.str+=d.str; m.agi+=d.agi; return d;}
function mkMember(cls,name,lv,eq){
  const b=CLS[cls].base;
  const m={cls,name,lv:1,hp:0,mhp:b.hp,mp:0,mmp:b.mp,str:b.str,agi:b.agi,exp:0,eq:Object.assign({w:null,a:null,s:null},eq),poison:false};
  while(m.lv<lv) growth(m);
  m.hp=m.mhp; m.mp=m.mmp; m.exp=expFor(m.lv); return m;
}
// じゅもん・とくぎ：いりょくは おぼえる レベルから きめる
const PW={one:L=>[4*L+12,5*L+16],all:L=>[Math.round(2.4*L+8),3*L+12],heal:L=>[4*L+14,5*L+20],hall:L=>[Math.round(2.4*L+10),3*L+14]};
const SP={};
function spell(k,n,cls,lv,mp,t,o={}){
  const s=Object.assign({n,cls,lv,mp,t,battle:1},o);
  if(t==='atk') s.pow=o.pow||(o.tg==='all'?PW.all(lv):PW.one(lv));
  if(t==='heal') s.pow=o.pow||PW.heal(lv);
  if(t==='healAll') s.pow=o.pow||PW.hall(lv);
  SP[k]=s;
}
// ゆうしゃ
spell('heal','いやし','hero',3,3,'heal',{tg:'ally',field:1,d:'なかま ひとりの HPを かいふくする。'});
spell('cure','げどく','hero',6,2,'cure',{tg:'ally',field:1,d:'どくを なおす。'});
spell('ret','かえりみち','hero',8,6,'return',{field:1,battle:0,d:'いちど いった まちへ いどうする。'});
spell('guard','まもり','hero',10,4,'guard',{d:'なかま ぜんいんが うける ダメージを へらす。'});
spell('heal2','だいいやし','hero',16,8,'heal',{tg:'ally',field:1,d:'HPを おおきく かいふくする。'});
spell('lsword','ひかりの つるぎ','hero',19,8,'atk',{tg:'one',d:'ひかりの やいばで てき 1たいを きる。'});
spell('revive','よみがえり','hero',24,15,'revive',{tg:'dead',field:1,d:'ちからつきた なかまを いきかえらせる。'});
spell('starrain','ほしくずのあめ','hero',32,16,'atk',{tg:'all',d:'てき ぜんいんに ほしくずを ふらせる。'});
spell('hheal','いやしのひかり','hero',40,18,'healAll',{field:1,d:'なかま ぜんいんを かいふくする。'});
spell('judge','ほしのさばき','hero',50,24,'atk',{tg:'one',d:'てき 1たいに だいダメージ。'});
spell('dawn','あかつきの ひかり','hero',60,36,'atk',{tg:'all',d:'よあけの ひかりで てき ぜんいんを やく。'});
// ミオ（ほしよみ）
spell('fire','ひのたま','mio',1,2,'atk',{tg:'one',pow:[11,16],d:'ちいさな ほのおで てき 1たいを こうげき。'});
spell('sleep','ねむりのうた','mio',4,3,'sleep',{tg:'all',d:'てきを ねむらせる ことが ある。'});
spell('bolt','いかずち','mio',8,6,'atk',{tg:'all',d:'てき ぜんいんに いなずまを おとす。'});
spell('power','ちからのうた','mio',12,6,'buffAtk',{tg:'ally',d:'なかま ひとりの こうげきりょくを あげる。'});
spell('ice','こおりのやいば','mio',15,6,'atk',{tg:'one',d:'てき 1たいを こおりで きりさく。'});
spell('blaze','ほのおのうず','mio',20,12,'atk',{tg:'all',d:'てき ぜんいんを ほのおで つつむ。'});
spell('spear','いかずちのやり','mio',28,12,'atk',{tg:'one',d:'てき 1たいを いかずちで つらぬく。'});
spell('meteor','りゅうせいぐん','mio',36,22,'atk',{tg:'all',d:'ながれぼしを ふらせる。'});
spell('nova','ちょうしんせい','mio',46,30,'atk',{tg:'all',d:'ほしの ばくはつで やきつくす。'});
spell('secret','ほしよみの ひでん','mio',58,40,'atk',{tg:'all',d:'ほしよみに つたわる さいごの じゅもん。'});
// ガルム（きし）
spell('cover','かばう','garm',1,0,'cover',{d:'このターン、 なかまへの こうげきを かわりに うける。'});
spell('stance','たてのかまえ','garm',6,3,'buffDef',{tg:'self',d:'じぶんが うける ダメージを へらす。'});
spell('smash','つよぎり','garm',10,3,'phys',{mult:1.8,tg:'one',d:'ちからを こめて てき 1たいを きる。'});
spell('oath','ちかいの いちげき','garm',18,6,'phys',{mult:2.4,tg:'one',d:'ちかいを こめた いちげき。'});
spell('wall','まもりの じん','garm',26,8,'guard',{d:'なかま ぜんいんを まもる じんを しく。'});
spell('quake','だいちわり','garm',44,14,'phys',{mult:1.3,tg:'all',d:'だいちを わり、 てき ぜんいんを こうげき。'});
spell('pride','きしの ほこり','garm',56,18,'phys',{mult:3.5,tg:'one',d:'きしの ほこりを かけた いちげき。'});
// リリ（とうぞく）
spell('steal','ぬすむ','riri',1,0,'steal',{tg:'one',d:'てきから どうぐを ぬすむ。'});
spell('double','にれんげき','riri',5,2,'multi',{hits:2,mult:.75,tg:'one',d:'すばやく 2かい こうげきする。'});
spell('shadowcut','かげうち','riri',10,4,'phys',{mult:1.6,tg:'one',d:'かげから しのびより きりつける。'});
spell('sneak','しのびあし','riri',14,4,'sneak',{field:1,battle:0,d:'しばらく まものに であいにくく なる。'});
spell('triple','さんれんげき','riri',22,6,'multi',{hits:3,mult:.7,tg:'one',d:'すばやく 3かい こうげきする。'});
spell('dust','ねむりの こな','riri',28,6,'sleep',{tg:'all',d:'てきを ねむらせる ことが ある。'});
spell('needle','かげぬい','riri',36,10,'phys',{mult:2.6,tg:'one',d:'かげを ぬいとめる いちげき。'});
spell('storm','みだれうち','riri',48,14,'phys',{mult:1.2,tg:'all',d:'てき ぜんいんを みだれうつ。'});
spell('flash','ぎんの ひらめき','riri',60,20,'phys',{mult:4,tg:'one',d:'めにも とまらない いちげき。'});
// オルガ（まじょ）
spell('oheal','まじょの いやし','olga',1,4,'heal',{tg:'ally',field:1,pow:[40,55],d:'HPを かいふくする。'});
spell('purify','じょうか','olga',4,3,'purify',{tg:'ally',field:1,d:'どくと ねむりを なおす。'});
spell('oall','みんなの いやし','olga',10,9,'healAll',{field:1,d:'なかま ぜんいんを かいふくする。'});
spell('bless','まもりの まじない','olga',14,6,'buffDef',{tg:'ally',d:'なかま ひとりの うける ダメージを へらす。'});
spell('orev','よみがえりの まじない','olga',20,14,'revive',{tg:'dead',field:1,d:'ちからつきた なかまを いきかえらせる。'});
spell('obig','だいいやし','olga',26,10,'heal',{tg:'ally',field:1,d:'HPを おおきく かいふくする。'});
spell('curse','やみの いかずち','olga',30,10,'atk',{tg:'one',d:'のろいの いかずちを おとす。'});
spell('oallbig','おおいなる いやし','olga',38,18,'healAll',{field:1,d:'なかま ぜんいんを おおきく かいふくする。'});
spell('ofull','かんぜんふっかつ','olga',46,22,'revive',{full:1,tg:'dead',field:1,d:'なかまを げんきな すがたで いきかえらせる。'});
spell('witch','まじょの ひほう','olga',56,28,'healAll',{field:1,d:'なかま ぜんいんを すべて かいふくする ほどの まほう。'});
// ジン（けんし）
spell('counter','みかえし','jin',1,2,'counter',{d:'このターン、 こうげきを うけると きりかえす。'});
spell('iai','いあい','jin',6,4,'phys',{mult:2,tg:'one',d:'さやから いっしゅんで きる。'});
spell('swallow','つばめがえし','jin',14,7,'phys',{mult:1,tg:'all',d:'てき ぜんいんを きりはらう。'});
spell('focus','きあいため','jin',20,4,'buffAtk',{tg:'self',d:'きあいを ため こうげきりょくを あげる。'});
spell('steel','ざんてつ','jin',28,10,'phys',{mult:2.8,tg:'one',d:'てつを も きる いちげき。'});
spell('musou','むそう','jin',38,16,'phys',{mult:1.6,tg:'all',d:'てき ぜんいんに すさまじい れんげき。'});
spell('first','いちのたち','jin',50,18,'phys',{mult:4.2,tg:'one',d:'ゆいいつ むにの いちげき。'});
spell('starcut','ほしきり','jin',62,28,'phys',{mult:2.4,tg:'all',d:'ほしを も きりさく れんげき。'});
// ムメイ（かこへん）
spell('mlight','えいゆうの ひかり','mumei',1,10,'atk',{tg:'all',pow:[300,360],d:'えいゆうの ひかり。'});
spell('mheal','えいゆうの いやし','mumei',1,10,'healAll',{pow:[300,350],d:'みんなを いやす。'});
const learned=m=>Object.keys(SP).filter(k=>SP[k].cls===m.cls&&m.lv>=SP[k].lv);

// どうぐ（なまえは すべて オリジナル）
const IT={
  herb:{n:'いやしぐさ',price:8,t:'heal',pow:[25,35],tg:'ally',d:'なかま ひとりの HPを すこし かいふくする。'},
  herb2:{n:'げんきのみ',price:40,t:'heal',pow:[80,100],tg:'ally',d:'なかま ひとりの HPを たっぷり かいふくする。'},
  herb3:{n:'たいようのみ',price:200,t:'heal',pow:[250,300],tg:'ally',d:'なかま ひとりの HPを おおきく かいふくする。'},
  antidote:{n:'げどくのみ',price:10,t:'cure',tg:'ally',d:'どくを なおす。'},
  bell:{n:'めざましベル',price:30,t:'wake',tg:'ally',d:'せんとうちゅう ねむっている なかまを おこす。'},
  drop:{n:'まりょくのしずく',price:150,t:'mp',pow:[20,30],tg:'ally',d:'MPを かいふくする。'},
  life:{n:'いのちのはね',price:300,t:'revive',tg:'dead',d:'ちからつきた なかまを いきかえらせる。'},
  wing:{n:'もどりのはね',price:25,t:'return',d:'いちど いった まちへ いっしゅんで もどる。'},
  smoke:{n:'めくらましだま',price:20,t:'flee',d:'せんとうから かならず にげられる。'},
  fseed1:{n:'ちからのたね',t:'seed',stat:'str',v:3,tg:'ally',d:'たべると ちからが 3 あがる。'},
  fseed2:{n:'いのちのたね',t:'seed',stat:'mhp',v:12,tg:'ally',d:'たべると さいだいHPが 12 あがる。'},
  fseed3:{n:'まりょくのたね',t:'seed',stat:'mmp',v:8,tg:'ally',d:'たべると さいだいMPが 8 あがる。'},
  fbell:{n:'すばやさのたね',t:'seed',stat:'agi',v:3,tg:'ally',d:'たべると すばやさが 3 あがる。'},
};
// そうび：だんかい（tier）ごとに なまえを ならべ、 つよさと ねだんは しきで きめる
const WEAPON_ATK=[3,8,14,20,27,34,41,49,57,66,75,85,95,105];
const ARMOR_DEF=[4,9,15,21,28,35,42,50,58,67,76,86,96,106];
const SHIELD_DEF=[3,6,10,15,20,26,32,38,44,50,56,62,68,74];
const GEARN={
  sword:['きのけん','どうのけん','てつのけん','はがねのけん','ぎんのけん','くろがねのけん','せいれいのけん','りゅうのけん','つきかげのけん','たいようのけん','てんくうのけん','いにしえのけん'],
  knife:['どうのナイフ','てつのナイフ','はがねのナイフ','ぎんのナイフ','かげのナイフ','くろがねのナイフ','せいれいのナイフ','りゅうのキバ','つきかげのナイフ','たいようのナイフ','てんくうのナイフ','いにしえのナイフ'],
  axe:['いしのおの','どうのおの','てつのおの','はがねのおの','ぎんのおの','いくさおの','せいれいのおの','りゅうのおの','つきかげのおの','たいようのおの','てんくうのおの','いにしえのおの'],
  staff:['かしのつえ','まどうしのつえ','ほしのつえ','ぎんのつえ','つきのつえ','くろがねのつえ','せいれいのつえ','りゅうのつえ','つきかげのつえ','たいようのつえ','てんくうのつえ','いにしえのつえ'],
  heavy:['かわのよろい','くさりのよろい','てつのよろい','はがねのよろい','ぎんのよろい','くろがねのよろい','せいれいのよろい','りゅうのよろい','つきかげのよろい','たいようのよろい','てんくうのよろい','いにしえのよろい'],
  light:['たびびとのふく','かわのベスト','しのびのふく','ぎんのベスト','かげのころも','くろがねのころも','せいれいのころも','りゅうのころも','つきかげのころも','たいようのころも','てんくうのころも','いにしえのころも'],
  robe:['ぬののローブ','まどうしのローブ','ほしぎぬのローブ','ぎんのローブ','つきのローブ','くろがねのローブ','せいれいのローブ','りゅうのローブ','つきかげのローブ','たいようのローブ','てんくうのローブ','いにしえのローブ'],
  shield:['きのたて','うろこのたて','てつのたて','はがねのたて','ぎんのたて','くろがねのたて','せいれいのたて','りゅうのたて','つきかげのたて','たいようのたて','てんくうのたて','いにしえのたて'],
};
const GEAR_WHO={sword:['hero','garm','jin'],knife:['riri','hero'],axe:['garm','jin'],staff:['mio','olga'],heavy:['hero','garm','jin'],light:['riri','hero','jin','mio','olga'],robe:['mio','olga'],shield:['hero','garm','jin','riri']};
const GEAR_MUL={sword:1,knife:.82,axe:1.12,staff:.55,heavy:1,light:.8,robe:.72,shield:1};
for(const [type,names] of Object.entries(GEARN)) names.forEach((n,i)=>{
  const id=`${type}${i+1}`, base=type==='shield'?SHIELD_DEF[i]:['heavy','light','robe'].includes(type)?ARMOR_DEF[i]:WEAPON_ATK[i];
  const v=Math.max(1,Math.round(base*GEAR_MUL[type])), slot=type==='shield'?'s':['heavy','light','robe'].includes(type)?'a':'w';
  IT[id]=Object.assign({n,slot,only:GEAR_WHO[type],price:Math.round((v*v*1.6+v*20)/10)*10},slot==='w'?{atk:v}:{def:v});
});
// とくべつな そうび（ほしのかけら・クエスト・ボスの ごほうび）
Object.assign(IT,{
  fring1:{n:'かけらの たて',slot:'s',def:24,only:['hero','garm','jin','riri'],price:0,d:'ほしのかけらで できた たて。'},
  fsword:{n:'かけらの つるぎ',slot:'w',atk:52,only:['hero','garm','jin'],price:0},
  frobe:{n:'ほしぎぬの はごろも',slot:'a',def:48,only:['mio','olga','riri'],price:0},
  fshield:{n:'ぎんがの たて',slot:'s',def:52,only:['hero','garm','jin','riri'],price:0},
  faxe:{n:'すいせいの おの',slot:'w',atk:92,only:['garm','jin'],price:0},
  fcrown:{n:'ほしの よろい',slot:'a',def:92,only:['hero','garm','jin'],price:0},
  fstar:{n:'ほしかげの けん',slot:'w',atk:120,only:['hero'],price:0,d:'せんねんまえの ゆうしゃの けん。'},
  legend:{n:'なまえの つるぎ',slot:'w',atk:70,only:['hero'],price:0,d:'ほむらの まちで うたれた でんせつの つるぎ。'},
  legendS:{n:'なまえの たて',slot:'s',def:40,only:['hero','garm','jin','riri'],price:0},
});
const canEquip=(m,id)=>{const it=IT[id]; return !!it.slot&&(!it.only||it.only.includes(m.cls));};
const gearSet=(...tiers)=>tiers.flatMap(([type,t])=>[`${type}${t}`]);
