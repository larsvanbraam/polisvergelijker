// Menzis (zorgvinder.menzis.nl, z-zoeker classic)
const {makeClassic}=require("./zzoeker-common");
const check=makeClassic({host:"https://zorgvinder.menzis.nl",afnemer:"MENZIS_ZZ",pakketId:"H231538222",pakketLijst:"voor_advies_2027"});
module.exports={concern:"Menzis",labels:["Menzis"],check};
