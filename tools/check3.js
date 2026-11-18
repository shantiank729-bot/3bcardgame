// 徒歩・船・空で行ける場所の検証：node tools/check3.js
const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.goto('file://'+require('path').resolve(__dirname,'../rpg.html')); await pg.waitForTimeout(800);
  const r=await pg.evaluate(()=>{
    const G=window.__rpg, W=G.WORLD, H=W.length, Wd=W[0].length;
    const solid=new Set(['^','~','Y','W','c','X','#','p','t','Q','J','E','N','A','I','y','D','k','h','v','m','l']);
    const icons='VGCKHRSOZMB1234567890!';
    const walk=(x,y)=>{const t=W[y]&&W[y][x]; return t&&!solid.has(t)&&t!=='~';};
    const foot=starts=>{const seen=new Set(starts.map(s=>s.join(','))), q=starts.slice();
      while(q.length){const [x,y]=q.shift(); if(icons.includes(W[y][x])&&!(x===starts[0][0]&&y===starts[0][1])) continue;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny; if(seen.has(k)||!walk(nx,ny)) continue; seen.add(k); q.push([nx,ny]);}}
      return seen;};
    const found=s=>[...icons].filter(c=>{for(let y=0;y<H;y++){const x=W[y].indexOf(c); if(x>=0&&s.has(x+','+y)) return true;} return false;});
    const A=foot([[13,22]]);
    const oc=G.dockFor? null:null;
    // ship: ocean reachable from dock near Hayate
    const [hx,hy]=G.MAPS.hayate.world; const d=G.dockFor(hx,hy);
    const sea=new Set([d.x+','+d.y]), q=[[d.x,d.y]];
    while(q.length){const [x,y]=q.shift(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny; if(sea.has(k)||!W[ny]||W[ny][nx]!=='~') continue; sea.add(k); q.push([nx,ny]);}}
    const land=[]; for(const k of sea){const [x,y]=k.split(',').map(Number); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){if(walk(x+dx,y+dy)) land.push([x+dx,y+dy]);}}
    const Bs=new Set(A); for(const s of land) for(const k of foot([s])) Bs.add(k);
    // whale: land anywhere walkable non-icon
    const all=[]; for(let y=0;y<H;y++) for(let x=0;x<Wd;x++) if(walk(x,y)&&!icons.includes(W[y][x])) all.push([x,y]);
    const Cs=new Set(); for(const k of foot(all.slice(0,1))) Cs.add(k);
    const whaleIcons=[...icons].filter(c=>{for(let y=0;y<H;y++){const x=W[y].indexOf(c); if(x<0) continue; return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>walk(x+dx,y+dy)&&!icons.includes(W[y+dy][x+dx]));} return false;});
    const dockInfo=['village','town','hayate','port','kazan','yukino','alma','lumina'].map(id=>{const [x,y]=G.MAPS[id].world; const dd=G.dockFor(x,y); return id+':'+(dd?dd.x+','+dd.y:'none');});
    return {foot:found(A).join(''),ship:found(Bs).join(''),whaleLandable:whaleIcons.join(''),docks:dockInfo.join(' '),size:Wd+'x'+H};
  });
  console.log(r); console.log('errors',errs);
  await pg.screenshot({path:'z0.png'}); await b.close();
})();
