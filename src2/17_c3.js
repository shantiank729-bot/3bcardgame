/* =========================================================
   だい3ぶ　なまえの ない せかい（17〜24しょう・クリアご）
   ========================================================= */
function mapByName(name){return Object.keys(MAPS).find(k=>MAPS[k].name===name);}
/* ---------- 17しょう そらの みやこ ---------- */
function defineCh17(){
  buildTown({id:'skycity',name:'そらの みやこ アウラ',type:'ring',w:30,seed:1717,ground:'o',road:'w',bands:['bld','road','plaza','bld','road'],landmark:'skystatue',roofs:['白','青'],trees:['p'],edge:'v',plaza:'w',noTrees:1,
    sign:'そらの みやこ アウラ　―なまえの ない かみを まつる みやこ―',barrels:1,pots:3,loot:['frag','herb3','frag'],
    bld:[{t:'church',name:'なまえの ない かみの しんでん',book:'「かみの なまえを よんでは ならない。 よべば かみは めざめ、 わすれを もたらす」'},{t:'inn',price:20},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','wing','smoke']},
      {t:'arms',goods:['sword11','knife11','axe10','staff10','heavy11','light11','robe11','shield11']},{t:'house',npcs:[{pal:'king',talk:skyElder}],loot:['frag']}],
    npcs:[{at:'plaza',pal:'woman',talk:by([true,['そらびと「わたしたちは なまえの ない かみを まもる いちぞく。 でも ひがしの しんでんに まりゅうが すみついて…」']])},
      {at:'road',pal:'sage',talk:by([true,['そらびと「せんねんまえ、 ひとりの えいゆうが ここで かみを その みに ふうじた と つたわる。」']])}]});
  icon('world',76,10,'5','skycity');
  DUNGEONS.push({id:'cloud',name:'くもの しんでん',floors:4,w:21,h:15,wall:'v',floor:'w',rooms:2,loops:.08,up:1,zone:'cloud',area:'sky',seed:1717,per:2,
    loot:['herb3','frag',{gold:1500},'drop','life','frag','herb3'],feat:['switch','lock secret','switch lock','lock'],boss:'maryu',reward:'mirrorShard',
    intro:['「…ほう。 そらの したの ものが ここまで。」','てんくうの まりゅう「ムメイさまの めいで、 この しんでんを ふさいで いる。 とおりたくば、 しね！」']});
  icon('world',81,9,'9','cloud1');
  IT.mirrorShard={n:'かがみの かけら',key:1,d:'とうだいの ひかりを うけると、 うらがえしの せかいへの とびらを ひらく という。'};
  MON.maryu=B_(Object.assign({n:'てんくうの まりゅう',s:'dragon',p:{1:'#4ab080',2:'#2a7050',3:'#e0f0c0'},p2:{1:'#3a6ad0',2:'#1a3a90',3:'#ffffff'},scale:4.4},bstat(42,17,{turns:13}),{
    phases:[{moves:[M_('attack',3),M_('breath',3,'まりゅうは あらしの ブレスを はいた！',{f:.14}),M_('sleepAll',1,'まりゅうの かみなりの ほうこう！',{ch:.25}),M_('poison',1,'まりゅうは どくの つめで ひっかいた！')]},
            {at:.5,alt:1,acts:.5,say:'まりゅう「そらは ムメイさまの もの！」',moves:[M_('attack',3),M_('breath',2,'まりゅうは あらしの ブレスを はいた！',{f:.15}),M_('summon',1,'まりゅうは ストームドラゴンを よびよせた！',{id:'stormdrake'}),
              M_('prep',2,'まりゅうの まわりに あらしが うずまきはじめた！',{next:M_('breath',0,'まりゅうの だいせんぷう！',{f:.3})})]}]}));
  GOALS[17]=()=>!S.flags.boss_cloud?'そらとぶ ふねで きたの そらの しまへ。 アウラの ひがしの『くもの しんでん』で まりゅうを たおそう。':'かがみの かけらを もって、 アカリの とうだいへ。';
}
async function skyElder(){
  await lines(S.flags.boss_cloud?['そらの おさ「まりゅうを たおして くれたか。 かがみの かけらは、 とうだいの ひかりで うらがえしの せかいへの まどと なる。」','そらの おさ「わすれられた ものたちは、 みな その せかいで くらして いるのだ。」']
    :['そらの おさ「ちじょうの ものよ。 わたしたちは『なまえの ない かみ』を まつる。 その かみの なまえは、 だれも しらない。」']);
}

