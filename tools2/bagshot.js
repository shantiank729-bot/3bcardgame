// どうぐが たくさん ある ときの メニュー（スクロール）を みる
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:820,height:760}});
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(800);
  await p.evaluate(()=>{__rpg.setFast(true);}); await p.evaluate(()=>__rpg.beginStory('ソラ'));
  await p.evaluate(()=>{document.querySelectorAll('.title,.menu').forEach(e=>e.remove()); __rpg.setFast(false); const S=__rpg.S;
    for(const id of ['herb','herb2','herb3','antidote','bell','drop','life','wing','smoke','fseed1','fseed2','lantern','tako','ore','ev1','ev2','ev3','sword3','axe2','shield4']) S.items[id]=3;});
  const k=async(key,ms=200)=>{await p.keyboard.press(key); await p.waitForTimeout(ms);};
  p.evaluate(()=>__rpg.run(()=>bagMenu())).catch(()=>{}); await p.waitForTimeout(500);
  await p.screenshot({path:process.argv[2]+'/bag1.png'});
  for(let i=0;i<9;i++) await k('ArrowDown',80);
  await p.waitForTimeout(200); await p.screenshot({path:process.argv[2]+'/bag2.png'});
  await b.close();
})();
