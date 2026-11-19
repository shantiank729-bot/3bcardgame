/* ---------- モンスター（ほしかげの剣 II） ---------- */
Object.assign(MSPR,{
 crab:["................",".kk..........kk.","k11k........k11k","k1kk........kk1k","k11k..k..k..k11k",".kk1k.w..w.k1kk.",
  "...kk111111kk...","..k1111111111k..",".k122111111221k.",".k111111111111k.","..k1111111111k..",".k.kk1kkkk1kk.k.","k.k..k....k..k.k","................","................","................"],
 scorp:["............kk..","...........k11k.","...........k1k..","..........k11k..","..........k1k...",".kk.......k1k...",
  "k11k.....k11k...","k1k.kkkkk11k....",".kk1111111k.....","..k1e1e1111k....",".k111111111k....","k.k2k2k2k2k.....","................","................","................","................"],
 lord:["....k.k.k.k.....","....k3k3k3k.....","....k33333k.....","...kwwwwwwwk....","...kwwewewwk....","...kwwwkwwwk....",
  "..kk1kwwwk1kk...",".k2111k1k1112k..","k22111131111122k","k22111131111122k","k22111133111122k","k22111133111122k",
  "k22111111111122k","k22121212121222k","kkkkkkkkkkkkkkkk","................"],
 shade:["................","......kkkk......",".....k1111k.....","....k1e11e1k....","....k111111k....",".....k1111k.....",
  "....kk1111kk....","...k11111111k...","..k1111111111k..","..k1k111111k1k..","..kk.k1111k.kk..",".....k1111k.....",
  "....k11kk11k....","...k111kk111k...","..k2222kk2222k..","...kkkk..kkkk..."],
 eye:["................","................",".....kkkkkk.....","...kk111111kk...","..k1111111111k..",".k111kkkkk1111k.",
  ".k11kweeewk111k.",".k11keeeeek111k.",".k11kweeewk111k.",".k111kkkkk1111k.","..k1111111111k..","...kk111111kk...",
  ".....kkkkkk.....","......k.k.k.....",".....k..k..k....","................"],
 imp:["................","..k........k....",".k1k......k1k...",".k11kkkkkk11k...","..k11111111k....","..k1w1111w1k....",
  "..k1e1111e1k....","..k11111111k....","...k1kwwk1k.....","..kk111111kk....",".k2k111111k2k...","k22kk1111kk22k..",
  ".kk.k1111k.kk...","....k1kk1k......","....kk..kk......","................"],
 treant:["....kkkkkkkk....","..kk22222222kk..",".k222222222222k.","k22222222222222k","k22kk222222kk22k",".kkk1kkkkkk1kkk.",
  "...k1e1111e1k...","...k11111111k...","...k11kkkk11k...","..k1111111111k..",".k1k11111111k1k.","k1k.k111111k.k1k",
  "....k11kk11k....","...k111kk111k...","..k1111kk1111k..","..kkkkk..kkkkk.."],
});
const SHIP_ART=art(["......k.........","......kk........","......kwk.......","......kwwk......","......kwwwk.....","......kwwwwk....",
 "......kwwwwwk...","......kkkkkkkk..","......k.........",".kkkkkkkkkkkkkk.",".kooooooooooook.","..kooooooooook..","...kkkkkkkkkk...","................","................","................"],
 {k:'#2a160a',w:'#f4f0e0',o:'#a8642c'});
const AIR_ART=art(["................","...kkkkkkkkkk...","..k1111111111k..",".k111111111111k.","..k1111111111k..","...kkkkkkkkkk...",
 "......k..k......","......k..k......","..kkkkkkkkkkkk..",".k2222222222222k","k2w2222222222222","k22222222222222k",".kkkkkkkkkkkkkk.","................","................","................"],
 {k:'#1a1a40',1:'#e8e8f8',2:'#c08a3a',w:'#ffe060'});

