// ボス戦バランスの検証：node tools/sim.js [戦闘回数] [章の番号,...]（Playwright が必要）
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
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'../rpg.html')); await pg.waitForTimeout(500);
  await pg.evaluate(()=>{window.__rpg.setFast(true); window.__rpg.setAuto(true);});
  const rows=[];
  for(const c of CASES){
    if(only&&!only.split(',').includes(String(c.ch))) continue;
    const r=await pg.evaluate(async ({c,N})=>{
      const G=window.__rpg; let win=0, turns=0, hpLeft=0, bossLeft=0;
      for(let t=0;t<N;t++){
        const names={hero:'ユウ',mira:'ミラ',gou:'ゴウ',sena:'セナ'};
        G.S={party:c.party.map(([cl,eq])=>G.mkMember(cl,names[cl],c.L,eq)),gold:0,items:Object.assign({},c.items),flags:{},map:'village',x:10,y:10,dir:'up',ch:c.ch,visited:['village'],lastTown:'village'};
        let last=null; const iv=setInterval(()=>{if(G.B) last=G.B.en.filter(e=>e.d.boss).reduce((s,e)=>s+e.hp/e.mhp,0)/Math.max(1,G.B.en.filter(e=>e.d.boss).length);},0);
        const res=await G.battle(c.boss,{boss:1,area:c.area}); clearInterval(iv);
        if(res==='win'){win++; hpLeft+=G.S.party.reduce((s,p)=>s+p.hp/p.mhp,0)/G.S.party.length;} else bossLeft+=(last??1);
        turns+=window.__lastTurns||0;
      }
      return {win:win/N,turns:turns/N,hpLeft:win?hpLeft/win:0,bossLeft:(N-win)?bossLeft/(N-win):0,
        bossHP:c.boss.map(id=>G.MON[id].hp).join('+'),bossAtk:c.boss.map(id=>G.MON[id].atk).join('/')};
    },{c,N});
    const ok=r.win>=c.target[0]&&r.win<=c.target[1]?'OK':r.win<c.target[0]?'HARD':'EASY';
    rows.push(`ch${c.ch} ${c.boss.join('+')} Lv${c.L}: win ${(r.win*100).toFixed(0)}% turns ${r.turns.toFixed(1)} partyHP ${(r.hpLeft*100).toFixed(0)}% bossLeftOnLoss ${(r.bossLeft*100).toFixed(0)}% hp=${r.bossHP} atk=${r.bossAtk} => ${ok}`);
    console.log(rows[rows.length-1]);
  }
  console.log('errors',errs.slice(0,5)); await b.close();
})();
