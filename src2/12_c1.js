/* =========================================================
   だい1ぶ　わすれられた ひとびと（1〜8しょう）
   ========================================================= */
// かいわの たすけ：じょうけんの あう さいしょの セリフを つかう
const by=(...cases)=>async()=>{for(const [c,ls] of cases){ if(c===true||c()){ if(typeof ls==='function') await ls(); else await lines(ls); return; } }};
const F=k=>()=>!!S.flags[k], NF=k=>()=>!S.flags[k], CH=(a,b=99)=>()=>(S.ch||1)>=a&&(S.ch||1)<=b, Q=(id,st)=>()=>qState(id)===st;
const MIO=()=>memberOf('mio')||(S.away&&S.away.mio);
const MN=()=>S.flags.mioNamed?'ミオ':'かげのこ';
function room(id,name,rows,o={}){MAPS[id]=Object.assign({id,name,rows,out:'無',bgm:'town',objs:[],npcs:[],chests:[],links:{},interior:1,entry:[Math.floor(rows[0].length/2),rows.length-2,'up']},o); return MAPS[id];}
function addDoor(mapId,x,y,to,tx,ty,dir){const m=MAPS[mapId]; const r=m.rows[y]; m.rows[y]=r.slice(0,x)+'戸'+r.slice(x+1); m.links[`${x},${y}`]=[to,tx,ty,dir];}
function bldMap(townId,t,nth=0){const ids=Object.keys(MAPS).filter(k=>k.startsWith(townId+'_')&&MAPS[k].interior&&MAPS[k].name.includes(BLD_LABEL[t]||t)); return ids[nth];}
const GOALS={};