/* ---------- 18〜21しょう うらがえしの せかい ---------- */
function makeMirror(){
  const T={'.':'x','T':'T',':':':','z':'x','P':'T','路':'x','%':'%','^':'^','~':'~','o':'x','藪':'x','岩':'x'};
  const rows=MAPS.world.rows.map(r=>[...r].reverse().map(c=>T[c]||(c==='='?'=':'x')).join(''));
  // かわを わたれる ように
  for(let y=54;y<118;y++){const x=WW-1-67; if(rows[y][x]==='~'&&y===86){} }
  for(const x of [91,92,93]) rows[86]=rows[86].slice(0,x)+'='+rows[86].slice(x+1);
  MAPS.mirror={id:'mirror',name:'うらがえしの せかい',rows,out:'~',bgm:'mirror',kind:'world',enc:()=>'mirror',links:{},npcs:[],chests:[],objs:[],tint:'rgba(80,0,90,.28)',hid:[]};
}
const MX=x=>WW-1-x;
function defineCh18(){
  makeMirror();
  buildTown({id:'makari',name:'うらがえしの アカリ',type:'harbor',w:34,seed:1801,bands:['park','bld','road','plaza','bld','road','pier'],landmark:'lighthouse',roofs:['黒','紫'],trees:['Y'],ground:'x',road:'道',bgm:'mirror',
    sign:'うらがえしの アカリ　―わすれられた ものの まち―',barrels:2,pots:2,loot:['frag','herb3'],
    bld:[{t:'house',name:'うらがえしの じぶんの いえ',npcs:[{pal:'mio',shadow:1,talk:by([true,['かがみの ミオ「ここは、 だれかに わすれられた ものが くる せかい。」','かがみの ミオ「わたしも 5ねん、 ここに いたの。 …あなたが みつけて くれるまで。」']])}],loot:['frag']},
      {t:'inn',price:22},{t:'item',goods:['herb2','herb3','antidote','bell','drop','life','smoke']},{t:'arms',goods:['sword12','knife12','axe11','staff11','heavy12','light12','robe12','shield12']},{t:'church'}],
    npcs:[{at:'plaza',pal:'woman',shadow:1,talk:by([true,['わすれられた ひと「わたしたちは みんなを おぼえてる。 でも だれも わたしたちを おぼえてない。」','「ここでは、 よばれた なまえだけが ひかりに なるの。」']])},
      {at:'road',pal:'sage',shadow:1,talk:by([true,['わすれられた ろうじん「ムメイは この せかいの まんなかの『わすれの とう』に いる。」','「だが とうは ふういんされておる。 ムメイ じしんの きおくが かぎじゃ と いう。」']])},
      {at:'pier',pal:'sailor',shadow:1,talk:by([true,['「とうだいもりの だんなを みたよ。 ひがしの『わすれの こうや』の ほうへ いった。 ずいぶん まえの はなしだがな。」']])}]});
  const lmM=MAPS.makari.marks.find(m=>m.kind==='lighthouse');
  icon('mirror',MX(16),106,'G','makari');
  // ほんものの とうだい → かがみの とうだい
  const L=MAPS.akari_lh; L.rows[2]=L.rows[2].slice(0,1)+'釦'.replace('釦','u')+L.rows[2].slice(2); L.links['1,2']=['makari',0,0];
  LINK_GATE['akari_lh:1,2']=()=>has('mirrorShard')?null:['かべに ふしぎな かがみの わくが ある。 なにかを はめこめそうだ…'];
  addDoor('makari',lmM.x,lmM.y+lmM.h-1,'akari_lh',1,3,'down');
  DUNGEONS.push({id:'mlight',bgm:'mirror',name:'かがみの とうだい',floors:4,w:19,h:15,wall:'l',floor:'i',rooms:2,loops:.07,up:1,zone:'mlight',area:'dark',seed:1818,per:2,worldMap:'mirror',
    loot:['herb3','frag',{gold:1800},'life','drop','frag','herb3'],feat:['lock','switch','lock secret','switch lock'],darkAll:1,boss:'mirrorme',reward:'frag',
    intro:['「…よく きたな。 おれ。」','かがみの じぶん「おれは おまえが わすれた おまえ。 いもうとを わすれて へいきで くらしていた、 5ねんぶんの おまえだ。」','かがみの じぶん「おまえに、 ひとを すくう しかくが あるのか？」']});
  icon('mirror',MX(10),102,'R','mlight1');
  MON.mirrorme=B_(Object.assign({n:'かがみの じぶん',s:'shade',p:{1:'#c0c8e0',2:'#8088a8',e:'#ff40ff'},scale:3.8},bstat(44,18,{turns:13}),{
    phases:[{moves:[M_('attack',4),M_('mag',2,'かがみの じぶんは ひかりの つるぎを はなった！',{f:.2}),M_('heal',1,'かがみの じぶんは いやしの じゅもんを となえた！',{f:.08,max:2}),M_('charge',1,'かがみの じぶんは つるぎを かまえた…')]},
            {at:.5,acts:.45,say:'かがみの じぶん「わすれた ことは なかった ことに ならない！」',moves:[M_('attack',3),M_('breath',3,'かがみの じぶんは ほしくずの あめを ふらせた！',{f:.15}),
              M_('prep',2,'かがみの じぶんの つるぎが くろく ひかった…',{next:M_('breath',0,'かがみの じぶんの くろい あかつき！',{f:.3})})]}]}));
  GOALS[18]=()=>!S.flags.boss_mlight?'かがみの かけらを もって アカリの とうだいへ。 うらがえしの せかいの『かがみの とうだい』を のぼろう。':'うらがえしの とりでへ。（にし）';
}
function defineCh19(){
  buildTown({id:'mfort',name:'うらがえしの とりで',type:'castle',w:30,seed:1901,bands:['castle','road','bld','road'],roofs:['黒'],ground:'x',edge:'X',plaza:'s',bgm:'mirror',
    castle:{name:'うらがえしの おおひろま',npcs:[{pal:'guard',shadow:1,at:[8,3],talk:by([true,['わすれられた へいし「たいちょうの たましいは、 ちかの くろい へやで まだ たたかっている。」']])}]},
    bld:[{t:'inn',price:24},{t:'item',goods:['herb3','antidote','bell','drop','life','smoke']},{t:'arms',goods:['sword12','axe11','heavy12','shield12']}],
    npcs:[{at:'gate',pal:'guard',shadow:1,talk:by([true,['わすれられた へいし「ここは わすれられた へいしの とりで。 ガルム… おまえの ことは みんな おぼえている。」']])}]});
  icon('mirror',MX(78),62,'K','mfort');
  const from=stairsIn('mfort_castle',14,11,'mfortD1');
  DUNGEONS.push({id:'mfortD',bgm:'mirror',name:'かがみの ちかどう',floors:4,w:21,h:15,wall:'X',floor:'s',rooms:2,loops:.07,zone:'mfort',area:'dark',seed:1919,per:2,worldMap:'mirror',from:['mfort_castle',13,11,'left'],
    loot:['herb3','frag',{gold:2000},'life','drop','frag','herb3'],feat:['switch','lock','crack lock','switch secret'],boss:'truecaptain',reward:'oathMail',
    intro:['「…ガルム。 おおきく なったな。」','たいちょう バルドの たましい「わたしは ここで わすれの かみと たたかい つづけて きた。 だが もう、 こころが のまれかけて いる。」','バルド「ガルム、 おまえの ちかいで わたしを とめろ！」']});
  IT.oathMail={n:'ちかいの よろい',slot:'a',def:80,only:['garm'],price:0,d:'たいちょう バルドの よろい。'};
  MON.truecaptain=B_(Object.assign({n:'たいちょう バルド',s:'knight',p:{1:'#7a3a4a',2:'#4a1a2a',3:'#e0c040',e:'#ffffff'},scale:3.8},bstat(46,19,{turns:13}),{
    phases:[{moves:[M_('attack',4),M_('str',2,'バルドの けんが うなる！'),M_('charge',1,'バルドは たてを かまえ、 ちからを ためている…'),M_('breath',1,'バルドの なぎはらい！',{f:.15})]},
            {at:.5,alt:1,acts:.45,say:'バルド「ガルム！ おまえの ちかいは なんだ！ さけべ！」',moves:[M_('attack',3),M_('breath',2,'バルドの なぎはらい！',{f:.16}),
              M_('prep',2,'バルドは けんを たかく かかげた！',{next:M_('breath',0,'バルドの ちかいの おおぎり！',{f:.3})})]}]}));
  GOALS[19]=()=>!S.flags.boss_mfortD?'うらがえしの とりでの ちかどうで、 たいちょう バルドの たましいと むきあおう。':'うらがえしの サンドラへ。（ひがし）';
}
function defineCh20(){
  buildTown({id:'msandra',name:'うらがえしの サンドラ',type:'market',w:34,seed:2001,ground:':',bands:['bld','road','market','road','bld','road'],roofs:['黒','紫'],trees:['k'],edge:'D',plaza:'s',bgm:'mirror',
    sign:'うらがえしの サンドラ　―なまえいしに なった ひとびとの まち―',barrels:3,pots:2,loot:['frag','herb3'],
    bld:[{t:'guild',name:'かげの ギルド',talk:by([true,['かげの うけつけ「おやかたは ちかで なまえいしを かぞえて いる。」']]),pal:'merchant'},{t:'inn',price:26},{t:'item',goods:['herb3','antidote','bell','drop','life','smoke']},
      {t:'house',name:'リリの かぞくの いえ',npcs:[{pal:'woman',shadow:1,talk:ririFamily},{pal:'kid',shadow:1,talk:ririFamily}],loot:['frag']}],
    npcs:[{at:'market',pal:'merchant',shadow:1,talk:by([true,['かげの しょうにん「なまえいしに された ものは、 ここで かげに なる。 おやかたが いしを もつ かぎり、 もとには もどれん。」']])}]});
  icon('mirror',MX(80),80,'G','msandra');
  const gm=mapByName('かげの ギルド');
  stairsIn(gm,11,7,'mvault1');
  DUNGEONS.push({id:'mvault',bgm:'mirror',name:'うらがえしの ちかこ',floors:4,w:21,h:15,wall:'X',floor:'s',rooms:1,loops:.06,zone:'mvault',area:'dark',seed:2020,per:2,worldMap:'mirror',from:[gm,10,7,'left'],
    loot:['herb3','frag',{gold:2200},'life','drop','frag','herb3'],feat:['guard','guard lock','switch secret','guard lock'],guardsPer:3,boss:'oyakata',reward:'frag',
    intro:['「くっくっ… なまえいしは すべて わたしの もの。」','かげの おやかた「その こむすめの かぞくの いしも なあ！」','リリ「かえして！ あたしの かぞくを かえして！」']});
  MON.oyakata=B_(Object.assign({n:'かげの おやかた',s:'lord',p:{1:'#3a3a3a',2:'#1a1a1a',3:'#e0c040',w:'#a0a0a0',e:'#ff4040'},scale:4},bstat(48,20,{turns:13}),{
    phases:[{moves:[M_('attack',3),M_('summon',2,'おやかたは かげの てしたを よんだ！',{id:'urakage'}),M_('mag',2,'おやかたは のろいの きんかを なげた！',{f:.2}),M_('mist',1,'おやかたは どくの けむりを まいた！',{f:.1})]},
            {at:.5,acts:.45,say:'おやかた「くそっ！ いしを まもれ！」',moves:[M_('attack',3),M_('summon',1,'おやかたは かげの てしたを よんだ！',{id:'urakage'}),M_('breath',2,'おやかたは きんかの あらしを おこした！',{f:.15}),
              M_('prep',2,'おやかたは なまえいしを たかく かかげた！',{next:M_('breath',0,'おやかたの なまえいし ばくはつ！',{f:.3})})]}]}));
  GOALS[20]=()=>!S.flags.boss_mvault?'うらがえしの サンドラの『かげの ギルド』から ちかこへ。 リリの かぞくの なまえいしを とりもどそう。（みはりに ちゅうい）':'みなみの『わすれの こうや』で、 ちちを さがそう。';
}
async function ririFamily(){
  if(S.flags.ririFamily){await lines(['（かげは もう いない。 ほんものの サンドラへ かえったのだ）']); return;}
  if(S.flags.boss_mvault&&has('ririStone')){
    msgClear(); delItem('ririStone');
    await say('リリ「…おかあさん。 ルカ。 これ、 あたしたちの なまえいし。」');
    await say('リリが いしを にぎりしめて なまえを よぶと、 かげが ひかりに かわった！');
    await say('リリの はは「…リリ？ リリなのね！ マヤよ、 おかあさんよ！」');
    await say('リリの おとうと「ねえちゃん！ ルカだよ！」');
    await say('リリ「…うん。 うん！ ずっと、 ずっと さがしてた…！」');
    S.flags.ririFamily=1; const r=memberOf('riri'); if(r){r.agi+=6; r.str+=4;} sfx.lvl();
    await say('リリの すばやさと ちからが あがった！ リリの かぞくは ほんものの サンドラへ かえっていった。');
    msgClose(); await startChapter(21); return;
  }
  await lines(['かげの おんな「…あなたは だれ？ どこかで あった きが する…」']);
}
function defineCh21(){
  DUNGEONS.push({id:'waste',bgm:'mirror',name:'わすれの こうや',floors:4,w:23,h:15,wall:'I',floor:'i',rooms:3,loops:.08,zone:'waste',area:'abyss',seed:2121,per:2,worldMap:'mirror',
    loot:['herb3','frag',{gold:2400},'life','drop','frag','herb3'],feat:['crack','switch lock','secret','lock'],darkAll:1,boss:'kyojin',reward:'frag',
    intro:['「…ズシン… ズシン… この さきには いかせぬ…」','わすれの きょじん「この おとこは わすれの かみへの いけにえ！」','とうだいもりの ちち「…ミオ？ その こえは ミオ なのか！」']});
  icon('mirror',MX(84),104,'C','waste1');
  MON.kyojin=B_(Object.assign({n:'わすれの きょじん',s:'golem',p:{1:'#7a7a8a',2:'#4a4a5a',e:'#ff40ff'},p2:{1:'#9a5a8a',2:'#5a2a5a',e:'#ffffff'},scale:4.4},bstat(50,21,{turns:13}),{
    phases:[{moves:[M_('attack',4),M_('charge',2,'きょじんは おおきく こぶしを ふりあげた…'),M_('breath',2,'きょじんは だいちを ふみならした！',{f:.15})]},
            {at:.5,alt:1,acts:.45,say:'きょじん「わすれろ… すべて… わすれろ…！」',moves:[M_('attack',3),M_('mist',2,'きょじんは わすれの ちりを まきあげた！',{f:.11}),
              M_('prep',2,'きょじんの からだに ひびが はしり、 ひかりが もれだした…',{next:M_('breath',0,'きょじんの ほうかい！',{f:.3})})]}]}));
  GOALS[21]=()=>!S.flags.boss_waste?'うらがえしの せかいの みなみ、『わすれの こうや』の おくで ちちを たすけよう。':'…';
}
async function afterKyojin(){
  msgClear();
  await say('ちち「…ミオ。 それに、 おおきく なったな。」');
  await say(`ミオ「おとうさん！」 ${HN()}「とうさん…！」`);
  await say('ちち「ミオの なまえを とりもどそうと、 この せかいに きた。 だが わしも わすれの かみに なまえを くわれかけてな。」');
  await say('ちち「ここで ムメイの きおくの かけらを みつけた。 ムメイの ほんとうの なまえは、 せんねん まえに すてられて いる。」');
  await say('ちち「きおくの かけらに ふれれば、 かれの すごした ときを みられる はずだ。 …いくか？」',{wait:'none'});
  await yesNo(); msgClear();
  S.guest={name:'ちち',pal:'father'}; S.flags.father=1;
  await say('ちちが いっしょに くる ことに なった！');
  msgClose(); await startChapter(22); await flashback();
}