/* てきの すうちの しき（1さくめと おなじ かんがえかた。 6にんの しょくぎょうと Lv70に あわせた） */
const TIER_OF_CH=[0,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,11,12,12,13];
const PARTY_AT=ch=>ch<4?['hero','mio']:ch<5?['hero','mio','garm']:ch<9?['hero','mio','garm','riri']:ch===14?['hero','mio','garm','riri']:ch<16?['hero','mio','garm','olga']:['hero','mio','jin','olga'];
const AVG={hero:{hp:7.5,str:2.5,agi:2},mio:{hp:5,str:1.5,agi:2},garm:{hp:9.5,str:3.5,agi:1.5},riri:{hp:6,str:2.5,agi:3},olga:{hp:6,str:1.5,agi:1.5},jin:{hp:8.5,str:3.5,agi:2.5}};
function expectParty(L,ch){
  const t=TIER_OF_CH[Math.min(ch,25)]||13, who=PARTY_AT(ch), lv=L-1;
  const w=WEAPON_ATK[t-1], a=ARMOR_DEF[t-1], s=SHIELD_DEF[t-1];
  const st=c=>({hp:CLS[c].base.hp+AVG[c].hp*lv,str:CLS[c].base.str+AVG[c].str*lv,agi:CLS[c].base.agi+AVG[c].agi*lv});
  const fighters=who.filter(c=>['hero','garm','jin','riri'].includes(c));
  const fAtk=fighters.reduce((sum,c)=>sum+st(c).str+w*(c==='riri'?.82:c==='garm'?1.12:1),0)/fighters.length;
  const hpAvg=who.reduce((sum,c)=>sum+st(c).hp,0)/who.length;
  const def=who.reduce((sum,c)=>sum+st(c).agi/2+(['hero','garm','jin'].includes(c)?a+s:c==='riri'?a*.8+s:a*.72),0)/who.length;
  const agi=who.reduce((sum,c)=>sum+st(c).agi,0)/who.length;
  const spell=who.includes('mio')?(2.4*L+12):0;
  return {fAtk,hpAvg,def,agi,who,spell};
}
const ARCH={norm:{hp:1,atk:1,def:1,agi:1},tank:{hp:1.45,atk:1.05,def:1.3,agi:.55},fast:{hp:.75,atk:.95,def:.85,agi:1.5},
  mage:{hp:.8,atk:.85,def:.8,agi:1.05},brute:{hp:1.25,atk:1.18,def:.9,agi:.8}};
