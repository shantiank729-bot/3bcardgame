/* =========================================================
   だい2ぶ　うみの むこうの なまえ（9〜16しょう）
   ========================================================= */
// かいだんを たてものの なかに おく（ダンジョンへの いりぐち）
function stairsIn(mapId,x,y,to,gate){const m=MAPS[mapId]; m.rows[y]=m.rows[y].slice(0,x)+'d'+m.rows[y].slice(x+1); m.links[`${x},${y}`]=[to,0,0]; if(gate) LINK_GATE[`${mapId}:${x},${y}`]=gate; return [mapId,x-1,y,'left'];}

/* ---------- 9しょう しまの さいばん ---------- */
function defineCh9(){
  buildTown({id:'namino',name:'しまの まち ナミノ',type:'harbor',w:32,seed:909,ground:':',landmark:'mast',bands:['park','bld','road','bld','road','pier'],roofs:['白','青'],trees:['k'],
    sign:'しまの まち ナミノ　―ひがしの いわばに しおだまりの どうくつ―',barrels:3,pots:3,loot:['ev2','frag','herb2'],
    bld:[{t:'hall',name:'さいばんしょ',talk:trialTalk,pal:'elder',book:'しまの おきて。「なまえを たべた ものは しまを おわれる」'},{t:'inn',price:12},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','wing','smoke']},
      {t:'arms',goods:['sword7','knife7','axe6','staff6','heavy7','light7','robe7','shield7']},{t:'house',name:'まじょの いえ',npcs:[{id:'olgaHome',pal:'olga',cond:()=>!S.flags.olgaFree&&!S.flags.join_olga,talk:olgaJail}],book:'くすりの ちょうごうしょ。「ネネの ために ねつさましを」 …ネネ？',loot:['frag']},
      {t:'church'},{t:'bar',npcs:[{pal:'sailor',talk:by([true,['「まじょの オルガが、 しまの ものの なまえを くっている って もっぱらの うわさだ。」','「…でも、 あの ばあさんの くすりに たすけられた やつも おおいんだがな。」']])}]}],
    npcs:[{at:'pier',pal:'sailor',talk:by([true,['「ナミノは うみの まち。 ここから さきの うみは、 よる まものが おおいぞ。」','「ひがしの おきには よるだけ、 ぼろぼろの ふねが うかんで いるとか…」']])},
      {at:'road',pal:'kid',time:'night',talk:evidenceKid},
      {at:'road',pal:'woman',talk:by([F('olgaFree'),['「まじょさんが むじつだった なんて… わたし、 あやまらなきゃ。」']],[true,['「さいきん、 しおだまりの どうくつの ほうから、 よるに ひかりが みえるの。」']])}]});
  icon('world',116,104,'1','namino');
  // しょうこ：あしあと（せかいの きらきら）、 かいがら（つぼ）、 こどもの しょうげん（よる）
  MAPS.world.hid=MAPS.world.hid||[]; MAPS.world.hid.push({id:'ev1',x:120,y:106,loot:'ev1'});
  IT.ev1={n:'なぞの あしあとの かた',key:1,d:'どうくつへ つづく、 ひとでは ない あしあと。'};
  IT.ev2={n:'ぬれた かいがら',key:1,d:'しおだまりの どうくつに しか ない かいがら。 まじょの いえから とおい ばしょに おちていた。'};
  IT.ev3={n:'こどもの しょうげん',key:1,d:'「よるに うみから でてきた おおきな かげが、 ひとの なまえを すってた」'};
  DUNGEONS.push({id:'tide',name:'しおだまりの どうくつ',floors:3,w:21,h:15,wall:'J',floor:'j',rooms:2,loops:.08,zone:'tide',area:'lake',seed:909,per:2,
    loot:['herb2','frag',{gold:400},'drop','frag','life'],feat:['switch','lock secret','lock'],boss:'majuu',reward:'frag',
    intro:['「…ゴボ… ばれて しまったか…」','うみの まじゅう「まじょに つみを きせ、 しまの なまえを くらう けいかくが…！ みんな のみこんで やる！」']});
  icon('world',122,108,'6','tide1');
  MON.majuu=B_(Object.assign({n:'うみの まじゅう',s:'frog',p:{1:'#2a5a8a',2:'#80b0d0',3:'#ff6080',e:'#ffe040'},scale:4},bstat(24,9,{turns:12}),{
    phases:[{moves:[M_('attack',4),M_('breath',3,'まじゅうは うずしおを おこした！',{f:.13}),M_('poison',2,'まじゅうは どくの したを のばした！')]},
            {at:.5,acts:.4,say:'まじゅう「ゴボボ！ うみの そこへ！」',moves:[M_('attack',3),M_('sleepAll',1,'まじゅうは なみの うたを うたった！',{ch:.3}),M_('breath',2,'まじゅうは うずしおを おこした！',{f:.14}),
              M_('prep',2,'まじゅうは ふかく いきを すいこんだ…',{next:M_('breath',0,'まじゅうの だいつなみ！',{f:.28})})]}]}));
  GOALS[9]=()=>!S.flags.olgaFree?'ナミノの まじょ オルガの むじつを しめす しょうこを 3つ あつめ、 さいばんしょへ。（あしあと・かいがら・よるの しょうげん）'
    :!S.flags.boss_tide?'まちの ひがしの『しおだまりの どうくつ』で しんはんにんを たおそう。':'ふねで ひがしの おきへ。 よるに なにかが あらわれる らしい。';
}
async function evidenceKid(){
  if(has('ev3')||S.flags.olgaFree){await lines(['こども「まじょの おばあちゃん、 たすかると いいな。」']); return;}
  msgClear(); await say('こども「…ないしょ だよ。 よるに うみから おおきな かげが でてきて、 ひとの なまえを すってたの。」'); await say('こども「まじょの おばあちゃんじゃ なかった。 ぼく、 みたもん。」');
  addItem('ev3'); sfx.chest(); await say('しょうこ『こどもの しょうげん』を てにいれた！'); msgClose();
}
async function olgaJail(){await lines(['まじょ オルガ「…わたしは なにも くっちゃ いないよ。 でも だれも しんじて くれやしない。」','オルガ「さいばんは あした。 しょうこでも なけりゃ、 しまを おわれる だけさ。」']);}
async function trialTalk(){
  msgClear();
  if(S.flags.olgaFree){await say('さいばんかん「まじょ オルガは むじつ。 しまの ものは みな あやまらねば ならん。」'); msgClose(); return;}
  const n=['ev1','ev2','ev3'].filter(has).length;
  if(n<3){await say(`さいばんかん「まじょ オルガの さいばんを ひらく。 …だが べんごの しょうこが たりぬようだな。（${n}／3）」`); await say('さいばんかん「しょうこを そろえて また くるが よい。」'); msgClose(); return;}
  await say('さいばんかん「では さいばんを はじめる。 まじょ オルガは しまの ものの なまえを くった。 はんろん するか？」');
  const Qs=[['さいばんかん「はんにんは にんげんの あしで どうくつへ にげた という。 これに はんろん する しょうこは？」','ev1'],
    ['さいばんかん「はんにんは まじょの いえから でてきた という。 はんろんは？」','ev2'],['さいばんかん「だれも はんにんを みて いない。 ちがうか？」','ev3']];
  for(const [q,ans] of Qs){
    while(true){
      msgClear(); await say(q,{wait:'none'});
      const items=['ev1','ev2','ev3'].map(id=>({id,label:IT[id].n}));
      const m=new Menu({title:'しょうこを つきつける',items,style:{left:'6%',top:'6%',width:'88%'},desc:i=>IT[items[i].id].d}); const i=await m.pick(); m.close();
      if(i>=0&&items[i].id===ans){sfx.ok(); flash('#ffffff',200); await say('その しょうこが、 ぎもんを うちくだいた！',{wait:'auto'}); break;}
      sfx.bump(); shake(); await say('さいばんかん「…その しょうこでは はんろんに ならん！」');
    }
  }
  for(const id of ['ev1','ev2','ev3']) delItem(id);
  await say('さいばんかん「…しょうこは そろった。 まじょ オルガは むじつ！ しんはんにんは しおだまりの どうくつに いる！」');
  S.flags.olgaFree=1; await say('オルガ「…ふん。 たすけて くれた れいは いう。 あんたたち、 なまえくいを おってるんだろ？」');
  await say('オルガ「わたしも いくよ。 くすりと まじないなら まかせな。 …わすれて いる なにかを、 わたしも とりもどしたい。」');
  await joinParty('olga','オルガ',22,{w:'staff6',a:'robe6'}); msgClose(); loadNPCs();
}

