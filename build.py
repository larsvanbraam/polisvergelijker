"""Builds site/data.json from the extracted policy files in data/.

Formats:
  *.psv  : one package per file. Header '#label=..|concern=..|package=..|premium=..|source=..'
           Rows: heading|coverage|provider|conditions|ref
  *.mpsv : several packages. Header '#label=..|concern=..|source=..|policy=..|packages=Name:premium,Name:premium'
           Rows: heading|<coverage per package...>|provider|conditions|ref
Optional header key 'module' marks modular insurers (e.g. FBTO): packages with the same
module value are alternatives, different modules can be combined.
A row starting with '!' is flagged as needs_check (source table was ambiguous).
Values (headings, coverage text, notes) are Dutch, as in the source documents.
"""
import json, re, glob, os, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
NO_VALUE = ("—", "-", "")

# canonical treatment -> (category, keywords to match in the source heading).
# Treatment and category names are shown to users and stay Dutch.
CANON = [
    ("Fysiotherapie", "Paramedisch", ["fysiotherap"]),
    ("Oefentherapie Cesar/Mensendieck", "Paramedisch", ["oefentherapie cesar"]),
    ("Ergotherapie", "Paramedisch", ["ergotherap"]),
    ("Steunzolen", "Paramedisch", ["steunzolen en therapiezolen", "steunzolen en voetzorg hulp"]),
    ("Podotherapie en voetzorg", "Paramedisch", ["podotherap", "voetzorg", "voetbehandel", "podolog"]),
    ("Steunzolen", "Paramedisch", ["steunzolen"]),
    ("Pedicure bij diabetes", "Paramedisch", ["pedicure"]),
    ("Alternatieve geneeswijzen", "Alternatief & mentaal", ["alternatie"]),
    ("Diëtetiek", "Paramedisch", ["diëtetiek", "dietetiek"]),
    ("Psychologische zorg / mentale ondersteuning", "Alternatief & mentaal", ["psycholog", "mentale"]),
    ("Homeopathische middelen", "Alternatief & mentaal", ["homeopathische"]),
    ("Mindfulness bij burn-out", "Alternatief & mentaal", ["mindfulness"]),
    ("Seksuologie", "Alternatief & mentaal", ["seksuolog"]),
    ("Overgangsconsulent", "Alternatief & mentaal", ["overgang"]),
    ("Brillen en lenzen volwassenen", "Ogen & oren", ["brillen en lenzen volw", "brillenglazen", "brillen en contactlenzen", "bril, contactlenzen", "budget voor brillen"]),
    ("Brillen en lenzen kinderen", "Ogen & oren", ["brillen en lenzen kind"]),
    ("Ooglaseren", "Ogen & oren", ["ooglaser"]),
    ("Hoortoestellen eigen bijdrage", "Ogen & oren", ["hoortoestel"]),
    ("Tandongevallen", "Mond", ["tandongeval", "ongeval"]),
    ("Tandarts (aanvullend)", "Mond", ["tandarts", "tandheelkundige zorg voor verzekerden van 18", "algemene tandheelkundige"]),
    ("Orthodontie", "Mond", ["orthodont"]),
    ("Tandongevallen", "Mond", ["tandongeval"]),
    ("Acne / huidbehandelingen", "Huid", ["acne", "huidbehandel", "huidverzorging", "huidtherap"]),
    ("Camouflagetherapie", "Huid", ["camouflage"]),
    ("Ontharing (hirsutisme)", "Huid", ["hirsutisme", "ontharing", "ontharen", "epilatie"]),
    ("Anticonceptie", "Preventie & buitenland", ["anticonceptie"]),
    ("Sterilisatie", "Preventie & buitenland", ["sterilisatie"]),
    ("Vaccinaties buitenland", "Preventie & buitenland", ["vaccinatie"]),
    ("Buitenland (spoedzorg)", "Preventie & buitenland", ["buitenland", "vakantie en tijdelijk verblijf"]),
    ("Repatriëring", "Preventie & buitenland", ["repatri"]),
    ("Griepprik", "Preventie & buitenland", ["griep"]),
    ("Beweegprogramma", "Preventie & buitenland", ["beweegprogramma"]),
    ("Preventiebudget / gezondheidsbudget", "Preventie & buitenland", ["preventiebudget", "gezondheidsbudget", "gezond en fitbundel", "preventie-tegoed"]),
    ("Preventief onderzoek", "Preventie & buitenland", ["preventief onderzoek"]),
    ("Sportmedisch onderzoek", "Preventie & buitenland", ["sportmedisch"]),
    ("Reanimatiecursus", "Preventie & buitenland", ["reanimatie"]),
    ("Kraampakket", "Zwanger & kind", ["kraampakket"]),
    ("Kraamzorg eigen bijdrage", "Zwanger & kind", ["kraamzorg"]),
    ("Poliklinische bevalling eigen bijdrage", "Zwanger & kind", ["bevalling"]),
    ("Lactatiekundige", "Zwanger & kind", ["lactatie", "borstvoeding"]),
    ("Borstkolf", "Zwanger & kind", ["borstkolf"]),
    ("Zwangerschapscursus", "Zwanger & kind", ["zwangerschapscursus"]),
    ("Flapoorcorrectie", "Zwanger & kind", ["flapoor", "oorstand"]),
    ("Plaswekker", "Zwanger & kind", ["plaswekker"]),
    ("Astmakamp kinderen", "Zwanger & kind", ["astma"]),
    ("Ooglidcorrectie", "Overig", ["ooglid"]),
    ("Gewichtsconsulent", "Paramedisch", ["gewichtsconsulent"]),
    ("Hulpmiddelen (budget)", "Overig", ["hulpmiddelen"]),
    ("Haarwerken", "Overig", ["haarwerk"]),
    ("Rollator", "Overig", ["rollator"]),
    ("Steunpessarium", "Overig", ["pessari"]),
    ("Hospice", "Overig", ["hospice"]),
    ("Herstellingsoord", "Overig", ["herstellingsoord"]),
    ("Logeerhuis", "Overig", ["logeerhuis"]),
    ("Vervangende mantelzorg", "Overig", ["mantelzorg"]),
    ("Hartrevalidatie / begeleid trainen", "Overig", ["hart"]),
    ("Reiskosten bezoek ziek kind", "Overig", ["reiskosten"]),
    ("Rechtshulp medische fout", "Overig", ["rechtshulp"]),
    ("Stottertherapie", "Paramedisch", ["stotter"]),
]


