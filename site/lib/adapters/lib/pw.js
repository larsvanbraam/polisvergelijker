// Gedeelde helper voor het "pw-zorgzoeker" platform (Angular-app + content-BFF) dat zowel DSW/Stad Holland
// (www.dsw.nl, BFF https://content.dsw.nl/api) als a.s.r./VvAA (zorgzoeker.asr.nl, BFF https://content.zorgzoeker.asr.nl/api) gebruikt.
// Endpoints (zonder login/captcha): GET v1/Zorgzoeker/GetZorgsoorten, POST v1/Zorgzoeker/FindZorgpartijen.
const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const STATUS={ // statusCode uit de app-bundle (StatusService.getContractStatus)
  2:["ja","Contract: vergoed"],
  1:["nee","Geen contract: een deel niet vergoed"],
  3:["gesprek","Nog geen contract: een deel niet vergoed"],
  6:["gesprek","(Nog) geen contract: wel vergoed"],
  0:["onbekend","Meerdere zorgsoorten/contracten, zie detailpagina"]};
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\s+/g," ").trim();
const cache={};
async function zorgsoorten(api,origin){
  if(cache[api]&&Date.now()-cache[api].t<3600e3)return cache[api].d;
  const yrs=new Date().getFullYear();
  const q=[yrs,yrs+1].map(y=>"availableYears="+y).join("&");
  const r=await fetch(`${api}/v1/Zorgzoeker/GetZorgsoorten?${q}`,{headers:{"user-agent":UA,origin},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("GetZorgsoorten HTTP "+r.status);
  const d=await r.json();cache[api]={t:Date.now(),d};return d;
}
function kies(lijst,soort){
  const s=norm(soort);
  const naamEq=lijst.find(z=>norm(z.zorgsoortName)===s);
  const synEq=lijst.find(z=>norm(z.synonym)===s);
  const incl=lijst.find(z=>norm(z.zorgsoortName).includes(s))||lijst.find(z=>norm(z.synonym).includes(s));
  return naamEq||synEq||incl||null;
}
async function check({api,origin,label},{naam,postcode,soort="fysiotherapie"}){
  try{
    const lijst=await zorgsoorten(api,origin);
    // Lege zorgsoort = zoeken op alleen naam + plaats (zoals de zorgzoeker zelf zonder zorgsoort doet)
    const z=soort?kies(lijst,soort):{years:lijst.flatMap(x=>x.years||[]),subZorgsoortCode:null};
    if(!z)return{status:"error",reden:`zorgsoort '${soort}' niet gevonden bij ${label}`};
    const jaren=z.years&&z.years.length?z.years:[new Date().getFullYear()];
    const year=Math.max(...jaren);
    const body={zorgsoortCode:soort?(z.subZorgsoortCode??z.mainZorgsoortCode):null,location:String(postcode||"").trim(),radius:naam?25:10,
      zorgpartijName:naam||"",year,isWorkAreaSearch:false,zorgsoortsearchTerm:""};
    const r=await fetch(`${api}/v1/Zorgzoeker/FindZorgpartijen`,{method:"POST",headers:{"user-agent":UA,origin,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
    if(!r.ok)return{status:"error",reden:"FindZorgpartijen HTTP "+r.status};
    const d=await r.json();
    if(d.addressType==="country")return{status:"error",reden:"ongeldige postcode/plaats"};
    const matches=(d.results||[]).slice(0,15).map(p=>{
      const a=p.address||{};const [c,t]=STATUS[p.statusCode]||["onbekend","Onbekende status "+p.statusCode];
      const extra=[p.hasOmzetplafond&&"met omzetplafond",p.hasSpecificMessage&&"met bijzonderheden"].filter(Boolean).join(", ");
      return{naam:p.name,adres:`${a.street||""} ${a.houseNumber||""}${a.houseNumberAddition?"-"+a.houseNumberAddition:""}, ${a.postalCode||""} ${a.city||""}`.replace(/\s+/g," ").trim(),
        contract:c,tekst:`${t} (${year}${p.distance?`, ${p.distance} km`:""}${extra?`, ${extra}`:""})`};});
    return{status:"ok",matches};
  }catch(e){return{status:"error",reden:String(e.message||e)}}}
module.exports={check};
