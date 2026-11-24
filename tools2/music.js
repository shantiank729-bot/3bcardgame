// BGM を オフラインで 12びょう ずつ かきだし、 おおきさ（ピーク・へいきん）を はかる。 WAV も ほぞん
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{if(m.type()==='warning'||m.type()==='error') console.log(m.text());});
  await p.goto('file://'+require('path').resolve(__dirname,'../rpg2.html')); await p.waitForTimeout(800);
  const res=await p.evaluate(async()=>{
    const out={};
    for(const name of Object.keys(SONGS)){
      const sr=22050, secs=24, oc=new OfflineAudioContext(2,sr*secs,sr);
      Snd.ac=oc; Snd.bus=null; Snd.nb=null; Snd.master=oc.createGain(); Snd.master.connect(oc.destination);
      const s=SONGS[name], step=60/s.bpm/2, loopDur=s.len*step;
      for(let L=0;L*loopDur<secs;L++) for(const e of s.ev){const t=.05+L*loopDur+e.st*step; if(t<secs) INST[e.inst](e.f,t,e.len*step*.95,e.v);}
      const buf=await oc.startRendering(); const d=buf.getChannelData(0); let pk=0,sq=0; for(const v of d){pk=Math.max(pk,Math.abs(v)); sq+=v*v;}
      // WAV
      const n=d.length, w=new DataView(new ArrayBuffer(44+n*2)); const str=(o,s)=>[...s].forEach((c,i)=>w.setUint8(o+i,c.charCodeAt(0)));
      str(0,'RIFF'); w.setUint32(4,36+n*2,true); str(8,'WAVEfmt '); w.setUint32(16,16,true); w.setUint16(20,1,true); w.setUint16(22,1,true); w.setUint32(24,sr,true); w.setUint32(28,sr*2,true); w.setUint16(32,2,true); w.setUint16(34,16,true); str(36,'data'); w.setUint32(40,n*2,true);
      for(let i=0;i<n;i++) w.setInt16(44+i*2,Math.max(-1,Math.min(1,d[i]))*32767,true);
      out[name]={peak:+pk.toFixed(2),rms:+Math.sqrt(sq/d.length).toFixed(3),wav:Array.from(new Uint8Array(w.buffer))};
    }
    return out;
  });
  const dir=process.argv[2]; for(const [k,v] of Object.entries(res)){ if(dir) fs.writeFileSync(`${dir}/${k}.wav`,Buffer.from(v.wav)); console.log(k.padEnd(8),'peak',v.peak,'rms',v.rms); }
  await b.close();
})();
