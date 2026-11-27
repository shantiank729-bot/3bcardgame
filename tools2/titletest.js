// タイトルで きろく・じどうセーブを えらべるか、 はじめからで けされないか
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:820,height:760}});
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  const url='file://'+require('path').resolve(__dirname,'../rpg2.html');
  await p.goto(url); await p.waitForTimeout(500);
  await p.evaluate(()=>{const man={party:[{name:'ソラ',lv:23,cls:'hero',hp:1,mhp:1,mp:0,mmp:0,str:1,agi:1,eq:{}}],items:{},flags:{},map:'sandra',x:5,y:5,ch:6,gold:1};
    localStorage.setItem('hoshikage2-save-v1',JSON.stringify(man)); localStorage.setItem('hoshikage2-auto-v1',JSON.stringify({...man,ch:1,map:'akari',at:Date.now(),party:[{...man.party[0],lv:2}]}));});
  await p.reload(); await p.waitForTimeout(800);
  await p.screenshot({path:process.argv[2]+'/title_slots.png'});
  // はじめから を すこし あそぶ
  await p.evaluate(async()=>{__rpg.setFast(true); await __rpg.beginStory('テスト'); const e=__rpg.MAPS.akari.entry; await __rpg.gotoMap('akari',e[0],e[1],'up');});
  const after=await p.evaluate(()=>({man:JSON.parse(localStorage.getItem('hoshikage2-save-v1')).party[0].lv,auto:JSON.parse(localStorage.getItem('hoshikage2-auto-v1')).party[0].name}));
  console.log('after new game:',JSON.stringify(after));
  await b.close();
})();
