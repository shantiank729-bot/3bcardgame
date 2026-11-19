/* ---------- 13しょう こびとの もり ---------- */
function defineCh13(){
  buildTown({id:'kinoko',name:'キノコの さと',type:'village',w:28,seed:1313,landmark:'mushroom',bands:['park','bld','road','plaza','bld','road','farm'],roofs:['赤','藁','緑'],trees:['Y'],flower:'F',treeRate:.3,
    sign:'キノコの さと　―こびとの すむ もり―',barrels:2,pots:4,loot:['frag','kinokoSoup','herb3'],
    bld:[{t:'house',name:'こびとの ちょうろうの いえ',w:5,npcs:[{id:'kobitoElder',pal:'elder',talk:kobitoElder}],loot:['frag']},{t:'inn',price:16},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','wing']},
      {t:'house',w:5,npcs:[{pal:'kid',talk:kobitoHat}]},{t:'arms',goods:['sword9','knife9','axe8','staff8','heavy9','light9','robe9','shield9']},{t:'house',w:5,npcs:[{pal:'woman',talk:by([true,['こびと「もりの おくの おおきな きの ねっこに、 どくぐもが すみついたの。」']])}]}],
    npcs:[{at:'plaza',pal:'kid',wander:1,talk:by([true,['こびと「にんげん だ！ おおきい！」','こびと「ちょうろうの なまえが たべられて、 さとの みんなが ちょうろうを わすれちゃったの。」']])},
      {at:'farm',pal:'merchant',talk:by([true,['こびと「キノコの スープは さとの じまん。 なべで にこむと、 わすれかけた ことも おもいだすって いうよ。」']])}]});
  icon('world',140,40,'V','kinoko');
  DUNGEONS.push({id:'root',name:'おおきな きの ねっこ',floors:3,w:21,h:15,wall:'Y',floor:',',rooms:2,loops:.1,zone:'root',area:'forest',seed:1313,per:2,
    loot:['herb3','frag',{gold:800},'drop','frag','life'],feat:['crack','switch secret','lock crack'],boss:'dokugumo',reward:'frag',
    intro:['「シュルル… こびとの なまえは あまくて おいしい…」','どくぐも「おまえたちも いとで まいて たべてやる！」']});
  icon('world',148,30,'C','root1',{gate:()=>qState('kobito')==='done'?null:['おおきな きの ねっこ。 こびとたちの けっかいで とざされている。']});
  MON.dokugumo=B_(Object.assign({n:'どくぐも',s:'scorp',p:{1:'#3a2a1a',2:'#1a1008',e:'#ff2020'},scale:4.2},bstat(32,13,{turns:12}),{
    phases:[{moves:[M_('attack',3),M_('poison',3,'どくぐもは どくの キバで かみついた！'),M_('sleepAll',1,'どくぐもは いとを はきかけた！ うごけない！',{ch:.3}),M_('summon',1,'どくぐもは こグモを よびだした！',{id:'morigumo'})]},
            {at:.5,acts:.4,say:'どくぐも「シュルル！ まとめて いとまき だ！」',moves:[M_('attack',3),M_('mist',3,'どくぐもは どくの きりを はいた！',{f:.1}),
              M_('prep',2,'どくぐもは おしりを たかく あげた…',{next:M_('breath',0,'どくぐもの どくの おおあみ！',{f:.27})})]}]}));
  QUESTS.kobito={t:'こびとの たのみごと',g:'こびとの さと',area:'キノコの さと',steps:['こびとの こどもの ぼうしを もりで さがす。','キノコの スープを ちょうろうに とどける。','ちょうろうから もりの けっかいを といて もらう。']};
  IT.hat={n:'こびとの ぼうし',key:1,d:'てのひらに のる ちいさな ぼうし。'}; IT.kinokoSoup={n:'キノコの スープ',key:1,d:'わすれかけた ことを おもいださせる という スープ。'};
  MAPS.world.hid=MAPS.world.hid||[]; MAPS.world.hid.push({id:'hat',x:136,y:36,loot:'hat'});
  GOALS[13]=()=>qState('kobito')!=='done'?'キノコの さとの こびとたちの たのみごとを きいて、 もりの けっかいを といて もらおう。':!S.flags.boss_root?'さとの きたひがしの『おおきな きの ねっこ』で どくぐもを たおそう。':'なみだの みずうみの むらへ。';
}
async function kobitoHat(){
  if(qState('kobito')==null) qStart('kobito');
  if(has('hat')){delItem('hat'); qSet('kobito',1); await lines(['こびとの こ「ぼうし！ ありがとう、 おおきい ひと！」','こびとの こ「おれいに ないしょの こと おしえる。 キノコの スープは どこかの つぼに かくして あるんだ。 それを ちょうろうに のませて あげて！」']); return;}
  if(qState('kobito')>0||qState('kobito')==='done'){await lines(['こびとの こ「ちょうろう、 げんきに なると いいな。」']); return;}
  await lines(['こびとの こ「ぼうしを もりで なくしちゃった… さとの にしの くさむらの あたりで おとしたと おもう。」']);
}
async function kobitoElder(){
  if(qState('kobito')==='done'){await lines(['ちょうろう「わしの なまえは ポコ。 おもいだせて よかった。 もりの けっかいは といて おいたぞ。」']); return;}
  if(has('kinokoSoup')){delItem('kinokoSoup'); msgClear(); await say('ちょうろう「…この あじ… そうじゃ、 わしは ポコ！ さとの ちょうろうの ポコじゃ！」'); flash('#ffffff',300);
    await say('ちょうろう「どくぐもが わしの なまえを ねっこに うめたのじゃ。 けっかいを とく から、 どうか たいじして くれ。」'); await qDone('kobito','frag'); msgClose(); return;}
  await lines(['ろうじんの こびと「…わしは だれじゃったかのう。 みんなが わしを『おじいちゃん』と よぶ。 なまえが あった ような…」']);
}