/* ---------- 1しょう ともしびの まち ---------- */
function defineCh1(){
  buildTown({id:'akari',name:'ともしびの まち アカリ',type:'harbor',w:34,seed:101,bands:['park','bld','road','plaza','bld','road','pier'],landmark:'lighthouse',
    roofs:['青','白'],trees:['Y'],sign:'ともしびの まち アカリ　―きたは はなの むら フローラ―',barrels:3,pots:2,loot:['herb','frag',{gold:15}],
    bld:[
      {t:'house',name:'じぶんの いえ',beds:2,npcs:[{id:'mother',pal:'granny',dir:'down',talk:motherTalk}],loot:['herb','frag'],book:'ふたりの こどもが てを つないだ え。 ひとりは じぶん。 もう ひとりは… だれだろう？'},
      {t:'inn',price:4},{t:'item',goods:['herb','antidote','wing','smoke']},{t:'arms',goods:['sword1','knife1','staff1','heavy1','light1','robe1','shield1']},
      {t:'church',book:'「ひとは にど しぬ。 いちどめは いのちが つきた とき。 にどめは だれにも なまえを よばれなくなった とき」'},
      {t:'hall',talk:mayorAkari,pal:'elder',book:'アカリの とうだいは、 せんねんまえの ほしかげの ゆうしゃが ともした ひを まもっている という。'},
      {t:'bar',npcs:[{pal:'sailor',talk:by([CH(9),['「あんたの とうちゃんの ふね、 まだ うごくんだってな！ しんじられねえ。」']],[true,['「とうだいもりの だんなが うみに でて 5ねん… あんな いい ひとが いなくなるとはなあ。」','「…あれ、 だんなの むすめさんの なまえ… なんだっけ。 むすこの おまえしか いなかったか？」']])},
        {pal:'woman',talk:by([true,['「さいきん、 ひとが きえる うわさが あるの。 きえた ひとの ことは、 みんな すぐ わすれちゃう んですって。」']])}]},
      {t:'house',npcs:[{pal:'sage',id:'fisher',talk:fisherTalk}],loot:['herb2']},
    ],
    npcs:[
      {at:'gate',pal:'guard',talk:by([CH(2),['「きたの フローラむらへは みちなりに すすめば いい。 もりには ちかよるなよ。」']],[true,['「よるに なると、 さんばしの あたりで ふしぎな こえが する らしいぜ。」']])},
      {at:'plaza',pal:'kid',wander:1,talk:by([F('mioNamed'),['「ミオねえちゃん、 おかえり！ …あれ、 なんで ぼく わすれてたんだろう？」']],[true,['「とうだいの ひかりって、 どこまで とどくのかな？」','「…ねえ、 きみ だれと はなしてるの？ だれも いないよ？」']])},
      {at:'plaza',pal:'woman',wander:1,talk:by([true,['「この まちは とうだいの まち。 よるでも ひかりが たえないのが じまんなの。」']])},
      {at:'pier',pal:'sailor',talk:by([CH(9),['「ふねは さんばしの はしに つないで ある。 のりこめば すぐ でられるぞ。」']],[true,['「うみべの どうくつに、 くろい かげが はいっていくのを みたんだ。」','「まちの にしの いわばだよ。 …こわくて ちかよれねえ。」']])},
      {at:'pier',id:'shadowgirl',pal:'mio',shadow:1,time:'night',cond:()=>!S.flags.metMio,talk:metMio},
    ]});
  // とうだい（ランドマークの なか）
  const A=MAPS.akari, lm=A.marks.find(m=>m.kind==='lighthouse');
  room('akari_lh','アカリの とうだい',["WWWWWWW","WfffffW","Wf...fW","WfffffW","WfffffW","WWW出WWW"].map(r=>r.replace(/\./g,'f')),{objs:[{x:1,y:1,k:'shelf',text:'とうだいもりの にっし。「いもうとの ミ… が うみを みて わらった」 …なまえの ところが にじんで よめない。'},{x:5,y:1,k:'drawer'}]});
  MAPS.akari_lh.objs[1].loot='frag';
  MAPS.akari_lh.npcs.push({x:3,y:2,pal:'sage',dir:'down',talk:by([CH(8),lhKeeperCh8],[true,['とうだいの せわを している おじいさん「おまえの とうちゃんが いなくなってから、 わしが ひを まもっとる。」','「ひかりは まいばん ともす。 だれかが かえって くるかも しれんからな。」']])});
  addDoor('akari',lm.x,lm.y+lm.h-1,'akari_lh',3,4,'up'); MAPS.akari_lh.links['3,5']=['akari',lm.x,lm.y+lm.h,'down'];
  icon('world',16,106,'G','akari');
  // うみべの どうくつ
  DUNGEONS.push({id:'seacave',name:'うみべの どうくつ',floors:2,w:19,h:13,wall:'J',floor:'j',rooms:1,loops:.08,zone:'seacave',area:'lake',seed:111,per:2,
    loot:['herb','fisherCharm',{gold:40},'frag'],feat:['secret',''],boss:'kobun',reward:'herb2',
    intro:['「ククク… なまえを なくした ちびすけと、 みょうな にんげんが きたか。」','「わしは なまえくいさまの こぶん。 おまえの なまえも いただくぞ！」']});
  icon('world',8,110,'C','seacave1');
  QUESTS.charm={t:'りょうしの おまもり',g:'りょうしの じいさん',area:'アカリ',steps:['うみべの どうくつで、 りょうしの じいさんの おまもりを さがす。','おまもりを りょうしの じいさんに とどける。']};
  IT.fisherCharm={n:'りょうしの おまもり',key:1,d:'なみの もようが ほられた ちいさな おまもり。'};
  MON.kobun=B_(Object.assign({n:'なまえくいの こぶん',s:'shade',p:{1:'#3a3a5a',2:'#1a1a3a',e:'#ff4040'},scale:3.6},bstat(4,1,{turns:8,atk:.8}),{
    phases:[{moves:[M_('attack',4),M_('sleep1',2,'こぶんは わすれの うたを うたった！'),M_('mag',2,'こぶんは かげの つぶてを なげた！',{f:.12})]},
            {at:.5,acts:.2,say:'こぶん「ぐぐ… なまえを よこせ！」',moves:[M_('attack',4),M_('charge',1,'こぶんは ちからを ためている…'),M_('mag',2,'こぶんは かげの つぶてを なげた！',{f:.13})]}]}));
  GOALS[1]=()=>!S.flags.metMio?'よるに なったら、 アカリの さんばしへ いってみよう。（やどやで「よるまで」やすむと よるに なる。 そとを あるいても じかんが すすむ）'
    :!S.flags.boss_seacave?'まちの にしの『うみべの どうくつ』へ。 なまえくいの こぶんを おいかけよう。':'アカリの やくばで ちょうちょうに はなしを きこう。';
}
async function motherTalk(){
  if(S.flags.mioNamed){await lines(['はは「ミオ… ミオ！ ああ、 どうして わすれて いたの…」','はは「おかえり。 ふたりとも、 わたしの だいじな こどもよ。」']); return;}
  if((S.ch||1)>=2){await lines(['はは「あら、 また 3にんぶん おさらを ならべちゃった。 …へんね、 うちは ふたりきりなのに。」','はは「きを つけて いってらっしゃい。」']); return;}
  await lines(['はは「おはよう。 …あら？ どうして わたし、 おさらを 3まい ならべたのかしら。」','はは「とうさんが うみに でて 5ねん。 ふたりきりの まいにちにも なれたのにね。」','はは「さんばしの あたり、 よるは あぶないから きを つけるのよ。」']);
}
async function metMio(n){
  msgClear();
  await say('……さんばしの さきに、 すきとおった おんなのこが たっている。');
  emote(n,'！');
  await say('？？？「…え？ あなた、 わたしが みえるの？」');
  await say('？？？「わたし… なまえが ないの。 なにも おもいだせない。 だれも わたしを みてくれない。」');
  await say('？？？「でも、 あなたを みてると… なんだか なつかしい きが する。」');
  await say('？？？「さっき、 くろい かげが まちの にしの どうくつへ はいっていったの。 あれが わたしの なまえを もっていった きがする…」');
  await say('？？？「おねがい。 いっしょに きて くれる？」',{wait:'none'});
  await yesNo(); msgClear();
  await say('？？？「…ありがとう。 なまえが ないと よびにくいよね。 『かげのこ』って よんで。」');
  S.flags.metMio=1;
  const m=await joinParty('mio','かげのこ',1,{w:'staff1',a:'robe1'},{shadow:1});
  await say('（かげのこは ほかの ひとには みえない。 でも せんとうでは いっしょに たたかって くれる）');
  msgClose();
}
async function fisherTalk(){
  if(qState('trade')===0&&!has('tako')){addItem('tako'); qSet('trade',1); msgClear(); await say('りょうし「ひかりダコ？ ああ、 ゆうべ とれたのが あるよ。 もっていきな。」'); sfx.chest(); await say('ひかりダコを てにいれた！'); msgClose(); return;}
  if(qState('charm')==='done'){await lines(['りょうし「おまもりの おかげで、 うみが やさしく なった きが するよ。」']); return;}
  if(has('fisherCharm')){delItem('fisherCharm'); msgClear(); await say('りょうし「おお、 わしの おまもり！ どうくつに おとして しまっていたのか。」'); await say('りょうし「これは つまの かたみでな… なまえも かおも まだ おぼえておる。 ありがとう。」'); await qDone('charm','frag'); msgClose(); return;}
  qStart('charm'); await lines(['りょうし「わしは もう ながいこと りょうしを やっとる。」','りょうし「うみべの どうくつで、 つまの かたみの おまもりを おとしてしまってな… もし みつけたら とどけて くれんか。」']);
}
async function mayorAkari(){
  msgClear();
  if((S.ch||1)===1&&S.flags.boss_seacave){
    await say('ちょうちょう「どうくつの まものを たおした？ …きみ ひとりで？」');
    await say('ちょうちょう「じつは きたの フローラむらから しらせが あってな。 まいとしの はなまつりが ひらけない らしい。」');
    await say('ちょうちょう「まつりの『はなの むすめ』が だれだったか、 むらの だれも おもいだせない というのだ。」');
    await say('かげのこ「…なまえを たべられた ひとが いるんだ。 いってみよう。」');
    S.gold+=60; sfx.chest(); await say(`${HN()}は 60ゴールドを うけとった！`); msgClose(); await startChapter(2); return;
  }
  if((S.ch||1)>=9){await say('ちょうちょう「ミオちゃんの こと… まちじゅうで おもいだしたよ。 わしらは なんと ひどい ことを。」'); msgClose(); return;}
  await say('ちょうちょう「わしは アカリの ちょうちょう。 さいきん まちで、 なにかを わすれている きが すると いう ものが おおくてな。」'); msgClose();
}

