"""Convert the JSON from menzis.py to data/menzis.mpsv (premiums per package are listed below).

usage: python3 menzis2mpsv.py menzis.json > data/menzis.mpsv
"""
import json,re,sys
d=json.load(open(sys.argv[1]))
order=[('ExtraVerzorgd 1','8.60'),('ExtraVerzorgd 2','25.00'),('ExtraVerzorgd 3','45.80'),('JongerenVerzorgd','21.15')]
source="https://voorwaarden.menzis.nl/verzekeringsvoorwaarden-menzisbasis-extraverzorgd-tandverzorgd-2027.pdf"
print(f"#label=Menzis|concern=Menzis|source={source}|policy={source}|packages="+','.join(f"{n}:{p}" for n,p in order))
seen={}
for a in d:
    t=a['title'];pre=a['pre']
    if t=='Let op': t='Fysiotherapie bij specifieke aandoening (bijlage 1)'
    if t in seen: seen[t]+=1; t=f"{t} ({'patiënt' if seen[t]==2 else seen[t]})"
    else: seen[t]=1
    per=''
    if '2 kalenderjaren' in pre: per=' per 2 jaar'
    elif 'gehele verzekeringsduur' in pre: per=' voor gehele verzekeringsduur'
    elif 'per ongeval' in pre: per=' per ongeval'
    elif 'kalenderjaar' in pre: per=' per jaar'
    unit=' behandelingen' if 'behandelingen' in pre else ' uur' if ('behandeluren' in pre or 'uren' in pre) else ' gesprekken' if 'gesprek' in pre else ''
    def conv(v):
        v=v.strip()
        if v in ('€0','€ 0','0','Nee'): return '—'
        if v=='Ja': return 'Vergoed'
        if re.fullmatch(r'\d+',v): return v+unit+per
        if '€' in v: return v.replace('€0','—')+per
        return v
    vals=[conv(a['vals'].get(n,'—')) for n,_ in order]
    if t=='Alternatieve zorg': vals=[v if v=='—' else v+' (max. € 40 per behandeldag)' for v in vals]
    if all(v=='—' for v in vals): continue
    prov=re.sub(r'\s+',' ',a['provider']).replace('|','/')[:240]
    print('|'.join([t]+vals+[prov,'',f"p. {a['page']}"]))
