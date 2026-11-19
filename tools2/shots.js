// いくつかの ばしょの スクリーンショット
const {chromium}=require('playwright');
const OUT=process.argv[2];
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:820,height:760}});
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(800);
  await p.evaluate(()=>{const R=__rpg; R.setFast(true); R.setAuto(true);});
  await p.evaluate(()=>__rpg.beginStory('ソラ'));
  await p.evaluate(()=>{document.querySelectorAll('.title').forEach(e=>e.remove()); document.querySelectorAll('.menu').forEach(e=>e.remove());});
  await p.evaluate(()=>{const R=__rpg; R.setFast(false);});
  const go=async(map,x,y,t,name)=>{await p.evaluate(([map,x,y,t])=>{const R=__rpg; R.S.map=map; R.P.x=x; R.P.y=y; R.S.time=t; R.loadNPCs(); document.getElementById('msg').hidden=true;},[map,x,y,t]); await p.waitForTimeout(400); await p.locator('#screen').screenshot({path:`${OUT}/${name}.png`});};
  const M=await p.evaluate(()=>({ak:__rpg.MAPS.akari.entry, w:__rpg.MAPS.akari.world}));
  await go('akari_0',5,6,.3,'01_home');
  await go('akari',M.ak[0],M.ak[1]+6,.3,'02_akari');
  await go('akari',26,24,.7,'03_akari_night');
  await go('world',M.w[0]+2,M.w[1]-2,.3,'04_world');
  await go('seacave1',9,10,.3,'05_cave');
  await go('golde',17,14,.3,'06_golde');
  await go('sandra',18,12,.3,'07_sandra');
  await b.close();
})();