/* ---------- 2しょう はなまつりの むら ---------- */
function defineCh2(){
  buildTown({id:'flora',name:'はなさく むら フローラ',type:'village',w:30,seed:202,landmark:'windmill',bands:['farm','bld','road','plaza','bld','road','farm'],roofs:['赤','藁'],trees:['Y','F'],flower:'F',
    sign:'はなさく むら フローラ　―にしに まよいの もり／きたは ゴルド（くさむらで とおれない）―',barrels:2,pots:2,loot:['frag','songLyric1',{gold:20}],
    bld:[{t:'house',name:'はなの むすめの いえ',npcs:[],book:'にっき。「ことしも はなの かんむりを あめる。 わたしの なまえは リ…」 …なまえの ぶぶんが きえている。',loot:['frag']},
      {t:'inn',price:5},{t:'item',goods:['herb','antidote','bell','wing','smoke']},{t:'arms',goods:['sword2','knife2','staff2','heavy2','light2','robe2','shield2']},
      {t:'house',name:'むらおさの いえ',npcs:[{id:'floraElder',pal:'elder',talk:floraElder}]},
      {t:'house',npcs:[{pal:'woman',talk:by([true,['「はなの かんむりを かぶる ひとが いたはず なのに、 どうしても かおが おもいだせないの。」']])}],loot:['herb2']}],
    npcs:[
      {at:'plaza',pal:'kid',talk:songKid},
      {at:'farm',pal:'merchant',talk:by([F('boss_forest'),['「はなが いっせいに さいた！ ことしも まつりが できるぞ！」']],[true,['「ことしは はなが さかないんだ。 まつりの まえは いつも まんかい なのに。」']])},
      {at:'road',pal:'guard',talk:by([F('sickle'),['「その かまで きたの くさむらを かれば、 ゴルドの まちへ いけるぞ。」']],[true,['「きたへの みちは くさむらで ふさがって いてな。 かる どうぐが あれば…」']])},
      {at:'plaza',id:'maidenShadow',pal:'woman',shadow:1,time:'night',cond:()=>!S.flags.boss_forest,talk:by([true,['かげの むすめ「…はなが さかない。 わたしの なまえが、 もりの おくへ もっていかれたの。」','かげの むすめ「もりの ぬしが、 なまえを ねっこに うめて しまった…」']])},
      {at:'plaza',id:'maiden',pal:'woman',cond:F('boss_forest'),talk:by([true,['リナ「わたしは リナ。 はなの むすめよ。 なまえを とりもどして くれて ありがとう！」','リナ「みて、 むらじゅうの はなが さいたわ。」']])},
    ]});
  icon('world',30,96,'V','flora');
  DUNGEONS.push({id:'forest',name:'まよいの もり',floors:3,w:21,h:15,wall:'Y',floor:'.',rooms:2,loops:.1,zone:'forest',area:'forest',seed:202,per:2,
    loot:['herb','antidote','frag',{gold:60},'herb2','songLyric2'],feat:['','switch','secret'],boss:'morinushi',reward:'frag',
    intro:['「…ザワザワ… わしの もりを あらす ものは だれじゃ…」','もりの ぬし「この むすめの なまえは、 もりの こやしに するのじゃ！」']});
  icon('world',20,86,'C','forest1');
  MON.morinushi=B_(Object.assign({n:'もりの ぬし',s:'treant',p:{1:'#6a4a2a',2:'#2a6a2a',e:'#ffe040'},scale:4},bstat(7,2,{turns:10}),{
    phases:[{moves:[M_('attack',4),M_('poison',2,'ぬしは とげの つたで しめつけた！'),M_('sleepAll',1,'ぬしは ねむりの かふんを まいた！',{ch:.25})]},
            {at:.5,acts:.25,say:'もりの ぬし「ぐぬぬ… ねっこよ、 ちからを かせ！」',moves:[M_('attack',3),M_('heal',1,'ぬしは だいちから ちからを すいあげた！',{f:.1,max:1}),
              M_('prep',2,'ぬしは えだを おおきく ふりあげた！',{next:M_('breath',0,'ぬしの だいちを ゆらす いちげき！',{f:.25})})]}]}));
  QUESTS.song={t:'わすれられた うた',g:'フローラの こども',area:'フローラ',steps:['こどもが うたう まつりの うたには ぬけた ところが ある。 かしを さがそう。（2まい）','あつめた かしを こどもに とどける。']};
  IT.songLyric1={n:'うたの かし（1）',key:1,d:'「はなの かんむり あたまに のせて」'};
  IT.songLyric2={n:'うたの かし（2）',key:1,d:'「なまえを よんで ほしが わらう」'};
  GOALS[2]=()=>!S.flags.boss_forest?'フローラむらの にしの『まよいの もり』の おくで、 もりの ぬしから はなの むすめの なまえを とりもどそう。（よるの むらにも なにか あるかも）'
    :!S.flags.sickle?'フローラむらの むらおさに ほうこくしよう。':'もらった かまで きたの くさむらを かり、 いわの まち ゴルドへ むかおう。';
}
async function songKid(){
  const st=qState('song');
  if(st==='done'){await lines(['こども「♪はなの かんむり あたまに のせて、 なまえを よんで ほしが わらう♪ …ぜんぶ うたえた！」']); return;}
  if(has('songLyric1')&&has('songLyric2')){delItem('songLyric1'); delItem('songLyric2'); msgClear(); await say('こども「かしが ぜんぶ そろった！ ♪はなの かんむり あたまに のせて、 なまえを よんで ほしが わらう♪」'); await say('こども「これ、 リナおねえちゃんが おしえて くれた うただ…！ ありがとう！」'); await qDone('song','fseed1'); msgClose(); return;}
  qStart('song'); await lines(['こども「♪はなの … あたまに のせて、 …を よんで ほしが わらう♪」','こども「まつりの うたなのに、 ところどころ おもいだせないの。 だれかが かしを かいた かみを もってないかなあ。」']);
}
async function floraElder(){
  msgClear();
  if(S.flags.boss_forest&&!S.flags.sickle){
    await say('むらおさ「リナの なまえが もどり、 はなが さいた！ ことしも まつりが できる。 ほんとうに ありがとう。」');
    await say('むらおさ「おれいに これを。 むかし ゆうしゃが つかったと いわれる くさかりの かまじゃ。」');
    S.flags.sickle=1; S.abil=S.abil||{}; S.abil.sickle=1; sfx.lvl(); await say(`${HN()}は『ほしかげの かま』を てにいれた！ くさむらを かりとれる ように なった。`);
    await say('むらおさ「きたの くさむらを かれば、 いわの まち ゴルドへ いける。 ゴルドでも ひとが きえていると きいた。」');
    msgClose(); await startChapter(3); return;
  }
  await say('むらおさ「まつりの『はなの むすめ』が だれだったか、 どうしても おもいだせんのじゃ。」');
  await say('むらおさ「むすめが いなければ、 はなは ひらかぬ。 …あの いえに すんでいたのは、 だれだったかのう。」');
  msgClose();
}