/* ---------- 10しょう ゆうれいせん ---------- */
function defineCh10(){
  room('gship_deck','ゆうれいせんの かんぱん',["WWWWWWWWWWWWW","WfffffffffffW","WfffffffffffW","WfffffffffffW","WfffffffffffW","WfffffffffffW","WWWWWW出WWWWWW"],{bgm:'dungeon',floor:'f',
    objs:[{x:1,y:1,k:'barrel',loot:'frag'},{x:11,y:1,k:'barrel'},{x:1,y:5,k:'crate',loot:'herb3'}],
    npcs:[{x:6,y:2,pal:'sailor',shadow:1,talk:by([F('boss_gship'),['ゆうれいの すいふ「せんちょうの なまえが もどった。 これで ようやく みなとへ かえれる…」']],[true,['ゆうれいの すいふ「…この ふねは 100ねん うみを さまよって いる。 せんちょうの なまえが、 ふなぞこの くろい けんしに うばわれて…」']])}]});
  const gx=132,gy=92;
  icon('world',gx,gy,'~','gship_deck',{entry:[6,5,'up'],gate:()=>isNight()||S.flags.boss_gship?null:['……うみは しずかだ。 よるに なると なにかが あらわれる らしい。']});
  MAPS.gship_deck.links['6,6']=['world',gx,gy+1,'down'];
  const [fx,fy,fd]=[11,4,'left']; const from=stairsIn('gship_deck',11,4,'gship1');
  DUNGEONS.push({id:'gship',name:'ゆうれいせん',floors:3,w:19,h:13,wall:'W',floor:'f',rooms:2,loops:.07,zone:'gship',area:'crypt',seed:1010,per:2,from:['gship_deck',10,4,'left'],
    loot:['herb3','frag',{gold:500},'drop','life','frag'],feat:['lock','switch secret','lock'],darkAll:1,boss:'jin2',group:['jin2','captain'],reward:'frag',
    intro:['ジン「…また おまえたちか。」','ジン「この ふねの せんちょうの なまえは、 ムメイさまへの みつぎもの。 わたさん。」','ゆうれいせんちょう「なまえ… わしの なまえ…！」']});
  MON.jin2=B_(Object.assign({n:'けんし ジン',s:'knight',p:{1:'#3a3a4a',2:'#1a1a2a',3:'#c04060',e:'#ffe040'},scale:3.3},bstat(26,10,{turns:7}),{
    phases:[{moves:[M_('attack',5),M_('str',2,'ジンの いあいぎり！'),M_('breath',1,'ジンの つばめがえし！',{f:.13}),M_('charge',1,'ジンは しずかに かたなを かまえた…')]}]}));
  MON.captain=B_(Object.assign({n:'ゆうれいせんちょう',s:'skel',p:{w:'#c8d0e0',2:'#2a3a5a',e:'#40ffd0'},scale:3.3},bstat(26,10,{turns:6,atk:.85}),{
    phases:[{moves:[M_('attack',3),M_('sleepAll',2,'せんちょうは のろいの うたを うたった！',{ch:.3}),M_('mist',2,'せんちょうは しおからい きりを はいた！',{f:.09})]}]}));
  GOALS[10]=()=>!S.flags.boss_gship?'よるに ナミノの ひがしの おきへ ふねで むかい、 ゆうれいせんに のりこもう。':'ふねで きたの こおりの くにへ。';
}