/* ---------- 14しょう なみだの みずうみ ---------- */
function defineCh14(){
  buildTown({id:'lakevil',name:'みずうみの むら シズク',type:'harbor',w:30,seed:1414,bands:['park','bld','road','bld','road','pier'],landmark:'shrine',roofs:['青','緑'],trees:['Y'],
    sign:'みずうみの むら シズク　―なみだの みずうみの ほとり―',barrels:2,pots:3,loot:['frag','herb3','frag'],
    bld:[{t:'inn',price:17},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','wing','smoke']},{t:'house',name:'みずうみの ほとりの いえ',book:'ちいさな こどもの にっき。「おかあさんは まじょ。 くすりで みんなを たすける、 じまんの おかあさん。 ネネ」',npcs:[{pal:'granny',talk:by([true,['「この いえには むかし、 まじょの おやこが すんでいた。 むすめの なまえは… なんだったか。」']])}],loot:['frag']},
      {t:'arms',goods:['sword9','knife9','axe8','staff9','heavy9','light9','robe9','shield9']},{t:'church'}],
    npcs:[{at:'pier',pal:'sailor',talk:by([F('boss_lakeD'),()=>lines([S.flags.saveNene?'「みずうみが すんだ！ まじょの おやこが いっしょに わらってたよ。」':'「みずうみは しずかに なった。 でも、 どこか さみしい いろだね。」'])],[true,['「みずうみの まんなかの しまに、 なきつづける まじょが いるんだ。」']])},
      {at:'road',pal:'woman',talk:by([true,['「なみだの みずうみの みずは しょっぱいの。 まじょの なみだで できている から なんですって。」']])}]});
  icon('world',120,64,'V','lakevil');
  DUNGEONS.push({id:'lakeD',name:'なみだの みずうみ',floors:3,w:21,h:15,wall:'J',floor:'j',rooms:2,loops:.08,zone:'lakeD',area:'lake',seed:1414,per:2,
    loot:['herb3','frag',{gold:900},'drop','frag','life'],feat:['switch','lock secret','switch lock'],boss:'kanashimi',reward:'frag',
    intro:['「…おかあさん… どうして わたしを わすれたの…」','かなしみの まじょ「だれも わたしを よばない。 だから わたしも、 みんなの なまえを けしてあげる！」']});
  icon('world',128,58,'6','lakeD1',{gate:()=>S.flags.olgaLeft?null:['みずうみの まんなかの しま。 いまは きりが ふかい。']});
  MON.kanashimi=B_(Object.assign({n:'かなしみの まじょ',s:'mage',p:{1:'#5a7ab0',2:'#3a4a80',3:'#c0d0ff',e:'#ffffff'},scale:4},bstat(34,14,{turns:12}),{
    phases:[{moves:[M_('attack',2),M_('mag',3,'まじょは なみだの やりを はなった！',{f:.2}),M_('sleepAll',2,'まじょは かなしい うたを うたった！',{ch:.3}),M_('heal',1,'まじょは なみだで きずを いやした！',{f:.08,max:2})]},
            {at:.5,acts:.4,say:'まじょ「おかあさん… おかあさん！ どこに いるの！」',moves:[M_('mag',3,'まじょは なみだの やりを はなった！',{f:.22}),M_('breath',2,'まじょは かなしみの なみを おこした！',{f:.14}),
              M_('prep',2,'みずうみの みずが まじょの まわりに あつまっていく…',{next:M_('breath',0,'まじょの なみだの おおなみ！',{f:.28})})]}]}));
  GOALS[14]=()=>!S.flags.olgaLeft?'みずうみの むら シズクで はなしを きこう。（ほとりの いえに なにかが ある）':!S.flags.boss_lakeD?'みずうみの まんなかの『なみだの みずうみ』へ。 かなしみの まじょと むきあおう。':'ほむらの まちへ。（みなみひがしの かざんの しま）';
}
// オルガの いちじ りだつ（ほとりの いえで にっきを よむと はじまる）
async function olgaLeaves(){
  if(S.flags.olgaLeft||!memberOf('olga')) return;
  msgClear();
  await say('オルガ「…ネネ。 その にっき… ネネ…！」'); shake();
  await say('オルガ「わたしには むすめが いた。 ネネと いう むすめが。 なのに… わたしは 10ねんも わすれて…！」');
  await say('オルガ「みずうみの まじょは… ネネだ。 わたしが わすれた せいで、 あのこは ひとりぼっちで ないていたんだ！」');
  await say('オルガ「…すまない。 すこし ひとりに させておくれ。 わたしに あのこに あう しかくなんか ない。」');
  leaveParty('olga'); S.flags.olgaLeft=1; sfx.bump();
  await say('オルガは なかまから はなれた…');
  await say('ミオ「…わたしたちで いこう。 ネネさんの なまえを、 オルガさんに とどけるために。」'); msgClose();
}
async function afterKanashimi(){
  msgClear();
  await say('かなしみの まじょ「…どうして。 どうして、 だれも わたしの なまえを よんで くれないの…」');
  await say('みずうみの きしから、 だれかが はしって くる！');
  await say('オルガ「ネネ！！」');
  await say('オルガ「ネネ… わたしの ネネ… わすれて いて ごめんよ…！」');
  await say('ミオ「…まじょの まま ふうじれば、 もう だれも きずつかない。 でも なまえを よべば、 ネネさんは もとに もどれる かも しれない。」');
  await say('どうする？',{wait:'none'});
  const m=new Menu({items:['なまえを よんで すくう','ふういんする'],style:{right:'3%',bottom:'35%',width:'40%'}}); const c=await m.pick(); m.close(); msgClear();
  if(c!==1){
    S.flags.saveNene=1; flash('#ffffff',800);
    await say('オルガ「ネネ！ あなたは ネネ！ わたしの たいせつな むすめ！」');
    await say('くろい もやが はれ、 ちいさな おんなのこが オルガの うでの なかに いた。');
    await say('ネネ「…おかあさん。 よんで くれた…」');
    await say('オルガ「ありがとう。 これからは、 あのこの なまえを まいにち よぶよ。」');
    rejoinParty('olga'); const o=memberOf('olga'); if(o){o.str+=4; o.mmp+=20; o.mp=o.mmp;} sfx.lvl();
    await say('オルガが なかまに もどった！ オルガの ちからと まりょくが あがった！');
  }else{
    S.flags.sealNene=1;
    await say('オルガ「…そうだね。 あのこを これいじょう くるしませたく ない。」');
    await say('みずうみが しずかに こおりついていく。 オルガは ずっと、 こおりに てを あてていた。');
    await say('オルガ「…いこう。 ネネの ぶんまで、 なまえを とりもどす たびを つづけるよ。」');
    rejoinParty('olga'); addItem('herb3',3); addItem('neneTear');
    await say('オルガが なかまに もどった。 『ネネの なみだ』を てにいれた。');
  }
  IT.neneTear={n:'ネネの なみだ',slot:'s',def:44,only:['olga','mio','riri','hero'],price:0,d:'こおった なみだの たて。'};
  msgClose(); await startChapter(15);
}

