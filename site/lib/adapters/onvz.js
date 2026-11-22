// ONVZ (onvz.z-zoeker.nl, z-zoeker Nuxt 3). onvz.nl/api/v1/find/suggest is alleen site-zoeksuggesties, niet gebruikt.
const {makeNuxt3}=require("./zzoeker-common");
const check=makeNuxt3({host:"https://onvz.z-zoeker.nl",contractant:"ONVZ"});
module.exports={concern:"ONVZ",labels:["ONVZ"],check};
