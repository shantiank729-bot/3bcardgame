/* =========================================================
   サブクエスト（まちの ひとの こまりごと）と、 せかいの かくし かけら
   どれも「なまえ」に まつわる ちいさな ものがたり
   ========================================================= */
// てがるな「さがしもの」クエスト：まちの ひとに たのまれ、 ダンジョン・ちず・まちで みつけて とどける
function fetchQuest(o){
  QUESTS[o.id]={t:o.t,g:o.g,area:MAPS[o.town].name,steps:[o.hint,'みつけた ものを '+o.g+'に とどける。']};
  IT[o.item]={n:o.itemName,key:1,d:o.itemDesc};
  const m=MAPS[o.town], sp=m.spots, L=sp[o.at||'road']||sp.road, at=L[Math.floor(L.length*(o.pos??.5))];
  m.npcs.push(placeNpc({pal:o.pal,dir:'down',time:o.time,cond:o.cond,talk:async()=>{
    const st=qState(o.id);
    if(st==='done'){await lines(o.after); return;}
    if(has(o.item)){delItem(o.item); msgClear(); for(const t of o.done) await say(t); await qDone(o.id,o.reward); msgClose(); return;}
    if(st==null) qStart(o.id);
    await lines(o.ask);
  }},sp,prng(o.id.length*97),m));
  if(o.dungeon){const D=DUNGEONS.find(d=>d.id===o.dungeon); D.loot.splice(1,0,o.item);}
  if(o.hid){const [mp,x,y]=o.hid; const t=MAPS[mp]; t.hid=t.hid||[]; t.hid.push({id:o.item,x,y,loot:o.item});}
  if(o.obj){const t=MAPS[o.obj]; const ob=(t.objs||[]).find(b=>!b.text&&b.k!=='shelf'); if(ob) ob.loot=o.item;}
}
function defineSideQuests(){
  fetchQuest({id:'cat',t:'まいごの ネコ',g:'アカリの おんなのこ',town:'akari',at:'plaza',pos:.8,pal:'kid',item:'catCollar',itemName:'ネコの くびわ',itemDesc:'「ミケ」と ほられた すずつきの くびわ。',
    hint:'うみべの どうくつで、 ネコの くびわを さがす。',dungeon:'seacave',reward:'herb2',
    ask:['おんなのこ「うちの ネコが いなくなったの。 うみべの どうくつの ほうへ いったみたい。」','おんなのこ「なまえ？ …あれ、 なんだっけ。 くびわに かいて あるはず なのに。」'],
    done:['おんなのこ「くびわ！ ミケ… そう、 ミケ！ よんだら かえって きた！」','ネコ「ニャア。」'],after:['おんなのこ「ミケ、 ミケ。 なまえを よぶと ちゃんと くるの。」']});
  fetchQuest({id:'windmill',t:'ふうしゃの はぐるま',g:'フローラの ふうしゃばん',town:'flora',at:'farm',pos:.2,pal:'merchant',item:'gear',itemName:'ふうしゃの はぐるま',itemDesc:'ちいさな なまえが ほられた てつの はぐるま。',
    hint:'まよいの もりで、 ふうしゃの はぐるまを さがす。',dungeon:'forest',reward:'fseed1',
    ask:['ふうしゃばん「ふうしゃの はぐるまが ひとつ たりないんだ。 もりの まものが もっていった らしい。」'],
    done:['ふうしゃばん「これだ！ ほら、 ふうしゃが まわりだした！」'],after:['ふうしゃばん「かぜが ふけば ふうしゃは まわる。 あたりまえが いちばんさ。」']});
  fetchQuest({id:'canary',t:'こうざんの カナリア',g:'ゴルドの こども',town:'golde',at:'road',pos:.75,pal:'kid',item:'canary',itemName:'カナリアの かご',itemDesc:'きいろい ことりが げんきに ないている。',
    hint:'ゴルド こうざんで、 カナリアの かごを さがす。',dungeon:'mine',reward:'antidote',
    ask:['こども「とうちゃんの カナリア、 こうざんに おいてきちゃったんだって。 カナリアは わるい くうきを おしえて くれる だいじな ともだちなの。」'],
    done:['こども「ピピ！ おかえり、 ピピ！」'],after:['こども「ピピは けさも げんきに ないてるよ。」']});
  fetchQuest({id:'fishing',t:'かわの ぬしの うろこ',g:'せきしょの つりびと',town:'river',at:'park',pos:.3,pal:'sailor',item:'bigScale',itemName:'かわの ぬしの うろこ',itemDesc:'てのひらより おおきい ぎんいろの うろこ。',
    hint:'すいもんの いせきで、 かわの ぬしの うろこを さがす。',dungeon:'ruins',reward:{gold:150},
    ask:['つりびと「この かわには ぬしが いる。 しょうこに うろこを みせて くれたら、 ほうびを やろう。」'],
    done:['つりびと「おお、 ほんものだ！ おれの いうこと、 だれも しんじて くれなかったんだ。」'],after:['つりびと「いつか ぬしを つりあげて、 なまえを つけて やるんだ。」']});
  fetchQuest({id:'ring',t:'ぬすまれた ゆびわ',g:'サンドラの しょうにん',town:'sandra',at:'market',pos:.15,pal:'woman',item:'ring',itemName:'ふたりの なまえの ゆびわ',itemDesc:'うちがわに ふたりの なまえが ほられている。',
    hint:'ギルドの ちかこで、 けっこんゆびわを さがす。',dungeon:'vault',reward:'fbell',
    ask:['しょうにん「ギルドに だまされて、 けっこんゆびわを かたに とられたの。 うちがわに おっとと わたしの なまえが ほってあるのよ。」'],
    done:['しょうにん「…あった。 カイと メイ。 わたしたちの なまえ。」'],after:['しょうにん「ゆびわを みるたび、 おっとの なまえを よぶの。」']});
  fetchQuest({id:'lullaby',t:'ねむりの まちの こもりうた',g:'ノクターンの かげの はは',town:'ghost',at:'park',pos:.6,pal:'woman',item:'musicbox',itemName:'ちいさな オルゴール',itemDesc:'ふたを あけると やさしい こもりうたが ながれる。',
    hint:'かねの とうで、 オルゴールを さがす。',dungeon:'bell',reward:'fseed3',cond:()=>S.flags.boss_bell||isNight(),
    ask:['かげの はは「むすこを ねかしつける オルゴールが、 かねの とうに あるの。 あのこの なまえを いれた うたなのよ。」'],
    done:['はは「♪ねむれ ねむれ、 わたしの テオ…♪ …ああ、 テオ。 あなたの なまえ。」'],after:['はは「テオは すやすや ねむっているわ。」']});
  fetchQuest({id:'bottle',t:'うみの てがみの びん',g:'ナミノの ろうじん',town:'namino',at:'road',pos:.15,pal:'sage',item:'bottle',itemName:'てがみの びん',itemDesc:'しおに あらわれた びん。 なかに てがみが はいっている。',
    hint:'ナミノの しまの ひがしの はまべを しらべる。（きらきら ひかる ところ）',hid:['world',121,101],reward:'herb3',
    ask:['ろうじん「わかい ころ、 うみに てがみの びんを ながしたんじゃ。 もう いちど よみたくてな… はまべに うちあげられて おらんかのう。」'],
    done:['ろうじん「…『ハンナへ』。 そうじゃ、 ハンナ。 つまの なまえじゃ。 ありがとう。」'],after:['ろうじん「てがみの へんじは、 つまに ちょくせつ いうよ。」']});
  fetchQuest({id:'iceflower',t:'こおりの はな',g:'ひょうけつの みやこの くすりし',town:'icetown',at:'road',pos:.3,pal:'woman',item:'iceflower',itemName:'こおりの はな',itemDesc:'とけない こおりで できた はな。',
    hint:'ひょうけつの しろで、 こおりの はなを さがす。',dungeon:'icecastle',reward:'drop',
    ask:['くすりし「こおりの はなが あれば、 ねつの くすりが つくれるの。 しろの なかに さいている はず。」'],
    done:['くすりし「きれい… これで まちの こどもたちを たすけられる。」'],after:['くすりし「こおりの はなの くすり、 よく きくのよ。」']});
  fetchQuest({id:'textbook',t:'きえた きょうかしょ',g:'がくえんの せんせい',town:'academy',at:'plaza',pos:.2,pal:'sage',item:'textbook',itemName:'ほしの なまえの きょうかしょ',itemDesc:'1000この ほしの なまえが のっている。',
    hint:'きんしょの しょこで、 きょうかしょを さがす。',dungeon:'library',reward:'fseed3',
    ask:['せんせい「ほしの なまえの きょうかしょが、 しょこに まぎれこんで しまった。 あれが ないと じゅぎょうに ならん。」'],
    done:['せんせい「ありがとう！ ほしにも ひとつずつ なまえが ある。 なまえが あるから、 ひとは ほしを みわけられるのだ。」'],after:['せんせい「きょうは ほしの なまえの じゅぎょうだ。」']});
  fetchQuest({id:'mushroom',t:'ほしキノコ',g:'キノコの さとの りょうりにん',town:'kinoko',at:'farm',pos:.7,pal:'merchant',item:'starshroom',itemName:'ほしキノコ',itemDesc:'よるに ほしの ように ひかる キノコ。',
    hint:'おおきな きの ねっこで、 ほしキノコを さがす。',dungeon:'root',reward:'herb3',
    ask:['りょうりにん「ほしキノコの スープは、 わすれた ことを おもいださせる まぼろしの りょうり。 ねっこの おくに はえて いるんだ。」'],
    done:['りょうりにん「これだ！ さっそく にこもう。 …うん、 いい においだ！」'],after:['りょうりにん「スープ、 さとの みんなで のんだよ。」']});
  fetchQuest({id:'oar',t:'みずうみの かい',g:'シズクの わたしもり',town:'lakevil',at:'pier',pos:.5,pal:'sailor',item:'oar',itemName:'なまえいりの かい',itemDesc:'「ふたりで こぐ」と ほられた ふねの かい。',
    hint:'なみだの みずうみで、 ふねの かいを さがす。',dungeon:'lakeD',reward:'life',
    ask:['わたしもり「みずうみに かいを おとして しまった。 なくなった あいぼうと いっしょに ほった なまえいりの かいなんだ。」'],
    done:['わたしもり「…あった。 あいぼうの なまえも ちゃんと のこってる。」'],after:['わたしもり「きょうも ふたりで こいでる きぶんさ。」']});
  fetchQuest({id:'apprentice',t:'かじやの でし',g:'ほむらの でし',town:'homura',at:'road',pos:.8,pal:'kid',item:'hammerStone',itemName:'ほのおの といし',itemDesc:'かじやの でしが なくした といし。',
    hint:'ようがんの もぐらみちで、 といしを さがす。',dungeon:'lava',reward:'fseed2',
    ask:['でし「ししょうの といしを なくしちゃった… もぐらみちに おとしたんだ。 みつけて くれたら、 ぼくの なまえを ししょうに おぼえて もらえるかも！」'],
    done:['でし「ありがとう！ ししょうが『よく やった、 ケン』って よんでくれたんだ！」'],after:['でし「ぼく、 ケン！ いつか でんせつの かじやに なる！」']});
  fetchQuest({id:'feather',t:'そらの はね',g:'アウラの こども',town:'skycity',at:'plaza',pos:.8,pal:'kid',item:'skyfeather',itemName:'そらくじらの はね',itemDesc:'かぜを よぶ しろい はね。',
    hint:'くもの しんでんで、 はねを さがす。',dungeon:'cloud',reward:'fseed1',
    ask:['こども「そらくじらの はねを もってると、 なまえを よばれた とき かぜが こたえて くれるんだって。 しんでんに おちてるの。」'],
    done:['こども「わあ！ …ねえ、 ぼくの なまえ よんで！ …ほら、 かぜが ふいた！」'],after:['こども「かぜって、 なまえを おぼえてるんだよ。」']});
  fetchQuest({id:'mirrorDoll',t:'かがみの にんぎょう',g:'うらがえしの アカリの こども',town:'makari',at:'plaza',pos:.3,pal:'kid',item:'doll',itemName:'なまえの ない にんぎょう',itemDesc:'くびに ちいさな なふだが さがっている。',
    hint:'かがみの とうだいで、 にんぎょうを さがす。',dungeon:'mlight',reward:'fseed2',
    ask:['わすれられた こども「ぼくの にんぎょう、 とうだいに おいて きちゃった。 ぼくの ことは だれも おぼえてないけど、 あのこは ぼくを おぼえてる。」'],
    done:['こども「おかえり！ …なふだに ぼくの なまえが かいてある。 ルイ。 ぼく、 ルイだ！」'],after:['ルイ「にんぎょうが おぼえてて くれたんだ。」']});
}
function placeWorldFrags(){
  // せかいの かくし かけら（けしきの いい ばしょ・みさき・しまの はし）
  const W=MAPS.world; W.hid=W.hid||[];
  const spots=[[4,92],[52,60],[63,112],[93,100],[66,58],[18,14],[60,10],[96,20],[150,40],[112,112],[156,106],[130,66],[102,70],[80,6]];
  spots.forEach(([x,y],i)=>{const p=nearLand(W,x,y); if(p) W.hid.push({id:'wfrag'+i,x:p[0],y:p[1],loot:'frag'});});
}
// ちかくの あるける マス
function nearLand(m,x,y){for(let r=0;r<8;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){const t=m.rows[y+dy]&&m.rows[y+dy][x+dx]; if(t&&t!=='~'&&!SOLID.has(t)&&!m.links[(x+dx)+','+(y+dy)]) return [x+dx,y+dy];} return null;}
