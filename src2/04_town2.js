/* =========================================================
   まちづくり：「おび（よこ ならびの くかく）」を つみかさねて まちを つくる
   - 型（cross / street / harbor / village / castle / ring）で おびの ならびが かわる
   - たてものは みな みなみがわに とびら。 なかに はいれる（ないそう つき）
   ========================================================= */
const BLD_LABEL={inn:'やどや',arms:'ぶきと ぼうぐの みせ',item:'どうぐや',magic:'まほうの みせ',house:'みんか',church:'きょうかい',bar:'さかば',library:'としょかん',forge:'かじや',
  guild:'ギルド',throne:'おしろ',school:'がくえん',swap:'こうかんじょ',shrine:'ほこら',hall:'やくば'};
const BLD_SIGN={inn:'宿',arms:'剣',item:'薬',magic:'杖',church:'教',bar:'酒',library:'本',forge:'鎚',swap:'換',school:'学',guild:'換'};
const BAND_TYPES={
  cross:['park','bld','road','plaza','bld','road','park'],
  street:['park','bld','road','bld','road','park'],
  harbor:['bld','road','bld','road','pier'],
  village:['farm','bld','road','farm','bld','road','park'],
  castle:['castle','road','bld','road','bld','road'],
  ring:['bld','road','plaza','bld','road','park'],
  ghost:['grave','road','bld','road','bld','road','grave'],
  market:['bld','road','market','road','bld','road'],
};
function buildTown(sp){
  const W=sp.w||32, r=prng(sp.seed||7), id=sp.id;
  const g=[], put=(x,y,c)=>{if(g[y]&&x>=0&&x<W) g[y][x]=c;};
  const ground=sp.ground||'.', road=sp.road||'道', edge=sp.edge||'Y';
  const bands=(sp.bands||BAND_TYPES[sp.type||'cross']).slice();
  const blds=(sp.bld||[]).slice(); const objs=[], links={}, interiors=[], spots={road:[],plaza:[],gate:null,pier:[],landmark:null,park:[],farm:[],market:[]};
  const marks=[]; let y=1;
  const row=()=>{const a=Array(W).fill(ground); a[0]=a[W-1]=edge; g.push(a); return g.length-1;};
  row(); for(let i=1;i<W-1;i++) g[0][i]=edge;
  const roofs=sp.roofs||['赤','青','緑'];
  for(const band of bands){
    if(band==='road'){const a=row(), b=row(); for(let x=1;x<W-1;x++){g[a][x]=road; g[b][x]=road; spots.road.push([x,a]);} y+=2; continue;}
    if(band==='bld'){
      const H=5, top=g.length; for(let i=0;i<H;i++) row();
      let x=2+((r()*2)|0);
      while(x<W-6&&blds.length){
        const b=blds.shift(); const bw=b.w||(b.t==='house'?5+((r()*2)|0):b.t==='church'||b.t==='library'||b.t==='guild'||b.t==='school'||b.t==='hall'?8:7);
        if(x+bw>W-2){blds.unshift(b); break;}
        const roof=b.roof||pickR2(roofs,r); const wallT=b.brick||sp.brick?'煉':'壁';
        for(let yy=top;yy<top+H-2;yy++) for(let xx=x;xx<x+bw;xx++) g[yy][xx]=roof;
        for(let xx=x;xx<x+bw;xx++){g[top+H-2][xx]=(xx-x)%2?'窓':wallT; g[top+H-1][xx]=wallT;}
        const dx=x+Math.floor(bw/2); g[top+H-1][dx]='戸'; if(BLD_SIGN[b.t]) g[top+H-2][dx]=BLD_SIGN[b.t];
        const inId=`${id}_${interiors.length}`; interiors.push({b,inId,door:[dx,top+H-1]});
        x+=bw+1+((r()*2)|0);
        if(x<W-3&&r()<.45&&!sp.noTrees){g[top+H-1][x-1]=pickR2(sp.trees||['Y'],r);}
      }
      y+=H; continue;
    }
    if(band==='plaza'||band==='park'||band==='farm'||band==='grave'||band==='market'){
      const H=band==='plaza'?6:4, top=g.length; for(let i=0;i<H;i++) row();
      for(let yy=top;yy<top+H;yy++) for(let xx=1;xx<W-1;xx++){
        if(band==='plaza'){g[yy][xx]=sp.plaza||'s'; spots.plaza.push([xx,yy]);}
        else if(band==='farm'){g[yy][xx]=(xx%9<6&&yy<top+H-1)?'畑':ground; if(g[yy][xx]===ground) spots.farm.push([xx,yy]);}
        else if(band==='grave'){g[yy][xx]=(xx%3===1&&(yy-top)%2===0&&xx>2&&xx<W-3)?'墓':ground; spots.park.push([xx,yy]);}
        else if(band==='market'){g[yy][xx]=sp.plaza||'s'; spots.market.push([xx,yy]);}
        else{ if(r()<(sp.treeRate??.18)) g[yy][xx]=pickR2(sp.trees||['Y'],r); else if(r()<.12) g[yy][xx]=sp.flower||'F'; else spots.park.push([xx,yy]); }
      }
      if(band==='plaza'){ const lm=sp.landmark; if(lm){const L=LMSIZE[lm]||[2,2]; const lx=Math.floor(W/2-L[0]/2), ly=top+Math.max(0,Math.floor((H-L[1])/2)); marks.push({kind:lm,x:lx,y:ly,w:L[0],h:L[1]}); spots.landmark=[lx+Math.floor(L[0]/2),ly+L[1]];}
        else {put(Math.floor(W/2),top+2,'噴'); put(Math.floor(W/2)-1,top+2,'噴');}}
      if(band==='market'){for(let i=0;i<3;i++){const tx=4+i*Math.floor((W-12)/2); marks.push({kind:'tent',x:tx,y:top,w:3,h:2});}}
      y+=H; continue;
    }
    if(band==='pier'){
      const H=6, top=g.length; for(let i=0;i<H;i++) row();
      for(let yy=top;yy<top+H;yy++) for(let xx=1;xx<W-1;xx++) g[yy][xx]='~';
      for(let px=4;px<W-4;px+=7) for(let yy=top;yy<top+H-1;yy++){g[yy][px]='桟'; g[yy][px+1]='桟'; spots.pier.push([px,yy]);}
      if(sp.landmark){const L=LMSIZE[sp.landmark]||[2,2], lx=W-4-L[0], lh=Math.min(L[1],H-2); for(let yy=top;yy<top+lh+1;yy++) for(let xx=lx-1;xx<=lx+L[0];xx++) g[yy][xx]='桟'; for(let xx=lx-1;xx>=1&&g[top][xx]!=='桟';xx--) g[top][xx]='桟'; marks.push({kind:sp.landmark,x:lx,y:top,w:L[0],h:lh}); spots.landmark=[lx,top+lh];}
      y+=H; continue;
    }
    if(band==='castle'){
      const H=8, top=g.length; for(let i=0;i<H;i++) row();
      for(let yy=top;yy<top+H;yy++) for(let xx=1;xx<W-1;xx++) g[yy][xx]=(yy===top+H-1&&(xx<W/2-5||xx>W/2+4))?'X':(sp.plaza||'s');
      const cx=Math.floor(W/2)-2; marks.push({kind:'castle',x:cx,y:top,w:4,h:3});
      const dx=cx+2, dy=top+3; g[dy][dx]='戸'; interiors.push({b:{t:'throne',...(sp.castle||{})},inId:`${id}_castle`,door:[dx,dy]});
      spots.landmark=[dx,dy+1]; y+=H; continue;
    }
  }
  // しゅうへんの みち（たてに つなぐ）と いりぐち
  const H=g.length+1; row(); for(let i=1;i<W-1;i++) g[H-1][i]=edge;
  const vx=[1,W-2];
  for(const x of vx) for(let yy=1;yy<H-1;yy++){ if(['■','戸'].includes(g[yy][x])) continue; const c=g[yy][x]; if(c==='~'&&!sp.bridges) continue;
    if(c==='~') g[yy][x]='桟'; else if(!ROOFC[c]&&!['壁','窓','煉','戸','X'].includes(c)&&!BLD_SIGN_TILE.has(c)) g[yy][x]=road; }
  const gateX=Math.floor(W/2); const gateY=(sp.gate==='top'||bands[bands.length-1]==='pier')?0:H-1;
  g[gateY][gateX]=road; g[gateY][gateX-1]=road; const inY=gateY===0?1:H-2; g[inY][gateX]=road; g[inY][gateX-1]=road; spots.gate=[gateX,inY];
  const soft=new Set([ground,'Y','T','k','y','F','畑','墓','s','.',sp.plaza||'s']); for(let x=1;x<gateX;x++) if(soft.has(g[inY][x])) g[inY][x]=road;
  if(sp.sideExits){for(let yy=1;yy<H-1;yy++) if(g[yy][1]===road){g[yy][0]=road; g[yy][W-1]=road;}}
  for(const m of marks) for(let yy=m.y;yy<m.y+m.h;yy++) for(let xx=m.x;xx<m.x+m.w;xx++) if(g[yy]&&g[yy][xx]!=='戸') g[yy][xx]='■';
  // かんばん（まちの なまえ）
  const sx=gateX+2, sy=inY; g[sy][sx]='標';
  const rows=g.map(a=>a.join(''));
  const map={name:sp.name,out:edge,bgm:sp.bgm||'town',edgeExit:1,town:1,rows,objs,links,marks,signs:{[`${sx},${sy}`]:sp.sign||sp.name},
    entry:[gateX,gateY===0?1:H-2,gateY===0?'down':'up'],npcs:[],chests:[],theme:sp.theme,night:sp.night,dark:sp.dark,spots};
  map.id=id; MAPS[id]=map;
  // ないそう
  interiors.forEach(({b,inId,door},i)=>{
    const im=buildInterior(inId,b,sp,i);
    map.links[`${door[0]},${door[1]}`]=[inId,im.entry[0],im.entry[1],'up'];
    im.links[`${im.exit[0]},${im.exit[1]}`]=[id,door[0],door[1]+1,'down'];
    im.parent=id; im.door=door; b.map=inId;
  });
  // そとの NPC
  for(const n of sp.npcs||[]) map.npcs.push(placeNpc(n,spots,r,map));
  // そとの しらべもの（たる・つぼ）
  for(const [k,cnt] of [['barrel',sp.barrels??2],['pot',sp.pots??1]]) for(let i=0;i<cnt;i++){
    const cand=spots.road.filter(([x,yy])=>g[yy-1]&&ROOFC[g[yy-1][x]]===undefined&&['壁','窓','煉'].includes(g[yy-1][x]));
    const p=cand.length?cand[(r()*cand.length)|0]:null; if(p){const [x,yy]=p; if(!objs.some(o=>Math.abs(o.x-x)<=1&&o.y===yy)&&!map.npcs.some(n=>n.x===x&&n.y===yy)&&!map.links[`${x},${yy-1}`]) objs.push({x,y:yy,k});}
  }
  assignLoot(map,sp.loot||[]);
  return map;
}
const BLD_SIGN_TILE=new Set(Object.values(BLD_SIGN));
const LMSIZE={lighthouse:[2,4],windmill:[2,3],headframe:[2,3],clock:[2,4],bigfountain:[2,2],tent:[3,2],belltower:[2,4],gate:[3,3],castle:[4,3],academy:[2,4],mushroom:[2,3],chimney:[2,3],bigtree:[3,3],skystatue:[2,3],shrine:[2,2],mast:[2,3],igloo:[2,2]};
function pickR2(a,r){return a[(r()*a.length)|0];}
function placeNpc(n,spots,r,map){
  let p=n.at;
  if(typeof p==='string'){const L=spots[p]; p=Array.isArray(L)&&Array.isArray(L[0])?L[(r()*L.length)|0]:L;}
  if(!p) p=spots.road[(r()*spots.road.length)|0];
  const taken=new Set(map.npcs.map(o=>o.x+','+o.y));
  for(const k of Object.keys(map.links)){const [lx,ly]=k.split(',').map(Number); taken.add(lx+','+(ly+1)); taken.add(k);}
  if(map.spots.gate) taken.add(map.spots.gate.join(','));
  const ok=(x,y)=>!taken.has(x+','+y)&&map.rows[y]&&!SOLID.has(map.rows[y][x])&&map.rows[y][x]!=='~';
  let [x,y]=p; for(let k=0;k<12&&!ok(x,y);k++) x+=(k%2?-k:k);
  return Object.assign({dir:'down'},n,{x,y});
}
// しらべものに なかみを くばる（いちど とったら フラグで のこる）
function assignLoot(map,loot){
  const L=loot.slice();
  map.objs.forEach((o,i)=>{o.id=`${map.id}_o${i}`; if(!o.text&&L.length&&o.k!=='shelf') o.loot=L.shift();});
}
// ないそうの ひながた
function buildInterior(inId,b,sp,idx){
  const T=b.t, r=prng((sp.seed||7)*13+idx*31);
  const size={inn:[13,9],arms:[11,8],item:[11,8],magic:[11,8],house:[11,8],church:[13,11],bar:[13,9],library:[13,10],forge:[11,8],guild:[13,10],throne:[17,14],school:[13,10],swap:[11,8],shrine:[11,8],hall:[13,9]}[T]||[11,8];
  const [W,H]=b.size||size;
  const g=[...Array(H)].map((_,y)=>[...Array(W)].map((_,x)=>(y===0||x===0||x===W-1||y===H-1)?'W':(b.floor||'f')));
  const objs=[], npcs=[], ex=Math.floor(W/2);
  g[H-1][ex]='出';
  const keeper=(x,y,talk,pal)=>npcs.push({x,y,pal:pal||b.pal||'merchant',dir:'down',talk,role:'keeper'});
  const counter=(x1,x2,y)=>{for(let x=x1;x<=x2;x++) g[y][x]='c';};
  if(T==='inn'){counter(2,5,3); keeper(3,2,()=>inn(b.price||sp.innPrice||6,sp.name+'の やどや'),'inn'); for(let y=2;y<H-2;y+=2){g[y][W-3]='寝'; g[y][W-5]='寝';} objs.push({x:1,y:H-2,k:'pot'},{x:W-2,y:1,k:'drawer'});}
  else if(T==='arms'||T==='item'||T==='magic'||T==='swap'){counter(2,W-3,3); keeper(ex,2,()=>T==='swap'?fragShop():shop(b.goods||[],b.greet||`${BLD_LABEL[T]}へ ようこそ！`)); objs.push({x:1,y:1,k:'shelf',text:b.book},{x:W-2,y:1,k:T==='arms'?'crate':'barrel'},{x:1,y:H-2,k:'barrel'},{x:W-2,y:H-2,k:'pot'});}
  else if(T==='house'){g[2][W-3]='寝'; g[2][W-5]=b.beds>1?'寝':'f'; g[4][3]='机'; objs.push({x:1,y:1,k:'drawer'},{x:W-2,y:H-2,k:'pot'},{x:1,y:H-2,k:(r()<.5?'barrel':'shelf'),text:b.book}); if(r()<.5) g[1][ex]='暖';}
  else if(T==='church'){for(let y=1;y<H-1;y++) g[y][ex]='r'; g[1][ex]='祭'; for(let y=4;y<H-2;y+=2) for(const x of [2,3,W-4,W-3]) g[y][x]='机'; keeper(ex,2,()=>churchTalk(sp),'sage'); objs.push({x:1,y:1,k:'shelf',text:b.book||'「ほしの かみさまは、 なまえを よばれた ものを けっして わすれない」と かかれている。'});}
  else if(T==='bar'){counter(2,W-3,3); keeper(ex,2,b.talk||(()=>lines(['「いらっしゃい。 うわさばなしなら そこらの きゃくに きいて おくれ。」'])),'merchant'); for(const [x,y] of [[3,5],[W-4,5],[ex,6]]) g[y][x]='机'; objs.push({x:1,y:1,k:'barrel'},{x:W-2,y:1,k:'barrel'},{x:1,y:H-2,k:'barrel'});}
  else if(T==='library'||T==='school'){for(let x=1;x<W-1;x+=2) objs.push({x,y:1,k:'shelf',text:(b.books||[])[(x-1)/2]}); for(let x=2;x<W-2;x+=4) objs.push({x,y:4,k:'shelf',text:(b.books||[])[6+(x-2)/4]}); g[6][ex]='机';}
  else if(T==='forge'){g[2][2]='炉'; g[3][4]='鍛'; keeper(ex,3,b.talk||(()=>shop(b.goods||[],'かじやだ。 いい ぶきが そろってるぜ。')),'merchant'); objs.push({x:W-2,y:1,k:'crate'},{x:W-2,y:H-2,k:'barrel'});}
  else if(T==='guild'||T==='hall'){counter(3,W-4,3); keeper(ex,2,b.talk||(()=>lines(['「ようこそ。」'])),b.pal||'elder'); objs.push({x:1,y:1,k:'shelf',text:b.book},{x:W-2,y:1,k:'drawer'},{x:1,y:H-2,k:'crate'});}
  else if(T==='throne'){for(let y=2;y<H-1;y++) g[y][ex]='r'; g[1][ex]='t'; for(const x of [2,W-3]) for(let y=3;y<H-2;y+=3) g[y][x]='p'; objs.push({x:1,y:1,k:'pot'},{x:W-2,y:1,k:'pot'});}
  else if(T==='shrine'){g[1][ex]='祭'; for(let y=2;y<H-1;y++) g[y][ex]='r';}
  for(const n of b.npcs||[]){
    const spots=[]; for(let y=2;y<H-1;y++) for(let x=1;x<W-1;x++) if(g[y][x]==='f'||g[y][x]==='r') spots.push([x,y]);
    const taken=new Set([...npcs,...objs].map(o=>o.x+','+o.y).concat([`${ex},${H-2}`]));
    const free=spots.filter(([x,y])=>!taken.has(x+','+y)); const p=n.at||free[(r()*free.length)|0];
    npcs.push(Object.assign({dir:'down'},n,{x:p[0],y:p[1]}));
  }
  const map={id:inId,name:b.name||`${sp.name}の ${BLD_LABEL[T]||'たてもの'}`,out:'無',bgm:b.bgm||sp.bgm||'town',rows:g.map(a=>a.join('')),objs,npcs,chests:b.chests||[],links:{},
    entry:[ex,H-2,'up'],exit:[ex,H-1],interior:1,theme:sp.theme};
  map.objs.forEach((o,i)=>o.id=`${inId}_o${i}`);
  const L=(b.loot||[]).slice(); for(const o of map.objs) if(!o.text&&L.length&&o.k!=='shelf') o.loot=L.shift();
  MAPS[inId]=map; return map;
}
