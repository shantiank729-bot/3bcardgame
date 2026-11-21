/* ---------- せかいちず（160×120）・かがみの せかい・せんねんまえ ---------- */
const WW=160, WH=120;
function hsh(x,y,s){let h=(x*374761393+y*668265263+s*1442695041)>>>0; h=(h^(h>>>13))*1274126177>>>0; return ((h^(h>>>16))>>>0)/4294967296;}
function makeWorld(){
  const g=[...Array(WH)].map(()=>Array(WW).fill('~'));
  const land=c=>c!=='~';
  const blob=(cx,cy,rx,ry,o={})=>{
    for(let y=Math.floor(cy-ry-2);y<=cy+ry+2;y++) for(let x=Math.floor(cx-rx-2);x<=cx+rx+2;x++){
      if(y<1||x<1||y>=WH-1||x>=WW-1) continue;
      const d=Math.hypot((x-cx)/rx,(y-cy)/ry)+(hsh(x,y,o.seed||1)-.5)*(o.wob??.22);
      if(d>1) continue;
      if(o.only&&!land(g[y][x])) continue;
      g[y][x]=o.ring&&d>.76?'^':(o.ground||'.');
    }
  };
  const paint=(x0,y0,x1,y1,c,rate=1,seed=3)=>{for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++) if(g[y]&&land(g[y][x])&&g[y][x]!=='^'&&hsh(x,y,seed)<rate) g[y][x]=c;};
  const line=(pts,c,w=1,gaps=[])=>{for(let i=0;i<pts.length-1;i++){const [ax,ay]=pts[i],[bx,by]=pts[i+1]; const n=Math.max(Math.abs(bx-ax),Math.abs(by-ay));
    for(let k=0;k<=n;k++){const x=Math.round(ax+(bx-ax)*k/n), y=Math.round(ay+(by-ay)*k/n); for(let dy=0;dy<w;dy++) for(let dx=0;dx<w;dx++){const X=x+dx,Y=y+dy; if(g[Y]&&g[Y][X]!==undefined&&!gaps.some(([gx,gy])=>Math.abs(gx-X)<=0&&Math.abs(gy-Y)<=0)) g[Y][X]=c;}}}};
  const road=(pts)=>{for(let i=0;i<pts.length-1;i++){let [x,y]=pts[i]; const [bx,by]=pts[i+1];
    while(x!==bx||y!==by){ if(x!==bx) x+=Math.sign(bx-x); else y+=Math.sign(by-y); if(g[y][x]==='.'||g[y][x]==='T'||g[y][x]===':'||g[y][x]==='z'||g[y][x]==='%') g[y][x]='路'; }}};
  // だい1ぶ：あおばの たいりく（とほ）
  blob(40,92,40,24,{seed:11}); blob(18,104,14,12,{seed:12}); blob(70,78,18,22,{seed:13}); blob(82,100,12,12,{seed:14}); blob(44,66,15,9,{seed:15,wob:.12});
  paint(14,76,34,90,'T',.7,21);                  // まよいの もり
  paint(36,58,56,72,'^',.18,22);                 // こうざんの おか
  paint(72,70,92,86,':',.85,23);                 // さばく（サンドラ）
  paint(74,96,94,112,'%',.6,24);                 // ぬまち（ゆうれいの まち）
  // さんみゃく（ちいきを くぎる）。 すきまに せき（くさむら・いわ）
  line([[2,82],[38,80],[56,80]],'^',2);
  line([[56,52],[58,90],[58,113]],'^',2);
  for(let y=76;y<=86;y++) if(g[y][30]==='^') g[y][30]='藪';        // フローラ → ゴルド の みち（かま）
  for(let x=52;x<=62;x++) if(g[74][x]==='^') g[74][x]='岩';        // ゴルド → かわ（ハンマー）
  line([[66,54],[66,118]],'~',3);                // おおかわ
  // だい2ぶ：うみの むこう（ふね）
  blob(40,22,26,16,{seed:31,ground:'z'}); paint(18,10,62,36,'P',.18,32); paint(20,6,60,12,'^',.25,33);       // こおりの たいりく
  blob(112,28,22,18,{seed:41}); paint(126,18,146,44,'T',.5,42); blob(142,34,10,12,{seed:43}); paint(134,24,152,46,'T',.55,44); // がくえん と こびとの もり
  blob(116,104,10,7,{seed:51,ground:':'});        // ナミノの しま
  blob(124,62,12,9,{seed:61}); for(const [x,y] of [[127,58],[128,58],[127,59],[128,59],[129,59]]) g[y][x]='~';   // なみだの みずうみの しま
  blob(146,98,10,10,{seed:71}); paint(140,90,156,108,'^',.12,72);                       // ほむらの しま（かざん）
  blob(100,72,4,4,{seed:81});                                                            // なまえの とうの こじま
  // だい3ぶ：そら（くうちゅう せんよう：やまの わで かこむ）
  blob(78,10,8,5,{seed:91,ground:'o',ring:1,wob:.06});
  blob(150,8,6,5,{seed:92,ground:'x',ring:1,wob:.06});                                   // ほしかげの いせき（クリアご）
  // かいどう（みちしるべ）
  road([[16,106],[30,96],[30,82],[30,78],[46,70],[56,74],[62,86]]);
  road([[70,86],[80,80],[84,104]]); road([[80,80],[78,62]]);
  return g;
}
// ちず の うえの いりぐち・せき
const WORLD_ICONS=[];   // {map,x,y,tile,to,entry?,gate?}
function icon(map,x,y,tile,to,o={}){WORLD_ICONS.push(Object.assign({map,x,y,tile,to},o));}
const ICON_GATE={}, LINK_GATE={};
function placeIcons(){
  for(const ic of WORLD_ICONS){
    const m=MAPS[ic.map]; const row=m.rows[ic.y]; m.rows[ic.y]=row.slice(0,ic.x)+ic.tile+row.slice(ic.x+1);
    const T=MAPS[ic.to]; if(!T) {console.warn('no map',ic.to); continue;}
    const e=ic.entry||T.entry; m.links[`${ic.x},${ic.y}`]=[ic.to,e[0],e[1],e[2]];
    T.world=[ic.x,ic.y]; T.worldMap=ic.map;
    if(ic.gate) ICON_GATE[`${ic.map}:${ic.x},${ic.y}`]=ic.gate;
  }
}
// うみの つながり・ふねの とまる ばしょ
const OCEANS={};
function ocean(map){
  if(OCEANS[map]) return OCEANS[map]; const rows=MAPS[map].rows, set=new Set(['0,0']), q=[[0,0]];
  while(q.length){const [x,y]=q.shift(); for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=nx+','+ny; if(set.has(k)||!rows[ny]||rows[ny][nx]!=='~') continue; set.add(k); q.push([nx,ny]);}}
  return OCEANS[map]=set;
}
function dockFor(x,y,map='world'){
  const oc=ocean(map), rows=MAPS[map].rows, seen=new Set([x+','+y]), q=[[x,y]];
  while(q.length){const [cx,cy]=q.shift();
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,ny=cy+dy,k=nx+','+ny; if(seen.has(k)) continue; seen.add(k);
      if(oc.has(k)) return {x:nx,y:ny,map};
      const t=rows[ny]&&rows[ny][nx]; if(t&&!SOLID.has(t)&&t!=='~') q.push([nx,ny]);}}
  return null;
}
// ばしょごとの てきの つよさ（ML=そうていレベル、 ch=そうびの めやすの しょう）
const ZONE_ML={
  akari:[2,1],seacave:[3,1],flora:[5,2],forest:[6,2],golde:[8,3],mine:[9,3],river:[11,4],ruins:[12,4],sand:[14,5],vault:[15,5],
  ghost:[16,6],bell:[17,6],fort:[18,7],fortu:[19,7],lhouse:[21,8],
  sea1:[23,9],namino:[23,9],tide:[24,9],gship:[26,10],ice:[27,11],icecastle:[28,11],academy:[29,12],library:[30,12],kinoko:[31,13],root:[32,13],
  lake:[33,14],lakeD:[34,14],homura:[35,15],lava:[36,15],sea2:[32,13],ntower:[38,16],
  sky:[41,17],cloud:[42,17],mirror:[43,18],mlight:[44,18],mfort:[46,19],mvault:[48,20],waste:[49,21],past:[50,22],final:[53,23],ruins7:[66,25],
};
const ZONE_AREA={akari:'beach',seacave:'lake',flora:'field',forest:'forest',golde:'field',mine:'cave',river:'field',ruins:'lake',sand:'desert',vault:'cave',ghost:'swamp',bell:'crypt',
  fort:'field',fortu:'castle',lhouse:'nox',sea1:'sea',namino:'beach',tide:'lake',gship:'crypt',ice:'ice',icecastle:'ice',academy:'field',library:'tower',kinoko:'forest',root:'forest',
  lake:'lake',lakeD:'lake',homura:'volcano',lava:'volcano',sea2:'sea',ntower:'tower',sky:'sky',cloud:'sky',mirror:'dark',mlight:'dark',mfort:'dark',mvault:'dark',waste:'abyss',past:'castle',final:'nox',ruins7:'abyss'};