/* ---------- 22しょう ムメイの きおく（かこへん） ---------- */
function defineCh22(){
  buildTown({id:'past',name:'せんねんまえの おうと',type:'castle',w:32,seed:2201,bands:['castle','road','bld','road','plaza','bld','road'],roofs:['赤','青','白'],trees:['Y'],plaza:'s',landmark:'bigfountain',
    castle:{name:'せんねんまえの おうきゅう',npcs:[{id:'pastKing',pal:'king',at:[8,2],talk:pastKing}]},
    bld:[{t:'inn',price:1},{t:'house',npcs:[{pal:'woman',talk:by([true,['「えいゆう セイルさま！ あなたの なまえは とわに かたりつがれますわ！」']])}]},
      {t:'church',book:'「えいゆう セイル。 ほしの つるぎで わすれの かみと たたかう もの」'},{t:'house',npcs:[{pal:'kid',talk:by([true,['「ぼく おおきく なったら セイルさまみたいな えいゆうに なる！」']])}]}],
    npcs:[{at:'plaza',pal:'guard',talk:by([true,['「セイルさま、 おうが およびです。 わすれの かみが せまって おります！」']])},
      {at:'road',pal:'merchant',talk:by([true,['「セイルさまの なまえを くちに するだけで、 ゆうきが わくよ！」']])}]});
  MAPS.past.edgeExit=0;
}
async function flashback(){
  msgClear();
  await say('きおくの かけらに ふれると、 まわりの けしきが しろく とけていった…'); msgClose();
  S.saved={party:S.party,reserve:S.reserve,guest:S.guest,map:S.map,x:P.x,y:P.y};
  S.party=[Object.assign(mkMember('mumei','セイル',50,{}),{name:'セイル'})]; S.reserve=[]; S.guest=null;
  await fadeOut(800); S.map='past'; const e=MAPS.past.entry; P.x=e[0]; P.y=e[1]; P.dir='up'; trail=[]; loadNPCs(); playBgm('town'); await fadeIn(800);
  msgClear(); await say('―― せんねんまえ ――'); await say('（あなたは いま、 えいゆう セイルと して この まちに いる）'); msgClose();
}
async function pastKing(){
  msgClear();
  await say('おう「セイルよ。 わすれの かみが おうとに せまって いる。 すべての なまえを くらい、 せかいを まっしろに する かみだ。」');
  await say('おう「おまえの ほしの つるぎだけが たよりだ。 たのむ。」'); msgClose();
  const r=await battle(['wasurekami0'],{boss:1,area:'castle',limit:3,noDefeat:1}); S.party.forEach(p=>{if(p.hp<=0) p.hp=1;});
  msgClear();
  await say('セイル「…たおせない。 この かみは、 なまえが ある かぎり よみがえる。」');
  await say('セイル「ならば… わたしの なかに ふうじる。 わたしの なまえを かぎに して。」'); flash('#ffffff',800); shake();
  await say('セイルは わすれの かみを じぶんの なかに ふうじこめた。');
  await say('おう「…セイル。 おまえの なまえを よべば、 ふういんが ゆるむ と だいしんかんが いう。」');
  await say('おう「だから… すまない。 わたしたちは おまえの なまえを、 れきしから けす。 だれも よばぬ ように。」');
  await say('セイル「……。」');
  await say('セイル「わかりました。 みんなが へいわに くらせるなら。」');
  await say('―― そして、 えいゆうの なまえは きえた。 せんねん、 だれにも よばれず。 くらやみの なかで、 かみの ささやきだけが きこえた。');
  await say('――『おまえを わすれた ものたちに、 わすれられる いたみを おしえて やれ』と。');
  msgClose(); await fadeOut(1000);
  Object.assign(S,{party:S.saved.party,reserve:S.saved.reserve,guest:S.saved.guest}); const sv=S.saved; delete S.saved;
  S.map=sv.map; P.x=sv.x; P.y=sv.y; trail=[]; loadNPCs(); playBgm(mapBgm()); await fadeIn(1000);
  msgClear();
  await say('ミオ「…いまの、 ムメイの きおく。 ムメイの ほんとうの なまえは…」');
  await say(`${HN()}は その なまえを むねに きざんだ。`);
  await say('ちち「わすれの とうへ いこう。 ムメイの なまえを、 よんで やる ために。」');
  S.flags.flashback=1; msgClose(); await startChapter(23);
}
MON.wasurekami0=B_(Object.assign({n:'わすれの かみ',s:'eye',p:{1:'#f0f0f0',2:'#c0c0c0',e:'#000000',w:'#ffffff'},scale:4.4},bstat(50,22,{turns:8,atk:.5}),{hp:99999,
  phases:[{moves:[M_('attack',3),M_('breath',2,'わすれの かみは まっしろな ひかりを はなった！',{f:.05})]}]}));

