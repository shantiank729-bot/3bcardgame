/* ---------- 4しょう かわの せきしょ ---------- */
function defineCh4(){
  buildTown({id:'river',name:'かわの せきしょ',type:'street',w:30,seed:404,landmark:'gate',bands:['park','bld','road','plaza','bld','road'],roofs:['緑','藁'],trees:['Y'],
    sign:'かわの せきしょ　―ひがしの はしは くずれている―',barrels:2,pots:2,loot:['frag','herb2'],
    bld:[{t:'inn',price:7},{t:'item',goods:['herb','herb2','antidote','bell','wing','smoke']},{t:'arms',goods:['sword4','knife4','axe3','staff3','heavy4','light4','robe4','shield4']},
      {t:'house',name:'はしもりの いえ',npcs:[{id:'bridgeWidow',pal:'granny',talk:bridgeWidow}],book:'せっけいずの たば。「この はしは わしの いのち。 わすれられぬ かぎり たっている」 しょめいは きえている。',loot:['frag']},
      {t:'hall',talk:by([F('boss_ruins'),['せきしょちょう「はしが なおった！ ひがしの バザールの まちへ いけるぞ。」']],[true,['せきしょちょう「はしが きゅうに くずれおちた。 はしを つくった だいくの なまえを、 だれも おもいだせないのだ。」','せきしょちょう「みなみの『すいもんの いせき』に、 はしの せっけいずが ねむっていると きく。」']]),pal:'guard'}],
    npcs:[{at:'plaza',id:'jin1',pal:'jin',cond:()=>!S.flags.jinDuel1,talk:jinDuel1},
      {at:'road',pal:'sailor',talk:by([true,['「むかしは はしの うえで、 だいくの じいさんが まいにち くぎを うってたんだ。 …あれは だれだったか。」']])},
      {at:'road',pal:'kid',wander:1,talk:by([true,['「すいもんの いせきって、 みずが いっぱいで すすめないんだって。 スイッチで みずを ぬくらしいよ。」']])}]});
  icon('world',62,86,'V','river');
  // はしの マス（なおるまで みず）
  MAPS.world.dyn=MAPS.world.dyn||{};
  for(const x of [66,67,68]) MAPS.world.dyn[`${x},86`]=()=>S.flags.bridge?'=':'~';
  DUNGEONS.push({id:'ruins',name:'すいもんの いせき',floors:3,w:21,h:15,wall:'E',floor:'e',rooms:2,loops:.08,zone:'ruins',area:'lake',seed:404,per:2,
    loot:['herb2','frag',{gold:120},'antidote','drop','frag'],feat:['switch','switch secret','switch lock'],boss:'suimon',reward:'blueprint',
    intro:['「…ここは すいもんの いせき。 はしの せっけいずを ねらう ものは ゆるさぬ…」','すいもんの ばんにん「みずの そこに しずめて やる！」']});
  icon('world',60,96,'C','ruins1');
  IT.blueprint={n:'はしの せっけいず',key:1,d:'はしもり ゲンゾウの なまえが きざまれた せっけいず。'};
  MON.jin1=B_(Object.assign({n:'けんし ジン',s:'knight',p:{1:'#3a3a4a',2:'#1a1a2a',3:'#c04060',e:'#ffe040'},scale:3.4},bstat(12,4,{turns:9,expMul:.8}),{
    phases:[{moves:[M_('attack',5),M_('str',2,'ジンの いあいぎり！'),M_('charge',1,'ジンは しずかに かたなを かまえた…')]}]}));
  MON.suimon=B_(Object.assign({n:'すいもんの ばんにん',s:'snake',p:{1:'#2a6ab0',2:'#1a3a70',e:'#ffe040'},scale:4},bstat(13,4,{turns:11}),{
    phases:[{moves:[M_('attack',4),M_('breath',3,'ばんにんは おおなみを おこした！',{f:.12}),M_('poison',1,'ばんにんは どくの キバで かみついた！')]},
            {at:.5,acts:.3,say:'ばんにん「シャアア！ みずよ、 あふれよ！」',moves:[M_('attack',3),M_('breath',3,'ばんにんは おおなみを おこした！',{f:.13}),
              M_('prep',1,'ばんにんの まわりで みずが うずを まきはじめた…',{next:M_('breath',0,'ばんにんの だいこうずい！',{f:.26})})]}]}));
  QUESTS.widow={t:'はしもりの なまえ',g:'はしもりの つま',area:'かわの せきしょ',steps:['すいもんの いせきで はしの せっけいずを さがす。','せっけいずを はしもりの つまに みせる。']};
  GOALS[4]=()=>!S.flags.jinDuel1?'かわの せきしょの ひろばに いる、 あやしい けんしに はなしかけよう。':!S.flags.boss_ruins?'せきしょの みなみの『すいもんの いせき』で、 はしの せっけいずを とりもどそう。（スイッチを ふむと こうしが ひらく）'
    :'はしもりの つまに せっけいずを みせよう。';
}
async function jinDuel1(n){
  msgClear();
  await say('くろい けんし「…みつけたぞ。 なまえの ない かげ。」'); emote(n,'！');
  await say('くろい けんし「おれは ジン。 ムメイさまの めいれいで、 その かげを つれて いく。」');
  await say(`かげのこ「…いや！ ${HN()}、 たすけて！」`);
  await say('ジン「じゃまを するなら、 きる。」'); msgClose();
  const r=await battle(['jin1'],{boss:1,area:'field'});
  if(r!=='win') return;
  S.flags.jinDuel1=1; loadNPCs(); msgClear();
  await say('ジン「…くっ。 その うで、 おぼえて おく。」');
  await say('ジン「だが おぼえて おけ。 おれにも、 なまえを とりもどさねば ならない りゆうが ある。」');
  await say('ジンは はしの なくなった かわを とびこえ、 きえていった…');
  await say('ガルム「あの けんし… めが さみしそうだったな。」'); msgClose();
}
async function bridgeWidow(){
  msgClear();
  if(has('blueprint')){delItem('blueprint'); await say('おばあさん「これは… あのひとの せっけいず！ ゲンゾウ… そう、 あのひとは ゲンゾウ！」'); flash('#ffffff',400);
    await say('おばあさんが なまえを よぶと、 せっけいずが ひかり、 かわの ほうから おおきな おとが ひびいた！');
    S.flags.bridge=1; await qDone('widow','frag'); await say('はしが ふたたび かかった！ ひがしの バザールの まち サンドラへ いける。'); msgClose(); await startChapter(5); return;}
  if(qState('widow')==='done'){await say('おばあさん「はしを わたる たびに、 あのひとの なまえを よぶの。 もう わすれないように。」'); msgClose(); return;}
  qStart('widow'); await say('おばあさん「おっとが いた きがするの。 はしを つくった ひと…。 でも なまえも かおも かすみの なか。」'); await say('おばあさん「あのひとの せっけいずが あれば、 おもいだせる かも しれない。」'); msgClose();
}

