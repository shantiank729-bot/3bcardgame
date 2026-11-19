const {chromium}=require('playwright');
const OUT=process.argv[2];
(async()=>{
  const b=await chromium.launch();
  for(const [vw,tag] of [[{width:820,height:760},'pc'],[{width:390,height:844},'phone']]){
  const p=await b.newPage({viewport:vw});
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(800);
  await p.evaluate(()=>{const R=__rpg; R.setFast(true); R.setAuto(true);});
  await p.evaluate(()=>__rpg.beginStory('ソラ'));
  await p.evaluate(()=>{document.querySelectorAll('.title,.menu').forEach(e=>e.remove()); const R=__rpg; R.setFast(false);
    const S=R.S; S.party.push(R.mkMember('mio','ミオ',20,{w:'staff4',a:'robe4'}),R.mkMember('garm','ガルム',20,{w:'axe4',a:'heavy4',s:'shield4'}),R.mkMember('riri','リリ',20,{w:'knife4'})); S.party[0]=Object.assign(R.mkMember('hero','ソラ',20,{w:'sword4',a:'heavy4',s:'shield4'}));});
  const go=async(map,x,y,t,name)=>{await p.evaluate(([map,x,y,t])=>{const R=__rpg; R.S.map=map; R.P.x=x; R.P.y=y; R.S.time=t; R.loadNPCs(); document.getElementById('msg').hidden=true;},[map,x,y,t]); await p.waitForTimeout(500); await p.screenshot({path:`${OUT}/${tag}_${name}.png`});};
  if(tag==='pc'){
    const v=await p.evaluate(()=>{const m=__rpg.MAPS.vault2; const g=m.npcs.find(n=>n.guard); return g?[g.x,g.y+1]:m.entry;});
    await go('vault2',v[0],v[1],.3,'guard');
    const mk=await p.evaluate(()=>__rpg.MAPS.makari.world); await go('mirror',mk[0],mk[1]+1,.3,'mirror');
    await go('past',16,20,.3,'past');
  }
  const ak=await p.evaluate(()=>__rpg.MAPS.akari.entry); await go('akari',ak[0],ak[1]+1,.3,'town');
  p.evaluate(()=>__rpg.battle(['kanebourei'],{boss:1,area:'crypt'})).catch(()=>{}); await p.waitForTimeout(3500); await p.screenshot({path:`${OUT}/${tag}_battle.png`});
  await p.close();
  }
  await b.close();
})();
