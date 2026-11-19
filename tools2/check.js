// データと ちずの せいごうせいを しらべる（いきどまり・ないID・とどかない とびら）
const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message));
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(1200);
  const out=await p.evaluate(()=>{
    const R=window.__rpg, M=R.MAPS, bad=[];
    // ID
    for(const [z,L] of Object.entries(R.ENC)) for(const g of L) for(const id of g) if(!R.MON[id]) bad.push('ENC no mon '+z+':'+id);
    for(const z of Object.keys(R.ENC)) if(!R.ZONE_ML[z]) bad.push('no ZONE_ML '+z);
    for(const [id,m] of Object.entries(R.MON)){ if(!R.MSPR[m.s]) bad.push('no sprite '+id+' '+m.s); if(m.form2&&!R.MSPR[m.form2.s]) bad.push('no form2 sprite '+id);
      for(const ph of m.phases||[]) for(const mv of ph.moves){ if(mv.t==='summon'&&!R.MON[mv.id]) bad.push('summon '+id+'->'+mv.id); } }
    for(const D of R.DUNGEONS){ if(!R.MON[D.boss]) bad.push('boss '+D.id+' '+D.boss); for(const g of D.group||[]) if(!R.MON[g]) bad.push('grp '+g);
      for(const L of D.loot) if(typeof L==='string'&&L!=='frag'&&!R.IT[L]) bad.push('loot '+D.id+' '+L); if(D.reward&&D.reward!=='frag'&&!R.IT[D.reward]) bad.push('reward '+D.reward); if(!R.ZONE_ML[D.zone]) bad.push('zone '+D.zone); }
    for(const [id,m] of Object.entries(M)){
      for(const [k,l] of Object.entries(m.links||{})){ if(!M[l[0]]) bad.push('link '+id+' '+k+' -> '+l[0]); else { const t=M[l[0]]; const r=t.rows[l[2]]; if(!r||r[l[1]]===undefined) bad.push('link oob '+id+'->'+l.join(',')); } }
      for(const o of m.objs||[]) if(o.loot&&typeof o.loot==='string'&&o.loot!=='frag'&&!R.IT[o.loot]) bad.push('objloot '+id+' '+o.loot);
      for(const c of m.chests||[]) if(c.item&&c.item!=='frag'&&!R.IT[c.item]) bad.push('chest '+id+' '+c.item);
      for(const h of m.hid||[]) if(typeof h.loot==='string'&&h.loot!=='frag'&&!R.IT[h.loot]) bad.push('hid '+id+' '+h.loot);
    }
    for(const ic of R.WORLD_ICONS) if(!M[ic.to]) bad.push('icon to '+ic.to);
    // ちず の つながり（たいようの ある マップ）
    const SOL=R.SOLID, pass=(m,x,y,abil)=>{const r=m.rows[y]; if(!r||r[x]===undefined) return false; let t=r[x]; if(m.dyn&&m.dyn[x+','+y]) t='=';
      if(t==='藪'||t==='岩'||t==='割'||t==='錠'||t==='格'||t==='隠') return abil; return !SOL.has(t);};
    function flood(m,sx,sy,abil,blockObj){const seen=new Set([sx+','+sy]), q=[[sx,sy]]; const occ=new Set([...(m.objs||[]),...(blockObj?(m.npcs||[]).filter(n=>!n.mon&&!n.guard):[])].map(o=>o.x+','+o.y));
      while(q.length){const [x,y]=q.shift(); if(m.links&&m.links[x+','+y]&&!(x===sx&&y===sy)) continue;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny; if(seen.has(k)||occ.has(k)) continue; if(!pass(m,nx,ny,abil)) continue; seen.add(k); q.push([nx,ny]);}}
      return seen;}
    const near=(set,x,y)=>[[0,0],[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>set.has((x+dx)+','+(y+dy)));
    for(const [id,m] of Object.entries(M)){
      if(m.kind==='world') continue;
      const e=m.entry; if(!e){bad.push('no entry '+id); continue;}
      const s=flood(m,e[0],e[1],true,true);
      for(const k of Object.keys(m.links||{})){const [x,y]=k.split(',').map(Number); if(!near(s,x,y)) bad.push('unreach link '+id+' '+k);}
      for(const n of m.npcs||[]) if(!n.guard&&!near(s,n.x,n.y)) bad.push('unreach npc '+id+' '+n.x+','+n.y+' '+(n.id||n.mon||n.pal));
      for(const c of m.chests||[]) if(!near(s,c.x,c.y)) bad.push('unreach chest '+id+' '+c.id);
      for(const o of m.objs||[]) if(!near(s,o.x,o.y)) bad.push('unreach obj '+id+' '+o.id);
      for(const h of m.hid||[]) if(!s.has(h.x+','+h.y)) bad.push('unreach hid '+id+' '+h.id);
      if(m.town){const s2=flood(m,e[0],e[1],false,true); for(const k of Object.keys(m.links)){const [x,y]=k.split(',').map(Number); if(!near(s2,x,y)) bad.push('town door blocked '+id+' '+k);}}
    }
    // せかいの アイコン（りく か）
    for(const ic of R.WORLD_ICONS){const m=M[ic.map]; const nb=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>m.rows[ic.y+dy][ic.x+dx]); if(nb.every(t=>t==='~'||t==='^')&&ic.tile!=='~') bad.push('icon isolated '+ic.to+' '+ic.x+','+ic.y+' '+nb.join(''));}
    for(const h of M.world.hid) {const t=M.world.rows[h.y][h.x]; if(SOL.has(t)||t==='~') bad.push('world hid on '+t+' '+h.id);}
    return bad;
  });
  console.log(out.length+' problems'); console.log(out.slice(0,120).join('\n'));
  await b.close();
})();
