import re,sys
pdftxt,label,concern,pakket,premie,bron=sys.argv[1:7]
raw=open(pdftxt).read().split('\n');page=1;L=[]
for l in raw: page+=l.count('\f');L.append((page,l.replace('\f','')))
print(f"#label={label}|concern={concern}|pakket={pakket}|premie={premie}|bron={bron}")
ZV=re.compile(r'(dient te worden (gegeven|verleend|uitgevoerd)|verleend door|geleverd door|aangesloten bij|geregistreerd (in|bij)|gecertificeerd|lid van|door een (arts|huidtherapeut|fysio|podo|oefen|opticien|tandarts|orthodont|diëtist|psycholoog|verloskundige))',re.I)
def clean(s): return re.sub(r'\s+',' ',s.replace('\xad ','').replace('\xad','')).strip()
heads=[]
for i,(pg,l) in enumerate(L):
    m=re.match(r'^\s*VERGOEDING\s{2,}(\S.*)$',l)
    if not m: continue
    # kop: dichtstbijzijnde niet-lege regel erboven die geen tabelregel is
    j=i-1;head=''
    while j>=0:
        s=L[j][1].strip()
        if s and not re.match(r'^(VERGOEDING|av-|AV-)',s): head=s;break
        j-=1
    v=m.group(1); k=i+1
    while k<len(L) and L[k][1].strip() and re.match(r'^\s{20,}\S',L[k][1]): v+=' '+L[k][1].strip(); k+=1
    # beschrijving tot volgende kop
    desc=[]
    while k<len(L) and len(desc)<25:
        s=L[k][1]
        if re.match(r'^\s*VERGOEDING\s{2,}',s): break
        if s.strip(): desc.append(s.strip())
        k+=1
    text=clean(' '.join(desc))
    sents=re.split(r'(?<=[.;])\s+',text)
    zv=' '.join(x for x in sents if ZV.search(x))[:260]
    heads.append((head,clean(v),zv,pg))
seen={}
for h,v,zv,pg in heads:
    h=re.sub(r'\s+-\s*vervolg$','',h)
    if h.isupper(): h=h.capitalize()
    if h in seen: h=f"{h} ({v[:20]})"
    seen[h]=1
    print('|'.join([h.replace('|','/'),v.replace('|','/'),zv.replace('|','/'),'',f"p. {pg}"]))
