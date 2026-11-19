// node ev.js "js expression"  … ページの なかで しきを ひょうか
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>console.log('LOG',m.text()));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(1000);
  const r=await p.evaluate(src=>{try{return JSON.stringify(eval(src));}catch(e){return 'ERR '+e.stack}},process.argv[2]);
  console.log(r); await b.close();
})();
