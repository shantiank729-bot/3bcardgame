// はかった けっか（MEAS）から TUNE（ボスの HP・こうげき ばいりつ）を けいさん
// node tunecalc.js meas.log tune_in.json > tune_out.json
const fs=require('fs');
const log=fs.readFileSync(process.argv[2],'utf8'); const cur=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const m=log.match(/MEAS (\{.*\})/); if(!m){console.error('no MEAS'); process.exit(1);}
const M=JSON.parse(m[1]);
const TARGET=id=>({minegolem:7,jin1:8,jin2:10,jin3:10,gen1:9,gen2:9,gen3:9,mumei:14,oblivion:18,phantom:18}[id])||null;
const out=Object.assign({},cur);
for(const [id,r] of Object.entries(M)){
  const tgt=TARGET(id)||(r.ch<=2?9:r.ch<=4?10:r.ch<=8?11:r.ch<=16?12:13);
  const t=out[id]||{hp:1,dmg:1};
  let hp=t.hp*Math.pow(Math.min(2.5,Math.max(.5,tgt/Math.max(1,r.turns))),.85);
  let dmg=t.dmg;
  const wr=r.win/r.n;
  if(wr<.6) dmg*=.85; else if(wr<.8) dmg*=.93;
  else if(r.minHp>.6) dmg*=1.15; else if(r.minHp>.45) dmg*=1.07; else if(r.minHp<.15) dmg*=.95;
  out[id]={hp:+hp.toFixed(2),dmg:+dmg.toFixed(2)};
  console.error(id.padEnd(12),'ch'+r.ch,'turns',r.turns.toFixed(1),'->',tgt,'win',wr.toFixed(2),'minHp',r.minHp.toFixed(2),' =>',JSON.stringify(out[id]));
}
console.log(JSON.stringify(out));
