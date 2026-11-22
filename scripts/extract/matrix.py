"""Read a coverage matrix (one column per package) from a pdftotext -layout export.

usage: python3 matrix.py overview.txt "Package A,Package B" > out.json
"""
import re,sys,json
txt=open(sys.argv[1]).read();pks=sys.argv[2].split(',')
rows=[];cur=None;starts=None;page=1
for raw in txt.split('\n'):
    page+=raw.count('\f');l=raw.replace('\f','')
    if l.strip().startswith('Dekking') and all(p in l for p in pks):
        starts=[l.index(p) for p in pks];continue
    if not starts or not l.strip() or 'Vergoedingenoverzicht 2027 |' in l: continue
    lab=l[:starts[0]-1].strip()
    vals=[l[max(0,starts[k]-2):(starts[k+1]-2 if k+1<len(starts) else None)].strip() for k in range(len(starts))]
    if lab and (cur is None or re.search(r'\(\d+\)\s*$',cur['label'])):
        cur={'label':lab,'vals':['']*len(pks),'page':page};rows.append(cur)
    elif lab: cur['label']+=' '+lab
    if cur:
        for k,v in enumerate(vals):
            if v: cur['vals'][k]=(cur['vals'][k]+' '+v).strip()
for r in rows:
    r['label']=re.sub(r'(\s*\(\d+\))+\s*$','',r['label'])
json.dump(rows,sys.stdout,ensure_ascii=False)
