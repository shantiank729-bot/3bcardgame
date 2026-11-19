/* ---------- 7しょう ちかいの とりで ---------- */
function defineCh7(){
  buildTown({id:'fort',name:'ちかいの とりで',type:'castle',w:30,seed:707,bands:['castle','road','bld','road','park'],roofs:['黒','青'],trees:['Y'],plaza:'s',edge:'X',
    castle:{name:'とりでの おおひろま',npcs:[{id:'fortCmd',pal:'guard',at:[8,4],talk:fortCommander}]},
    sign:'ちかいの とりで　―ここを とおさぬ ことを ちかう―',barrels:3,pots:1,loot:['frag','herb2',{gold:100}],
    bld:[{t:'inn',price:12},{t:'item',goods:['herb2','antidote','bell','drop','life','wing','smoke']},{t:'arms',goods:['sword6','axe5','heavy6','shield6','knife6','light6','staff5','robe6']},
      {t:'house',name:'へいしの つめしょ',npcs:[{pal:'guard',talk:tagQuest}],book:'へいしの めいぼ。 なまえの らんが ところどころ まっしろに なっている。',loot:['frag']}],
    npcs:[{at:'gate',pal:'guard',talk:by([F('siege'),['「ぼうえいせんの えいゆうだ！ さあ とおって くれ。」']],[true,['「まものの むれが まいばん せめて くる。 もう もちこたえられん…」']])},
      {at:'road',pal:'sage',talk:by([true,['ろうへい「この とりでの たいちょうは りっぱな かただった。 …なのに、 なまえが おもいだせん。」','ろうへい「たいちょうの そばには いつも、 おおきな たてを もった わかい きしが いた。」']])}]});
  icon('world',78,62,'K','fort');
  DUNGEONS.push({id:'fortu',name:'とりでの ちかどう',floors:3,w:21,h:15,wall:'X',floor:'s',rooms:2,loops:.07,zone:'fortu',area:'castle',seed:707,per:2,from:null,
    loot:['herb2','frag','tag4',{gold:220},'life','tag5','drop'],feat:['lock','switch crack','lock secret'],boss:'taichou',reward:'oathSword',
    intro:['「…ガルム。 おまえか。」','わすれの たいちょう「わたしは… だれだ。 なにを まもって いた…？ わからぬ… わからぬのだ！」','ガルム「たいちょう！ おれです、 ガルムです！ …くっ、 ききとって もらえないのか！」']});
  IT.oathSword={n:'ちかいの おおたて',slot:'s',def:30,only:['garm'],price:0,d:'たいちょうが ガルムに たくした おおたて。'};
  for(let i=1;i<=5;i++) IT['tag'+i]={n:`へいしの なふだ（${i}）`,key:1,d:'ちいさな きんぞくの なふだ。 なまえが きざまれている。'};
  MON.taichou=B_(Object.assign({n:'わすれの たいちょう',s:'knight',p:{1:'#5a5a6a',2:'#3a3a4a',3:'#a0a0b0',e:'#a0ffff'},p2:{1:'#7a3a4a',2:'#4a1a2a',3:'#e0c040',e:'#ffffff'},scale:3.8},bstat(20,7,{turns:12}),{
    phases:[{moves:[M_('attack',4),M_('str',2,'たいちょうの けんが うなる！'),M_('charge',1,'たいちょうは たてを かまえ、 ちからを ためている…')]},
            {at:.5,alt:1,acts:.35,say:'たいちょう「…ガ…ル…ム？ その なまえを… しって いる…！」',moves:[M_('attack',3),M_('breath',2,'たいちょうの なぎはらい！',{f:.14}),
              M_('prep',2,'たいちょうは けんを たかく かかげた！',{next:M_('breath',0,'たいちょうの ちかいの おおぎり！',{f:.27})})]}]}));
  QUESTS.tags={t:'とりでの へいしの なまえ',g:'つめしょの へいし',area:'ちかいの とりで',steps:['なまえを たべられた へいしたちの なふだを 5まい あつめる。','なふだを つめしょの へいしに とどける。']};
  GOALS[7]=()=>!S.flags.siege?'ちかいの とりでの おおひろまで しれいかんに はなしかけ、 とりでを まもろう。':!S.flags.boss_fortu?'とりでの ちかどうの おくで、 ガルムの もと たいちょうと むきあおう。':'アカリに もどろう。 かげのこの ようすが おかしい…';
}
async function fortCommander(){
  msgClear();
  if(S.flags.siege){await say('しれいかん「ちかどうの おくに、 くろい よろいの きしが すみついている。 …あれは まさか。」'); msgClose(); return;}
  await say('しれいかん「たびの もの！ ちょうど いい。 こんやも まものが せめて くる。 てを かしてくれ！」');
  await say('ガルム「…この とりで。 おれは ここを しっている。 ここで、 だれかと ちかったんだ。」');
  await say('しれいかん「くるぞ！ もんを まもれ！」'); msgClose();
  const waves=[['wasurehei','ikusaookami'],['yamigarasu','ishinage','yamigarasu'],['wasurehei','wasurehei','ikusaookami']];
  for(let i=0;i<waves.length;i++){
    msgClear(); await say(`だい ${i+1} は！ まものが もんに おしよせる！`,{wait:'auto',ms:700}); msgClose();
    const r=await battle(waves[i],{area:'field',zone:'fort',boss:i===2}); if(r!=='win') return;
  }
  S.flags.siege=1; msgClear();
  await say('しれいかん「もちこたえた…！ みごとだ！」');
  await say('しれいかん「だが まものは ちかどうから わいてくる。 ちかどうの おくに なにかが いるのだ。 いりぐちは おおひろまの おくだ。」');
  S.gold+=400; sfx.chest(); await say(`${HN()}たちは 400ゴールドを うけとった！`); msgClose(); loadNPCs();
}
async function tagQuest(){
  const st=qState('tags'); const n=[1,2,3,4,5].filter(i=>has('tag'+i)).length;
  if(st==='done'){await lines(['へいし「めいぼに なまえが もどった。 なかまたちが ここに いたことを、 もう わすれない。」']); return;}
  if(n>=5){for(let i=1;i<=5;i++) delItem('tag'+i); msgClear(); await say('へいし「5まい ぜんぶ…！ なまえを よむたびに、 かおが おもいうかぶ。」'); await qDone('tags','fseed2'); msgClose(); return;}
  if(st==null) qStart('tags');
  await lines([`へいし「この とりでで たたかった なかまの なふだが、 あちこちに ちらばって いるんだ。（いま ${n}まい）」`,'へいし「とりでの まわりや、 ちかどうに おちて いる はずだ。」']);
}

