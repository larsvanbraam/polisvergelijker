"""Convert the JSON from articles.py to a .mpsv file.

usage: python3 json2mpsv.py articles.json LABEL CONCERN SOURCE_URL "Name in doc:Display name:premium,..." > data/x.mpsv
"""
import json,sys,re
src,label,concern,source,pk_arg=sys.argv[1:6]
pks=[x.split(':') for x in pk_arg.split(',')]  # name_in_doc:display_name:premium
d=list({a['nr']:a for a in json.load(open(src))}.values())
def short(v):
    v=re.sub(r'\s+',' ',v).strip()
    if re.match(r'^geen (vergoeding|dekking)\.?$',v,re.I) or re.match(r'^(geen (vergoeding|dekking)[;.]?\s*)+$',v,re.I): return '—'
    v=v.replace('maximaal','max.').replace('kalenderjaar','jaar').replace('kalenderjaren','jaar')
    return v[:280]
print(f"#label={label}|concern={concern}|source={source}|policy={source}|packages="+','.join(f"{p[1]}:{p[2]}" for p in pks))
for a in d:
    vals=[short(a['vals'].get(p[0],'—')) for p in pks]
    if all(v=='—' for v in vals): continue
    prov=re.sub(r'\s+',' ',a['provider'])[:240].replace('|','/')
    vals=[v.replace('|','/') for v in vals]
    print('|'.join([a['title'].replace('|','/')]+vals+[prov,'',f"Art. {a['nr']}, p. {a['page']}"]))
