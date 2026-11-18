// 章ごとの到達レベルの見積もり：node tools/pace.js
const { chromium } = require('playwright');
(async()=>{
  const b=await chromium.launch(); const pg=await b.newPage();
  await pg.goto('file://'+require('path').resolve(__dirname,'../rpg.html')); await pg.waitForTimeout(500);
  const r=await pg.evaluate(()=>{
    const G=window.__rpg;
    const avg=z=>{const L=G.ENC[z]; return (G.EXPMUL[z]??1)*L.reduce((s,g)=>s+g.reduce((a,id)=>a+mkEnemy(id,z).d.exp,0),0)/L.length;};
    // しょう: [そとの ゾーン, そとの せんとう, ダンジョンゾーン, かいすう, ボス, もくひょうLv]
    const CH=[[1,1,8,'lake',2,'nushi',5],[2,2,10,'sewer',2,'ratking',8],[3,2,10,'cave',1,'guardian',11],[4,'east',12,'tower',2,'witch',15],[5,3,10,'crypt',3,'boneking',18],
      [6,3,10,'castle',2,'zolga',21],[7,'sea1',14,'seacave',3,'jabara',25],[8,'east',8,'volcano',3,'flamelord',28],[9,'ice',12,'icet',3,'setsura',31],[10,'desert',12,'pyr',4,'zahar',34],
      [11,'sea3',12,null,0,'galva',36],[12,'sky',12,'sky2',4,'tempes',40],[13,'dark',10,'dark',3,'zero',43],[14,'nox',8,'nox',4,'zolga2',45],[15,'nox',0,'nox',1,'nox',47]];
    let lv=1, exp=0; const out=[];
    for(const [ch,oz,ob,dz,fl,boss,tgt] of CH){
      const gain=avg(oz)*ob+(dz?avg(dz)*fl*5:0)+G.MON[boss].exp+(boss==='zero'?G.MON.nero.exp:0);
      exp+=gain; while(lv<50&&exp>=G.expFor(lv+1)) lv++;
      out.push(`ch${ch}: battles≈${ob+fl*5} exp+${Math.round(gain)} -> Lv${lv} (target ${tgt})`);
    }
    return out.join('\n');
  });
  console.log(r); await b.close();
})();