/* ---------- 8しょう ただいま ---------- */
async function lhKeeperCh8(){
  msgClear();
  if(S.flags.mioNamed){await say('じいさん「とうだいの うらの かいだんは もう ふさいだよ。 …おかえり、 ミオちゃん。」'); msgClose(); return;}
  await say('じいさん「その すきとおった むすめさん… どこかで あった ような…」');
  await say('かげのこ「…この とうだい、 しってる。 かいだんを のぼった さきで、 おとうさんと ほしを みた…」');
  await say('じいさん「とうだいの うらに、 いまは つかわれていない かいだんが ある。 5ねん まえ、 だんなが きえた ばしょじゃ。」');
  msgClose();
}
function defineCh8(){
  DUNGEONS.push({id:'lhouse',name:'とうだいの うら',floors:4,w:19,h:15,wall:'l',floor:'i',rooms:2,loops:.07,up:1,zone:'lhouse',area:'nox',seed:808,per:2,from:['akari_lh',5,3,'left'],
    loot:['herb2','frag',{gold:300},'life','drop','frag','herb3'],feat:['','lock','switch secret','lock'],darkAll:1,boss:'shogun',reward:'fatherLog',
    intro:['「…よく きたな。 なまえの ない むすめ。 そして その あに。」','かげのこ「あに…？」','なまえくいの しょうぐん「5ねん まえ、 この とうだいで おまえの なまえを くらったのは この わしよ！」','しょうぐん「ふたりとも、 ここで わすれさられるが よい！」']});
  IT.fatherLog={n:'ちちの こうかいにっし',key:1,d:'「わすれの くにへ むかう。 ミオ、 かならず なまえを とりもどす」'};
  MON.shogun=B_(Object.assign({n:'なまえくいの しょうぐん',s:'lord',p:{1:'#2a1a3a',2:'#140a20',3:'#c0a0ff',w:'#8a8aa0',e:'#ff2040'},p2:{1:'#4a1a2a',2:'#2a0a14',3:'#ffe070',w:'#c0c0d0',e:'#ffffff'},scale:4},bstat(22,8,{turns:13}),{
    phases:[{moves:[M_('attack',3),M_('mag',3,'しょうぐんは なまえを くらう ひかりを はなった！',{f:.2}),M_('sleepAll',1,'しょうぐんは わすれの うたを うたった！',{ch:.3}),M_('summon',1,'しょうぐんは かげのへいを よびだした！',{id:'kagehei'})]},
            {at:.5,alt:1,acts:.4,say:'しょうぐん「ぬうう… この ちから、 ほしかげの…！ ならば ほんきを みせよう！」',moves:[M_('attack',3),M_('mist',2,'しょうぐんは わすれの きりを はいた！',{f:.1}),M_('mag',2,'しょうぐんは なまえを くらう ひかりを はなった！',{f:.21}),
              M_('prep',2,'しょうぐんの まわりに くろい もじが うずを まいた…',{next:M_('breath',0,'しょうぐんの なまえけし！',{f:.28})})]}]}));
  const L=MAPS.akari_lh; L.rows[3]=L.rows[3].slice(0,5)+'u'+L.rows[3].slice(6);
  L.links['5,3']=['lhouse1',0,0];
  LINK_GATE['akari_lh:5,3']=()=>(S.ch||1)>=8?null:['かいだんは がれきで ふさがれている。'];
  GOALS[8]=()=>!S.flags.boss_lhouse?'アカリの とうだいの なかの かいだんから『とうだいの うら』を のぼろう。':'いえに かえろう。';
}
async function afterShogun(){
  msgClear();
  await say('しょうぐん「ば…かな… なまえが… もどって いく…」');
  flash('#ffffff',800); shake();
  await say('くろい もじが ほどけ、 ひかりの つぶが かげのこを つつんだ。');
  await say(`かげのこ「…おもいだした。 わたしの なまえは… ミオ。」`);
  await say(`ミオ「${HN()}の… いもうと。 5ねん まえ、 おとうさんと この とうだいで ほしを みていた ミオ！」`);
  const m=memberOf('mio'); if(m){m.name='ミオ'; m.shadow=0; m.seen=1;} S.flags.mioNamed=1; sfx.lvl();
  await say(`${HN()}の なかに、 いもうとと すごした ひびが いっきに よみがえった！`);
  await say('ミオ「おとうさんは… わたしの なまえを とりもどす ために、『わすれの くに』へ むかったの。」');
  msgClose(); await fadeOut(600);
  S.map='akari_0'; P.x=4; P.y=5; P.dir='up'; trail=[]; loadNPCs(); playBgm('town'); await fadeIn(600);
  msgClear();
  await say('はは「…ミオ？ ミオなの？」');
  await say('はは「ああ… ずっと 3にんぶん おさらを ならべて いたのは、 あなたを わすれて いなかったから なのね…！」');
  await say('ミオ「ただいま、 おかあさん。」');
  await say('はは「おとうさんの ふねが ふなつきばに ある。 あのひとを むかえに いって。 こんどは、 3にんで かえって くるのよ。」');
  const [ax,ay]=MAPS.akari.world; S.ship=dockFor(ax,ay)||{x:ax,y:ay+2,map:'world'};
  await say('ちちの ふねを てにいれた！ うみを わたれる ように なった。 （ふねに ちかづくと のれる）');
  msgClose(); await startChapter(9);
}
