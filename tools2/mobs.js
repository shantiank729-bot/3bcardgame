// ざこせんの てごたえ：ちいきごとに めやすレベルの パーティで 8かい たたかう
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(1000);
  p.setDefaultTimeout(600000);
  const out=await p.evaluate(async()=>{
    const R=__rpg; R.setFast(true); R.setAuto('trash'); setInterval(()=>{if(R.busy) R.press('a');},2);
    R.newGame('ソラ'); const L=[];
    const TIER=[0,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,11,12,12,12];
    const PARTY_AT=ch=>ch<4?['hero','mio']:ch<5?['hero','mio','garm']:ch<9?['hero','mio','garm','riri']:ch===14?['hero','mio','garm','riri']:ch<16?['hero','mio','garm','olga']:['hero','mio','jin','olga'];
    for(const [z,[ml,ch]] of Object.entries(R.ZONE_ML)){
      if(!R.ENC[z]) continue;
      const t=Math.min(12,TIER[ch]);
      let turns=0,lost=0,dead=0,n=8;
      for(let k=0;k<n;k++){
        R.S.party=PARTY_AT(ch).map(c=>{const m=R.mkMember(c,c,ml,{}); for(const s of ['w','a','s']){const id=Object.keys(R.IT).filter(i=>R.IT[i].slot===s&&canEquip(m,i)&&/\d+$/.test(i)&&+i.match(/\d+$/)[0]<=t).sort((a,b)=>(R.IT[b].atk||R.IT[b].def)-(R.IT[a].atk||R.IT[a].def))[0]; if(id) m.eq[s]=id;} return m;});
        R.S.items={herb2:3}; R.S.map='world';
        const g=R.ENC[z][k%R.ENC[z].length];
        await R.battle(g,{zone:z,area:'field',noDefeat:1}); turns+=window.__lastTurns;
        const tot=R.S.party.reduce((s,m)=>s+m.mhp,0), cur=R.S.party.reduce((s,m)=>s+m.hp,0); lost+=1-cur/tot; dead+=R.S.party.filter(m=>m.hp<=0).length;
      }
      L.push(`${z.padEnd(10)} ML${ml} ch${ch} turns ${(turns/n).toFixed(1)} hpLost ${(lost/n*100).toFixed(0)}% deaths ${dead}`);
    }
    return L;
  });
  console.log(out.join('\n')); await b.close();
})();