/* ---------- 15しょう ほむらの まち ---------- */
function defineCh15(){
  buildTown({id:'homura',name:'かじの まち ほむら',type:'street',w:34,seed:1515,landmark:'chimney',ground:'_',road:'道',bands:['park','bld','road','plaza','bld','road'],roofs:['黒','赤'],trees:['Y'],brick:1,edge:'A',
    sign:'かじの まち ほむら　―かざんの ふもと―',barrels:4,pots:1,loot:['frag','herb3','frag'],
    bld:[{t:'forge',name:'でんせつの かじや',talk:smithTalk},{t:'inn',price:18},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','wing','smoke']},
      {t:'arms',goods:['sword10','knife10','axe9','staff9','heavy10','light10','robe10','shield10']},{t:'house',npcs:[{pal:'granny',talk:by([true,['「でんせつの かじやは、 なまえの こもった ぶきしか うたない がんこものさ。」']])}],loot:['frag']},{t:'church'}],
    npcs:[{at:'plaza',pal:'merchant',talk:by([true,['「かざんの ようがんの もぐらみちには、 ほのおの こうせきが ある。 でも ようがんりゅうが すんでいるんだ。」']])},
      {at:'road',pal:'guard',talk:by([true,['「ようがんを ふむと やけどするぞ。 HPに きを つけろ。」']])}]});
  icon('world',146,100,'G','homura');
  DUNGEONS.push({id:'lava',name:'ようがんの もぐらみち',floors:3,w:21,h:15,wall:'A',floor:'a',rooms:2,loops:.08,lava:.06,zone:'lava',area:'volcano',seed:1515,per:2,
    loot:['fireOre','herb3',{gold:1000},'starIron','frag','life'],feat:['lock','crack switch','lock secret'],boss:'yoganryu',reward:'dragonScale',
    intro:['「グルル… ようがんの なかまで おいかけて くるとは。」','ようがんりゅう「わしの うろこは だれにも わたさん！」']});
  icon('world',150,92,'C','lava1');
  IT.fireOre={n:'ほのおの こうせき',key:1,d:'ようがんの ねつを たくわえた こうせき。'}; IT.starIron={n:'ほしの てっこう',key:1,d:'そらから おちた ほしの てつ。'}; IT.dragonScale={n:'りゅうの うろこ',key:1,d:'ようがんりゅうの かたい うろこ。'};
  MON.yoganryu=B_(Object.assign({n:'ようがんりゅう',s:'dragon',p:{1:'#c8401a',2:'#7a1a0a',3:'#ffb030'},p2:{1:'#ff6020',2:'#a02a0a',3:'#ffff60'},scale:4.4},bstat(36,15,{turns:12}),{
    phases:[{moves:[M_('attack',4),M_('breath',3,'ようがんりゅうは ほのおを はいた！',{f:.14}),M_('charge',1,'ようがんりゅうは ようがんを のみこんだ…')]},
            {at:.5,alt:1,acts:.4,say:'ようがんりゅう「グオオオ！ かざんよ、 めざめよ！」',moves:[M_('attack',3),M_('breath',2,'ようがんりゅうは ほのおを はいた！',{f:.15}),
              M_('prep',3,'ようがんりゅうの からだが まっかに かがやきだした！',{next:M_('breath',0,'ようがんりゅうの だいふんか！',{f:.3})})]}]}));
  GOALS[15]=()=>!has('legend')?'でんせつの かじやに なまえの つるぎを うって もらおう。（ほのおの こうせき・ほしの てっこう・りゅうの うろこ）':'なまえの とうへ。（うみの まんなかの こじま）';
}
async function smithTalk(){
  msgClear();
  if(has('legend')){await say('かじや「その つるぎは おまえの なまえと いっしょに ある。 わすれるなよ。」'); msgClose(); return;}
  const need=['fireOre','starIron','dragonScale'], n=need.filter(has).length;
  if(n<3){await say(`かじや「おれは なまえの こもった ぶきしか うたん。 なまえを まもる ための ぶきなら うってやる。」`); await say(`かじや「ほのおの こうせき、 ほしの てっこう、 りゅうの うろこ。 みっつ もってこい。（いま ${n}／3）」`); msgClose(); return;}
  for(const id of need) delItem(id);
  await say('かじや「…そろったな。 よし、 うつぞ。」'); msgClose(); stopBgm(); await fadeOut(500);
  for(let i=0;i<4;i++){sfx.hit(); await sleep(300);} await fadeIn(500); playBgm(curMap().bgm);
  msgClear(); addItem('legend'); addItem('legendS'); sfx.lvl();
  await say(`かじや「できた。『なまえの つるぎ』と『なまえの たて』だ。 つかいてが じぶんの なまえを よぶ たびに、 つよく ひかる。」`);
  await say(`${HN()}は なまえの つるぎと なまえの たてを てにいれた！`);
  await say('かじや「うみの まんなかの こじまに『なまえの とう』が ある。 すべての なまえが うまれた ばしょ だそうだ。」'); msgClose();
  await startChapter(16);
}

