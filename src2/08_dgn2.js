/* ---------- ダンジョン（しかけつき じどう せいせい） ----------
   ゼルダの カギの かんがえかた：ほんすじの つうろに カギの とびら（または こうし）を おき、
   カギ（または スイッチ）は スタートがわの わきみちの いきどまりに おく → わきみちを たんけん させる */
function genFloor(o){
  const r=prng(o.seed), W=o.w, H=o.h;
  const g=[...Array(H)].map(()=>Array(W).fill(o.wall));
  const sx=1+2*Math.floor((W-2)/4), sy=H-2;
  g[sy][sx]=o.floor; const st=[[sx,sy]];
  while(st.length){
    const [x,y]=st[st.length-1];
    const ds=[[2,0],[-2,0],[0,2],[0,-2]].filter(([dx,dy])=>{const nx=x+dx,ny=y+dy; return nx>0&&ny>0&&nx<W-1&&ny<H-1&&g[ny][nx]===o.wall;});
    if(!ds.length){st.pop(); continue;}
    const [dx,dy]=ds[Math.floor(r()*ds.length)]; g[y+dy/2][x+dx/2]=o.floor; g[y+dy][x+dx]=o.floor; st.push([x+dx,y+dy]);
  }
  for(let i=0;i<o.rooms;i++){
    const rw=3+2*Math.floor(r()*2), rh=3+2*Math.floor(r()*2);
    const rx=1+2*Math.floor(r()*((W-rw-1)/2)), ry=1+2*Math.floor(r()*((H-rh-3)/2));
    for(let y=ry;y<ry+rh&&y<H-1;y++) for(let x=rx;x<rx+rw&&x<W-1;x++) g[y][x]=o.floor;
  }
  for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++){
    if(g[y][x]!==o.wall||(x+y)%2!==1||r()>=o.loops) continue;
    if((g[y][x-1]===o.floor&&g[y][x+1]===o.floor)||(g[y-1][x]===o.floor&&g[y+1][x]===o.floor)) g[y][x]=o.floor;
  }
  const isF=(x,y)=>g[y]&&(g[y][x]===o.floor||g[y][x]==='u'||g[y][x]==='d'||g[y][x]==='U');
  const nb=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[x+dx,y+dy]).filter(([a,b])=>isF(a,b));
  const bfs=(sx0,sy0,block)=>{const dist=[...Array(H)].map(()=>Array(W).fill(-1)), par={}; dist[sy0][sx0]=0; const q=[[sx0,sy0]];
    while(q.length){const [x,y]=q.shift(); for(const [nx,ny] of nb(x,y)){ if(block&&block.has(nx+','+ny)) continue; if(dist[ny][nx]<0){dist[ny][nx]=dist[y][x]+1; par[nx+','+ny]=[x,y]; q.push([nx,ny]);}}}
    return {dist,par};};
  const {dist}=bfs(sx,sy);
  const tiles=[]; for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++) if(dist[y][x]>0) tiles.push([x,y]);
  const far=tiles.reduce((a,b)=>dist[b[1]][b[0]]>dist[a[1]][a[0]]?b:a);
  const dead=tiles.filter(([x,y])=>nb(x,y).length===1).sort((a,b)=>dist[b[1]][b[0]]-dist[a[1]][a[0]]);
  return {g,sx,sy,far,dead,nb,r,bfs,dist,W,H,isF};
}
// ほんすじ（start→goal）の とちゅうで、 ふさぐと goal に いけなくなる マスを さがし、
// その てまえがわの いきどまりを かえす
function findChoke(F,goal,avoid){
  const {par}=F.bfs(F.sx,F.sy); const path=[]; let k=goal[0]+','+goal[1];
  while(par[k]){path.unshift(k.split(',').map(Number)); const p=par[k]; k=p[0]+','+p[1];}
  const n=path.length; if(n<6) return null;
  for(let i=Math.floor(n*.45);i<Math.floor(n*.85);i++){
    const [x,y]=path[i]; if(F.nb(x,y).length!==2||avoid.has(x+','+y)) continue;
    const blk=new Set([x+','+y]); const {dist}=F.bfs(F.sx,F.sy,blk);
    if(dist[goal[1]][goal[0]]>=0) continue;
    const ds=F.dead.filter(([dx,dy])=>dist[dy][dx]>0&&!avoid.has(dx+','+dy)&&!(dx===F.sx&&dy===F.sy));
    if(!ds.length) continue;
    ds.sort((a,b)=>dist[b[1]][b[0]]-dist[a[1]][a[0]]);
    return {door:[x,y],spot:ds[0]};
  }
  return null;
}
// いきどまりの むこうに かくしべや（隠＝ランタンで ひかる、 割＝ハンマーで こわす）
function carveSecret(F,avoid,kind){
  for(const [x,y] of F.dead){
    if(avoid.has(x+','+y)) continue;
    const [nx,ny]=F.nb(x,y)[0], dx=x-nx, dy=y-ny;
    const ax=x+dx, ay=y+dy, bx=x+2*dx, by=y+2*dy;
    if(bx<1||by<1||bx>=F.W-1||by>=F.H-1) continue;
    if(F.isF(ax,ay)||F.isF(bx,by)) continue;
    const side=[[bx+dy,by+dx],[bx-dy,by-dx],[bx+dx,by+dy]];
    if(side.some(([sx,sy])=>F.isF(sx,sy))) continue;
    F.g[ay][ax]=kind; F.g[by][bx]=F.g[y][x];
    avoid.add(x+','+y); avoid.add(bx+','+by);
    return [bx,by];
  }
  return null;
}
const DUNGEONS=[];
function buildDungeons(){
  for(const D of DUNGEONS){
    let li=0;
    const fl=[];
    for(let f=1;f<=D.floors;f++) fl.push(genFloor({w:D.w,h:D.h,seed:D.seed*31+f*7,wall:D.wall,floor:D.floor,rooms:D.rooms??2,loops:D.loops??.07}));
    const mids=D.mids||(D.mid?[D.mid]:[]);
    fl.forEach((F,i)=>{ if(mids.some(m=>m.floor===i+1)&&F.dead.length) F.far=F.dead[0]; });
    fl.forEach((F,i)=>{
      const f=i+1, id=D.id+f, last=f===D.floors, g=F.g;
      const startN=F.nb(F.sx,F.sy)[0];
      const fwd=D.up?'u':'d', back=D.up?'d':'u';
      const links={};
      g[F.sy][F.sx]=f===1?(D.from?'u':'U'):back;
      if(f===1&&D.from) links[F.sx+','+F.sy]=D.from;
      if(f>1){const P2=fl[i-1]; const n2=P2.nb(P2.far[0],P2.far[1])[0]; links[F.sx+','+F.sy]=[D.id+(f-1),n2[0],n2[1],'down'];}
      const npcs=[], chests=[], avoid=new Set([F.sx+','+F.sy,startN.join(',')]);
      let goal=F.far;
      if(!last){
        g[F.far[1]][F.far[0]]=fwd; const N=fl[i+1]; const n3=N.nb(N.sx,N.sy)[0];
        links[F.far[0]+','+F.far[1]]=[D.id+(f+1),n3[0],n3[1],'up'];
        avoid.add(F.far.join(','));
        const mid=mids.find(m=>m.floor===f);
        if(mid){
          const bn=F.nb(F.far[0],F.far[1])[0], flag=D.mids?`mid_${D.id}${f}`:`mid_${D.id}`;
          npcs.push({x:bn[0],y:bn[1],mon:mid.mon,dir:'down',cond:()=>!S.flags[flag],talk:()=>dungeonMid(D,mid,flag)});
          avoid.add(bn.join(','));
        }
      }else{
        const bd=F.dead.find(([x,y])=>!avoid.has(x+','+y)&&!avoid.has(F.nb(x,y)[0].join(',')));
        const bn=F.nb(bd[0],bd[1])[0]; goal=bn;
        if(D.reward) chests.push({id:D.id+'_boss',x:bd[0],y:bd[1],item:D.reward});
        npcs.push({x:bn[0],y:bn[1],mon:D.boss,dir:'down',cond:()=>!S.flags['boss_'+D.id],talk:()=>dungeonBoss(D)});
        avoid.add(bd.join(',')); avoid.add(bn.join(','));
      }
      // しかけ
      const feat=(D.feat&&D.feat[f-1])||'';
      if(feat.includes('guard')){
        const {par}=F.bfs(F.sx,F.sy); const path=[]; let k=goal[0]+','+goal[1]; while(par[k]){path.unshift(k.split(',').map(Number)); const p=par[k]; k=p[0]+','+p[1];}
        const onPath=new Set(path.map(p=>p.join(',')));
        let placed=0;
        // みはりは ほんすじの よこに ほった くぼみに たち、 くびを ふって つうろを みはる（よそみの すきに とおる）
        const want=D.guardsPer||3;
        const cand=[];
        for(const [x,y] of F.dead){ if(avoid.has(x+','+y)) continue; const [nx,ny]=F.nb(x,y)[0]; const dx=nx-x, dy=ny-y;
          for(let L=1;L<=2;L++){const px=x+dx*(L+1), py=y+dy*(L+1); if(onPath.has(px+','+py)){cand.push({x,y,dx,dy,i:path.findIndex(p=>p[0]===px&&p[1]===py)}); break;} if(!F.isF(px,py)) break;} }
        cand.sort((a,b)=>a.i-b.i);
        const pick=cand.length<=want?cand:[...Array(want)].map((_,k)=>cand[Math.floor((k+.5)*cand.length/want)]);
        for(const c of pick){ if(c.i<3) continue;
          const dir=c.dx>0?'right':c.dx<0?'left':c.dy>0?'down':'up', side=c.dx?['up','down']:['left','right'];
          npcs.push({x:c.x,y:c.y,pal:'guard',dir,guard:1,sight:4,turns:[dir,dir,side[0],dir,side[1]],talk:()=>caught()}); avoid.add(c.x+','+c.y); placed++;
        }
      }
      if(feat.includes('lock')){const c=findChoke(F,goal,avoid); if(c){g[c.door[1]][c.door[0]]='錠'; chests.push({id:`${id}_key`,x:c.spot[0],y:c.spot[1],key:D.id}); avoid.add(c.door.join(',')); avoid.add(c.spot.join(','));}}
      if(feat.includes('switch')){const c=findChoke(F,goal,avoid); if(c){g[c.door[1]][c.door[0]]='格'; g[c.spot[1]][c.spot[0]]='釦'; avoid.add(c.door.join(',')); avoid.add(c.spot.join(','));}}
      if(feat.includes('secret')){const p=carveSecret(F,avoid,D.secretKind||'隠'); if(p) chests.push({id:`${id}_sec`,x:p[0],y:p[1],item:D.secretLoot||'frag'});}
      if(feat.includes('crack')){const p=carveSecret(F,avoid,'割'); if(p) chests.push({id:`${id}_crk`,x:p[0],y:p[1],item:D.crackLoot||'frag'});}
      for(const [x,y] of F.dead.filter(([x,y])=>!avoid.has(x+','+y)).slice(0,D.per??3)){
        const L=D.loot[li++ % D.loot.length]; chests.push({id:`${D.id}${f}_${chests.length}`,x,y,...(typeof L==='string'?{item:L}:L)});
      }
      if(D.lava){
        const busy=new Set([...chests,...npcs].map(o=>o.x+','+o.y).concat([startN.join(',')]));
        for(let y=1;y<D.h-1;y++) for(let x=1;x<D.w-1;x++) if(g[y][x]===D.floor&&!busy.has(x+','+y)&&F.r()<D.lava) g[y][x]='L';
      }
      MAPS[id]={name:D.name+(D.floors>1?(D.up?` ${f}かい`:` ちか${f}かい`):''),out:D.wall,floor:D.floor,bgm:last&&D.bossBgm?D.bossBgm:(D.bgm||'dungeon'),world:D.world,worldMap:D.worldMap||'world',
        entry:[startN[0],startN[1],'up'],enc:()=>D.zone,area:D.area,dark:D.dark&&D.dark[f-1]!==undefined?D.dark[f-1]:D.darkAll,links,npcs,chests,rows:g.map(r=>r.join('')),dg:D.id,floor:D.floor,fl:f,
        guards:feat.includes('guard'),objs:[]};
    });
  }
}
