import sys,re,os
sys.path.insert(0,os.path.dirname(__file__))
from cz import parse
def clean(s): return re.sub(r'\s+',' ',s).strip()
def zv(k):
    m=re.search(r'zonder contract.*?(\d+)% van uw rekening',k)
    if m: return f"Gecontracteerd 100%; zonder contract {m.group(1)}% (van gemiddeld tarief)"
    return ""
def vw(k,v):
    if 'afgesproken tarief' in k and 'zonder contract' not in k: k=''
    k=re.sub(r'● Dit is zorg in natura.*?(contract hebben|tarief\.)','',k)
    k=clean(k.replace('●',';')).strip('; ')
    if 'bovenop de vergoeding uit de basisverzekering' in v: k=(k+'; ' if k else '')+'Aanvulling op basisverzekering'
    return k[:160]
def val(v):
    if len(v)>90 and 'Max' in v: v=v[v.rfind('Max'):]
    v=re.sub(r'^.*?(zorg samen|vergoedingen):\s*','',v)
    v=re.sub(r',? ?bovenop de vergoeding uit de basisverzekering.*?(aanvullende verzekering|$)','',v)
    return clean(v).replace('Maximaal','Max.')
pdf,label,concern,pakket,premie,bron=sys.argv[1:7]
print(f"#label={label}|concern={concern}|pakket={pakket}|premie={premie}|bron={bron}")
for r in parse(pdf):
    full=clean(r['r'])
    m=re.search(r'\((D\.[^)]*)\)\s*$',full)
    if not m: continue
    ref=m.group(1); name=full[:m.start()].strip()
    if len(name)>110: name=name.split('. ')[-1]
    name=re.sub(r'^.*?●\s*','',name)
    name=re.sub(r'^U kunt kiezen uit één van de volgende\s*','',name)
    h=name.split(' ');half=len(h)//2
    if len(h)%2==0 and h[:half]==h[half:]: name=' '.join(h[:half])
    if r['h'] and r['h'].lower().startswith('voetzorg') and 'voetzorg' not in name.lower(): name='Voetzorg: '+name
    z=zv(r['k'])
    if ref.startswith('D.7'): z='Erkende therapeut volgens lijst van de verzekeraar (o.a. opleiding Medische Basiskennis volgens Plato-eisen)'
    print('|'.join([name,val(r['v']),z,vw(r['k'],r['v']),ref]).replace('\n',' '))
