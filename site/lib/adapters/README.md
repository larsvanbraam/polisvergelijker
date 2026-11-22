# Adapter contract

Each `<concern>.js` exports `async function check({naam, postcode, soort})` (CommonJS: `module.exports = {concern, labels, check}`).

- `naam`: search text for the provider (e.g. "Fysio Jansen"); `postcode`: "3511AB" or a place name; `soort`: care type, e.g. "fysiotherapie".
- Returns `{status:"ok", matches:[{naam, adres, contract:"ja"|"nee"|"gesprek"|"onbekend", tekst}]}`
  or `{status:"unsupported"|"error", reden:"..."}`. Never throw; catch errors.
- `contract`: "ja" = contracted/reimbursed, "nee" = no contract, "gesprek" = still negotiating (put what the insurer reimburses meanwhile in `tekst`).
- Only the built-in `fetch` of Node 18+, no npm packages. Timeout at most 8 s via `AbortSignal.timeout(8000)`.

The field names and values of this contract are still Dutch (`naam`, `adres`, `tekst`, `reden`, `soort`, `ja`/`nee`/`gesprek`/`onbekend`) because the
adapters also read Dutch fields from the insurers' APIs; renaming them needs a live test against every provider finder.