/* ---------- 11しょう こおりの おうさま ---------- */
function defineCh11(){
  buildTown({id:'icetown',name:'ひょうけつの みやこ',type:'castle',w:30,seed:1111,ground:'z',road:'道',bands:['castle','road','bld','road','plaza','bld','road'],roofs:['白','青'],trees:['y'],edge:'y',plaza:'s',landmark:'igloo',
    castle:{name:'ひょうけつの しろの ひろま',npcs:[{id:'fakeking',pal:'king',at:[8,2],cond:NF('boss_icecastle'),talk:fakeKingTalk},{id:'realking',pal:'king',at:[8,2],cond:F('boss_icecastle'),talk:by([true,['こおりの おう「わしの なまえは アイスバーン。 この くにの おうじゃ。 …おまえたちの おかげで おもいだせた。」']])}]},
    sign:'ひょうけつの みやこ　―きたに ひょうけつの しろ―',barrels:2,pots:2,loot:['frag','herb3'],
    bld:[{t:'inn',price:14},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','wing','smoke']},{t:'arms',goods:['sword8','knife8','axe7','staff7','heavy8','light8','robe8','shield8']},
      {t:'house',name:'ろうじんの いえ',npcs:[{id:'beggar',pal:'sage',cond:()=>!S.guest&&!S.flags.boss_icecastle,talk:beggarKing}],book:'くにの しょうぞうが。 えがかれた おうの かおは、 なぜか この いえの ろうじんに そっくりだ。',loot:['frag']},
      {t:'church'},{t:'bar',npcs:[{pal:'guard',talk:by([true,['「さいきんの おうさまは まるで べつじん だ。 ぜいきんは あがるし、 ひとは きえるし…」']])}]}],
    npcs:[{at:'road',pal:'kid',talk:by([true,['「おうさまの しょうぞうがと そっくりな おじいさんが、 まちの いえに いるよ。 だれも しらないって いうけど…」']])},
      {at:'plaza',pal:'woman',talk:by([true,['「しろの うらから はいれる ちかどうが ある って うわさ。 でも こおりで すべって あぶないわ。」']])}]});
  icon('world',40,22,'K','icetown');
  DUNGEONS.push({id:'icecastle',name:'ひょうけつの しろ',floors:3,w:21,h:15,wall:'h',floor:'g',rooms:2,loops:.07,up:1,zone:'icecastle',area:'ice',seed:1111,per:2,
    loot:['herb3','frag',{gold:600},'drop','life','frag'],feat:['lock','switch','lock secret'],boss:'fakeking2',reward:'frag',
    intro:['にせの おう「…ほんものを つれて きたか。 だが もう おそい。」','にせの おう「この くにの なまえは すべて わたしが もらう！」']});
  icon('world',50,12,'7','icecastle1',{gate:()=>S.guest&&S.guest.name==='ろうじん'?null:['しろの うらぐち。 かたく とざされている。','（この くにの ことを よく しる ひとが いれば…）']});
  MON.fakeking2=B_(Object.assign({n:'にせの おう',s:'lord',p:{1:'#3a6ab8',2:'#24467e',3:'#f0d040',w:'#c8d8f0',e:'#ff2040'},form2:{n:'こおりの へんげ',s:'shade',p:{1:'#80c0f0',2:'#4080c0',e:'#ff2040'},scale:4.2},scale:4},bstat(28,11,{turns:12}),{
    phases:[{moves:[M_('attack',3),M_('mag',3,'にせの おうは こおりの やりを はなった！',{f:.2}),M_('heal',1,'にせの おうは こおりで きずを ふさいだ！',{f:.08,max:2})]},
            {at:.5,form:1,acts:.4,say:'にせの おう「…ばれては しかたない。 しんの すがたを みせよう！」',moves:[M_('attack',3),M_('sleepAll',2,'へんげは こおりの いきを はいた！ からだが こおりつく！',{ch:.3}),M_('breath',2,'へんげは ふぶきを よんだ！',{f:.14}),
              M_('prep',2,'へんげの まわりが こおりついていく…',{next:M_('breath',0,'へんげの ぜったいれいど！',{f:.28})})]}]}));
  GOALS[11]=()=>!S.guest&&!S.flags.boss_icecastle?'ひょうけつの みやこで、 おうの しょうぞうがに にた ろうじんを さがそう。':!S.flags.boss_icecastle?'ろうじん（ほんものの おう）を つれて、 きたの『ひょうけつの しろ』の うらぐちへ。':'ふねで ひがしの がくえん としへ。';
}
async function fakeKingTalk(){await lines(['おう？「なんじゃ たびびと。 わしは いそがしい。 さっさと でていけ。」','（どこか ふしぜんな わらいかたを している…）']);}
async function beggarKing(){
  msgClear();
  await say('ろうじん「…わしは だれじゃろうな。 なにも おもいだせん。 ただ、 しろを みると むねが いたむ。」');
  await say('ミオ「この ひと、 しょうぞうがの おうさまと おなじ かお！」');
  await say('ろうじん「わしが おう…？ ばかな。 だが… しろの うらぐちの あいことばだけは、 なぜか おぼえておる。」',{wait:'none'});
  await yesNo(); msgClear();
  S.guest={name:'ろうじん',pal:'sage'}; trail=[]; loadNPCs();
  await say('ろうじんが ついてくる ことに なった！（せんとうには でない）'); msgClose();
}

