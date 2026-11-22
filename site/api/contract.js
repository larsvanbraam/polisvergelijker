// GET /api/contract?naam=Fysio+Jansen&postcode=3511AB&soort=fysiotherapie[&concerns=CZ+groep,VGZ]
// Asks each concern's provider finder whether the provider has a contract and returns everything in one response.
// Static require paths so Vercel bundles the adapters into the function (only api/*.js are functions).
const CONCERN = { cz: "CZ groep", vgz: "VGZ", achmea: "Achmea", menzis: "Menzis", onvz: "ONVZ", eno: "ENO", dsw: "DSW", asr: "a.s.r.", zorgenzekerheid: "Zorg en Zekerheid", eucare: "Eucare" };
const loaders = {
  cz: () => require("../lib/adapters/cz.js"), vgz: () => require("../lib/adapters/vgz.js"), achmea: () => require("../lib/adapters/achmea.js"),
  menzis: () => require("../lib/adapters/menzis.js"), onvz: () => require("../lib/adapters/onvz.js"), eno: () => require("../lib/adapters/eno.js"),
  dsw: () => require("../lib/adapters/dsw.js"), asr: () => require("../lib/adapters/asr.js"),
  zorgenzekerheid: () => require("../lib/adapters/zorgenzekerheid.js"), eucare: () => require("../lib/adapters/eucare.js"),
};
const adapters = [];
for (const [n, load] of Object.entries(loaders)) {
  try { adapters.push({ ...load(), concern: CONCERN[n] }); } catch (e) { /* adapter not available */ }
}

const clean = (s, max) => String(s || "").replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, max);

module.exports = async (req, res) => {
  const q = req.query || Object.fromEntries(new URL(req.url, "http://x").searchParams);
  const naam = clean(q.naam, 80), postcode = clean(q.postcode, 40).replace(/^(\d{4})\s*([a-zA-Z]{2})$/, (m, d, l) => d + l.toUpperCase()), soorten = String(q.soort || "fysiotherapie").split(",").map(x => clean(x, 60)).filter(Boolean).slice(0, 5), soort = soorten[0];
  if (naam.length < 2 || postcode.length < 2) {
    res.statusCode = 400;
    return res.json({ error: "naam en postcode zijn verplicht" });
  }
  const only = q.concerns ? new Set(String(q.concerns).split(",").map(s => s.trim())) : null;
  const todo = adapters.filter(a => !only || only.has(a.concern));
  const results = await Promise.all(todo.map(async a => {
    const call = async (nm, sd) => { try { return await a.check({ naam: nm, postcode, soort: sd }); } catch (e) { return { status: "error", reden: String(e && e.message || e) }; } };
    // 1. Every finder has its own care-type names: try them in order until the finder knows one.
    let r = null;
    // (Also on 0 hits: another care type may still know the practice. At most ~6 s per insurer.)
    const t0 = Date.now(); let beste = null;
    for (const sd of soorten) {
      const x = await call(naam, sd);
      if (x.status === "ok") { beste = x; if (x.matches && x.matches.length) break; }
      else if (!beste) beste = x;
      if (Date.now() - t0 > 6000) break;
    }
    r = beste;
    // 2. If the finder knows none of the care types: search on name + place only.
    if (r.status !== "ok") { const x = await call(naam, ""); if (x.status === "ok") r = x; }
    // 3. No hits? Retry once with a shorter name (without filler words); some finders match on part of the name.
    if (r.status === "ok" && !(r.matches && r.matches.length)) {
      const stop = new Set(["voor", "van", "de", "het", "en", "bv", "b.v."]);
      const kort = naam.split(/\s+/).filter(x => x && !stop.has(x.toLowerCase())).join(" ");
      if (kort && kort !== naam) { const x = await call(kort, ""); if (x.status === "ok" && x.matches && x.matches.length) r = x; }
    }
    return { concern: a.concern, labels: a.labels, ...r };
  }));
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = 200;
  res.end(JSON.stringify({ naam, postcode, soort, results }));
};
