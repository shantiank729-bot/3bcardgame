// 雑魚戦の手応えの検証：node tools/mobs.js
// せっけいしょ §6：かくしょうの ボスを もくひょうLv・そのしょうの そうびで じどうせんとうさせ、 しょうりつを はかる
const { chromium } = require('playwright');
const N=+process.argv[2]||16;
const only=process.argv[3];
const H=(w,a,s)=>({w,a,s}), M=(w,a,s)=>({w,a,s});
const CASES=[
 {ch:1,boss:['nushi'],area:'lake',L:5,party:[['hero',H('knife','leather','woodS')]],items:{herb:5},target:[.6,.9]},
 {ch:2,boss:['ratking'],area:'sewer',L:8,party:[['hero',H('bronze','chain','woodS')],['mira',M('oak','leather')]],items:{herb:4,herb2:2,antidote:3,life:1},target:[.6,.9]},
 {ch:3,boss:['guardian'],area:'cave',L:11,party:[['hero',H('steel','chain','ironS')],['mira',M('dewstaff','robe')]],items:{herb2:4,life:1,antidote:2},target:[.6,.9]},
 {ch:4,boss:['witch'],area:'tower',L:15,party:[['hero',H('steel','plate','ironS')],['mira',M('magstaff','robe')],['gou',H('axe','plate','woodS')]],items:{herb2:5,life:2,antidote:4,bell:2},target:[.6,.9]},
 {ch:5,boss:['boneking'],area:'crypt',L:18,party:[['hero',H('steel','silver','silverS')],['mira',M('magstaff','robe2')],['gou',H('holyaxe','silver','ironS')]],items:{herb2:5,life:2,antidote:3,bell:2},target:[.6,.9]},
 {ch:6,boss:['zolga'],area:'castle',L:21,party:[['hero',H('star','silver','silverS')],['mira',M('magstaff','robe2','scaleS')],['gou',H('holyaxe','silver','ironS')]],items:{herb2:6,life:2,drop:1,bell:2},target:[.6,.9]},
 {ch:7,boss:['jabara'],area:'sea',L:25,party:[['hero',H('seasword','seamail','shellS')],['mira',M('seastaff','searobe','shellS')],['gou',H('seasword','seamail','shellS')],['sena',M('mace','searobe','shellS')]],items:{herb2:6,life:3,drop:2},target:[.6,.9]},
 {ch:8,boss:['flamelord'],area:'volcano',L:28,party:[['hero',H('firesword','flamemail','shellS')],['mira',M('flamestaff','firerobe','shellS')],['gou',H('firesword','seamail','shellS')],['sena',M('seastaff','firerobe','shellS')]],items:{herb2:6,life:3,drop:2},target:[.6,.9]},
 {ch:9,boss:['setsura'],area:'ice',L:31,party:[['hero',H('iceaxe','snowmail','iceS')],['mira',M('icestaff','snowrobe','iceS')],['gou',H('iceaxe','snowmail','iceS')],['sena',M('icestaff','snowrobe','iceS')]],items:{herb2:6,life:3,drop:2},target:[.6,.9]},
 {ch:10,boss:['zahar'],area:'desert',L:34,party:[['hero',H('goldsword','goldmail','goldS')],['mira',M('sunstaff','sunrobe','goldS')],['gou',H('goldsword','goldmail','goldS')],['sena',M('sunstaff','sunrobe','goldS')]],items:{herb2:6,life:3,drop:2},target:[.6,.9]},
 {ch:11,boss:['galva'],area:'castle',L:36,party:[['hero',H('goldsword','goldmail','goldS')],['mira',M('sunstaff','sunrobe','goldS')],['gou',H('goldsword','goldmail','goldS')],['sena',M('sunstaff','sunrobe','goldS')]],items:{herb2:6,life:3,drop:2},target:[.6,.9]},
 {ch:12,boss:['tempes'],area:'sky',L:40,party:[['hero',H('skyaxe','skymail','skyS')],['mira',M('angelstaff','angelrobe','skyS')],['gou',H('skyaxe','skymail','skyS')],['sena',M('angelstaff','angelrobe','skyS')]],items:{herb2:6,life:3,drop:3},target:[.6,.9]},
 {ch:13,boss:['zero','nero'],area:'dark',L:43,party:[['hero',H('starsword','skymail','lightS')],['mira',M('angelstaff','angelrobe','skyS')],['gou',H('skyaxe','skymail','skyS')],['sena',M('angelstaff','angelrobe','skyS')]],items:{herb2:6,life:3,drop:3},target:[.6,.9]},
 {ch:14,boss:['zolga2'],area:'nox',L:45,party:[['hero',H('starsword','skymail','lightS')],['mira',M('angelstaff','angelrobe','skyS')],['gou',H('skyaxe','skymail','skyS')],['sena',M('angelstaff','angelrobe','skyS')]],items:{herb2:6,life:3,drop:3},target:[.6,.9]},
 {ch:15,boss:['nox'],area:'nox',L:47,party:[['hero',H('starsword','skymail','lightS')],['mira',M('angelstaff','angelrobe','skyS')],['gou',H('skyaxe','skymail','skyS')],['sena',M('angelstaff','angelrobe','skyS')]],items:{herb2:8,life:4,drop:4},target:[.5,.8]},
 {ch:16,boss:['stardragon'],area:'abyss',L:50,party:[['hero',H('starsword','starmail','lightS')],['mira',M('galaxystaff','galaxyrobe','skyS')],['gou',H('dragonaxe','flamemail','skyS')],['sena',M('angelstaff','angelrobe','skyS')]],items:{herb2:8,life:4,drop:4},target:[.4,.7]},
];

