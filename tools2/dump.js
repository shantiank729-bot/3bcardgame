// マップの いちぶを もじで みる: node dump.js map x0 y0 x1 y1
const {chromium}=require('playwright');
(async()=>{
  const [map,x0,y0,x1,y1]=process.argv.slice(2);
  const b=await chromium.launch(); const p=await b.newPage();
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(1000);
  const out=await p.evaluate(([map,x0,y0,x1,y1])=>{const m=window.__rpg.MAPS[map]; const X0=+x0||0,Y0=+y0||0,X1=x1?+x1:m.rows[0].length-1,Y1=y1?+y1:m.rows.length-1;
    const occ={}; for(const n of m.npcs||[]) occ[n.x+','+n.y]='@'; for(const o of m.objs||[]) occ[o.x+','+o.y]='o'; for(const c of m.chests||[]) occ[c.x+','+c.y]='$';
    const L=[]; for(let y=Y0;y<=Y1;y++){let s=String(y).padStart(3)+' '; for(let x=X0;x<=X1;x++){const k=x+','+y; s+=occ[k]||(m.links&&m.links[k]?'>':m.rows[y][x]);} L.push(s);} return L.join('\n');},[map,x0,y0,x1,y1]);
  console.log(out); await b.close();
})();