const ENC={
  akari:[['chibikage'],['uminezumi'],['korogashi','uminezumi'],['hanabachi','chibikage']],
  seacave:[['shiogani'],['kurage','chibikage'],['uminezumi','shiogani'],['kurage','kurage']],
  flora:[['hanabachi','moriusagi'],['ibara'],['kinoko','moriusagi'],['hanabachi','hanabachi']],
  forest:[['ibara','kinoko'],['morime'],['kodama'],['moriusagi','morime'],['kinoko','kinoko','hanabachi']],
  golde:[['iwatokage'],['koumori','koumori'],['ishikoro'],['mogura','koumori']],
  mine:[['mgolem'],['ishikoro','lampghost'],['mogura','mogura'],['lampghost','koumori','koumori']],
  river:[['kawahebi'],['tonbo','kaeruhei'],['kappa','kawahebi'],['kaeruhei','kaeruhei']],
  ruins:[['iseki'],['mizunosei','kaeruhei'],['kappa','kappa'],['iseki','mizunosei']],
  sand:[['sasori'],['sabakunezumi','sabakunezumi'],['saboten'],['sunakemuri','sasori']],
  vault:[['karakuri'],['kinka','dorobou'],['takaragani'],['dorobou','dorobou','kinka']],
  ghost:[['samayoi'],['obake','honenezumi'],['bochikarasu','bochikarasu'],['samayoi','obake']],
  bell:[['kanetsuki'],['honehei','kurayami'],['samayoi','honehei'],['kurayami','obake','obake']],
  fort:[['wasurehei'],['ikusaookami','yamigarasu'],['ishinage','ishinage'],['ikusaookami']],
  fortu:[['wasurehei','ishinage'],['ikusaookami','ikusaookami'],['yamigarasu','wasurehei','yamigarasu']],
  lhouse:[['kagehei'],['namaekui','kagehei'],['kuroumihebi','kuroumihebi'],['kagemadou','kagehei']],
  sea1:[['ikaobake'],['tobiuo','tobiuo'],['umigani'],['gyojin','tobiuo']],
  namino:[['umigani','kamome'],['yashi'],['shiodamari','kamome'],['gyojin']],
  tide:[['gyojin','shiodamari'],['umigani','umigani'],['ikaobake','shiodamari'],['yashi','gyojin']],
  gship:[['suifu','suifu'],['senchokage'],['funamushi','onryou'],['suifu','onryou','funamushi']],
  ice:[['yukioni'],['kooriookami','tsurara'],['yukinosei','kooriookami'],['tsurara','tsurara','yukinosei']],
  icecastle:[['koorikishi'],['yukioni','yukinosei'],['koorikishi','tsurara'],['kooriookami','kooriookami','yukinosei']],
  academy:[['madoume'],['imp2','hoshibachi'],['ningyou'],['hoshibachi','hoshibachi','imp2']],
  library:[['kinsho'],['toshoobake','madoume'],['ningyou','kinsho'],['imp2','toshoobake','imp2']],
  kinoko:[['dokukinoko'],['morigumo','happamushi'],['kinokosei','dokukinoko'],['happamushi','happamushi','morigumo']],
  root:[['morigumo','morigumo'],['kinokosei','dokukinoko'],['kodama','morigumo'],['dokukinoko','kinokosei','happamushi']],
  lake:[['namidasei'],['mizuumihebi'],['kanashimibana','shizuku'],['shizuku','shizuku','namidasei']],
  lakeD:[['mizuumihebi','namidasei'],['kanashimibana','kanashimibana'],['namidasei','namidasei','shizuku']],
  homura:[['yougan'],['hinotori','hinotori'],['magman'],['honoosei','yougan']],
  lava:[['magman','honoosei'],['yougan','hinotori'],['honoosei','honoosei','hinotori']],
  sea2:[['onryou'],['gyojin','gyojin'],['ikaobake','onryou']],
  ntower:[['moribito'],['wasureme','mojikui'],['kagekishi'],['mojikui','mojikui','wasureme']],
  sky:[['kaminari','kaminari'],['kumonosei','sorakishi'],['sorakishi'],['stormdrake']],
  cloud:[['stormdrake','kumonosei'],['sorakishi','sorakishi'],['kaminari','kaminari','kumonosei']],
  mirror:[['urakage','urakage'],['kagamihei'],['sakasakoumori','uragaeshime'],['yugami']],
  mlight:[['urakage','kagamimadou'],['kagamihei','sakasakoumori'],['yugami','uragaeshime']],
  mfort:[['kagamihei','kagamihei'],['yugami','urakage'],['kagamimadou','uragaeshime','urakage']],
  mvault:[['kagamimadou','kagamimadou'],['yugami','kagamihei'],['urakage','urakage','uragaeshime']],
  waste:[['wasuregolem'],['chirinosei','chirinosei'],['honeryu'],['wasuregolem','chirinosei']],
  past:[['sennen'],['sennen','sennen']],
  final:[['kokuuryu'],['wasureshito','kokumadou'],['yaminokishi','wasureshito'],['kokumadou','kokumadou','yaminokishi']],
  ruins7:[['maboroshi'],['kokuuryu','maboroshi'],['yaminokishi','yaminokishi'],['maboroshi','maboroshi','kokumadou']],
};
const NMUL={hp:1,atk:1};
const ZONE_MUL={akari:{hp:.55,atk:.85},seacave:{hp:.6,atk:.9},flora:{hp:.65,atk:.95},forest:{hp:.7,atk:1},golde:{hp:.8,atk:1.05},mine:{hp:.8,atk:1.05},
  river:{hp:.9,atk:1.2},ruins:{hp:.95,atk:1.2},sand:{hp:1,atk:1.3},vault:{hp:1,atk:1.3},ghost:{hp:1.05,atk:1.3},bell:{hp:1.05,atk:1.3}};
