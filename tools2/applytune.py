# tunecalc の けっか（いまの つよさに かける ばいりつ）を src2/07_world2.js の TUNE に かけあわせる
import json,re,sys
f=json.load(open(sys.argv[1])); fn='src2/07_world2.js'; s=open(fn).read()
for k,v in f.items():
    m=re.search(r"  %s:\{hp:([\d.]+),dmg:([\d.]+)\}"%k,s)
    if not m: continue
    hp=float(m.group(1))*v['hp']; dmg=float(m.group(2))*v['dmg']
    s=s.replace(m.group(0),"  %s:{hp:%.2f,dmg:%.2f}"%(k,hp,dmg))
open(fn,'w').write(s)
