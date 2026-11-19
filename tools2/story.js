// 1しょうから エンディングまで じどうで すすめる（めやす レベル・そうびで ボスと たたかう）
const {chromium}=require('playwright');
const LVADD=+(process.argv[2]||0), TRIALS=+(process.argv[3]||0), TUNEIN=process.argv[4]?JSON.parse(require('fs').readFileSync(process.argv[4],'utf8')):{};
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  p.on('console',m=>{if(m.text().startsWith('>>')) console.log(m.text());}); p.on('pageerror',e=>console.log('PAGEERR',e.stack.split('\n').slice(0,4).join(' | ')));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(1000);
  p.setDefaultTimeout(600000);
  const log=await p.evaluate(async ([LVADD,TRIALS,TUNEIN])=>{
    const R=__rpg, L=[]; Object.assign(R.TUNE,TUNEIN); R.applyTune(); const MEAS={}; R.setFast(true); R.setAuto(true);
    setInterval(()=>{if(R.busy) R.press(Math.random()<.4?'down':'a');},2);
    await R.beginStory('ソラ');
    const S=()=>R.S;
    const D=id=>R.DUNGEONS.find(d=>d.id===id);
    const TIER=[0,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,11,12,12,12];
    function prep(ch){
      const lv=Math.min(70,R.LV_OF_CH[ch]+LVADD), t=Math.min(12,TIER[ch]);
      for(const m of [...S().party,...(S().reserve||[])]){
        while(m.lv<lv){R.mkMember; growth(m);} m.exp=R.expFor(m.lv);
        const best=slot=>Object.keys(R.IT).filter(id=>R.IT[id].slot===slot&&canEquip(m,id)&&/\d+$/.test(id)&&+id.match(/\d+$/)[0]<=t).sort((a,b)=>(R.IT[b].atk||R.IT[b].def)-(R.IT[a].atk||R.IT[a].def))[0];
        for(const s of ['w','a','s']){const id=best(s); if(id&&(!m.eq[s]||!/\d+$/.test(m.eq[s])||(R.IT[id].atk||R.IT[id].def)>(R.IT[m.eq[s]].atk||R.IT[m.eq[s]].def))) m.eq[s]=id;}
        m.hp=m.mhp; m.mp=m.mmp; m.poison=false;
      }
      S().items.herb2=Math.max(S().items.herb2||0,ch<9?4:2); if(ch>=9) S().items.herb3=4; S().items.life=ch<5?1:2; if(ch>=5) S().items.drop=2;
    }
    const rec=async(name,fn)=>{const ch=S().ch; prep(ch); let tries=0, ok=false;
      while(tries<3&&!ok){tries++; const before=JSON.stringify(Object.keys(S().flags)); await fn(); ok=true; if(R.mode!=='field'){} }
      const hp=S().party.map(m=>m.hp+'/'+m.mhp).join(' ');
      console.log(`>> ch${ch} ${name}: turns=${window.__lastTurns} -> ch${S().ch}`); L.push(`ch${ch} ${name}: turns=${window.__lastTurns} lv=${S().party[0].lv} hp=[${hp}] -> ch${S().ch}`);};
    const measure=async(key,ids,area)=>{ if(!TRIALS) return; const snap=JSON.stringify(R.S); const r={turns:0,win:0,minHp:0,n:TRIALS};
      for(let k=0;k<TRIALS;k++){R.S=JSON.parse(snap); prep(R.S.ch); const res=await R.battle(ids,{boss:1,area,noDefeat:1}); r.turns+=window.__lastTurns; if(res==='win'){r.win++; r.minHp+=Math.min(...R.S.party.map(m=>m.hp/m.mhp));}}
      r.turns/=TRIALS; r.minHp=r.win?r.minHp/r.win:0; R.S=JSON.parse(snap); R.loadNPCs(); MEAS[key]=Object.assign(r,{ch:R.S.ch}); console.log('>> M '+key+' '+JSON.stringify(MEAS[key]));};
    const boss=async id=>{const d=D(id); await measure(d.boss,d.group||[d.boss],d.area); for(let k=0;k<4&&!S().flags['boss_'+id];k++){prep(S().ch); await dungeonBoss(d); if(!S().flags['boss_'+id]) L.push('  LOST '+id+' try '+(k+1));}};
    const mid=async (id,f)=>{const d=D(id); const mids=d.mids||[d.mid]; for(const m of mids){ if(f&&m.floor!==f) continue; await measure(m.mon,[m.mon],d.area); const flag=d.mids?`mid_${id}${m.floor}`:`mid_${id}`; for(let k=0;k<4&&!S().flags[flag];k++){prep(S().ch); await dungeonMid(d,m,flag); if(!S().flags[flag]) L.push('  LOST mid '+m.mon);}}};
    try{
    await metMio({}); await rec('seacave',()=>boss('seacave')); await mayorAkari();
    await rec('forest',()=>boss('forest')); await floraElder();
    await rec('minegolem',()=>mid('mine')); await rec('mine',()=>boss('mine')); await garmBar();
    await measure('jin1',['jin1'],'field'); await rec('jin1',()=>jinDuel1({})); await rec('ruins',()=>boss('ruins')); addItem('blueprint'); await bridgeWidow();
    await ririMeet(); await rec('vault',()=>boss('vault')); addItem('ririStone');
    await rec('bell',()=>boss('bell'));
    await rec('siege',()=>fortCommander()); await rec('fortu',()=>boss('fortu'));
    await rec('lhouse',()=>boss('lhouse'));
    ['ev1','ev2','ev3'].forEach(i=>addItem(i)); await trialTalk(); await rec('tide',()=>boss('tide'));
    await rec('gship',()=>boss('gship'));
    await beggarKing(); await rec('icecastle',()=>boss('icecastle'));
    await examTalk(); await rec('library',()=>boss('library'));
    addItem('hat'); await kobitoHat(); addItem('kinokoSoup'); await kobitoElder(); await rec('root',()=>boss('root'));
    await olgaLeaves(); await rec('lakeD',()=>boss('lakeD'));
    await rec('lava',()=>boss('lava')); addItem('fireOre'); addItem('starIron'); addItem('dragonScale'); await smithTalk();
    for(const m of S().party) if(m.cls==='hero') m.eq.w='legend';
    await rec('jin3',()=>mid('ntower')); await rec('ntower',()=>boss('ntower'));
    await rec('cloud',()=>boss('cloud'));
    await rec('mlight',()=>boss('mlight'));
    await rec('mfortD',()=>boss('mfortD'));
    await rec('mvault',()=>boss('mvault')); await ririFamily();
    await rec('waste',()=>boss('waste'));
    L.push('after kyojin map='+S().map+' party='+S().party.map(m=>m.name).join(','));
    await pastKing(); L.push('after past ch='+S().ch+' map='+S().map+' party='+S().party.map(m=>m.name+m.lv).join(','));
    await rec('gen1',()=>mid('final',2)); await rec('gen2',()=>mid('final',4)); await rec('gen3',()=>mid('final',6));
    prep(23); await measure('oblivion',['oblivion'],'nox'); await rec('final',()=>boss('final'));
    L.push('clear='+S().flags.clear+' ch='+S().ch+' map='+S().map+' quests='+JSON.stringify(S().q)+' frags='+S().frags);
    S().ch=25; await rec('ruins7',()=>boss('ruins7'));
    }catch(e){L.push('EXC '+e.stack);}
    L.push('MEAS '+JSON.stringify(MEAS)); return L;
  },[LVADD,TRIALS,TUNEIN]);
  console.log(log.join('\n')); await b.close();
})();