const ZM_DEFAULT={hp:1.15,atk:1.3};
const chOfLevel=L=>{const i=LV_OF_CH.findIndex(t=>t>=L); return i<1?25:i;};
function scaledMon(id,L,ch,zone){
  const d=MON[id], st=fstat(L,ch,d.arch||'norm'), zm=ZONE_MUL[zone]||ZM_DEFAULT;
  return Object.assign({},d,{hp:Math.round(st.hp*NMUL.hp*zm.hp*HARD.mobHp),atk:Math.round(st.atk*NMUL.atk*zm.atk*HARD.mobAtk),def:st.def,agi:st.agi,exp:st.exp,g:st.g,hpRef:st.hpRef,ml:L});
}
// ざこの けいけんちの ばいりつ（1さくめと おなじく おそめ。 1レベル あげるのに めやす 9〜13せん）
const EXP_FIELD=.45;
const EXPMUL={};
// tools2/story.js で ボスごとに 5〜6かい たたかわせ、 めやすの ターンすう・しょうりつに あわせた ばいりつ
const TUNE={
  kobun:{hp:0.67,dmg:1.89},
  morinushi:{hp:0.41,dmg:1.29},
  minegolem:{hp:0.61,dmg:1.65},
  iwakui:{hp:0.43,dmg:1.10},
  jin1:{hp:0.91,dmg:1.10},
  suimon:{hp:0.68,dmg:0.69},
  kinko:{hp:1.01,dmg:0.86},
  kanebourei:{hp:1.12,dmg:0.82},
  taichou:{hp:1.23,dmg:0.70},
  shogun:{hp:1.06,dmg:0.78},
  majuu:{hp:1.59,dmg:0.61},
  jin2:{hp:1.22,dmg:1.73},
  fakeking2:{hp:1.75,dmg:1.25},
  kinshoban:{hp:1.67,dmg:1.02},
  dokugumo:{hp:1.49,dmg:0.81},
  kanashimi:{hp:1.30,dmg:0.88},
  yoganryu:{hp:1.63,dmg:0.95},
  jin3:{hp:1.83,dmg:1.18},
  bunshin:{hp:1.55,dmg:0.73},
  maryu:{hp:1.69,dmg:1.22},
  mirrorme:{hp:1.71,dmg:1.41},
  truecaptain:{hp:1.80,dmg:1.15},
  oyakata:{hp:1.37,dmg:0.91},
  kyojin:{hp:1.92,dmg:1.09},
  gen1:{hp:1.74,dmg:1.45},
  gen2:{hp:1.77,dmg:1.55},
  gen3:{hp:1.79,dmg:1.54},
  oblivion:{hp:1.45,dmg:0.62},
  mumei:{hp:2.03,dmg:0.85},
  phantom:{hp:1.54,dmg:0.60}};
// むずかしさ（ボス・ざこ ぜんたいの ばいりつ）。 めやすレベルで ボスの しょうりつ 7〜8わり を ねらう
const HARD={bossHp:1.0,bossDmg:1.2,mobHp:1.1,mobAtk:1.15};
function applyTune(){for(const [id,m] of Object.entries(MON)){ if(!m.boss) continue; const t=TUNE[id]||{}; m.base=m.base||{hp:m.hp,atk:m.atk};
  m.hp=Math.round(m.base.hp*(t.hp||1)*HARD.bossHp); m.atk=Math.round(m.base.atk*(t.dmg||1)*HARD.bossDmg); m.dmg=(t.dmg||1)*HARD.bossDmg;}}
