/**
 * Zorg en Zekerheid: server-rendered Java app at https://service.zorgenzekerheid.nl/zorgzoeker.
 * Needs a session cookie (GET home.html) + lat/long; the site geocodes via Google Maps, we use the PDOK Locatieserver (free, no key).
 */
import type { ContractStatus, Finder, FinderMatch, FinderQuery, FinderResult } from './types.js';
import { UA, cookiesOf, errorText, normalize, timeout } from './util.js';

const B = 'https://service.zorgenzekerheid.nl/zorgzoeker';

const decode = (s: string): string =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

async function geocode(location: string): Promise<{ lng: string; lat: string; types: string } | null> {
  const isPc = /^[1-9]\d{3} ?[a-z]{2}$/i.test(location);
  const q = isPc ? location.replace(' ', '') : location;
  const u = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?rows=1&fl=centroide_ll,type,weergavenaam&fq=type:${isPc ? 'postcode' : 'woonplaats'}&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { signal: timeout() });
  if (!r.ok) throw new Error('PDOK HTTP ' + r.status);
  const d = ((await r.json()) as { response: { docs: { centroide_ll: string }[] } }).response.docs[0];
  if (!d) return null;
  const m = /POINT\(([\d.]+) ([\d.]+)\)/.exec(d.centroide_ll);
  if (!m) return null;
  return { lng: m[1], lat: m[2], types: isPc ? 'postal_code' : 'locality' };
}

/** The care-type name as the finder's autocomplete knows it. */
async function careTypeName(careType: string, cookie: string): Promise<string | null> {
  try {
    const r = await fetch(`${B}/autocomplete-json.html?term=${encodeURIComponent(careType)}`, {
      headers: { 'user-agent': UA, cookie },
      signal: timeout(),
    });
    const t = ((await r.json()) as { types: { type: string }[] }).types.map((x) => x.type),
      s = normalize(careType);
    return t.find((x) => normalize(x) === s) || t.find((x) => normalize(x).includes(s)) || null;
  } catch {
    return careType;
  }
}

const statusOf = (t: string): ContractStatus =>
  /^Contract: vergoed/i.test(t)
    ? 'yes'
    : /^Geen contract/i.test(t)
      ? 'no'
      : /geen contract/i.test(t)
        ? 'negotiating'
        : 'unknown';

async function check({ name, location, careType }: FinderQuery): Promise<FinderResult> {
  try {
    const g = await geocode(String(location || '').trim());
    if (!g) return { status: 'error', reason: 'postcode/plaats niet gevonden' };
    const h = await fetch(B + '/home.html', { headers: { 'user-agent': UA }, signal: timeout() });
    const cookie = cookiesOf(h);
    const type = await careTypeName(careType, cookie);
    if (!type)
      return { status: 'error', reason: `zorgsoort '${careType}' niet gevonden bij Zorg en Zekerheid` };
    const p = new URLSearchParams({
      zoekveld1: type,
      zoekveldLocatie: String(location),
      zoekveldNaam: name || '',
      longitude: g.lng,
      latitude: g.lat,
      types: g.types,
      formattedaddress: '',
      partialmatch: 'false',
      afstand: name ? 'FOUR' : 'THREE',
      resultatenWeergave: 'Lijst',
      sort: 'afstand',
      aantalResultatenPerPagina: 'VIJFTIG',
    });
    const r = await fetch(B + '/zorgaanbiederzoeken.html', {
      method: 'POST',
      body: p,
      headers: { 'user-agent': UA, cookie, referer: B + '/home.html' },
      signal: timeout(),
    });
    if (!r.ok) return { status: 'error', reason: 'HTTP ' + r.status };
    const html = await r.text();
    if (!/resultaten? gevonden/.test(html))
      return { status: 'error', reason: 'onverwachte respons (geen resultaatkop)' };
    const parts = html.split(/<tr class="[^"]*"[^>]*data-module="ui\/ClickableRow">/).slice(1);
    const matches: FinderMatch[] = [];
    for (const row of parts) {
      const nm = /<h3>([\s\S]*?)<\/h3>/.exec(row);
      if (!nm) continue;
      const adr = /<address>[\s\S]*?<\/h3>([\s\S]*?)<\/address>/.exec(row);
      const lines = adr ? adr[1].split(/<br>/i).map(decode).filter(Boolean) : [];
      const dist = /afstand__value">([^<]*)</.exec(row);
      const years: { year: number; text: string }[] = [];
      const re = /<p>([\s\S]*?)<\/p>[\s\S]*?gecontracteerd__jaar">(\d{4})</g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(row))) years.push({ year: +m[2], text: decode(m[1]) });
      if (!years.length) continue;
      const newest = Math.max(...years.map((j) => j.year));
      const last = years.find((j) => j.year === newest)!; // newest year, first entry
      const unique = [...new Set(years.map((j) => `${j.year}: ${j.text}`))];
      matches.push({
        name: decode(nm[1]),
        address: lines.slice(0, 2).join(', '),
        contract: statusOf(last.text),
        text: unique.join(' | ') + (dist ? ` (${decode(dist[1])})` : ''),
      });
      if (matches.length >= 15) break;
    }
    return { status: 'ok', matches };
  } catch (e) {
    return { status: 'error', reason: errorText(e) };
  }
}

export const zorgenzekerheid: Finder = { concern: 'Zorg en Zekerheid', labels: ['Zorg en Zekerheid'], check };