# Category for headings that match no canonical treatment.
FALLBACK = [("Mond", ["tand", "mondzorg", "gebit", "orthodon"]), ("Zwanger & kind", ["zwanger", "bevalling", "baby", "kind", "adoptie", "couveuse", "verloskamer"]),
            ("Preventie & buitenland", ["cursus", "preventie", "vaccin", "healthcheck", "check", "vervoer", "reis"]), ("Huid", ["huid", "camouflage"]),
            ("Alternatief & mentaal", ["mentale", "rouw", "kanker", "therapie"]), ("Paramedisch", ["fysio", "oefen", "ergo", "logoped", "bekken"])]

def canon(heading):
    """Map a source heading to (canonical treatment, category)."""
    h = heading.lower()
    for name, category, keys in CANON:
        if any(k in h for k in keys):
            return name, category
    for category, keys in FALLBACK:
        if any(k in h for k in keys):
            return heading, category
    return heading, "Overig"


def amount(s):
    """Dutch number ('1.250,50') to float."""
    return float(s.replace(".", "").replace(",", "."))


def numbers(text):
    """Numbers derived from the coverage text, used for sorting and estimates."""
    t = text.replace("\u00a0", " ")
    out = {"eur_per_year": None, "sessions": None, "eur": None, "pct": None}
    if t.strip() in NO_VALUE:
        return out
    m = re.search(r"€\s?([\d.]+(?:,\d+)?)\s*(?:per|/)\s*(?:kalender)?jaar", t)
    if m:
        out["eur_per_year"] = amount(m.group(1))
    else:  # "€ 300 per 2 kalenderjaren" -> per year
        m = re.search(r"€\s?([\d.]+(?:,\d+)?)\s*per\s*(\d)\s*(?:kalender)?ja", t)
        if m:
            out["eur_per_year"] = round(amount(m.group(1)) / int(m.group(2)), 2)
    m = re.search(r"(\d+)\s*(?:behandelingen|consulten|uur|zittingen|dagen)", t)
    if m:
        out["sessions"] = int(m.group(1))
    if out["eur_per_year"] is None:  # "€ 40 per behandeling, max. 10 consulten per jaar"
        m = re.search(r"€\s?([\d.]+(?:,\d+)?)\s*per\s*behandel\w*.*?max\.\s*(\d+)\s*(?:consulten|behandelingen)\s*per\s*(?:kalender)?jaar", t)
        if m:
            out["eur_per_year"] = round(amount(m.group(1)) * int(m.group(2)), 2)
    eur = [amount(x) for x in re.findall(r"€\s?([\d.]+(?:,\d+)?)", t)]
    if eur:
        out["eur"] = max(eur)
    m = re.search(r"(\d+)\s?%", t)
    if m:
        out["pct"] = int(m.group(1))
    return out