/* ---------- 5しょう バザールの まち ---------- */
function defineCh5(){
  buildTown({id:'sandra',name:'バザールの まち サンドラ',type:'market',w:36,seed:505,ground:':',road:'道',bands:['bld','road','market','road','bld','road','park'],roofs:['白','赤','紫'],trees:['k'],edge:'D',plaza:'s',
    sign:'バザールの まち サンドラ　―みなみに ゆうれいの まち（よるだけ）／きたに とりで―',barrels:4,pots:3,loot:['frag','herb2',{gold:80},'frag'],
    bld:[{t:'guild',name:'しょうにん ギルド',talk:guildTalk,pal:'merchant',book:'ギルドの ちょうぼ。「なまえいし 12こ　かいとり ずみ」 …なまえいし？'},
      {t:'inn',price:9},{t:'item',goods:['herb','herb2','antidote','bell','drop','life','wing','smoke']},{t:'arms',goods:['sword5','knife5','axe4','staff4','heavy5','light5','robe5','shield5']},
      {t:'swap',name:'ほしのかけら こうかんじょ'},{t:'bar',npcs:[{pal:'sailor',talk:by([true,['「ギルドの ちかこには、 なまえいしが ためこまれてる って うわさだ。」','「なまえいし？ ひとの なまえが かたまった いしさ。 たかく うれるらしい…。」']])},
        {id:'ririBar',pal:'riri',cond:()=>!S.flags.ririMet,talk:ririMeet}]},
      {t:'house',npcs:[{pal:'granny',talk:tradeQuest}],loot:['frag']},{t:'church'}],
    npcs:[{at:'market',pal:'merchant',talk:()=>shop(['herb2','drop','smoke','life'],'いらっしゃい！ ひるの いちばだよ。'),time:'day'},
      {at:'market',pal:'woman',talk:()=>shop(['sword5','knife5','light5','shield5'],'たびの ぶきは いかが？'),time:'day'},
      {at:'market',pal:'kid',wander:1,talk:by([true,['「よるの いちばは しまってるけど、 よるにしか あえない ひとも いるんだって。」']])},
      {at:'road',pal:'guard',talk:by([F('boss_vault'),['「ギルドの わるだくみが あばかれた！ なまえいしは もちぬしに かえされるそうだ。」']],[true,['「ギルドの ちかこは みはりが きびしいぞ。 みはりの めの まえを よこぎれば すぐ みつかる。」','「みはりは くびを ふって あたりを みわたしている。 よそみの すきに とおるんだな。」']])}]});
  icon('world',80,80,'G','sandra');
  const gm=bldMap('sandra','guild');
  DUNGEONS.push({id:'vault',name:'ギルドの ちかこ',floors:3,w:21,h:15,wall:'X',floor:'s',rooms:1,loops:.06,zone:'vault',area:'cave',seed:505,per:2,from:[gm,6,7,'down'],
    loot:['herb2','frag',{gold:200},'drop','frag','life'],feat:['guard','guard lock','lock secret'],guardsPer:3,boss:'kinko',reward:'ririStone',
    intro:['「ガシャン… しんにゅうしゃ はっけん。」','きんこの ばん「なまえいしは ギルドの ざいさん。 はいじょ する。」']});
  IT.ririStone={n:'リリの かぞくの なまえいし',key:1,d:'ちいさな いえの もようが ほられた なまえいし。'};
  MON.kinko=B_(Object.assign({n:'きんこの ばん',s:'golem',p:{1:'#e0c040',2:'#a08020',e:'#ff2020'},scale:4},bstat(16,5,{turns:11}),{
    phases:[{moves:[M_('attack',4),M_('charge',2,'きんこの ばんは うでを まわしはじめた…'),M_('breath',2,'きんこの ばんは きんかを ばらまいた！',{f:.11})]},
            {at:.5,alt:1,acts:.3,say:'きんこの ばん「けいほう。 けいほう。 ぜんりょくで はいじょ。」',moves:[M_('attack',3),M_('summon',1,'きんこの ばんは からくりへいを よびだした！',{id:'karakuri'}),
              M_('prep',2,'きんこの ばんの めが まっかに ひかった！',{next:M_('breath',0,'きんこの ばんの こうねつ ビーム！',{f:.27})})]}]}));
  QUESTS.trade={t:'こうかんの たび',g:'サンドラの おばあさん',area:'サンドラ',steps:['アカリの りょうしから「ひかりダコ」を もらう。','ゴルドの こうふに ひかりダコを わたす。','おばあさんに「ほしの こうせき」を とどける。']};
  IT.tako={n:'ひかりダコ',key:1,d:'よるの うみで ひかる タコ。'}; IT.ore={n:'ほしの こうせき',key:1,d:'ゴルドで とれた きらきら ひかる いし。'};
  GOALS[5]=()=>!S.flags.ririMet?'サンドラの さかばに いる しょうじょに はなしを きこう。':!S.flags.boss_vault?'しょうにん ギルドの ちかこに しのびこみ、 なまえいしを とりもどそう。（みはりの あかい しせんに はいらない）'
    :'リリと はなし、 さらに さきへ。 みなみの ゆうれいの まちは よるにしか あらわれない という。';
}
async function ririMeet(){
  msgClear();
  await say('すばしこそうな しょうじょ「…あんたたち、 ギルドの まわしもの じゃ ないよね？」');
  await say('しょうじょ「あたしは リリ。 とうぞく… って ことに しといて。」');
  await say('リリ「ギルドの ちかこに、 あたしの かぞくの なまえいしが ある。 なまえを たべられて、 かぞくの かおも なまえも おもいだせないの。」');
  await say('リリ「ひとりじゃ みはりを ぬけられない。 てを かして くれない？ かわりに、 かぎあけは まかせて。」',{wait:'none'});
  await yesNo(); msgClear();
  S.flags.ririMet=1;
  await joinParty('riri','リリ',14,{w:'knife5',a:'light4',s:'shield3'});
  await say('リリ「ちかこの いりぐちは ギルドの なか。 うけつけの おくの かいだんよ。」'); msgClose(); loadNPCs();
}
async function guildTalk(){
  msgClear();
  if(S.flags.boss_vault){await say('ギルドちょう「…わ、 わたしは しらなかった！ なまえいしは ぜんぶ もちぬしに かえす！」'); msgClose(); return;}
  await say('ギルドちょう「ようこそ しょうにん ギルドへ。 なまえいし？ はて、 なんの ことやら。」'); msgClose();
}
async function tradeQuest(){
  const st=qState('trade');
  if(st==='done'){await lines(['おばあさん「この いしは まごの なまえを かいた おまもりに するの。 わすれない ために ね。」']); return;}
  if(has('ore')){delItem('ore'); msgClear(); await say('おばあさん「まあ、 ほしの こうせき！ これで まごの なまえいしの おまもりが つくれるわ。」'); await qDone('trade','fring1'); msgClose(); return;}
  if(st==null){qStart('trade'); await lines(['おばあさん「まごの ために、 ゴルドの ほしの こうせきが ほしいの。」','おばあさん「ゴルドの こうふは アカリの『ひかりダコ』が だいこうぶつ。 こうかん して くれるかも。」']); return;}
  await lines(['おばあさん「ひかりダコは アカリの りょうしが もっている はずよ。」']);
}

