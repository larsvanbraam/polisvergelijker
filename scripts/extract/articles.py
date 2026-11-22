"""Split a pdftotext -layout export of policy conditions into articles and read the
coverage per package from each article.

usage: python3 articles.py conditions.txt "Package A,Package B" > out.json
env:   ARTICLE_RE  regex for an article heading (groups: number, title)
       PROVIDER_RE regex for the line after which the qualifying providers are described
       SUFFIX      comma-separated words that extend stacked column headers (e.g. "Regio,Compact")
The regexes match the Dutch wording of the source documents.
"""
import re,sys,json
STOP=re.compile(r'^\s*(Let op|Dit krijgt u niet|Hier kunt u|Toestemming|Welk middel|Verwijzing|Wat moet u|Goed om te weten|Wanneer|Voorwaarden voor|U heeft geen recht|Dit valt er niet|Wat wij \(volgens|Aanvullend\s+Dekking)')
import os
ARTICLE=re.compile(os.environ.get('ARTICLE_RE',r'^\s*Artikel\s+(\d+[a-z]?)\.?\s+(\S.*?)\s*$'))
PROVIDER_RE=os.environ.get('PROVIDER_RE',r'^\s*Hier kunt u terecht')
def articles(txt):
    arts=[];cur=None;page=1
    for line in txt.split('\n'):
        page+=line.count('\f');line=line.replace('\f','')
        m=ARTICLE.match(line)
        if m and not re.search(r'(\.{4,}|\s\d+\s*$)',line):
            g=[x for x in m.groups() if x is not None];cur={'nr':g[0],'title':g[-1].strip(),'lines':[],'page':page};arts.append(cur);continue
        if cur is not None: cur['lines'].append(line)
    return arts
def clean(s): return re.sub(r'\s+',' ',s).strip()
def find_packages(line,packages):
    pos=[];taken=set()
    for p in sorted(packages,key=len,reverse=True):
        for m in re.finditer(r'(?<![\w-])'+re.escape(p)+r'(?![\w-])',line):
            if any(i in taken for i in range(m.start(),m.end())): continue
            taken.update(range(m.start(),m.end())); pos.append((m.start(),p))
    return sorted(pos)
def parse_values(lines,pks):
    """Coverage per package from an article body (column tables or one row per package)."""
    vals={};i=0
    while i<len(lines):
        l=lines[i];pos=find_packages(l,pks)
        if len(pos)>=2 and len(clean(re.sub('|'.join(map(re.escape,pks)),'',l)))<5:  # column header
            starts=[p for p,_ in pos];groups=[[n] for _,n in pos]
            j=i+1
            # extra header lines with package names (stacked column headers)
            while j<len(lines):
                L=lines[j]
                if not L.strip(): j+=1;continue
                toks=[(m.start(),m.group()) for m in re.finditer(r'\S+(?: \S+)*',L)]
                SUF=[x for x in os.environ.get('SUFFIX','').split(',') if x]
                if toks and all(t in pks or t in SUF for _,t in toks):
                    for x,t in toks:
                        k=min(range(len(starts)),key=lambda q:abs(starts[q]-x))
                        if t in SUF: groups[k][0]=groups[k][0]+' '+t
                        else: groups[k].append(t)
                    j+=1;continue
                break
            names=[g[0] for g in groups]
            col={n:'' for n in names};blank=0
            while j<len(lines):
                L=lines[j]
                if STOP.match(L) or ARTICLE.match(L) or find_packages(L,pks) and len(find_packages(L,pks))>=2: break
                if not L.strip():
                    blank+=1
                    if blank>=2: break
                    j+=1;continue
                blank=0
                if re.search(r'Verzekeringsvoorwaarden|Voorwaarden .*20\d\d|^\s*\d+\s*$',L): j+=1;continue
                for k,s in enumerate(starts):
                    e=starts[k+1] if k+1<len(starts) else None
                    a=max(0,s-2); seg=L[a:(e-2 if e else None)]
                    col[names[k]]+=' '+seg
                j+=1
            for g in groups:
                v=clean(col[g[0]])
                if v:
                    for n in g: vals[n]=(vals[n]+'; '+v) if n in vals else v
            i=j;continue
        if len(pos)==1 and pos[0][0]<=24 and pos[0][0]==len(l)-len(l.lstrip()):  # row mode
            n=pos[0][1];rest=l[pos[0][0]+len(n):]
            if rest.strip():
                v=rest;ind=len(l)-len(rest.lstrip());j=i+1
                while j<len(lines) and lines[j].strip() and not STOP.match(lines[j]) and not find_packages(lines[j][:15],pks) and (len(lines[j])-len(lines[j].lstrip()))>=ind-3:
                    v+=' '+lines[j];j+=1
                vals[n]=(vals[n]+'; '+clean(v)) if n in vals else clean(v); i=j;continue
        i+=1
    return vals
def provider_text(lines):
    """Text after the 'where can you go' marker: which providers qualify."""
    out=[];on=False
    for l in lines:
        if re.match(PROVIDER_RE,l): on=True;continue
        if on:
            if STOP.match(l) or (not l.strip() and out and len(' '.join(out))>250): break
            if re.search(r'Verzekeringsvoorwaarden|^\s*\d+\s*$',l): continue
            out.append(l.strip())
    return clean(' '.join(out))[:300]
if __name__=='__main__':
    txt=open(sys.argv[1]).read();pks=sys.argv[2].split(',')
    res=[]
    for a in articles(txt):
        v=parse_values(a['lines'],pks)
        if v: res.append({'nr':a['nr'],'title':a['title'],'vals':v,'provider':provider_text(a['lines']),'page':a['page']})
    json.dump(res,sys.stdout,ensure_ascii=False,indent=0)
