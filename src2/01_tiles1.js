/* ---------- タイル（あたらしい ちけい） ---------- */
function buildTiles2(){
  const T=(ch,fn)=>{TILES[ch]=[mkTile(g=>fn(g,0)),mkTile(g=>fn(g,1))];};
  const BR=(g,b,m,h)=>{R(g,b,0,0,16,16); for(let y=0;y<16;y+=4){R(g,m,0,y+3,16,1); for(let x=(y/4)%2?4:0;x<16;x+=8) R(g,m,x,y,1,3);} R(g,h,2,0,4,1); R(g,h,10,4,4,1);};
  const FL=(g,b,d,l,seed)=>{R(g,b,0,0,16,16); const r=prng(seed); for(let i=0;i<8;i++){R(g,d,(r()*16)|0,(r()*16)|0); R(g,l,(r()*16)|0,(r()*16)|0);}};
  const snow=g=>FL(g,'#e8eef6','#c8d4e2','#ffffff',71);
  const tree2=art(TREE,{k:'#173f3a',G:'#2e6a5a',g:'#e8f0f8',t:'#5a4433'});
  const palm=art(["k.kk.kk.","kGGkGGk.",".kGGGk..","kGGkGGk.","...kt...","...kt...","...kt...","..kttk.."],{k:'#1a3a10',G:'#3a9a2a',t:'#8a6a3a'});
  T('z',snow); T('P',g=>{snow(g); g.drawImage(tree2,0,0); g.drawImage(tree2,8,3); g.drawImage(tree2,3,8);});
  T('y',g=>{snow(g); g.drawImage(tree2,0,0); g.drawImage(tree2,8,3); g.drawImage(tree2,3,8);});
  T('k',g=>{sand(g); g.drawImage(palm,1,2); g.drawImage(palm,8,6);});
  T('o',g=>{FL(g,'#f4f6ff','#dce2f6','#ffffff',72); R(g,'#e0e6fa',3,5,6,2); R(g,'#e0e6fa',9,11,5,2);});
  T('x',g=>FL(g,'#3a2a44','#2a1e34','#4e3a5a',73));
  T('D',g=>BR(g,'#c8a868','#8a7040','#e8d098'));
  T('g',g=>{FL(g,'#b8d8f0','#98bcd8','#e8f6ff',74); R(g,'#ffffff',3,4,4,1); R(g,'#ffffff',10,11,3,1);});
  T('h',g=>BR(g,'#6a98c0','#3a6890','#c8e8ff'));
  T('b',g=>{R(g,'#d8c088',0,0,16,16); R(g,'#b8a068',0,7,16,1); R(g,'#b8a068',0,15,16,1); R(g,'#b8a068',7,0,1,8); R(g,'#b8a068',15,8,1,8);});
  T('v',g=>BR(g,'#d8dcef','#a8b0d0','#ffffff'));
  T('w',g=>{R(g,'#eef0fa',0,0,16,16); R(g,'#c8cce4',0,7,16,1); R(g,'#c8cce4',0,15,16,1); R(g,'#c8cce4',7,0,1,8); R(g,'#c8cce4',15,8,1,8); R(g,'#f0d870',3,3,1,1);});
  T('m',g=>BR(g,'#2a1a30','#140a18','#4a2a50'));
  T('l',g=>{BR(g,'#1a1428','#0a0814','#3a2a58'); R(g,'#c8a0ff',7,7,2,2);});
  const pal={k:'#2a1a14',R:'#c8463a',W:'#f2e2c2',d:'#4a2a18'};
  T('1',g=>{sand(g); g.drawImage(art(HOUSE,Object.assign({},pal,{R:'#3a78c8'})),1,7); g.drawImage(art(HOUSE,Object.assign({},pal,{R:'#ffffff'})),8,3); R(g,'#5a3a1a',13,12,3,1);});
  T('2',g=>{grass(g,41); g.drawImage(art(HOUSE,Object.assign({},pal,{R:'#8a2a1a'})),1,6); g.drawImage(art(HOUSE,Object.assign({},pal,{R:'#d86a2a'})),8,3);});
  T('3',g=>{snow(g); g.drawImage(art(HOUSE,Object.assign({},pal,{R:'#f8fcff',W:'#a87a50'})),1,7); g.drawImage(art(HOUSE,Object.assign({},pal,{R:'#e8f0ff',W:'#a87a50'})),8,3);});
  T('4',g=>{sand(g); g.drawImage(art(HOUSE,Object.assign({},pal,{R:'#e0a040',W:'#e8d0a0'})),1,7); g.drawImage(palm,8,2);});
  T('5',g=>{TILES.o[0]&&g.drawImage(TILES.o[0],0,0); g.drawImage(art(TOWN,{k:'#4a4a6a',S:'#f0f0ff',B:'#f0c040',W:'#80c0ff',d:'#6a6a8a'}),1,5);});
  T('6',g=>{mountain(g,false); R(g,'#3b2a1b',4,9,8,7); R(g,'#0a2a4a',5,10,6,6); R(g,'#4a90e0',5,14,6,2);});
  T('7',g=>{snow(g); R(g,'#5a88b8',2,4,12,11); R(g,'#c8e8ff',3,5,10,9); for(const x of [4,7,10]) R(g,'#5a88b8',x,7,2,7); R(g,'#5a88b8',1,3,14,2);});
  T('8',g=>{sand(g); for(let y=2;y<15;y++){const hw=Math.floor((y-1)*.6)+1; R(g,'#c8a048',8-hw,y,hw*2,1); R(g,'#a07830',8,y,hw,1);} R(g,'#2a1a08',7,11,2,4);});
  T('9',g=>{TILES.o[0]&&g.drawImage(TILES.o[0],0,0); R(g,'#a8b0d0',5,1,6,15); R(g,'#eef0fa',6,2,4,13); R(g,'#5a6aa0',7,5,2,2); R(g,'#5a6aa0',7,10,2,2); R(g,'#f0d040',7,0,2,1);});
  T('0',g=>{TILES.x[0]&&g.drawImage(TILES.x[0],0,0); R(g,'#140a18',2,3,12,12); R(g,'#4a2a50',3,4,10,10); for(const x of [4,8,11]) R(g,'#2a1a30',x,6,1,8); R(g,'#c040ff',7,1,2,2);});
  T('!',g=>{TILES.x[0]&&g.drawImage(TILES.x[0],0,0); g.drawImage(art(CASTLE,{k:'#000000',R:'#5a0a1a',C:'#2a1a3a',d:'#ff2040'}),1,4);});
  T('@',g=>{TILES.o[0]&&g.drawImage(TILES.o[0],0,0);});
}
for(const c of ['y','D','k','h','v','m','l']) SOLID.add(c);
Object.assign(ENC_RATE,{z:20,P:12,o:18,x:15,g:16,b:16,w:16,'~':24});
Object.assign(PPAL,{sena:{h:'#e8d070',g:'#f0f0f8',r:'#4a7ad8'},king:{h:'#f0d040',g:'#3a50c0',r:'#e0e0ff'},sailor:{h:'#3a2a1a',g:'#2a4a8a',r:'#ffffff',s:'#d8a070'}});
