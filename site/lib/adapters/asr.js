// a.s.r. + VvAA (same provider-finder platform as DSW, see lib/pw.js)
const {check:pw}=require("./lib/pw");
const cfg={api:"https://content.zorgzoeker.asr.nl/api",origin:"https://zorgzoeker.asr.nl",label:"a.s.r."};
const check=args=>pw(cfg,args||{});
module.exports={concern:"a.s.r.",labels:["a.s.r.","VvAA"],check};
