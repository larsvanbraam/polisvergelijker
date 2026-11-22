// Eucare / Aevitae: zorgzoeker is een embed (iframe) van https://zorgzoeker.caresq.nl (Faceit-app), API: /api/v4/search
// Let op: zonder uzovi-parameter is het de generieke Eucare-zoeker (Aevitae-iframe gebruikt ook geen uzovi).
const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const B="https://zorgzoeker.caresq.nl";
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
let kw=null;
async function get(u){const r=await fetch(u,{headers:{"user-agent":UA},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error("HTTP "+r.status+" "+u.replace(B,""));return r.json()}
async function kwalificatie(soort){
  if(!kw||Date.now()-kw.t>3600e3)kw={t:Date.now(),d:(await get(B+"/api/v4/meta/zoektermen")).kwalificaties};
  const s=norm(soort),l=kw.d;
  return l.find(k=>norm(k.naam)===s&&!k.alias)||l.find(k=>norm(k.naam)===s)||l.find(k=>norm(k.naam).includes(s))||null;
}
function doeljaar(d=new Date()){const m=d.getMonth();return(m===10&&d.getDate()>=12)||m>10?d.getFullYear()+1:d.getFullYear()} // zoals de app zelf
async function check({naam,postcode,soort="fysiotherapie"}){
  try{
    const k=await kwalificatie(soort);
    if(!k)return{status:"error",reden:`zorgsoort '${soort}' niet gevonden in Eucare-zorgzoeker`};
    let id=k.id.padStart(8,"0");if(id.endsWith("0000"))id=id.slice(0,4)+"????"; // hoofdgroep incl. subkwalificaties, zoals de app
    const pc=String(postcode||"").trim();
    const loc=/^[1-9]\d{3} ?(?!sa|sd|ss)[a-z]{2}$/i.test(pc)||/^[1-9]\d{3}$/.test(pc)?"postcode="+pc.replace(" ",""):"plaats="+encodeURIComponent(pc);
    const jaar=doeljaar();
    const u=`${B}/api/v4/search?${loc}&kwalificatie=${encodeURIComponent(id)}${naam?"&naam="+encodeURIComponent(naam):""}&straal=${naam?25000:10000}&jaar=${jaar}&count=15`;
    const d=await get(u);
    if(d.status&&d.status!=="Ok")return{status:"error",reden:"zoeker status "+d.status};
    const matches=(d.results||[]).map(p=>{
      const j=p.gecontracteerd||[];const ja=j.includes(jaar);
      return{naam:p.naam,adres:`${p.straatnaam||""} ${p.huisnummer||""}, ${p.postcode||""} ${p.plaats||""}`.replace(/\s+/g," ").trim(),
        contract:ja?"ja":"nee",tekst:ja?`Gecontracteerd ${jaar} (contractjaren: ${j.join(", ")})`:`Geen contract ${jaar}`+(j.length?` (wel: ${j.join(", ")})`:"")+(p.afstand!=null?"":"")}});
    return{status:"ok",matches}
  }catch(e){return{status:"error",reden:String(e.message||e)}}}
module.exports={concern:"Eucare",labels:["Aevitae"],check};
