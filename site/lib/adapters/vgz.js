// VGZ group: VGZ, Univé, IZA (same finder API; label path "vgz")
// Endpoint (public, no auth): GET https://api.vgz.nl/zorgzoeker/api/v2/zorgaanbieder/zoekopnaam/vgz/<jaar>/<naam>
const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const BASE="https://api.vgz.nl/zorgzoeker/api/v2/zorgaanbieder/zoekopnaam/vgz";
const strip=s=>String(s||"").replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();
const isPostcode=s=>/^\d{4}\s?[A-Za-z]{2}$/.test(String(s).trim());
async function check({naam,postcode,soort="fysiotherapie"}){
  try{
    const term=strip(naam)||strip(soort);
    if(!term)return{status:"error",reden:"geen zoekterm"};
    const p=new URLSearchParams({sortering:"AfstandOplopend",skip:"0",take:"15"});
    if(postcode){isPostcode(postcode)?p.set("postcode",String(postcode).replace(/\s/g,"").toUpperCase()):p.set("plaats",String(postcode).trim())}
    const u=`${BASE}/2027/${encodeURIComponent(term.replace(/\//g,"-"))}?${p}`;
    const r=await fetch(u,{headers:{"user-agent":UA,accept:"application/json"},signal:AbortSignal.timeout(8000)});
    if(!r.ok)return{status:"error",reden:"HTTP "+r.status};
    const d=await r.json();const seen=new Set();const matches=[];
    for(const z of d.zoekresultaat||[]){
      const b=z.basisInfo||{};
      const adres=`${b.straat||""} ${b.huisnummer||""}${b.huisnummerToevoeging||""}, ${b.postcode||""} ${b.plaatsnaam||""}`.replace(/\s+/g," ").replace(/^ ?,/,"").trim();
      const key=strip(b.naam)+"|"+adres;if(seen.has(key))continue;seen.add(key);
      const st=b.contractStatus||"";
      const contract=b.gecontracteerd?"ja":b.inOnderhandeling?"gesprek":/niet/i.test(st)?"nee":"onbekend";
      let tekst=`${st||"onbekend"}${b.soortContractering&&b.gecontracteerd?" ("+b.soortContractering+")":""}, contract 2027`;
      if(b.deelsGecontracteerd)tekst+=", deels gecontracteerd";
      if(typeof b.afstand==="number")tekst+=`, ${(b.afstand/1000).toFixed(1)} km`;
      matches.push({naam:strip(b.naam),adres,contract,tekst});
      if(matches.length>=10)break;
    }
    return{status:"ok",matches}
  }catch(e){return{status:"error",reden:String(e.message||e)}}}
module.exports={concern:"VGZ groep",labels:["VGZ","Univé","IZA"],check};
