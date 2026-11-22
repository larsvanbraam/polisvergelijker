# Polisvergelijker

Vergelijk Nederlandse aanvullende zorgverzekeringen voor 2027 op de details: welke behandeling, hoeveel, bij welke zorgverlener en waar het in de polis staat. Elke waarde heeft een voetnoot naar het brondocument en de pagina.

Live: https://zorgverzekering.larsvanbraam.nl

## Hoe het werkt

1. `download.sh` haalt de polisvoorwaarden en vergoedingenoverzichten op (lijst in `urls.txt`) naar `pdfs/`.
2. De scripts in `scripts/extract/` lezen die PDF's uit (`pdftotext -layout` / pdfplumber) naar `data/*.psv` en `data/*.mpsv`.
3. `build.py` combineert alles met `data/basis.json` (basispolissen en premies) tot `site/data.json`.
4. `site/` is de website: `index.html` (alles in één bestand) en `data.json`, plus `api/contract.js` voor het opzoeken van contracten bij zorgzoekers.

## Data-formaten

- `*.psv`: één pakket per bestand. Kopregel `#label=..|concern=..|pakket=..|premie=..|bron=..`, daarna `rubriek|vergoeding|zorgverlener|voorwaarden|ref`.
- `*.mpsv`: meerdere pakketten. Kopregel met `pakketten=Naam:premie,Naam:premie`, daarna `rubriek|waarde pakket 1|…|zorgverlener|voorwaarden|ref`.
- Een regel die met `!` begint is gemarkeerd als *controleren*.
- `ref` bevat `p. N` voor een link naar de juiste pagina in de PDF.

## Lokaal draaien

```bash
python3 build.py      # site/data.json opnieuw bouwen
node dev.js           # http://localhost:8765
```

## Deployen

Vercel-project `polisvergelijker`, gekoppeld aan deze repo met **Root Directory: `site`**. Elke push naar `main` gaat live. Handmatig kan ook met `./deploy.sh` (of `./deploy.sh --preview`).

## Disclaimer

Persoonlijk hulpmiddel, geen advies. De gegevens zijn automatisch uitgelezen en kunnen fouten bevatten; alleen de documenten van de verzekeraar zijn leidend. De PDF's van verzekeraars staan bewust niet in deze repo.
