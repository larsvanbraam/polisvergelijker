"""Bouwt data.json uit de uitgelezen polisbestanden in data/.

Formaten:
  *.psv  : 1 pakket per bestand. Header '#label=..|concern=..|pakket=..|premie=..|bron=..'
           Regels: rubriek|vergoeding|zorgverlener|voorwaarden|ref
  *.mpsv : meerdere pakketten. Header '#label=..|concern=..|bron=..|polis=..|pakketten=Naam:premie,Naam:premie'
           Regels: rubriek|<waarde per pakket...>|zorgverlener|voorwaarden|ref
Een regel die begint met '!' is gemarkeerd als 'controleren' (bron onduidelijk).
"""
import json, re, glob, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# canonieke behandeling -> (groep, zoekwoorden in rubriek)
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


FALLBACK = [("Mond", ["tand", "mondzorg", "gebit", "orthodon"]), ("Zwanger & kind", ["zwanger", "bevalling", "baby", "kind", "adoptie", "couveuse", "verloskamer"]),
            ("Preventie & buitenland", ["cursus", "preventie", "vaccin", "healthcheck", "check", "vervoer", "reis"]), ("Huid", ["huid", "camouflage"]),
            ("Alternatief & mentaal", ["mentale", "rouw", "kanker", "therapie"]), ("Paramedisch", ["fysio", "oefen", "ergo", "logoped", "bekken"])]

def canon(rubriek):
    r = rubriek.lower()
    for name, group, keys in CANON:
        if any(k in r for k in keys):
            return name, group
    for group, keys in FALLBACK:
        if any(k in r for k in keys):
            return rubriek, group
    return rubriek, "Overig"


def amount(s):
    return float(s.replace(".", "").replace(",", "."))


def numbers(v):
    """Afgeleide getallen voor sorteren/vergelijken."""
    t = v.replace(" ", " ")
    out = {"eur_jaar": None, "beh": None, "eur": None, "pct": None}
    if t.strip() in ("—", "-", ""):
        return out
    m = re.search(r"€\s?([\d.]+(?:,\d+)?)\s*(?:per|/)\s*(?:kalender)?jaar", t)
    if m:
        out["eur_jaar"] = amount(m.group(1))
    else:
        m = re.search(r"€\s?([\d.]+(?:,\d+)?)\s*per\s*(\d)\s*(?:kalender)?ja", t)
        if m:
            out["eur_jaar"] = round(amount(m.group(1)) / int(m.group(2)), 2)
    m = re.search(r"(\d+)\s*(?:behandelingen|consulten|uur|zittingen|dagen)", t)
    if m:
        out["beh"] = int(m.group(1))
    if out["eur_jaar"] is None:
        m = re.search(r"€\s?([\d.]+(?:,\d+)?)\s*per\s*behandel\w*.*?max\.\s*(\d+)\s*(?:consulten|behandelingen)\s*per\s*(?:kalender)?jaar", t)
        if m:
            out["eur_jaar"] = round(amount(m.group(1)) * int(m.group(2)), 2)
    eur = [amount(x) for x in re.findall(r"€\s?([\d.]+(?:,\d+)?)", t)]
    if eur:
        out["eur"] = max(eur)
    m = re.search(r"(\d+)\s?%", t)
    if m:
        out["pct"] = int(m.group(1))
    return out


def parse_header(line):
    h = {}
    for part in line.lstrip("#").strip().split("|"):
        k, _, v = part.partition("=")
        h[k.strip()] = v.strip()
    return h


def premie(p):
    try:
        return float(p) if p else None
    except ValueError:
        return None


def rec(h, pakket, prem, rubriek, waarde, zv, vw, ref, check):
    name, group = canon(rubriek)
    covered = waarde.strip() not in ("—", "-", "")
    return {
        "label": h["label"], "concern": h.get("concern", h["label"]),
        "pakket": pakket, "premie": prem,
        "behandeling": name, "groep": group, "rubriek_bron": rubriek,
        "vergoeding": waarde if covered else "Geen dekking",
        "gedekt": covered,
        "zorgverlener": "" if zv in ("—", "-") else zv,
        "voorwaarden": "" if vw in ("—", "-") else vw,
        "ref": ref, "bron": h.get("bron", ""), "polis": h.get("polis", h.get("bron", "")),
        "controleren": check, **numbers(waarde),
    }


def load():
    records, pakketten, seen = [], [], set()
    for f in sorted(glob.glob(os.path.join(HERE, "data", "*.*psv"))):
        lines = [l.rstrip("\n") for l in open(f, encoding="utf-8") if l.strip()]
        h = parse_header(lines[0])
        multi = f.endswith(".mpsv")
        if multi:
            pk = []
            for item in h["pakketten"].split(","):
                n, _, p = item.partition(":")
                pk.append((n.strip(), premie(p)))
        else:
            pk = [(h["pakket"], premie(h.get("premie")))]
        for n, p in pk:
            pakketten.append({"label": h["label"], "concern": h.get("concern", h["label"]),
                              "pakket": n, "premie": p, "bron": h.get("bron", ""),
                              "polis": h.get("polis", h.get("bron", "")), "module": h.get("module")})
        for l in lines[1:]:
            check = l.startswith("!")
            cols = [c.strip() for c in l.lstrip("!").split("|")]
            exp = 1 + len(pk) + 3
            if len(cols) != exp:
                sys.exit(f"{os.path.basename(f)}: {len(cols)} kolommen, verwacht {exp}: {l}")
            rub, vals, (zv, vw, ref) = cols[0], cols[1:1 + len(pk)], cols[-3:]
            for (n, p), v in zip(pk, vals):
                r = rec(h, n, p, rub, v, zv, vw, ref, check)
                k = (r["label"], r["pakket"], r["behandeling"])
                if k in seen:  # tweede regel voor zelfde behandeling: eigen naam houden
                    r["behandeling"] = rub
                seen.add(k)
                records.append(r)
    return records, pakketten


if __name__ == "__main__":
    records, pakketten = load()
    groups = []
    for name, group, _ in CANON:
        if group not in groups:
            groups.append(group)
    out = {"jaar": 2027, "gegenereerd": __import__("datetime").date.today().isoformat(),
           "groepen": groups, "pakketten": pakketten, "records": records,
           "basis": json.load(open(os.path.join(HERE, "data", "basis.json"), encoding="utf-8")),
           "eigen_risico": 400}
    # compact: bron/polis/concern/premie staan al bij het pakket; de pagina vult ze weer aan
    for r in out["records"]:
        for k in ("bron", "polis", "concern", "premie"):
            r.pop(k, None)
        for k in [k for k, v in r.items() if v is None or v == "" or v is False]:
            r.pop(k)
    json.dump(out, open(os.path.join(HERE, "site", "data.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    beh = sorted({r["behandeling"] for r in records})
    print(f"{len(pakketten)} pakketten, {len(records)} records, {len(beh)} behandelingen")
    unmapped = sorted({r["behandeling"] for r in records if r["groep"] == "Overig" and r["behandeling"] not in [c[0] for c in CANON]})
    print("Niet gemapt:", unmapped)
