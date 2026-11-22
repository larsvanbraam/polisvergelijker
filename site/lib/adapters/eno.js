// Salland / ENO (salland.z-zoeker.nl, z-zoeker classic)
const {makeClassic}=require("./zzoeker-common");
const check=makeClassic({host:"https://salland.z-zoeker.nl",afnemer:"ENO-zz",pakketId:"H231537938",pakketLijst:"voor_advies_2027"});
module.exports={concern:"Salland/ENO",labels:["Salland"],check};
