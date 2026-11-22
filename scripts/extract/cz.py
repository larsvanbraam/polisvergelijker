import pdfplumber,re,sys,json
def parse(path):
    rows=[];cur=None;heading=None;b1=b2=None
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            words=page.extract_words(extra_attrs=['fontname','size'],keep_blank_chars=False,x_tolerance=1.5)
            # column bounds from header
            for w in words:
                if w['text']=='Hoeveel': b1=w['x0']-2
                if w['text']=='Wat' and b1 and w['x0']>b1+50: b2=w['x0']-2
            if not b1: continue
            lines={}
            for w in words:
                y=round(w['top']/2)
                lines.setdefault(y,[]).append(w)
            for y in sorted(lines):
                ws=sorted(lines[y],key=lambda w:w['x0'])
                txt=' '.join(w['text'] for w in ws)
                if re.search(r'geldig vanaf|Wat krijgt u vergoed|Productnummer|^aanvullende verzekering',txt): continue
                c=['','','']
                for w in ws:
                    k=0 if w['x0']<b1 else (1 if (b2 is None or w['x0']<b2) else 2)
                    c[k]+=(' ' if c[k] else '')+w['text']
                bold=all('Bold' in w['fontname'] for w in ws if w['x0']<b1) and c[0] and not c[1] and not c[2]
                if bold:
                    heading=c[0];cur=None;continue
                if c[0] and c[1] and (cur is None or not cur['open0']):
                    cur={'h':heading,'r':c[0],'v':c[1],'k':c[2],'open0':not re.search(r'\)\s*$',c[0])};rows.append(cur)
                elif cur:
                    if c[0] and not c[1] and not c[2] and not cur['open0']:
                        heading=c[0];cur=None;continue
                    if c[0]:
                        if cur['open0']: cur['r']+=' '+c[0]; cur['open0']=not re.search(r'\)\s*$',c[0])
                        elif not c[1]: cur['r']+=' '+c[0]
                        else:
                            cur={'h':heading,'r':c[0],'v':c[1],'k':c[2],'open0':not re.search(r'\)\s*$',c[0])};rows.append(cur);continue
                    if c[1]: cur['v']+=' '+c[1]
                    if c[2]: cur['k']+=' '+c[2]
    return rows
if __name__=='__main__':
    for r in parse(sys.argv[1]):
        print(f"[{r['h']}] {r['r']} || {r['v']} || {r['k'][:90]}")
