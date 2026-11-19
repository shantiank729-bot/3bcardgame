// せかいちずの すすみかた（だんかい ごとに いける ばしょ）を しらべる
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(1200);
  const out=await p.evaluate(()=>{
    const R=window.__rpg, M=R.MAPS, SOL=R.SOLID, res=[];
    const icons=m=>R.WORLD_ICONS.filter(i=>i.map===m);
    function walk(map,starts,ab){const m=M[map], seen=new Set(), q=[];
      for(const [x,y] of starts){seen.add(x+','+y); q.push([x,y]);}
      while(q.length){const [x,y]=q.shift(); if(m.links[x+','+y]&&!starts.some(s=>s[0]===x&&s[1]===y)) continue;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny; if(seen.has(k)) continue; const r=m.rows[ny]; if(!r) continue; let t=r[nx]; if(t===undefined) continue;
          if(m.dyn&&m.dyn[k]) t=ab.bridge?'=':'~';
          if(ab.air){seen.add(k); q.push([nx,ny]); continue;}
          const icon=m.links[k];
          if(t==='~'&&!icon){ if(!ab.ship) continue; }
          else if(t==='藪'){ if(!ab.sickle) continue; }
          else if(t==='岩'){ if(!ab.hammer) continue; }
          else if(!icon&&SOL.has(t)) continue;
          seen.add(k); q.push([nx,ny]);}}
      return seen;}
    const A=M.akari.world;
    const phases=[['start',{}],['sickle',{sickle:1}],['hammer',{sickle:1,hammer:1}],['bridge',{sickle:1,hammer:1,bridge:1}],['ship',{sickle:1,hammer:1,bridge:1,ship:1}],['air',{air:1}]];
    let prev=new Set();
    for(const [n,ab] of phases){const s=walk('world',[A],ab); const got=icons('world').filter(i=>s.has(i.x+','+i.y)).map(i=>i.to); res.push(n+': +'+got.filter(g=>!prev.has(g)).join(' ')); got.forEach(g=>prev.add(g));}
    const miss=icons('world').filter(i=>!prev.has(i.to)).map(i=>i.to); res.push('NEVER: '+miss.join(' '));
    const mk=M.makari.world; const s=walk('mirror',[mk],{}); res.push('mirror: '+icons('mirror').filter(i=>s.has(i.x+','+i.y)).map(i=>i.to).join(' ')+' / miss '+icons('mirror').filter(i=>!s.has(i.x+','+i.y)).map(i=>i.to+'@'+i.x+','+i.y).join(' '));
    // ふねの とまれる ばしょ（アカリ）
    res.push('dock akari '+JSON.stringify(R.dockFor(A[0],A[1])));
    return res;
  });
  console.log(out.join('\n')); await b.close();
})();
