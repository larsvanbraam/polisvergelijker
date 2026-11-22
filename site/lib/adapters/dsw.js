// DSW + Stad Holland (same provider-finder platform as a.s.r., see lib/pw.js)
const {check:pw}=require("./lib/pw");
const cfg={api:"https://content.dsw.nl/api",origin:"https://www.dsw.nl",label:"DSW"};
const check=args=>pw(cfg,args||{});
module.exports={concern:"DSW",labels:["DSW","Stad Holland"],check};
