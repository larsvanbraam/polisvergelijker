// Lokale dev-server: serveert site/ en /api/contract (zelfde functie als op Vercel)
const http=require("http"),fs=require("fs"),path=require("path");
const root=path.join(__dirname,"site"),types={".html":"text/html; charset=utf-8",".json":"application/json",".js":"text/javascript",".css":"text/css"};
const api=require("./site/api/contract.js");
http.createServer((req,res)=>{const u=new URL(req.url,"http://x");
  if(u.pathname==="/api/contract"){req.query=Object.fromEntries(u.searchParams);res.json=o=>{res.setHeader("content-type","application/json");res.end(JSON.stringify(o))};return api(req,res)}
  let f=path.join(root,u.pathname==="/"?"index.html":u.pathname);
  if(!f.startsWith(root)||!fs.existsSync(f)){res.statusCode=404;return res.end("nope")}
  res.setHeader("content-type",types[path.extname(f)]||"application/octet-stream");fs.createReadStream(f).pipe(res)}).listen(8765,()=>console.log("http://localhost:8765"));
