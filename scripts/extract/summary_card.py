"""Read the "Wat is verzekerd" section of insurance product information cards (zorgverzekeringskaart PDFs).

usage: python3 summary_card.py a.pdf,b.pdf "Package A,Package B" > out.json
"""
import pdfplumber,re,sys,json
out=[]
for path,package in zip(sys.argv[1].split(','),sys.argv[2].split(',')):
    items=[];cur=None
    with pdfplumber.open(path) as pdf:
        for pi,page in enumerate(pdf.pages):
            t=page.crop((0,0,page.width*0.5,page.height)).extract_text() or ''
            on = pi>0
            for l in t.split('\n'):
                s=l.strip()
                if 'Wat is verzekerd' in s: on=True;continue
                if not on or not s: continue
                if re.match(r'^(Wat is niet verzekerd|Waar ben ik|Wat zijn mijn|Hoe en wanneer|Wanneer begint|Hoe zeg ik)',s): on=False;cur=None;continue
                if s.startswith(('In de polisvoorwaarden','Een overzicht van alles','vergoedt, vindt u','Let op: hieronder','vergoedingen.')): continue
                bullet=s[0] in '•'
                s=s.lstrip('• ').strip()
                if not bullet and len(s)<45 and s[0].isupper() and not s.endswith(('.',',')) and not re.search(r'\d',s):
                    cur={'title':s,'text':'','page':pi+1};items.append(cur)
                elif cur: cur['text']=(cur['text']+' '+s).strip()
    out.append({'package':package,'items':items})
json.dump(out,sys.stdout,ensure_ascii=False)