/* ---------- 16しょう なまえの とう ---------- */
function defineCh16(){
  DUNGEONS.push({id:'ntower',name:'なまえの とう',floors:6,w:19,h:15,wall:'v',floor:'w',rooms:2,loops:.07,up:1,zone:'ntower',area:'tower',seed:1616,per:2,
    loot:['herb3','frag',{gold:1200},'drop','frag','life','herb3','frag'],feat:['','lock','switch secret','lock','switch lock',''],mid:{floor:3,mon:'jin3',intro:['ジン「…ここまで きたか。」','ジン「おれの なまえは、 ムメイさまが もっている。 なまえを かえす かわりに、 おまえたちを とめろと。」','ジン「…だが、 もう わからない。 なにが ただしいのか。 たしかめさせて くれ、 おまえたちの つるぎで！」']},
    boss:'bunshin',reward:'frag',
    intro:['「…ここは なまえの うまれる とう。」','ムメイの ぶんしん「わたしは ムメイ。 なまえの ない もの。 せんねん、 だれにも よばれなかった もの。」','ぶんしん「おまえたちにも おしえて やろう。 わすれられる ことの いたみを！」']});
  icon('world',100,72,'R','ntower1',{gate:()=>has('legend')?null:['とうの とびらには『なまえを まもる つるぎを もつ もの のみ』と きざまれている。']});
  MON.jin3=B_(Object.assign({n:'けんし ジン',s:'knight',p:{1:'#3a3a4a',2:'#1a1a2a',3:'#c04060',e:'#ffe040'},scale:3.6},bstat(38,16,{turns:11,expMul:.8}),{
    phases:[{moves:[M_('attack',5),M_('str',2,'ジンの いあいぎり！'),M_('breath',2,'ジンの つばめがえし！',{f:.14})]},
            {at:.5,acts:.4,say:'ジン「まだだ…！ おれは… おれの なまえを！」',moves:[M_('attack',4),M_('charge',2,'ジンは しずかに かたなを かまえた…'),M_('breath',2,'ジンの つばめがえし！',{f:.15})]}]}));
  MON.bunshin=B_(Object.assign({n:'ムメイの ぶんしん',s:'lord',p:{1:'#1a1a2a',2:'#0a0a14',3:'#a080ff',w:'#c0c0e0',e:'#ff2040'},p2:{1:'#2a0a2a',2:'#140514',3:'#ff80ff',w:'#e0c0ff',e:'#ffffff'},scale:4.2},bstat(39,16,{turns:13}),{
    phases:[{moves:[M_('attack',3),M_('mag',3,'ぶんしんは なまえけしの ひかりを はなった！',{f:.2}),M_('sleepAll',1,'ぶんしんは わすれの うたを うたった！',{ch:.3}),M_('mist',2,'ぶんしんは わすれの きりを はいた！',{f:.1})]},
            {at:.5,alt:1,acts:.45,say:'ぶんしん「よばれぬ なまえの おもさを しれ！」',moves:[M_('attack',3),M_('breath',3,'ぶんしんは くろい もじの あらしを おこした！',{f:.15}),M_('summon',1,'ぶんしんは かげのきしを よびだした！',{id:'kagekishi'}),
              M_('prep',2,'ぶんしんの まわりで せかいの なまえが うずを まく…',{next:M_('breath',0,'ぶんしんの むめいの さばき！',{f:.3})})]}]}));
  GOALS[16]=()=>!S.flags.mid_ntower?'なまえの とうを のぼろう。':!S.flags.boss_ntower?'なまえの とうの ちょうじょうへ。':'そらとぶ ふねで きたの そらの しまへ。';
}
async function afterJin3(){
  msgClear();
  await say('ジン「…まけた。 おまえたちの つるぎには、 よぶ なまえが ある。 おれには ない。」');
  await say('ミオ「…あなたの なまえは ジン でしょ？ わたしたちは もう おぼえてる。」');
  await say('ジン「…！」');
  await say(`${HN()}は ジンの なまえを よんだ。 ジンの まわりの くろい もやが すこし うすれた。`);
  await say('ジン「…はは。 なまえを よばれるのが こんなに あたたかい とはな。」');
  await say('ジン「ムメイさまは… いや、 ムメイは まちがっている。 とめに いこう、 いっしょに。」');
  await joinParty('jin','ジン',37,{w:'sword9',a:'heavy9',s:'shield9'}); msgClose();
}
async function afterBunshin(){
  msgClear();
  await say('ぶんしん「…ふふ。 これは ほんの かげ。 ほんとうの わたしは、 わすれの くにの とうで まっている…」');
  await say('ぶんしんが きえると、 とうの ちょうじょうに ふるい ほしの ふねが あらわれた。');
  await say('ジン「これは… せんねんまえの ゆうしゃが のった という『ほしの つばさ』か。」');
  S.flags.airship=1; S.air={x:101,y:74,map:'world'}; sfx.lvl();
  await say('そらとぶ ふね『ほしの つばさ』を てにいれた！ （とうの ふもとに とめてある。 ちかづくと のれる。 ひらけた ばしょで Aボタンで おりる）');
  msgClose(); await startChapter(17);
}
