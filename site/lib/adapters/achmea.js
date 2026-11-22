// Achmea group: Zilveren Kruis, Interpolis, FBTO, De Friesland (same Sitecore provider-finder backend)
// Flow (as the finder page itself): GET page -> cookie + __RequestVerificationToken (CSRF),
// then JSON POSTs to /clientcontroller/zorgzoekerclient/{getautofillzorgtype,getautofilllocatie,getautofillzorginstelling,getzorgaanbieders}.
const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const BASE="https://www.zilverenkruis.nl";
const PAGE=BASE+"/consumenten/zorgzoeker";
const API=BASE+"/clientcontroller/zorgzoekerclient/";
const JAAR=2027;
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
const sig=()=>AbortSignal.timeout(8000);

async function session(){
  const r=await fetch(PAGE,{headers:{"user-agent":UA,"accept":"text/html"},redirect:"follow",signal:sig()});
  if(!r.ok)throw new Error("pagina HTTP "+r.status);
  const html=await r.text();
  const m=html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  if(!m)throw new Error("geen verificatietoken gevonden");
  const sc=typeof r.headers.getSetCookie==="function"?r.headers.getSetCookie():[(r.headers.get("set-cookie")||"")];
  const cookie=sc.map(c=>c.split(";")[0]).filter(Boolean).join("; ");
  return{token:m[1],cookie};
}
async function post(s,ep,body){
  const r=await fetch(API+ep,{method:"POST",headers:{"user-agent":UA,"content-type":"application/json","accept":"application/json",
    "__RequestVerificationToken":s.token,"cookie":s.cookie,"origin":BASE,"referer":PAGE},body:JSON.stringify(body),signal:sig()});
  if(!r.ok)throw new Error(ep+" HTTP "+r.status);
  return r.json();
}
function contractVan(res){
  const cs=(res.Contracten||[]).filter(c=>c&&c.StatusOmschrijving);
  if(!cs.length)return{contract:"onbekend",tekst:"Geen contractinformatie"};
  // best status wins: ja > gesprek > nee
  const kl=c=>{const t=c.StatusOmschrijving;
    if(/^Contract\b/i.test(t))return"ja";
    if(/nog geen|onderhandel|gesprek/i.test(t))return"gesprek";
    if(/^geen contract/i.test(t))return"nee";return"onbekend"};
  const rang={ja:3,gesprek:2,nee:1,onbekend:0};
  let best=cs[0];for(const c of cs)if(rang[kl(c)]>rang[kl(best)])best=c;
  const extra=best.Toelichting&&best.Toelichting!==best.StatusOmschrijving?" - "+best.Toelichting:"";
  return{contract:kl(best),tekst:best.StatusOmschrijving+extra+` (jaar ${JAAR})`};
}
const adresStr=a=>a?[[a.Straat,a.Huisnummer].filter(Boolean).join(" "),[a.Postcode,a.Plaats].filter(Boolean).join(" ")].filter(Boolean).join(", "):"";

async function check({naam,postcode,soort="fysiotherapie"}){
  try{
    const s=await session();
    const zt=await post(s,"getautofillzorgtype",{ZoekstringZorgtype:soort});
    const opts=zt.options||[];
    // One search term can match several care types (e.g. psychotherapy: KPT and IPT): search all and merge.
    const exact=opts.filter(o=>norm(o.value)===norm(soort));
    const zs=(exact.length?exact:opts).slice(0,6);
    if(!zs.length)return{status:"error",reden:`zorgtype '${soort}' niet gevonden in zorgzoeker`};
    const loc=await post(s,"getautofilllocatie",{ZoekstringLocatie:String(postcode||"").trim()});
    const l=(loc.options||[])[0];
    if(!l)return{status:"error",reden:`locatie '${postcode}' niet gevonden in zorgzoeker`};
    const peil=new Date(Date.UTC(JAAR,0,1)).toISOString();
    const ds=await Promise.all(zs.map(z=>post(s,"getzorgaanbieders",{Zorgtype:z.id,LocatieId:l.id,Peildatum:peil}).catch(()=>null)));
    const goed=ds.filter(d=>d&&d.IsSucces);
    if(!goed.length)return{status:"error",reden:"zorgzoeker meldt fout"};
    const gezien=new Set();let lijst=[];
    for(const d of goed)for(const r of d.Resultaten||[]){const k=norm(r.Naam)+"|"+adresStr(r.Adres);if(!gezien.has(k)){gezien.add(k);lijst.push(r)}}
    const toks=norm(naam).split(" ").filter(Boolean);
    if(toks.length)lijst=lijst.filter(r=>{const n=norm(r.Naam);return toks.every(t=>n.includes(t))});
    const matches=lijst.slice(0,10).map(r=>({naam:r.Naam,adres:adresStr(r.Adres)+(r.Adres&&r.Adres.Afstand?` (${r.Adres.Afstand})`:""),...contractVan(r)}));
    return{status:"ok",matches};
  }catch(e){return{status:"error",reden:String(e&&e.message||e)}}}
module.exports={concern:"Achmea",labels:["Zilveren Kruis","Interpolis","FBTO","De Friesland"],check};
