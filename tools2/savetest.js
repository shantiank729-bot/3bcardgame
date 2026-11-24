// じどうセーブ と こうしんごの ひきつぎ を たしかめる
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const c=await b.newContext(); const p=await c.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  const url='file://'+require('path').resolve(__dirname,'../rpg2.html');
  await p.goto(url); await p.waitForTimeout(800);
  await p.evaluate(async()=>{__rpg.setFast(true); await __rpg.beginStory('ソラ'); const e=__rpg.MAPS.akari.entry; await __rpg.gotoMap('akari',e[0],e[1],'up'); __rpg.S.gold=777;});
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange'));});
  const keys=await p.evaluate(()=>Object.keys(localStorage));
  console.log('keys',keys.join(','));
  // 1) ふつうに よみこみなおし → つづきから
  await p.reload(); await p.waitForTimeout(800);
  const t=await p.evaluate(()=>{const s=loadSave(); return s&&{map:s.map,gold:s.gold};}); console.log('after reload loadSave',JSON.stringify(t));
  // 2) こうしん（hot）で ひきつぎ
  const p2=await c.newPage(); await p2.addInitScript(()=>{window.claude={hot:{data:{save:JSON.stringify({party:[],map:'x'})},ready(f){window.__hotStart=f;},snapshot(f){window.__snap=f;}}};});
  await p2.goto(url); await p2.waitForTimeout(500);
  const r=await p2.evaluate(async()=>{const s=loadSave(); await window.__hotStart({save:JSON.stringify(s)}); await new Promise(r=>setTimeout(r,800)); return {mode:__rpg.mode,map:__rpg.S.map,gold:__rpg.S.gold,snap:!!window.__snap&&!!JSON.parse(window.__snap().save).map};});
  console.log('hot resume',JSON.stringify(r));
  await b.close();
})();