/* ---------- 12しょう ほしの がくえん ---------- */
function defineCh12(){
  buildTown({id:'academy',name:'がくえん とし ステラ',type:'ring',w:32,seed:1212,landmark:'academy',bands:['bld','road','plaza','bld','road','park'],roofs:['紫','白'],trees:['Y'],plaza:'s',
    sign:'がくえん とし ステラ　―ほしよみの がくえん―',barrels:2,pots:3,loot:['frag','drop','frag'],
    bld:[{t:'school',name:'ほしよみの がくえん',books:['「ほしよみは ほしの なまえを よみ、 ひとの なまえを まもる」','「せんねんまえの えいゆうの なは、 れきしから けされた」','「なまえを よぶ ことは、 わすれの かみを ふうじる ゆいいつの ちから」','「わすれの かみは、 よばれぬ なまえを えさに する」','「アカリの とうだいは、 かがみの せかいへの まど でもある」','「そらの みやこには、 なまえの ない かみが ねむる」','「ほしの かけらは 100こ。 すべて あつめた ものは しんの ほしを みる」','「ムメイ… その なは『なまえの ない もの』の いみ」'],npcs:[{id:'professor',pal:'sage',talk:examTalk}]},
      {t:'inn',price:15},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','wing','smoke']},{t:'magic',goods:['staff8','robe8','staff7','robe7'],greet:'まほうの みせへ ようこそ。'},
      {t:'library',name:'きんしょの としょかん',books:['きんじられた ほん。「わすれの かみ」の しょうたいに ついて かかれているが、 ページが やぶられている。','「えいゆう セ… は、 わすれの かみを みずからに ふうじた」 なまえの ところが けされている。','「ふういんを まもる ため、 ひとびとは えいゆうの なを わすれる ことに した」'],npcs:[]},
      {t:'arms',goods:['sword8','knife8','axe7','heavy8','light8','shield8']}],
    npcs:[{at:'plaza',pal:'kid',talk:by([true,['がくせい「ほしよみの しけんは むずかしいよ。 この せかいの ことを よく みて きた ひとじゃないと ごうかく できないんだ。」']])},
      {at:'road',pal:'woman',talk:by([true,['がくせい「としょかんの ちかには、 きんしょの しょこが ある らしいわ。 ほんを うごかすと みちが ひらくとか。」']])}]});
  icon('world',100,30,'G','academy');
  const lib=bldMap('academy','library');
  const from=stairsIn(lib,11,7,'library1',()=>S.flags.examPass?null:['きんしょの しょこへ つづく かいだん。「ほしよみの しけんに ごうかく した もの のみ」と かいてある。']);
  DUNGEONS.push({id:'library',name:'きんしょの しょこ',floors:3,w:21,h:15,wall:'W',floor:'f',rooms:3,loops:.08,zone:'library',area:'tower',seed:1212,per:2,from:[lib,10,7,'left'],
    loot:['herb3','frag',{gold:700},'drop','frag','life'],feat:['switch','switch lock','lock secret'],boss:'kinshoban',reward:'starStaff',
    intro:['「…この ほんを ひらく ものよ。 なまえの ひみつを しる かくごは あるか。」','きんしょの ばんにん「しる ことは、 わすれられぬ くるしみを せおうこと！」']});
  IT.starStaff={n:'ほしよみの つえ',slot:'w',atk:52,only:['mio'],price:0,d:'ほしよみの がくえんに つたわる つえ。'};
  MON.kinshoban=B_(Object.assign({n:'きんしょの ばんにん',s:'mage',p:{1:'#3a2a1a',2:'#1a0a0a',3:'#e0c040',e:'#ff4040'},scale:4},bstat(30,12,{turns:12}),{
    phases:[{moves:[M_('attack',2),M_('mag',3,'ばんにんは きんじられた じゅもんを となえた！',{f:.2}),M_('sleepAll',2,'ばんにんは ねむりの ページを めくった！',{ch:.3}),M_('summon',1,'ばんにんは としょおばけを よびだした！',{id:'toshoobake'})]},
            {at:.5,acts:.4,say:'ばんにん「しれ！ えいゆうの なを けした のは、 おまえたちの せんぞだ！」',moves:[M_('mag',3,'ばんにんは きんじられた じゅもんを となえた！',{f:.22}),M_('breath',2,'ばんにんは ページの あらしを おこした！',{f:.14}),
              M_('prep',2,'ばんにんの ほんが まっくろに ひかった…',{next:M_('breath',0,'ばんにんの わすれの しょ！',{f:.28})})]}]}));
  GOALS[12]=()=>!S.flags.examPass?'がくえんの きょうじゅに あい、 ほしよみの しけんを うけよう。（まちの ほんだなに ヒントが ある）':!S.flags.boss_library?'きんしょの としょかんの かいだんから『きんしょの しょこ』へ。':'ふねで ひがしの こびとの もりへ。';
}
async function examTalk(){
  msgClear();
  if(S.flags.examPass){await say('きょうじゅ「ミオくん、 きみは りっぱな ほしよみだ。 きんしょの しょこへ いく ことを ゆるそう。」'); msgClose(); return;}
  await say('きょうじゅ「ほしよみの しけんを うけに きたのかね？ ミオくん、 きみに ほしよみの さいのうを かんじる。」');
  await say('きょうじゅ「この せかいを よく みて きた ものなら こたえられる。 では…」');
  const Q=[['アカリの とうだいを ともした と いわれる のは？',['ほしかげの ゆうしゃ','なまえくいの しょうぐん','こおりの おう'],0],
    ['フローラの はなの むすめの なまえは？',['リナ','ネネ','ヨハン'],0],['かわの せきしょの はしを つくった だいくの なまえは？',['ゲンゾウ','バルド','アイスバーン'],0],
    ['ねむりの まち ノクターンを めざめさせた のは なにの おと？',['かね','ふえ','たいこ'],0],['なまえを よぶ ことは、 なにを ふうじる ちから？',['わすれの かみ','ほしの ひかり','うみの まじゅう'],0]];
  let ok=0;
  for(const [q,choices,ans] of Q){
    msgClear(); await say('きょうじゅ「'+q+'」',{wait:'none'});
    const m=new Menu({items:choices,style:{left:'20%',top:'20%',width:'60%'}}); const i=await m.pick(); m.close();
    if(i===ans){ok++; sfx.ok();} else sfx.bump();
  }
  msgClear();
  if(ok>=4){S.flags.examPass=1; await say(`きょうじゅ「${ok}もん せいかい！ ごうかくだ！」`); sfx.lvl(); await say('きょうじゅ「きみたちは この せかいを よく みて きた。 なまえを おぼえて いる ものこそ、 ほしよみに ふさわしい。」');
    await say('きょうじゅ「きんしょの としょかんの かいだんへ いく ことを ゆるそう。」');}
  else await say(`きょうじゅ「${ok}もん せいかい… 4もん いじょうで ごうかくだ。 まちの ほんだなや、 これまでの たびを ふりかえって みなさい。」`);
  msgClose();
}
