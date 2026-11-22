// Gedeelde helper voor "z-zoeker"-zorgzoekers (Menzis, Salland/ENO, ONVZ).
// Twee varianten van dezelfde software:
//  - classic (Nuxt 2): Menzis + Salland. POST <host>/api/zadvies/<afnemer>/zorginkoop/zorgaanbieders
//  - nuxt3: ONVZ. GET <host>/api/zoektermen + /api/zorgaanbieders (contractantCode verplicht)
const UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const PC=/^\d{4}\s?[A-Za-z]{2}$/;
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();

async function jget(url,opt={}){
  const r=await fetch(url,{headers:{"user-agent":UA,accept:"application/json",...(opt.headers||{})},method:opt.method||"GET",body:opt.body,signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error("HTTP "+r.status+" "+url.split("?")[0]);
  return r.json();
}
// Zoekvarianten voor een naam: volledig, daarna steeds minder woorden (de zoekterm-API matcht op woordprefixen).
function variants(naam){
  const w=String(naam||"").trim().split(/\s+/).filter(Boolean);const out=[];
  for(let n=w.length;n>=1&&out.length<3;n--)out.push(w.slice(0,n).join(" "));
  const longest=[...w].sort((a,b)=>b.length-a.length)[0];if(longest&&!out.includes(longest))out.push(longest);
  return out;
}
// Houd namen waarvan alle woorden uit de zoekopdracht voorkomen vooraan.
function rank(matches,naam){
  const q=norm(naam).split(" ").filter(Boolean);
  const score=m=>q.filter(t=>norm(m.naam).includes(t)).length;
  return matches.map((m,i)=>[m,i]).sort((a,b)=>score(b[0])-score(a[0])||a[1]-b[1]).map(x=>x[0]);
}
function mapStatus(st){
  switch(st){
    case "GECONTRACTEERD":return["ja","Gecontracteerd"];
    case "DEELS_GECONTRACTEERD":return["ja","Deels gecontracteerd (deel van de zorg niet vergoed/afspraken beperkt)"];
    case "IN_ONDERHANDELING":return["gesprek","In onderhandeling"];
    case "GEEN_CONTRACT_VERGOED_TIJDENS_ONDERHANDELING":return["gesprek","Geen contract (nog), wordt vergoed tijdens onderhandeling"];
    case "GEEN_CONTRACT_WEL_VERGOED":return["gesprek","Geen contract, maar wel vergoed (let op eventueel lagere vergoeding)"];
    case "NIET_GECONTRACTEERD":return["nee","Niet gecontracteerd"];
    default:return["onbekend",st?"Status: "+st:"Geen contractstatus"];
  }
}
const adres=a=>[[a.straat,a.huisnummer,a.huisletter,a.toevoeging].filter(Boolean).join(" "),a.postcode,a.plaats].filter(Boolean).join(", ");
function wrap(fn){return async args=>{try{
  if(!args||!args.naam)return{status:"error",reden:"naam ontbreekt"};
  return await fn(args)}catch(e){return{status:"error",reden:String(e.message||e)}}}}

// ---------- classic (Menzis, Salland) ----------
function makeClassic(cfg){ // {host, afnemer, pakketId, pakketLijst, jaar}
  const base=`${cfg.host}/api/zadvies/${cfg.afnemer}/zorginkoop`;
  return wrap(async({naam,postcode,soort})=>{
    const loc={};let km=20;
    const p=String(postcode||"").trim();
    if(PC.test(p))loc.postcode=p.replace(/\s/g,"").toUpperCase();
    else if(p){
      const w=await jget(`${base}/woonplaatsen?zoekterm=${encodeURIComponent(p)}`);
      const hit=(w||[]).find(x=>norm(x.woonplaats)===norm(p))||(w||[])[0];
      if(!hit)return{status:"error",reden:"plaats niet gevonden: "+p};
      loc.woonplaatsId=hit.id;
    }
    let specIds;
    if(soort){
      try{
        const z=await jget(`${base}/zoektermenPerType?zoekterm=${encodeURIComponent(soort)}&zoektermTypes=SPECIALISME&aantal=5`);
        const s=(z.SPECIALISME||[]).find(x=>norm(x.zoekWaarde)===norm(soort));
        if(s&&s.referentieId)specIds=[s.referentieId];
      }catch(e){}
    }
    const search=async(naamQ,spec)=>{
      const body={zorgaanbieder:{type:"",naam:naamQ},locatiebepaling:{...loc,afstandKm:km},
        paginaEnSortering:{offset:0,aantal:10,sortering:"AFSTAND"},pakketIds:[cfg.pakketId],pakketLijst:cfg.pakketLijst};
      if(spec)body.specialismeIds=spec;
      return jget(`${base}/zorgaanbieders`,{method:"POST",body:JSON.stringify(body),headers:{"content-type":"application/json"}});
    };
    let res=[];
    for(const v of variants(naam)){
      let d=await search(v,specIds);
      if(!(d.zorgaanbieders||[]).length&&specIds)d=await search(v,undefined);
      res=d.zorgaanbieders||[];if(res.length)break;
    }
    const matches=rank(res.map(z=>{
      const pk=(z.pakketten||[]).slice().sort((a,b)=>(b.jaar||0)-(a.jaar||0))[0]||{};
      const [c,t]=mapStatus(pk.contractStatus);
      return{naam:z.naam,adres:adres(z),contract:c,tekst:`${t}${pk.jaar?" ("+pk.jaar+")":""}${z.afstand!=null?", "+z.afstand+" km":""}`};
    }),naam);
    return{status:"ok",matches};
  });
}

// ---------- nuxt3 (ONVZ) ----------
function makeNuxt3(cfg){ // {host, contractant}
  return wrap(async({naam,postcode,soort})=>{
    const p=String(postcode||"").trim();
    // 1) naam -> zoektermcodes (zorgaanbieder/vestiging)
    let codes=[];
    for(const v of variants(naam)){
      const z=await jget(`${cfg.host}/api/zoektermen?zoekterm=${encodeURIComponent(v)}&aantal=30&taal=NL`);
      codes=[];
      for(const g of z||[])if(["VESTIGING","ZORGAANBIEDER"].includes(g.zoektermType))
        for(const t of g.zoektermen||[])codes.push(t.code);
      if(codes.length)break;
    }
    if(!codes.length)return{status:"ok",matches:[]};
    // 2) per code de aanbieders ophalen (geen afstand -> alle vestigingen), daarna op plaats/postcode filteren
    const seen=new Map();
    for(const code of codes.slice(0,6)){
      const d=await jget(`${cfg.host}/api/zorgaanbieders?zoektermCode=${encodeURIComponent(code)}&afstand=-1&sortering=AFSTAND&offset=0&contractantCode=${cfg.contractant}`);
      for(const z of d.resultaten||[])if(!seen.has(z.zorgwebId))seen.set(z.zorgwebId,z);
    }
    let all=[...seen.values()];
    let buiten=false;
    if(p){
      let plaats=p;
      if(PC.test(p)){ // postcode -> plaatsnaam
        try{const l=await jget(`${cfg.host}/api/locaties?zoekterm=${encodeURIComponent(p.replace(/\s/g,""))}&taal=NL`);
          if(l&&l[0])plaats=l[0].plaatsnaam}catch(e){}
      }
      const pc=PC.test(p)?p.replace(/\s/g,"").toUpperCase():null;
      const local=all.filter(z=>{const a=z.adres||{};
        return norm(a.plaats)===norm(plaats)||(pc&&String(a.postcode||"").startsWith(pc.slice(0,4)))});
      if(local.length)all=local;else buiten=true;
    }
    const matches=rank(all.map(z=>{
      const cs=(z.contracten||[]).filter(c=>c.contractant===cfg.contractant).sort((a,b)=>b.jaar-a.jaar);
      const c0=cs[0]||{};
      let st=c0.contractStatus;
      if(soort){const sp=(c0.specialismen||[]).find(s=>norm(s.omschrijving)===norm(soort));if(sp)st=sp.contractStatus}
      const [c,t]=mapStatus(st);
      return{naam:z.naam,adres:adres(z.adres||{}),contract:c,tekst:`${t}${c0.jaar?" ("+c0.jaar+")":""}${z.afstand!=null?", "+z.afstand+" km":""}${buiten?" (let op: niet in opgegeven plaats)":""}`};
    }),naam).slice(0,10);
    return{status:"ok",matches};
  });
}
module.exports={makeClassic,makeNuxt3,mapStatus};
