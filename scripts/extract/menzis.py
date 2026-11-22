"""Read the Menzis ExtraVerzorgd coverage tables (five package columns) from a pdftotext -layout export.

usage: python3 menzis.py conditions.txt > out.json
"""
import re,json,sys
txt=open(sys.argv[1]).read().split('\n')
names=['Buitenland en Tandongeval','JongerenVerzorgd','ExtraVerzorgd 1','ExtraVerzorgd 2','ExtraVerzorgd 3']
out=[];page=1;pages=[]
for l in txt: page+=l.count('\f');pages.append(page)
txt=[l.replace('\f','') for l in txt]
def heading(i):
    # search back for a short line without a full stop that acts as heading
    for j in range(i-1,max(0,i-60),-1):
        s=txt[j].strip()
        if s and len(s)<60 and not s.endswith(('.',',',':',';')) and not re.search(r'€|\d{2,}|ExtraVerzorgd|Tandongeval|Buitenland en',s) and s[0].isupper() and len(s.split())<=8:
            return s
    return '?'
i=0
while i<len(txt):
    l=txt[i]
    if 'JongerenVerzorgd' in l and 'ExtraVerzorgd 3' in l:
        j=i+1;vals=None;ctx=[]
        while j<min(len(txt),i+12):
            s=txt[j].strip()
            if s and s!='Tandongeval':
                parts=[p.strip() for p in re.split(r'\s{2,}',s) if p.strip()]
                if len(parts)==5: vals=parts;break
                if len(parts)==4: vals=['?']+parts;break
                ctx.append(s)
            j+=1
        if vals:
            # context: heading plus any text right before the table
            pre=' '.join(x.strip() for x in txt[max(0,i-3):i] if x.strip())[-200:]
            prov=' '.join(x.strip() for x in txt[j+1:j+8] if x.strip())[:300]
            out.append({'title':heading(i),'pre':pre,'vals':dict(zip(names,vals)),'page':pages[i],'provider':prov})
        i=j+1;continue
    i+=1
json.dump(out,sys.stdout,ensure_ascii=False,indent=0)
