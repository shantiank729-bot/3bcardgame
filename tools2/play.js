// キーボードで ふつうに あそんでみる（タイトル→なまえ→いえ→そと→メニュー）
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage({viewport:{width:820,height:760}});
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(800);
  const k=async(key,n=1,ms=120)=>{for(let i=0;i<n;i++){await p.keyboard.press(key); await p.waitForTimeout(ms);}};
  await k('Enter'); await p.waitForTimeout(400); await k('Enter'); // なまえ
  for(let i=0;i<40;i++) await k('Enter',1,250);
  const st=await p.evaluate(()=>({map:__rpg.S.map,x:__rpg.P.x,y:__rpg.P.y,ch:__rpg.S.ch,busy:__rpg.busy}));
  console.log('after intro',JSON.stringify(st));
  // そとへ
  await p.keyboard.down('ArrowDown'); await p.waitForTimeout(1500); await p.keyboard.up('ArrowDown'); await p.waitForTimeout(800);
  console.log('after exit',JSON.stringify(await p.evaluate(()=>({map:__rpg.S.map,x:__rpg.P.x,y:__rpg.P.y}))));
  await k('KeyX'); await p.waitForTimeout(300); await p.screenshot({path:process.argv[2]+'/play_menu.png'});
  await k('Enter'); await p.waitForTimeout(300); await p.screenshot({path:process.argv[2]+'/play_goal.png'}); await k('Enter'); await k('Escape');
  await k('ArrowDown'); await k('ArrowDown'); await k('ArrowDown'); await k('Enter'); await p.waitForTimeout(300); await p.screenshot({path:process.argv[2]+'/play_quest.png'}); await k('Escape',3);
  console.log('errors:',errs.join(' | ')||'none'); await b.close();
})();