def parse_header(line):
    header = {}
    for part in line.lstrip("#").strip().split("|"):
        k, _, v = part.partition("=")
        header[k.strip()] = v.strip()
    return header


def premium(value):
    try:
        return float(value) if value else None
    except ValueError:
        return None


def record(header, package, heading, coverage, provider, conditions, ref, needs_check):
    name, category = canon(heading)
    covered = coverage.strip() not in NO_VALUE
    return {
        "label": header["label"], "package": package,
        "treatment": name, "category": category, "source_heading": heading,
        "coverage": coverage if covered else "Geen dekking",
        "covered": covered,
        "provider": "" if provider in NO_VALUE else provider,
        "conditions": "" if conditions in NO_VALUE else conditions,
        "ref": ref, "needs_check": needs_check, **numbers(coverage),
    }


def load():
    records, packages, seen = [], [], set()
    for f in sorted(glob.glob(os.path.join(HERE, "data", "*.*psv"))):
        lines = [l.rstrip("\n") for l in open(f, encoding="utf-8") if l.strip()]
        header = parse_header(lines[0])
        if f.endswith(".mpsv"):
            pkgs = []
            for item in header["packages"].split(","):
                name, _, prem = item.partition(":")
                pkgs.append((name.strip(), premium(prem)))
        else:
            pkgs = [(header["package"], premium(header.get("premium")))]
        for name, prem in pkgs:
            packages.append({"label": header["label"], "concern": header.get("concern", header["label"]),
                             "package": name, "premium": prem, "source": header.get("source", ""),
                             "policy": header.get("policy", header.get("source", "")), "module": header.get("module")})
        for line in lines[1:]:
            needs_check = line.startswith("!")
            cols = [c.strip() for c in line.lstrip("!").split("|")]
            expected = 1 + len(pkgs) + 3
            if len(cols) != expected:
                sys.exit(f"{os.path.basename(f)}: {len(cols)} columns, expected {expected}: {line}")
            heading, values, (provider, conditions, ref) = cols[0], cols[1:1 + len(pkgs)], cols[-3:]
            for (name, _), value in zip(pkgs, values):
                r = record(header, name, heading, value, provider, conditions, ref, needs_check)
                k = (r["label"], r["package"], r["treatment"])
                if k in seen:  # second row for the same treatment: keep its own heading as name
                    r["treatment"] = heading
                seen.add(k)
                records.append(r)
    return records, packages


if __name__ == "__main__":
    records, packages = load()
    categories = []
    for _, category, _ in CANON:
        if category not in categories:
            categories.append(category)
    out = {"year": 2027, "generated": datetime.date.today().isoformat(),
           "categories": categories, "packages": packages, "records": records,
           "base": json.load(open(os.path.join(HERE, "data", "base.json"), encoding="utf-8"))}
    # Compact output: empty fields are dropped; the page restores them and copies
    # source/policy/concern/premium from the package.
    for r in out["records"]:
        for k in [k for k, v in r.items() if v is None or v == "" or v is False]:
            r.pop(k)
    json.dump(out, open(os.path.join(HERE, "site", "data.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    treatments = sorted({r["treatment"] for r in records})
    print(f"{len(packages)} packages, {len(records)} records, {len(treatments)} treatments")
    unmapped = sorted({r["treatment"] for r in records if r["category"] == "Overig" and r["treatment"] not in [c[0] for c in CANON]})
    print("Unmapped:", unmapped)