/* ---------- 23〜24しょう わすれの とう ---------- */
function defineCh23(){
  DUNGEONS.push({id:'final',name:'わすれの とう',floors:7,w:21,h:15,wall:'l',floor:'i',rooms:2,loops:.07,up:1,zone:'final',area:'nox',seed:2323,per:2,worldMap:'mirror',bgm:'mirror',bossBgm:'dungeon',
    loot:['herb3','frag','life','drop','herb3','frag','life','drop','herb3','frag'],feat:['lock','switch','lock secret','switch lock','lock','switch secret',''],darkAll:1,
    mids:[{floor:2,mon:'gen1',intro:['わすれの しと ヴェール「ここから さきは とおさぬ。」']},{floor:4,mon:'gen2',intro:['わすれの しと ネル「なまえなど、 くさりに すぎない。」']},{floor:6,mon:'gen3',intro:['わすれの しと オブリ「ムメイさまの いたみを しれ。」']}],
    boss:'mumei',reward:null,
    intro:['ムメイ「…きたか。 わたしの きおくを のぞいた ものたちよ。」','ムメイ「わかったろう。 せかいは わたしを すてた。 だから わたしも、 せかいの なまえを すべて すてる。」','ムメイ「わすれられる いたみを、 だれもが しるが いい！」']});
  icon('mirror',MX(46),70,'!','final1',{gate:()=>(S.ch||1)>=23?null:['くろい けっかいが とうを つつんでいる。 だれかの きおくが かぎに なっている らしい。']});
  const gens=[['gen1','わすれの しと ヴェール','shade',{1:'#140a20',2:'#0a0510',e:'#ff2040'}],['gen2','わすれの しと ネル','mage',{1:'#1a1a3a',2:'#0a0a1a',3:'#40ffff',e:'#ff40ff'}],['gen3','わすれの しと オブリ','knight',{1:'#2a1a2a',2:'#140a14',3:'#ff80ff',e:'#ffffff'}]];
  gens.forEach(([k,n,s,p],i)=>{MON[k]=B_(Object.assign({n,s,p,scale:3.8},bstat(51+i,23,{turns:9,expMul:.7}),{
    phases:[{moves:[M_('attack',3),M_(i===1?'mag':'str',3,`${n}の こうげき！`,{f:.2}),M_(i===0?'sleepAll':i===1?'mist':'charge',2,i===0?`${n}は わすれの うたを うたった！`:i===1?`${n}は わすれの きりを はいた！`:`${n}は ちからを ためている…`,{f:.1,ch:.3})]},
            {at:.5,acts:.4,say:`${n}「ムメイさまの ために！」`,moves:[M_('attack',3),M_('breath',3,`${n}の くろい あらし！`,{f:.15})]}]}));});
  MON.mumei=B_(Object.assign({n:'ムメイ',s:'lord',p:{1:'#1a1a2a',2:'#0a0a14',3:'#a080ff',w:'#e0e0f0',e:'#ff2040'},p2:{1:'#2a0a2a',2:'#140514',3:'#ff80ff',w:'#ffffff',e:'#ffffff'},scale:4.2},bstat(56,24,{turns:13}),{
    phases:[{moves:[M_('attack',3),M_('mag',3,'ムメイは なまえけしの ひかりを はなった！',{f:.2}),M_('sleepAll',1,'ムメイは わすれの うたを うたった！',{ch:.3}),M_('mist',2,'ムメイは わすれの きりを はいた！',{f:.1})]},
            {at:.5,alt:1,acts:.45,say:'ムメイ「なぜだ… なぜ おまえたちは、 わたしの まえで なまえを よびあえる…！」',moves:[M_('attack',3),M_('breath',3,'ムメイは くろい もじの あらしを おこした！',{f:.15}),
              M_('prep',2,'ムメイの まわりで せかいの なまえが きえていく…',{next:M_('breath',0,'ムメイの むめいの さばき！',{f:.3})})]}]}));
  MON.oblivion=B_(Object.assign({n:'わすれの かみ',s:'eye',p:{1:'#f0f0f0',2:'#c0c0c0',e:'#000000',w:'#ffffff'},form2:{n:'わすれの かみ（しんのすがた）',s:'dragon',p:{1:'#e8e8f0',2:'#a0a0b0',3:'#ffffff',e:'#000000'},scale:5},scale:4.4},bstat(57,24,{turns:20}),{
    phases:[{moves:[M_('attack',3),M_('breath',3,'わすれの かみは まっしろな ひかりを はなった！',{f:.13}),M_('sleepAll',1,'わすれの かみは きおくを ぬりつぶす うたを うたった！',{ch:.25}),M_('mist',2,'わすれの かみは わすれの きりを はいた！',{f:.09})]},
            {at:.6,form:1,acts:.45,say:'わすれの かみ「…よばれぬ なまえは、 わたしの もの。 すべて しろく ぬりつぶして くれる！」',moves:[M_('attack',3),M_('breath',3,'わすれの かみは まっしろな ブレスを はいた！',{f:.15}),M_('summon',1,'わすれの かみは わすれの しとを よびだした！',{id:'wasureshito'}),M_('charge',1,'わすれの かみは つめを とぎすましている…')]},
            {at:.25,acts:.6,say:'わすれの かみ「きえよ！ なまえも、 おもいでも、 ほしも！」',moves:[M_('attack',2),M_('breath',3,'わすれの かみは まっしろな ブレスを はいた！',{f:.15}),M_('mag',2,'わすれの かみは きおくを くらう かみつきを はなった！',{f:.3}),
              M_('prep',3,'わすれの かみが せかいの いろを すいこみはじめた…',{next:M_('breath',0,'わすれの かみの ホワイトアウト！',{f:.34})})]}]}));
  MON.oblivion.exp=0; MON.oblivion.g=0;
  GOALS[23]=()=>'うらがえしの せかいの まんなかの『わすれの とう』を のぼろう。';
  GOALS[24]=()=>'わすれの とうの ちょうじょうで、 ムメイと むきあおう。';
}
async function afterMumei(){
  S.flags.mumeiDown=1; msgClear();
  await say('ムメイ「…まだだ… わたしは まだ…」');
  await say('ミオ「…ムメイ。 ううん、 ちがう。」');
  await say(`${HN()}は、 かこで しった その なまえを よんだ。`,{wait:'none'});
  const opts=['セイル','ゾルガ','バルド','ゲンゾウ'];
  while(true){
    const m=new Menu({title:'ムメイの ほんとうの なまえは？',items:opts,style:{left:'20%',top:'20%',width:'60%'}}); const i=await m.pick(); m.close();
    if(opts[i]==='セイル') break; msgClear(); sfx.bump(); await say('…ちがう。 その なまえでは ない。 かこで みた えいゆうの なまえを おもいだそう。',{wait:'none'});
  }
  msgClear(); flash('#ffffff',900);
  await say(`${HN()}「セイル！！」`);
  await say('ミオ「セイル！」 ちち「セイル！」 なかまたち「セイル！」');
  await say('セイル「…ああ。 よばれた。 せんねんぶりに… わたしの なまえが…」');
  await say('セイル「…ありがとう。 だが きを つけろ。 わたしの なかから、 かみが でてくる…！」'); shake(); flash('#ffffff',600);
  await say('セイルの からだから、 まっしろな なにかが あふれだした！');
  msgClose();
  const r=await battle(['oblivion'],{boss:1,area:'nox',bgm:'last'});
  if(r==='win') await ending2();
  else {delete S.flags.boss_final; loadNPCs(); msgClear(); await say('（わすれの とうの ちょうじょうで、 もういちど わすれの かみに いどもう）'); msgClose();}
}

