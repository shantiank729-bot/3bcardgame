// 1章からクリアまで物語が進むかの検証：node tools/prog.js
const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:900,height:820}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message+' @ '+(e.stack||'').split('\n')[1]));
  await pg.goto('file://'+require('path').resolve(__dirname,'../rpg.html')); await pg.waitForTimeout(600);
  const E=(f,a)=>pg.evaluate(f,a);
  // drive: keep pressing A while busy
  const drive=async(fnStr,max=400)=>{ await E(s=>{window.__done=false; (async()=>{try{await (0,eval)(s);}catch(e){window.__err=String(e)} window.__done=true;})();},fnStr);
    for(let i=0;i<max;i++){ if(await E(()=>window.__done)) return true; await E(()=>window.__rpg.press('a')); await pg.waitForTimeout(15);} return false;};
  await pg.keyboard.press('KeyZ'); await pg.waitForTimeout(300); await pg.keyboard.press('Enter');
  for(let i=0;i<120;i++){ if(await E(()=>window.__rpg.mode==='field'&&!window.__rpg.busy)) break; await pg.keyboard.press('KeyZ'); await pg.waitForTimeout(120);}
  await pg.screenshot({path:'p0.png'});
  await E(()=>{window.__rpg.setFast(true); window.__rpg.setAuto(true);});
  const ch=()=>E(()=>window.__rpg.S.ch);
  const log=async(t)=>console.log(t,'ch',await ch(),'party',await E(()=>window.__rpg.S.party.map(p=>p.name+p.lv).join(',')),'err',await E(()=>window.__err||''));
  await log('start');
  // boost party so auto battles win quickly
  const boost=()=>E(()=>{for(const p of window.__rpg.S.party){p.lv=50;p.mhp=p.hp=9999;p.str=999;p.agi=200;p.mmp=p.mp=999;}});
  await boost();
  await drive("window.__rpg.S.flags.boss_lake=1; elderTalk()"); await log('elder after lake');
  await drive("mayorTalk()"); await log('mayor1'); 
  await drive("miraTalk()"); await boost(); await log('mira');
  await drive("window.__rpg.S.flags.boss_sewer=1; mayorTalk()"); await log('mayor2');
  await drive("addItem('key'); afterKeyItem('key')"); await log('key');
  await drive("gouTalk()"); await boost(); await log('gou');
  await drive("addItem('moon'); afterKeyItem('moon')"); await log('moon');
  await drive("addItem('sun'); afterKeyItem('sun')"); await log('sun');
  await drive("window.__rpg.gotoMap('castle2',9,4,'up').then(()=>zolgaTalk())",2000); await log('zolga+twist'); console.log('ship',await E(()=>JSON.stringify(window.__rpg.S.ship)));
  await drive("window.__rpg.gotoMap('port',15,13,'down').then(()=>senaTalk())"); await boost(); await log('sena');
  await drive("addItem('blue'); afterKeyItem('blue')"); await log('blue');
  await drive("priestessTalk()"); console.log('volcOpen',await E(()=>window.__rpg.S.flags.volcOpen));
  await drive("addItem('red'); afterKeyItem('red')"); await log('red');
  await drive("yukinoTalk()"); console.log('iceOpen',await E(()=>window.__rpg.S.flags.iceOpen));
  await drive("addItem('white'); afterKeyItem('white')"); await log('white');
  await drive("almaTalk()"); console.log('pyrOpen',await E(()=>window.__rpg.S.flags.pyrOpen));
  await drive("addItem('golddrop'); afterKeyItem('golddrop')"); await log('gold');
  await drive("window.__rpg.gotoMap('shrine',5,3,'up').then(()=>shrineTalk())",2000); await log('ritual'); console.log('whale',await E(()=>JSON.stringify(window.__rpg.S.whale)));
  for(const D of ['windlab','darktemple']) {await drive(`dungeonBoss(window.__rpg.NEWDG.find(d=>d.id==='${D}'))`,2000); await log(D);}
  await drive("window.__rpg.gotoMap('noxcastle3',2,2,'up').then(()=>dungeonMid(window.__rpg.NEWDG.find(d=>d.id==='noxcastle')))",2000); await log('mid zolga');
  await drive("window.__rpg.gotoMap('noxcastle5',2,2,'up')"); await log('enter nox5');
  await drive("dungeonBoss(window.__rpg.NEWDG.find(d=>d.id==='noxcastle'))",3000); await log('nox');
  console.log('flags',await E(()=>JSON.stringify(window.__rpg.S.flags)).then(s=>s.slice(0,300)));
  console.log('errors',errs); await b.close();
})();