/* ---------- 3しょう いわの まち ---------- */
function defineCh3(){
  buildTown({id:'golde',name:'いわの まち ゴルド',type:'street',w:34,seed:303,landmark:'headframe',bands:['park','bld','road','plaza','bld','road'],roofs:['黒','赤'],trees:['Y'],plaza:'道',brick:1,
    sign:'いわの まち ゴルド　―きたにしに ゴルド こうざん／ひがしは いわで ふさがっている―',barrels:3,pots:1,loot:['frag',{gold:40},'herb2'],
    bld:[{t:'bar',name:'こうふの さかば',npcs:[{id:'garmBar',pal:'garm',cond:()=>!S.flags.join_garm,talk:garmBar},{pal:'merchant',talk:by([true,['「こうざんが くずれて、 なかに こうふが とじこめられたんだ。」','「…でも おかしいんだ。 だれが とじこめられたのか、 なまえが でてこない。」']])}]},
      {t:'inn',price:6},{t:'item',goods:['herb','herb2','antidote','bell','wing','smoke']},{t:'forge',goods:['sword3','knife3','axe2','staff2','heavy3','light3','robe3','shield3']},
      {t:'house',npcs:[{id:'minerWife',pal:'woman',talk:minerWife}],loot:['frag']},{t:'hall',talk:by([true,['こうざんちょう「こうざんの おくに『いわくい』と いう まものが すみついた らしい。」','「たのむ、 こうふたちを たすけて くれ。 こうざんは まちの きたにしだ。」']]),pal:'elder'},
      {t:'house',npcs:[{pal:'kid',talk:by([true,['「とうちゃんの なまえが おもいだせない… でも、 とうちゃんの おべんとうばこは ここに あるんだ。」']])}],loot:['herb']}],
    npcs:[{at:'plaza',pal:'merchant',wander:1,talk:by([true,['「この まちの しょうばいは ぜんぶ こうざん しだい。 こうざんが とまれば まちも とまる。」']])},
      {at:'road',pal:'guard',talk:by([F('hammer'),['「その ハンマーなら、 ひがしの いわも こわせるんじゃないか？」']],[true,['「ひがしの みちは おおいわで ふさがってる。 こうざんの ハンマーでも あれば…」']])}]});
  icon('world',46,70,'G','golde');
  DUNGEONS.push({id:'mine',name:'ゴルド こうざん',floors:3,w:21,h:15,wall:'#',floor:',',rooms:2,loops:.08,zone:'mine',area:'cave',seed:303,per:2,
    loot:['hammerItem','herb2','frag',{gold:90},'antidote','frag'],feat:['','lock crack','crack'],boss:'iwakui',reward:'frag',mid:{floor:2,mon:'minegolem',intro:['こうざんゴーレムが みちを ふさいでいる！']},
    intro:['「ガリガリ… なまえは いしより うまい…」','いわくい「おまえたちの なまえも いただこう！」']});
  icon('world',38,63,'C','mine1');
  IT.hammerItem={n:'こうざんの ハンマー',key:1,d:'ひびの はいった いわを くだける ハンマー。'};
  MON.minegolem=B_(Object.assign({n:'こうざんゴーレム',s:'golem',p:{1:'#8a7a6a',2:'#5a4a3a',e:'#ff4020'},scale:3.4},bstat(9,3,{turns:7,expMul:.6}),{phases:[{moves:[M_('attack',4),M_('charge',2,'ゴーレムは ちからを ためている…')]}]}));
  MON.iwakui=B_(Object.assign({n:'いわくい',s:'golem',p:{1:'#6a5a4a',2:'#3a2a1a',e:'#ff2040'},p2:{1:'#8a3a2a',2:'#5a1a0a',e:'#ffff40'},scale:4},bstat(10,3,{turns:11}),{
    phases:[{moves:[M_('attack',4),M_('charge',2,'いわくいは いわを かみくだいている…'),M_('breath',1,'いわくいは いわを はきだした！',{f:.11})]},
            {at:.5,alt:1,acts:.3,say:'いわくい「ガリガリ… もっと なまえを…！」',moves:[M_('attack',3),M_('breath',2,'いわくいは いわを はきだした！',{f:.12}),
              M_('prep',2,'いわくいは おおきく くちを あけた！',{next:M_('breath',0,'いわくいの らくばん！',{f:.26})})]}]}));
  QUESTS.lunch={t:'こうふの おべんとう',g:'こうふの つま',area:'ゴルド',steps:['こうふの つまから おべんとうを あずかる。','こうざんから かえった こうふに おべんとうを とどける。']};
  IT.lunch={n:'こうふの おべんとう',key:1,d:'まだ あたたかい おべんとう。'};
  GOALS[3]=()=>!S.flags.boss_mine?'ゴルドの きたにしの『ゴルド こうざん』へ。 いわくいを たおし、 こうふたちを たすけよう。':'ゴルドの いわ（ひがし）を ハンマーで こわし、 かわの せきしょへ むかおう。';
}
async function garmBar(){
  msgClear();
  if(!S.flags.boss_mine){
    await say('よっぱらいの きし「…なんだ、 こぞう。 さけの じゃまを するな。」');
    await say('よっぱらいの きし「おれは ガルム。 むかしは きしだった。 …なにかを まもると ちかった はずなのに、 なにを ちかったのか おもいだせん。」');
    await say('ガルム「こうざん？ かってに いけ。 …おれには かんけいない。」'); msgClose(); return;
  }
  await say('ガルム「…こうざんから こうふたちを つれかえった だと？ そんな ちいさな なりで。」');
  await say('ガルム「おまえを みてると、 なにかを おもいだしそうに なる。 『まもる』… そうだ、 おれは だれかを まもると ちかったんだ。」');
  await say('ガルム「その ちかいを おもいだす まで、 おまえの たてに なろう。 つれていけ。」',{wait:'none'});
  await yesNo(); msgClear();
  await say('ガルム「よし。 …そこの すきとおった じょうちゃんも、 よろしくな。」');
  await say('かげのこ「えっ… わたしが みえるの？」');
  await say('ガルム「うっすらと だがな。 なまえを わすれた もの どうし、 なにか かんじるのかも しれん。」');
  await joinParty('garm','ガルム',8,{w:'axe2',a:'heavy2',s:'shield2'});
  await say('ガルム「ひがしの いわを こわせば、 かわの せきしょへ いける。 そこを こえれば おおきな まちが ある。」');
  msgClose(); await startChapter(4);
}
async function minerWife(){
  const st=qState('lunch');
  if(st==='done'){await lines(['「おべんとうばこ、 からっぽで かえって きたわ。 ふふ。」']); return;}
  if(st==null){qStart('lunch'); addItem('lunch'); await lines(['「おっとが こうざんに とじこめられて いるの。 …なまえが おもいだせない けど、 だいじな ひとよ。」','「もし あえたら、 この おべんとうを わたして。」','（こうふの おべんとうを あずかった）']); return;}
  await lines(['「おっとは まだ こうざんの なかに いるの…」']);
}
