# Adapter-contract
Elk bestand `<concern>.js` exporteert `async function check({naam, postcode, soort})` (CommonJS: `module.exports = {concern, labels, check}`).
- naam: zoektekst van zorgverlener (bijv. "Fysio Jansen"); postcode: "3511AB" of plaatsnaam; soort: zorgtype, bijv. "fysiotherapie"
- Geeft terug: `{status:"ok", matches:[{naam, adres, contract:"ja"|"nee"|"gesprek"|"onbekend", tekst}]}`
  of `{status:"unsupported"|"error", reden:"..."}`. Gooi nooit; vang fouten af.
- contract: "ja" = gecontracteerd/vergoed, "nee" = geen contract, "gesprek" = nog in onderhandeling (let op wat de verzekeraar daar vergoedt, zet dat in `tekst`).
- Alleen Node 18+ ingebouwde `fetch`, geen npm-pakketten. Timeout max 8s via AbortSignal.timeout(8000).