function fstat(ML,ch,arch='norm'){
  const E=expectParty(ML,ch), A=ARCH[arch];
  const def=Math.round(E.fAtk*.55*A.def), per=(E.fAtk-def/2)/2;
  const exp=Math.round((expFor(ML+1)-expFor(ML))/9*(A.hp*.5+.5));
  return {hpRef:Math.round(E.hpAvg),hp:Math.round(per*3*A.hp),atk:Math.round((.2*E.hpAvg+E.def/2)*A.atk),def,agi:Math.round(E.agi*.9*A.agi),exp,g:Math.round(exp*1.6),ml:ML};
}
function bstat(L,ch,o={}){
  const E=expectParty(L,ch), def=Math.round(E.fAtk*.55*(o.def||1)), per=(E.fAtk-def/2)/2;
  let dpt=0; for(const c of E.who){ if(c==='hero') dpt+=per*(E.who.length>1?.65:1); if(c==='garm'||c==='jin') dpt+=per*1.35; if(c==='riri') dpt+=per*1.2; if(c==='mio') dpt+=E.spell*.85; }
  const exp=Math.round((expFor(L+1)-expFor(L))*(o.expMul||1.2));
  return {hp:Math.round(dpt*(o.turns||12)*(o.hp||1)),atk:Math.round((.36*E.hpAvg+E.def/2)*(o.atk||1)),def,agi:Math.round(E.agi*1.1),
    exp,g:Math.round(exp*1.2),hpRef:Math.round(E.hpAvg),boss:1,ml:L};
}
const M_=(t,r,m,o)=>Object.assign({t,r,m},o||{});
const B_=(o)=>Object.assign({ai:'gen'},o);
const MON={};
// [キー, なまえ, え, いろ, かた, とくぎ]
const ROSTER=[
 // だい1ぶ
 ['chibikage','ちびかげ','shade',{1:'#5a5a7a',2:'#3a3a5a',e:'#ffe040'},'fast'],
 ['uminezumi','うみネズミ','beast',{1:'#7a8aa0',2:'#4a5a70',3:'#e08aa0',e:'#1a1a1a'},'norm'],
 ['korogashi','ころがしむし','seed',{1:'#a0c060',2:'#6a8a30',3:'#3a6a2a'},'tank'],
 ['hanabachi','はなバチ','bat',{1:'#f0c040',2:'#a07010',e:'#1a1a1a'},'fast'],
 ['shiogani','しおガニ','crab',{1:'#e06a4a',2:'#a03a2a'},'tank'],
 ['kurage','くらげだま','seed',{1:'#c0a0f0',2:'#8070c0',3:'#ffffff'},'mage',[M_('sleep1',.2,'%sは ねむくなる ひかりを はなった！')]],
 ['ibara','いばらツル','plant',{1:'#e070a0',2:'#3a8a3a',3:'#5ab05a'},'tank',[M_('poison',.25,'%sは とげの ツルで しめつけた！')]],
 ['moriusagi','もりウサギ','beast',{1:'#d8c0a0',2:'#a88a6a',3:'#f08aa0'},'fast'],
 ['kinoko','キノコぼうや','shroom',{1:'#e8a040',2:'#a86a20',3:'#f4e2c0'},'mage',[M_('sleep1',.2,'%sは ねむりの ほうしを まいた！')]],
 ['morime','もりのめだま','eye',{1:'#5ab05a',2:'#3a8a3a',e:'#ff3040',w:'#ffffff'},'mage',[M_('mag',.3,'%sは あやしい ひかりを はなった！',{f:.12})]],
 ['kodama','こだまのき','treant',{1:'#8a6a3a',2:'#3a8a3a',e:'#ffe040'},'tank'],
 ['iwatokage','いわトカゲ','beast',{1:'#9a9080',2:'#6a6050',3:'#3a3020',e:'#ff8020'},'brute'],
 ['koumori','こうざんコウモリ','bat',{1:'#7a6a5a',2:'#4a3a2a',e:'#ffe040'},'fast'],
 ['ishikoro','いしころへい','golem',{1:'#a8a090',2:'#787060',e:'#40a0ff'},'tank'],
 ['mogura','ほりモグラ','beast',{1:'#6a4a3a',2:'#4a2a1a',3:'#f0a0a0',e:'#1a1a1a'},'norm',[M_('str',.2,'%sは つめで ひっかいた！')]],
 ['mgolem','こうざんゴーレム','golem',{1:'#8a7a6a',2:'#5a4a3a',e:'#ff4020'},'tank',[M_('charge',.15,'%sは ちからを ためている…')]],
 ['lampghost','ランプおばけ','ghost',{1:'#f0d080',2:'#c0a040',e:'#5a2a1a'},'mage',[M_('mag',.3,'%sは ほのおを はいた！',{f:.12})]],
 ['kawahebi','かわヘビ','snake',{1:'#3a9ab0',2:'#1a6a80'},'fast',[M_('poison',.25,'%sは どくの キバで かみついた！')]],
 ['tonbo','みずトンボ','bat',{1:'#80d0ff',2:'#3a8ad0',e:'#ff4040'},'fast'],
 ['kaeruhei','カエルへい','frog',{1:'#5aa04a',2:'#c8d860',3:'#3a6a2a'},'norm'],
 ['kappa','かわこぞう','imp',{1:'#4ab080',2:'#2a7050',e:'#1a1a1a',w:'#ffffff'},'mage',[M_('mag',.25,'%sは みずでっぽうを うった！',{f:.12})]],
 ['iseki','いせきのへい','knight',{1:'#8a9a8a',2:'#5a6a5a',3:'#c0d0c0',e:'#40ffd0'},'tank'],
 ['mizunosei','みずのせい','ghost',{1:'#80c0ff',2:'#4080c0',e:'#ffffff'},'mage',[M_('sleep1',.2,'%sは ねむりの しずくを おとした！')]],
 ['sasori','すなサソリ','scorp',{1:'#c8a050',2:'#8a6a30',e:'#ff2020'},'norm',[M_('poison',.3,'%sは どくばりで さした！')]],
 ['sabakunezumi','さばくネズミ','beast',{1:'#d8b870',2:'#a08040',3:'#603010',e:'#1a1a1a'},'fast'],
 ['saboten','サボテンボール','plant',{1:'#f0e0a0',2:'#3a8a3a',3:'#5ab05a'},'tank',[M_('breath',.2,'%sは とげを とばした！',{f:.08})]],
 ['sunakemuri','すなけむり','ghost',{1:'#e0d0a0',2:'#b0a070',e:'#3a2010'},'mage',[M_('sleepAll',.15,'%sは すなあらしを おこした！ めが あけられない！')]],
 ['kinka','きんかむし','seed',{1:'#f0d040',2:'#c0a020',3:'#a08010'},'tank'],
 ['karakuri','からくりへい','knight',{1:'#a0a0b0',2:'#6a6a7a',3:'#e0c040',e:'#ff4040'},'tank'],
 ['dorobou','どろぼうネズミ','beast',{1:'#5a5248',2:'#3a342c',3:'#c87a8a',e:'#ff3040'},'fast'],
 ['takaragani','たからガニ','crab',{1:'#f0c040',2:'#a08020'},'tank'],
 ['samayoi','さまよいびと','shade',{1:'#6a6a8a',2:'#4a4a6a',e:'#a0ffff'},'norm',[M_('sleep1',.2,'%sは かなしい うたを うたった！')]],
 ['obake','おばけランプ','ghost',{1:'#c0e8ff',2:'#80a0c0',e:'#2a2a6a'},'mage',[M_('mag',.3,'%sは あおい ひのたまを なげた！',{f:.13})]],
 ['honenezumi','ほねネズミ','skel',{w:'#e8e0d0',2:'#3a3030',e:'#ff3040'},'fast'],
 ['bochikarasu','ぼちのカラス','bat',{1:'#3a3a4a',2:'#22222e',e:'#ff8a20'},'fast'],
 ['kanetsuki','かねつきおばけ','ghost',{1:'#a0a070',2:'#707040',e:'#ff4040'},'brute',[M_('breath',.2,'%sは かねを うちならした！ みみが いたい！',{f:.09})]],
 ['honehei','ほねのへい','skel',{2:'#3a3030'},'norm',[M_('str',.2,'%sは ほねの けんを ふりおろした！')]],
 ['kurayami','くらやみめだま','eye',{1:'#4a3a6a',2:'#2a1a4a',e:'#ffe040',w:'#ff8080'},'mage',[M_('sleepAll',.15,'%sは くらやみを ひろげた！')]],
 ['wasurehei','わすれのへい','knight',{1:'#5a5a6a',2:'#3a3a4a',3:'#a0a0b0',e:'#a0ffff'},'tank'],
 ['ikusaookami','いくさオオカミ','beast',{1:'#5a6a8a',2:'#3a4660',3:'#1a1a1a',e:'#ffe040'},'brute',[M_('str',.2,'%sは するどい キバで かみついた！')]],
 ['yamigarasu','やみガラス','bat',{1:'#2a2a3a',2:'#14141e',e:'#ff4040'},'fast',[M_('mag',.2,'%sは やみの ひを はいた！',{f:.11})]],
 ['ishinage','いしなげこぞう','imp',{1:'#a07050',2:'#704030',e:'#1a1a1a',w:'#ffffff'},'norm',[M_('breath',.2,'%sは いしを なげつけた！',{f:.08})]],
 ['kagehei','かげのへい','shade',{1:'#3a3a5a',2:'#1a1a3a',e:'#ff4040'},'brute',[M_('str',.2,'%sは かげの けんで きりつけた！')]],
 ['namaekui','なまえくい','eye',{1:'#2a1a3a',2:'#140a20',e:'#ff2040',w:'#c0a0ff'},'mage',[M_('mag',.3,'%sは なまえを すいとる ひかりを はなった！',{f:.14}),M_('sleepAll',.12,'%sは わすれの きりを はいた！')]],
 ['kuroumihebi','くろうみヘビ','snake',{1:'#2a2a4a',2:'#14142a',e:'#ffe040'},'fast',[M_('poison',.3,'%sは どくの キバで かみついた！')]],
 ['kagemadou','かげまどうし','mage',{1:'#3a2a5a',2:'#1a1030',3:'#a080ff',e:'#ff40ff'},'mage',[M_('mag',.35,'%sは やみの いかずちを よんだ！',{f:.16})]],
 // だい2ぶ
 ['ikaobake','イカおばけ','ghost',{1:'#f0f0f8',2:'#c0c0d8',e:'#2a2a6a'},'norm',[M_('sleep1',.2,'%sは すみを はいた！ めの まえが まっくら！')]],
 ['tobiuo','トビウオン','bat',{1:'#c0d0e0',2:'#7a90a8',e:'#203040'},'fast'],
 ['umigani','うみガニ','crab',{1:'#d84a2a',2:'#8a2a1a'},'tank'],
 ['gyojin','ぎょじんへい','frog',{1:'#3a8ab0',2:'#a0d8f0',3:'#2a4a7a'},'brute'],
 ['yashi','ヤシのまもの','treant',{1:'#a07a4a',2:'#3a9a3a',e:'#ff4040'},'tank'],
 ['kamome','かもめへい','bat',{1:'#ffffff',2:'#c0c8d0',e:'#1a1a1a'},'fast'],
 ['shiodamari','しおだまり','seed',{1:'#80c0e0',2:'#4090b0',3:'#2a6a8a'},'mage',[M_('mag',.25,'%sは しおみずを ふきかけた！',{f:.12})]],
 ['suifu','ゆうれいすいふ','skel',{w:'#c8d0e0',2:'#2a3a5a',e:'#40ffd0'},'norm',[M_('str',.2,'%sは いかりを ふりまわした！')]],
 ['senchokage','せんちょうの かげ','shade',{1:'#2a3a5a',2:'#1a2440',e:'#40ffd0'},'brute'],
 ['funamushi','ふなむし','scorp',{1:'#6a5a4a',2:'#4a3a2a',e:'#ff2020'},'fast',[M_('poison',.25,'%sは どくの キバで かみついた！')]],
 ['onryou','うみの おんりょう','ghost',{1:'#4a7a8a',2:'#2a4a5a',e:'#ffffff'},'mage',[M_('sleepAll',.15,'%sは のろいの うたを うたった！'),M_('mag',.25,'%sは つめたい いきを はいた！',{f:.14})]],
 ['yukioni','ゆきおに','golem',{1:'#e8f0f8',2:'#a8b8c8',e:'#2040a0'},'brute',[M_('str',.2,'%sは こおりの こぶしを ふりおろした！')]],
 ['kooriookami','こおりオオカミ','beast',{1:'#e0e8f0',2:'#90a0b8',3:'#203040',e:'#40a0ff'},'fast'],
 ['tsurara','つららコウモリ','bat',{1:'#a0d0f0',2:'#5090c0',e:'#ffffff'},'fast',[M_('mag',.25,'%sは つららを おとした！',{f:.12})]],
 ['yukinosei','ゆきのせい','ghost',{1:'#ffffff',2:'#c0d8f0',e:'#4080c0'},'mage',[M_('sleepAll',.15,'%sは ふぶきを よんだ！ からだが こおりつく！')]],
 ['koorikishi','こおりのきし','knight',{1:'#8ab0d0',2:'#4a70a0',3:'#e0f0ff',e:'#40e0ff'},'tank'],
 ['madoume','まどうの め','eye',{1:'#6a4aa0',2:'#3a2a6a',e:'#ffe040',w:'#ffffff'},'mage',[M_('mag',.3,'%sは まりょくの たまを はなった！',{f:.15})]],
 ['imp2','いたずらインプ','imp',{1:'#c84a6a',2:'#8a2a4a',e:'#ffe040',w:'#ffffff'},'fast',[M_('sleep1',.2,'%sは いたずらの じゅもんを となえた！')]],
 ['ningyou','からくりにんぎょう','knight',{1:'#e0c0a0',2:'#a08060',3:'#ff6080',e:'#2a2a2a'},'norm'],
 ['hoshibachi','ほしくずバチ','bat',{1:'#f0e080',2:'#a09030',e:'#2a2a6a'},'fast'],
 ['kinsho','きんしょの しもべ','mage',{1:'#3a2a1a',2:'#1a0a0a',3:'#e0c040',e:'#ff4040'},'mage',[M_('mag',.35,'%sは きんじられた じゅもんを となえた！',{f:.16})]],
 ['toshoobake','としょおばけ','ghost',{1:'#d8c8a0',2:'#a89870',e:'#3a2a1a'},'norm'],
 ['dokukinoko','どくキノコ','shroom',{1:'#a040c0',2:'#6a2a8a',3:'#f4e2c0'},'mage',[M_('mist',.2,'%sは どくの ほうしを まきちらした！',{f:.07})]],
 ['morigumo','もりグモ','scorp',{1:'#3a2a1a',2:'#1a1008',e:'#ff2020'},'fast',[M_('poison',.3,'%sは どくの いとを はいた！')]],
 ['happamushi','はっぱむし','seed',{1:'#7ac040',2:'#4a8a20',3:'#2a5a10'},'norm'],
 ['kinokosei','きのこのせい','ghost',{1:'#f0c0e0',2:'#c080b0',e:'#2a1a2a'},'mage',[M_('sleepAll',.15,'%sは あまい かおりを ただよわせた！')]],
 ['namidasei','なみだのせい','ghost',{1:'#80b0e0',2:'#5080b0',e:'#ffffff'},'mage',[M_('mag',.3,'%sは かなしみの なみを おこした！',{f:.15})]],
 ['mizuumihebi','みずうみヘビ','snake',{1:'#2a6ab0',2:'#1a3a70',e:'#ffe040'},'brute'],
 ['kanashimibana','かなしみバナ','plant',{1:'#8090c0',2:'#3a6a5a',3:'#a0b0e0'},'tank',[M_('sleepAll',.15,'%sは なみだの かふんを まきちらした！')]],
 ['shizuku','しずくだま','seed',{1:'#a0d0ff',2:'#6090d0',3:'#ffffff'},'fast'],
 ['yougan','ようがんトカゲ','beast',{1:'#a02a10',2:'#601a0a',3:'#ffb030',e:'#ffff60'},'brute',[M_('breath',.2,'%sは ほのおを はいた！',{f:.1})]],
 ['hinotori','ひのとり','bat',{1:'#ff8a2a',2:'#c8401a',e:'#ffff80'},'fast',[M_('mag',.3,'%sは ほのおの はねを とばした！',{f:.14})]],
 ['magman','マグマン','golem',{1:'#c8502a',2:'#7a2a1a',e:'#ffe040'},'tank'],
 ['honoosei','ほのおのせい','ghost',{1:'#ff8040',2:'#c04010',e:'#fff080'},'mage',[M_('mag',.35,'%sは ほのおを はなった！',{f:.16})]],
 ['moribito','なまえの もりびと','knight',{1:'#c8c0a0',2:'#8a8060',3:'#e0c040',e:'#40a0ff'},'tank'],
 ['wasureme','わすれのめ','eye',{1:'#5a5a7a',2:'#3a3a5a',e:'#ff40ff',w:'#c0c0ff'},'mage',[M_('sleepAll',.15,'%sは わすれの ひかりを はなった！'),M_('mag',.25,'%sは きおくを くらう ひかりを はなった！',{f:.15})]],
 ['kagekishi','かげのきし','shade',{1:'#2a2a4a',2:'#14142a',e:'#ff4040'},'brute',[M_('str',.25,'%sは かげの つるぎを ふりおろした！')]],
 ['mojikui','もじくい','imp',{1:'#3a3a3a',2:'#1a1a1a',e:'#ff4040',w:'#ffffff'},'fast'],
 // だい3ぶ
 ['kaminari','かみなりドリ','bat',{1:'#f0d040',2:'#a08010',e:'#ffffff'},'fast',[M_('mag',.3,'%sは いかずちを よんだ！',{f:.15})]],
 ['kumonosei','くものせい','ghost',{1:'#ffffff',2:'#c0c8e0',e:'#4060c0'},'mage',[M_('sleepAll',.15,'%sは ねむりの きりを はなった！')]],
 ['sorakishi','そらのきし','knight',{1:'#e8e8f0',2:'#a0a8c0',3:'#f0d040',e:'#40a0ff'},'norm',[M_('str',.25,'%sは やりで つらぬいた！')]],
 ['stormdrake','ストームドラゴン','dragon',{1:'#4ab080',2:'#2a7050',3:'#e0f0c0'},'brute',[M_('breath',.25,'%sは あらしの ブレスを はいた！',{f:.12})]],
 ['urakage','うらかげ','shade',{1:'#8a2a4a',2:'#5a1a2a',e:'#ffff40'},'fast'],
 ['kagamihei','かがみのへい','knight',{1:'#c0c8e0',2:'#8088a8',3:'#ffffff',e:'#ff40ff'},'tank'],
 ['sakasakoumori','さかさコウモリ','bat',{1:'#a040a0',2:'#6a206a',e:'#40ff40'},'fast',[M_('sleep1',.2,'%sは さかさまの うたを うたった！')]],
 ['uragaeshime','うらがえしの め','eye',{1:'#a03040',2:'#601020',e:'#40ffff',w:'#ffffff'},'mage',[M_('mag',.3,'%sは ゆがんだ ひかりを はなった！',{f:.16})]],
 ['yugami','ゆがみトカゲ','beast',{1:'#6a2a8a',2:'#3a1a5a',3:'#40ff80',e:'#ffff40'},'brute',[M_('breath',.2,'%sは ゆがんだ ほのおを はいた！',{f:.11})]],
 ['kagamimadou','かがみまどうし','mage',{1:'#c0c8e0',2:'#8088a8',3:'#ff40ff',e:'#40ffff'},'mage',[M_('mag',.3,'%sは はねかえる いかずちを よんだ！',{f:.17}),M_('sleepAll',.12,'%sは ねむりの じゅもんを となえた！')]],
 ['wasuregolem','わすれのいわ','golem',{1:'#7a7a8a',2:'#4a4a5a',e:'#ff40ff'},'tank'],
 ['chirinosei','ちりのせい','ghost',{1:'#b0a090',2:'#807060',e:'#3a2a1a'},'mage',[M_('mist',.2,'%sは わすれの ちりを まきちらした！',{f:.08})]],
 ['honeryu','ほねりゅう','dragon',{1:'#e8e0d0',2:'#a8a090',3:'#5a5048'},'brute',[M_('breath',.25,'%sは のろいの ブレスを はいた！',{f:.13})]],
 ['sennen','せんねんまえの まもの','beast',{1:'#6a4a8a',2:'#3a2a5a',3:'#ffe040',e:'#ff2040'},'brute'],
 ['kokuuryu','こくうりゅう','dragon',{1:'#1a1030',2:'#4a2070',3:'#c0a0ff'},'brute',[M_('breath',.25,'%sは こくうの ブレスを はいた！',{f:.13})]],
 ['wasureshito','わすれの しと','shade',{1:'#140a20',2:'#0a0510',e:'#ff2040'},'norm',[M_('sleepAll',.12,'%sは わすれの うたを うたった！'),M_('str',.2,'%sは かげの かまを ふりおろした！')]],
 ['kokumadou','こくうの まどうし','mage',{1:'#1a1a3a',2:'#0a0a1a',3:'#40ffff',e:'#ff40ff'},'mage',[M_('mag',.3,'%sは こくうの いかずちを よんだ！',{f:.17})]],
 ['yaminokishi','やみのきし','knight',{1:'#4a4a6a',2:'#2a2a40',3:'#c0c0d0',e:'#ff4040'},'tank'],
 ['maboroshi','ほしの まぼろし','lord',{1:'#e8e0a0',2:'#a89040',3:'#ffffff',w:'#ffffff',e:'#4080ff'},'mage',[M_('mag',.3,'%sは ほしの ひかりを はなった！',{f:.17})]],
];
for(const [k,n,s,p,arch,sk] of ROSTER) MON[k]=Object.assign({n,s,p,arch,sk},fstat(10,4,arch));
