// CZ groep: CZ, CZdirect, OHRA, Nationale-Nederlanden, Just
const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const strip=h=>h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g," ").replace(/<[^>]+>/g," ").replace(/&amp;/g,"&").replace(/\s+/g," ");
async function check({naam,postcode,soort="fysiotherapie"}){
  if(!soort)return{status:"error",reden:"zorgsoort '' niet gevonden bij CZ"};
  try{
    const u=`https://zorgvinder.cz.nl/resultaten/${encodeURIComponent(soort)}/${encodeURIComponent(postcode)}?afstand=10&jaar=2027&naam=${encodeURIComponent(naam)}&vergoedbv=ja%2Cinclafsp%2Cnogniet`;
    const r=await fetch(u,{headers:{"user-agent":UA},redirect:"follow",signal:AbortSignal.timeout(8000)});
    if(r.status===404||!soort)return{status:"error",reden:`zorgsoort '${soort}' niet gevonden bij CZ`};
    if(!r.ok)return{status:"error",reden:"HTTP "+r.status};
    const t=strip(await r.text());const i=t.indexOf("Contract 2027 Reviews");
    const body=i<0?t:t.slice(i+21);const matches=[];
    const re=/(\S[^|]*?)\s+(?:0,\d+ km|\d+(?:,\d+)? km) - [^.]*?locatie ([^C]*?)\s*(Contract: vergoed|\(Nog\) geen contract: wel vergoed|Nog geen contract: een deel niet vergoed|Geen contract[^R]*?)(?= Reviews| [A-Z]|$)/g;
    let m;while((m=re.exec(body))&&matches.length<10){
      const s=m[3];matches.push({naam:m[1].trim().split(/\s{1}(?=[A-Z0-9])/).slice(-6).join(" "),adres:m[2].trim(),contract:/^Contract: vergoed/.test(s)?"ja":/Nog\)? geen|\(Nog\)/.test(s)?"gesprek":"nee",tekst:s})}
    return{status:"ok",matches}
  }catch(e){return{status:"error",reden:String(e.message||e)}}}
module.exports={concern:"CZ groep",labels:["CZ","CZdirect","OHRA","Nationale-Nederlanden","Just"],check};