/* ---------- 6しょう ゆうれいの まち ---------- */
function defineCh6(){
  buildTown({id:'ghost',name:'ねむりの まち ノクターン',type:'ghost',w:30,seed:606,landmark:'belltower',bands:['grave','road','bld','road','plaza','bld','road','grave'],roofs:['黒','紫'],trees:['Y'],ground:'.',bgm:'dungeon',
    sign:'ねむりの まち ノクターン　―100ねん まえから じかんが とまっている―',barrels:2,pots:3,loot:['frag','herb2','frag'],
    bld:[{t:'inn',price:10,npcs:[]},{t:'item',goods:['herb2','antidote','bell','drop','life','wing']},{t:'house',name:'かねつきの いえ',book:'かねつきの にっき。「かねが なれば、 ねむった なまえも めを さます」',loot:['lantern']},
      {t:'church',book:'100ねんまえの きろく。「この まちの ひとびとの なまえは、 ひとばんで すべて きえた」'},{t:'house',npcs:[{pal:'woman',shadow:1,talk:ghostLetter}],loot:['frag']},{t:'arms',goods:['sword6','knife6','axe5','staff5','heavy6','light6','robe6','shield6']}],
    npcs:[{at:'plaza',pal:'sage',shadow:1,talk:by([F('boss_bell'),['じいさん「かねが なった… わしの なまえは ヨハン！ おもいだしたぞ！」']],[true,['かげの じいさん「…みえるのか、 わしが。 この まちの ものは みな、 なまえを なくした かげびとじゃ。」','かげの じいさん「かねの とうの かねが なれば、 みんな めを さます。 だが とうの なかは まっくらでな…」']])},
      {at:'road',pal:'kid',shadow:1,wander:1,talk:by([true,['かげの こども「ねえ、 ぼくの なまえ しってる？ …しらないよね。」']])},
      {at:'road',pal:'guard',shadow:1,talk:by([true,['かげの へいし「かねの とうは まちの まんなかだ。 ランプが なければ いっぽも すすめんぞ。」','かげの へいし「かねつきの いえに、 むかしの ランタンが あった はずだ。」']])}]});
  icon('world',84,104,'G','ghost',{gate:()=>isNight()||S.flags.boss_bell?null:['ふかい きりで なにも みえない… ここには たしかに まちが あった はず なのに。','（よるに なれば すがたを あらわす かも しれない）']});
  const A=MAPS.ghost, lm=A.marks.find(m=>m.kind==='belltower');
  addDoor('ghost',lm.x,lm.y+lm.h-1,'bell1',0,0,'up');
  DUNGEONS.push({id:'bell',name:'かねの とう',floors:4,w:19,h:15,wall:'N',floor:'n',rooms:1,loops:.08,up:1,zone:'bell',area:'crypt',seed:606,per:2,from:['ghost',lm.x,lm.y+lm.h,'down'],
    loot:['herb2','frag',{gold:150},'drop','frag','life','herb2'],feat:['','secret','lock secret','switch'],dark:[1,2,2,2],boss:'kanebourei',reward:'frag',
    intro:['「…ゴォォン… だれが わたしの かねに ふれる…」','かねの ぼうれい「この まちの なまえは、 わたしが ねむらせたのだ… えいえんに！」']});
  IT.lantern={n:'かねつきの ランタン',key:1,d:'くらやみを てらし、 かくされた みちを うかびあがらせる ランタン。'};
  MON.kanebourei=B_(Object.assign({n:'かねの ぼうれい',s:'ghost',p:{1:'#a0a070',2:'#707040',e:'#ff4040'},p2:{1:'#c0c060',2:'#808020',e:'#ffffff'},scale:4},bstat(18,6,{turns:11}),{
    phases:[{moves:[M_('attack',3),M_('sleepAll',2,'ぼうれいは かねを うちならした！ ねむけが おそう…',{ch:.3}),M_('mag',3,'ぼうれいは あおい ひを はなった！',{f:.17}),M_('summon',1,'ぼうれいは さまよいびとを よんだ！',{id:'samayoi'})]},
            {at:.5,alt:1,acts:.35,say:'ぼうれい「ねむれ… ねむれ… なまえなど いらぬ…！」',moves:[M_('attack',3),M_('mist',2,'ぼうれいは のろいの きりを はいた！',{f:.09}),M_('mag',2,'ぼうれいは あおい ひを はなった！',{f:.18}),
              M_('prep',2,'かねが ひとりでに ゆれはじめた…',{next:M_('breath',0,'かねの だいこうおん！',{f:.26})})]}]}));
  QUESTS.ghostletter={t:'100ねんごしの てがみ',g:'かげの おんな',area:'ノクターン',steps:['かげの おんなから てがみを あずかる。','てがみを アカリの きょうかいの ぼくしに とどける。']};
  IT.ghostLetter={n:'100ねんまえの てがみ',key:1,d:'「いつか この てがみが とどきますように」'};
  GOALS[6]=()=>!S.flags.boss_bell?(S.abil&&S.abil.lantern?'ノクターンの まんなかの『かねの とう』を のぼり、 かねの ぼうれいを たおそう。':'よるにだけ あらわれる『ねむりの まち ノクターン』へ。 かねつきの いえで ランタンを さがそう。（サンドラの みなみの ぬまち）')
    :'ガルムが なにかを おもいだした ようだ。 サンドラの きたの とりでへ むかおう。';
}
async function ghostLetter(){
  const st=qState('ghostletter');
  if(st==='done'){await lines(['かげの おんな「とどいたのね… ありがとう。」']); return;}
  if(st==null){qStart('ghostletter'); addItem('ghostLetter'); await lines(['かげの おんな「100ねん まえ、 アカリの まちに いる こいびとへ てがみを かいたの。 でも とどける まえに、 なまえを たべられて しまった。」','かげの おんな「おねがい。 アカリの きょうかいに とどけて。 あのひとの しそんが いる はずだから。」','（100ねんまえの てがみを あずかった）']); return;}
  await lines(['かげの おんな「てがみ… とどいたかしら。」']);
}