// ざこせん：そのばしょに つく レベル（まえの しょうの もくひょう+1）で 30かい たたかう
const ZONES=[[1,'lake',2],[2,'sewer',6],[3,'cave',9],[4,'east',12],[4,'tower',13],[5,'crypt',16],[6,'castle',19],[7,'sea1',22],[7,'seacave',23],[8,'volcano',26],[9,'ice',29],[9,'icet',30],
  [10,'desert',32],[10,'pyr',33],[12,'sky',37],[12,'sky2',38],[13,'dark',41],[14,'nox',44],[16,'abyss',48]];
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'../rpg.html')); await pg.waitForTimeout(500);
  await pg.evaluate(()=>{window.__rpg.setFast(true); window.__rpg.setAuto('trash');});
  for(const [ch,zone,L] of ZONES){
    const c=CASES.find(x=>x.ch===ch)||CASES[CASES.length-1];
    const r=await pg.evaluate(async ({c,zone,L,nm})=>{
      const G=window.__rpg; let win=0,turns=0,lost=0; const N=24; Object.assign(G.NMUL,nm);
      for(let t=0;t<N;t++){
        const names={hero:'ユウ',mira:'ミラ',gou:'ゴウ',sena:'セナ'};
        G.S={party:c.party.map(([cl,eq])=>G.mkMember(cl,names[cl],L,eq)),gold:0,items:{},flags:{},map:'village',x:10,y:10,dir:'up',ch:c.ch,visited:['village'],lastTown:'village'};
        const g=G.ENC[zone][Math.floor(Math.random()*G.ENC[zone].length)];
        const res=await G.battle(g,{area:'field',zone}); if(res==='win'){win++; lost+=1-G.S.party.reduce((s,p)=>s+p.hp/p.mhp,0)/G.S.party.length;}
        turns+=window.__lastTurns||0;
      }
      return {win:win/N,turns:turns/N,lost:win?lost/win:1};
    },{c,zone,L,nm:JSON.parse(process.env.NM||'{}')});
    console.log(`ch${ch} ${zone} Lv${L}: win ${(r.win*100).toFixed(0)}% turns ${r.turns.toFixed(1)} HPlost/battle ${(r.lost*100).toFixed(0)}%`);
  }
  console.log('errors',errs.slice(0,5)); await b.close();
})();