/* ---------- クリアご：ほしかげの いせき ---------- */
function definePost(){
  DUNGEONS.push({id:'ruins7',name:'ほしかげの いせき',floors:7,w:23,h:17,wall:'I',floor:'i',rooms:3,loops:.08,zone:'ruins7',area:'abyss',seed:2525,per:3,
    loot:['herb3','frag','life','drop','frag','herb3','life','frag','drop','frag','fstar'],feat:['lock','switch secret','lock crack','switch lock','secret','lock','switch'],darkAll:1,boss:'phantom',reward:'fcrown',
    intro:['「…よく きた。 ほしかげの けんを うけつぐ ものよ。」','ほしかげの まぼろし「わたしは せんねんまえ、 よぞらに ほしを とりもどした ゆうしゃの まぼろし。」','まぼろし「おまえたちの『なまえを よぶ ちから』、 ためさせて もらうぞ！」']});
  icon('world',150,8,'B','ruins71',{gate:()=>S.flags.clear?null:['ふしぎな ほしの ひかりが うずまいている… いまは まだ はいれない。']});
  MON.phantom=B_(Object.assign({n:'ほしかげの まぼろし',s:'lord',p:{1:'#e8e0a0',2:'#a89040',3:'#ffffff',w:'#ffffff',e:'#4080ff'},p2:{1:'#ffe060',2:'#c0a020',3:'#ffffff',w:'#ffffff',e:'#ff4040'},scale:4.4},bstat(70,25,{turns:18,atk:1.05}),{
    phases:[{acts:.4,moves:[M_('attack',3),M_('breath',3,'まぼろしは ほしくずの あめを ふらせた！',{f:.15}),M_('heal',1,'まぼろしは いやしの ひかりに つつまれた！',{f:.06,max:3}),M_('sleepAll',1,'まぼろしは まどろみの ほしを ひからせた！',{ch:.3})]},
            {at:.5,alt:1,acts:.6,say:'まぼろし「みごとだ！ ならば わたしも ほんきを だそう！」',moves:[M_('attack',3),M_('breath',3,'まぼろしは ほしくずの あめを ふらせた！',{f:.16}),M_('charge',1,'まぼろしは つるぎに ほしの ひかりを あつめている…'),
              M_('prep',2,'よぞらの ほしが まぼろしの つるぎに あつまっていく…！',{next:M_('breath',0,'まぼろしの ほしかげ いちもんじ！',{f:.36})})]}]}));
}

