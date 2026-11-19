// rpg2.html を ひらいて エラーが ないか しらべる
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:800,height:900}});
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message)); p.on('console',m=>{if(m.type()==='error'||m.type()==='warning') errs.push(m.type()+': '+m.text());});
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html'));
  await p.waitForTimeout(1500);
  const info=await p.evaluate(()=>{const R=window.__rpg; if(!R) return 'no api'; return {maps:Object.keys(R.MAPS).length, mons:Object.keys(R.MON).length, dung:R.DUNGEONS.length, quests:Object.keys(R.QUESTS).length};});
  console.log(JSON.stringify(info)); console.log(errs.join('\n'));
  await p.screenshot({path:process.argv[2]||'/tmp/shot.png'});
  await b.close();
})();
