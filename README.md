# Polisvergelijker

Compare Dutch supplementary health insurance packages for 2027 in detail: which treatment is covered, how much, by which providers, and where it is stated in the policy. Every value has a footnote pointing to the source document and page.

Live: https://polisvergelijker.larsvanbraam.nl

The site itself is in Dutch, as are the extracted policy texts. Code, comments and docs are in English.

## How it works

1. `download.sh` fetches the policy conditions and coverage overviews listed in `urls.txt` into `pdfs/` (not committed).
2. The scripts in `scripts/extract/` read those PDFs (`pdftotext -layout` / pdfplumber) into `data/*.psv` and `data/*.mpsv`.
3. `build.py` combines them with `data/base.json` (base policies, premiums, out-of-network reimbursement) into `site/public/data.json`.
4. `site/` is the website: a [Vite+](https://viteplus.dev) project in TypeScript (no framework), plus `api/contract.js`, a serverless function that asks the insurers' provider finders whether a provider has a contract.

## Site structure (`site/src`)

| Module | Purpose |
|---|---|
| `types.ts` | Shapes of `data.json` |
| `data.ts` | Loading the data, active labels and packages |
| `pricing.ts` | Total price, estimated reimbursement, contracts, FBTO module combinations (tested in `pricing.test.ts`) |
| `plan.ts` | Step-by-step plan (tab *stappenplan*) |
| `treatment.ts`, `packages.ts`, `needs.ts` | Tabs *behandeling*, *pakketten*, *behoefte* |
| `sidebar.ts`, `filters.ts`, `contracts.ts` | Treatment list, filter bar and routing, contract table |
| `footnotes.ts`, `links.ts`, `cards.ts`, `format.ts` | Footnotes, purchase lines, mobile card tables, formatting helpers |
| `needlist.ts`, `concerns.ts`, `state.ts`, `theme.ts` | Preset needs, insurer groups and finder URLs, UI state, light/dark |

## Data formats

- `*.psv`: one package per file. Header `#label=..|concern=..|package=..|premium=..|source=..`, then rows `heading|coverage|provider|conditions|ref`.
- `*.mpsv`: several packages. Header with `packages=Name:premium,Name:premium` (plus `source`, `policy`), then rows `heading|coverage package 1|…|provider|conditions|ref`.
- Optional header key `module` marks modular insurers (FBTO): packages with the same module are alternatives, different modules can be combined.
- A row starting with `!` is flagged as *needs check* (the source table was ambiguous).
- `ref` contains `p. N` to link to the right page of the PDF.
- `data/base.json`: per label the base policies (`name`, `type`, `free_choice`, `p400`/`p900` premiums for each deductible, compatible `packages`), `out_of_network` reimbursement and sources.

## Extraction scripts

| Script | Input | Output |
|---|---|---|
| `articles.py` | conditions with numbered articles | JSON per article, then `json2mpsv.py` |
| `cz.py` / `cz2psv.py` | CZ-group coverage PDFs | `.psv` |
| `dsw.py` | DSW / Stad Holland packages | `.psv` |
| `menzis.py` / `menzis2mpsv.py` | Menzis ExtraVerzorgd tables | `.mpsv` |
| `matrix.py` | coverage matrix with one column per package | JSON |
| `summary_card.py` | insurance product information cards | JSON |

Each script has its usage in its docstring.

## Share image

`site/og.png` (1200×630) is rendered from `design/og.html` with a headless browser. The design uses IBM Plex from `@fontsource` (`npm i @fontsource/ibm-plex-sans @fontsource/ibm-plex-sans-condensed @fontsource/ibm-plex-mono` next to it).

## Run locally

```bash
python3 build.py      # rebuild site/public/data.json
cd site
vp install            # once, and after pulling dependency changes
vp dev                # http://localhost:5173, includes /api/contract
vp check              # format, lint and type check
vp test               # unit tests
vp build              # production build in site/dist
```

## Deploy

Vercel project `polisvergelijker`, connected to this repo with **Root Directory: `site`**. `site/vercel.json` sets the Vite framework, `npm ci`, `npm run build` and the `dist` output. Every push to `main` goes live; other branches get a preview URL. After changing data, run `python3 build.py` first so `site/public/data.json` is part of the commit.

## Disclaimer

Personal tool, not advice. The data was extracted automatically and may contain errors; only the insurers' own documents are binding. The insurers' PDFs are intentionally not part of this repo.