/* ---------- エンディング ---------- */
async function ending2(){
  msgClear();
  await say('わすれの かみ「…なぜ… よばれる なまえが… こんなにも…」'); flash('#ffffff',1000); shake();
  await say('わすれの かみは、 しろい ひかりの つぶに なって きえていった。');
  await say('セイル「…ありがとう。 これで ほんとうに ねむれる。」');
  await say('セイル「わたしの なまえを、 ときどき よんで おくれ。 それだけで いい。」');
  await say('セイルは ほほえんで、 ほしの ひかりに とけていった。');
  S.flags.clear=1; S.ch=25; S.guest=null; msgClose(); await fadeOut(1200);
  mode='ending'; endStars=0; playBgm('ending'); await fadeIn(1200);
  const grow=setInterval(()=>{endStars=Math.min(stars.length,endStars+1);},120);
  msgClear();
  const roll=[
    'せかいじゅうで、 わすれられて いた なまえが もどっていく。',
    'フローラの はなの むすめ リナ。 はしもりの ゲンゾウ。 かねつきの ヨハン。',
    'とりでの たいちょう バルド。 こおりの おう アイスバーン。 こびとの ちょうろう ポコ。',
    S.flags.saveNene?'まじょの むすめ ネネ。 リリの はは マヤと、 おとうと ルカ。':'リリの はは マヤと、 おとうと ルカ。 そして こおりの なかで ねむる ネネ。',
    'けんし ジン。 まじょ オルガ。 きし ガルム。 とうぞく リリ。',
    'そして、 せんねんぶりに なまえを よばれた えいゆう セイル。',
    `── アカリの まち。 とうだいの ひかりの したの いえで、 はは が おさらを ならべている。`,
    'はは「1まい、 2まい、 3まい… 4まい。」',
    `はは「ふふ。 こんどは ちゃんと、 みんなの ぶんよ。」`,
    `ちちと、 ミオと、 ${HN()}。 4にんの なまえを よびあう こえが、 よる おそくまで ひびいた。`,
  ];
  for(const t of roll) await say(t);
  msgClose(); clearInterval(grow); endStars=stars.length;
  endUI=document.createElement('div'); endUI.className='end';
  endUI.innerHTML=`<div class="logo">ほしかげの剣 II</div><p>― なまえを なくした せかい ―　おわり</p><p>あそんでくれて ありがとう！</p><p style="font-size:2.6cqw;color:var(--sub)">${[...S.party,...(S.reserve||[])].map(p=>p.name+' Lv'+p.lv).join('　')}</p><p style="font-size:2.6cqw;color:var(--sub)">クエスト ${Object.values(S.q||{}).filter(v=>v==='done').length}／${Object.keys(QUESTS).length}　ほしのかけら ${S.frags||0}／100</p><p style="font-size:2.6cqw;color:var(--sub)">クリアご：きたひがしの はての しまに『ほしかげの いせき』が ひらいた</p>`;
  ui.appendChild(endUI);
  const m=new Menu({items:['ぼうけんを つづける'],cancel:false,style:{left:'50%',bottom:'3%',transform:'translateX(-50%)'}});
  if(AUTO){m.close();} else {await m.pick(); m.close();}
  endUI.remove(); endUI=null;
  await fadeOut(500);
  mode='field'; S.map='akari_0'; S.veh=null; P.x=4; P.y=5; P.dir='up'; P.moving=false; trail=[]; loadNPCs(); playBgm('town'); saveGame();
  await fadeIn(500);
}
