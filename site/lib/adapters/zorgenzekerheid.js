// Zorg en Zekerheid: server-gerenderde Java-app op https://service.zorgenzekerheid.nl/zorgzoeker
// Vereist sessiecookie (GET home.html) + lat/long; de site geocodeert zelf via Google Maps, wij gebruiken PDOK Locatieserver (gratis, geen sleutel).
const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const B="https://service.zorgenzekerheid.nl/zorgzoeker";
const sig=()=>AbortSignal.timeout(8000);
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const dec=s=>s.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
async function geocode(loc){
  const isPc=/^[1-9]\d{3} ?[a-z]{2}$/i.test(loc);
  const q=isPc?loc.replace(" ",""):loc;
  const u=`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fl=centroide_ll,type,weergavenaam&fq=type:${isPc?"postcode":"woonplaats"}&q=${encodeURIComponent(q)}`;
  const r=await fetch(u,{signal:sig()});if(!r.ok)throw new Error("PDOK HTTP "+r.status);
  const d=(await r.json()).response.docs[0];if(!d)return null;
  const m=/POINT\(([\d.]+) ([\d.]+)\)/.exec(d.centroide_ll);if(!m)return null;
  return{lng:m[1],lat:m[2],types:isPc?"postal_code":"locality",naam:d.weergavenaam};
}
async function soortNaam(soort,cookie){
  try{const r=await fetch(`${B}/autocomplete-json.html?term=${encodeURIComponent(soort)}`,{headers:{"user-agent":UA,cookie},signal:sig()});
    const t=(await r.json()).types.map(x=>x.type),s=norm(soort);
    return t.find(x=>norm(x)===s)||t.find(x=>norm(x).includes(s))||null}catch{return soort}
}
const STAT=t=>/^Contract: vergoed/i.test(t)?"ja":/^Geen contract/i.test(t)?"nee":/geen contract/i.test(t)?"gesprek":"onbekend";
async function check({naam,postcode,soort="fysiotherapie"}){
  try{
    const g=await geocode(String(postcode||"").trim());
    if(!g)return{status:"error",reden:"postcode/plaats niet gevonden"};
    const h=await fetch(B+"/home.html",{headers:{"user-agent":UA},signal:sig()});
    const cookie=(h.headers.getSetCookie?h.headers.getSetCookie():[]).map(c=>c.split(";")[0]).join("; ");
    const zs=await soortNaam(soort,cookie);
    if(!zs)return{status:"error",reden:`zorgsoort '${soort}' niet gevonden bij Zorg en Zekerheid`};
    const p=new URLSearchParams({zoekveld1:zs,zoekveldLocatie:String(postcode),zoekveldNaam:naam||"",longitude:g.lng,latitude:g.lat,types:g.types,formattedaddress:"",partialmatch:"false",afstand:naam?"FOUR":"THREE",resultatenWeergave:"Lijst",sort:"afstand",aantalResultatenPerPagina:"VIJFTIG"});
    const r=await fetch(B+"/zorgaanbiederzoeken.html",{method:"POST",body:p,headers:{"user-agent":UA,cookie,referer:B+"/home.html"},signal:sig()});
    if(!r.ok)return{status:"error",reden:"HTTP "+r.status};
    const html=await r.text();
    if(!/resultaten? gevonden/.test(html))return{status:"error",reden:"onverwachte respons (geen resultaatkop)"};
    const parts=html.split(/<tr class="[^"]*"[^>]*data-module="ui\/ClickableRow">/).slice(1);
    const matches=[];
    for(const row of parts){
      const nm=/<h3>([\s\S]*?)<\/h3>/.exec(row);if(!nm)continue;
      const adr=/<address>[\s\S]*?<\/h3>([\s\S]*?)<\/address>/.exec(row);
      const lines=adr?adr[1].split(/<br>/i).map(dec).filter(Boolean):[];
      const afst=/afstand__value">([^<]*)</.exec(row);
      const jaren=[];const re=/<p>([\s\S]*?)<\/p>[\s\S]*?gecontracteerd__jaar">(\d{4})</g;let m;
      while((m=re.exec(row)))jaren.push({jaar:+m[2],tekst:dec(m[1])});
      if(!jaren.length)continue;
      const mx=Math.max(...jaren.map(j=>j.jaar));const last=jaren.find(j=>j.jaar===mx); // nieuwste jaar, eerste vermelding
      const uniek=[...new Set(jaren.map(j=>`${j.jaar}: ${j.tekst}`))];
      matches.push({naam:dec(nm[1]),adres:lines.slice(0,2).join(", "),contract:STAT(last.tekst),
        tekst:uniek.join(" | ")+(afst?` (${dec(afst[1])})`:"")});
      if(matches.length>=15)break;
    }
    return{status:"ok",matches}
  }catch(e){return{status:"error",reden:String(e.message||e)}}}
module.exports={concern:"Zorg en Zekerheid",labels:["Zorg en Zekerheid"],check};
