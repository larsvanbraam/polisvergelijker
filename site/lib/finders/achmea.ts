/**
 * Achmea labels: Zilveren Kruis, Interpolis, FBTO, De Friesland (same Sitecore provider-finder backend, one site per label).
 * Flow (as the finder page itself): GET page -> cookie + __RequestVerificationToken (CSRF),
 * then JSON POSTs to /clientcontroller/zorgzoekerclient/{getautofillzorgtype,getautofilllocatie,getautofillzorginstelling,getzorgaanbieders}.
 */
import type { ContractStatus, Finder, FinderQuery, FinderResult } from './types.js';
import { UA, cookiesOf, errorText, normalizeWords as norm, timeout } from './util.js';

interface Site {
  /** Label name = concern name on the page (CTR_GROUPS in src/concerns.ts). */
  concern: string;
  base: string;
  page: string;
}
/** Every label has its own provider-finder site (same backend), so each is asked separately. */
const SITES: Site[] = [
  { concern: 'Zilveren Kruis', base: 'https://www.zilverenkruis.nl', page: '/consumenten/zorgzoeker' },
  { concern: 'Interpolis', base: 'https://mijnzorg.interpolis.nl', page: '/zorgzoeker' },
  { concern: 'FBTO', base: 'https://mijnzorg.fbto.nl', page: '/zorgzoeker' },
  { concern: 'De Friesland', base: 'https://www.defriesland.nl', page: '/zorgzoeker' },
];
const YEAR = 2027;

interface Session {
  token: string;
  cookie: string;
}
interface Option {
  id: string;
  value: string;
}
interface AchmeaAddress {
  Straat?: string;
  Huisnummer?: string;
  Postcode?: string;
  Plaats?: string;
  Afstand?: string;
}
interface AchmeaProvider {
  Naam: string;
  Adres?: AchmeaAddress;
  Contracten?: { StatusOmschrijving?: string; Toelichting?: string }[];
}

async function session(site: Site): Promise<Session> {
  const r = await fetch(site.base + site.page, {
    headers: { 'user-agent': UA, accept: 'text/html' },
    redirect: 'follow',
    signal: timeout(),
  });
  if (!r.ok) throw new Error('pagina HTTP ' + r.status);
  const html = await r.text();
  const m = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  if (!m) throw new Error('geen verificatietoken gevonden');
  return { token: m[1], cookie: cookiesOf(r) };
}

async function post<T>(site: Site, s: Session, endpoint: string, body: unknown): Promise<T> {
  const r = await fetch(site.base + '/clientcontroller/zorgzoekerclient/' + endpoint, {
    method: 'POST',
    headers: {
      'user-agent': UA,
      'content-type': 'application/json',
      accept: 'application/json',
      __RequestVerificationToken: s.token,
      cookie: s.cookie,
      origin: site.base,
      referer: site.base + site.page,
    },
    body: JSON.stringify(body),
    signal: timeout(),
  });
  if (!r.ok) throw new Error(endpoint + ' HTTP ' + r.status);
  return (await r.json()) as T;
}

function classify(text: string): ContractStatus {
  if (/^Contract\b/i.test(text)) return 'yes';
  if (/nog geen|onderhandel|gesprek/i.test(text)) return 'negotiating';
  if (/^geen contract/i.test(text)) return 'no';
  return 'unknown';
}
const RANK: Record<ContractStatus, number> = { yes: 3, negotiating: 2, no: 1, unknown: 0 };

function contractOf(p: AchmeaProvider): { contract: ContractStatus; text: string } {
  const cs = (p.Contracten || []).filter((c) => c && c.StatusOmschrijving);
  if (!cs.length) return { contract: 'unknown', text: 'Geen contractinformatie' };
  // best status wins: yes > negotiating > no
  let best = cs[0];
  for (const c of cs)
    if (RANK[classify(c.StatusOmschrijving!)] > RANK[classify(best.StatusOmschrijving!)]) best = c;
  const extra =
    best.Toelichting && best.Toelichting !== best.StatusOmschrijving ? ' - ' + best.Toelichting : '';
  return {
    contract: classify(best.StatusOmschrijving!),
    text: best.StatusOmschrijving + extra + ` (jaar ${YEAR})`,
  };
}

const addressText = (a?: AchmeaAddress): string =>
  a
    ? [[a.Straat, a.Huisnummer].filter(Boolean).join(' '), [a.Postcode, a.Plaats].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ')
    : '';

const makeCheck =
  (site: Site) =>
  async ({ name, location, careType }: FinderQuery): Promise<FinderResult> => {
    try {
      const s = await session(site);
      const zt = await post<{ options?: Option[] }>(site, s, 'getautofillzorgtype', {
        ZoekstringZorgtype: careType,
      });
      const opts = zt.options || [];
      // One search term can match several care types (e.g. psychotherapy: KPT and IPT): search all and merge.
      const exact = opts.filter((o) => norm(o.value) === norm(careType));
      const types = (exact.length ? exact : opts).slice(0, 6);
      if (!types.length)
        return { status: 'error', reason: `zorgtype '${careType}' niet gevonden in zorgzoeker` };
      const loc = await post<{ options?: Option[] }>(site, s, 'getautofilllocatie', {
        ZoekstringLocatie: String(location || '').trim(),
      });
      const l = (loc.options || [])[0];
      if (!l) return { status: 'error', reason: `locatie '${location}' niet gevonden in zorgzoeker` };
      const date = new Date(Date.UTC(YEAR, 0, 1)).toISOString();
      const ds = await Promise.all(
        types.map((z) =>
          post<{ IsSucces?: boolean; Resultaten?: AchmeaProvider[] }>(site, s, 'getzorgaanbieders', {
            Zorgtype: z.id,
            LocatieId: l.id,
            Peildatum: date,
          }).catch(() => null),
        ),
      );
      const ok = ds.filter((d) => d && d.IsSucces);
      if (!ok.length) return { status: 'error', reason: 'zorgzoeker meldt fout' };
      const seen = new Set<string>();
      let list: AchmeaProvider[] = [];
      for (const d of ok)
        for (const r of d!.Resultaten || []) {
          const k = norm(r.Naam) + '|' + addressText(r.Adres);
          if (!seen.has(k)) {
            seen.add(k);
            list.push(r);
          }
        }
      const tokens = norm(name).split(' ').filter(Boolean);
      if (tokens.length)
        list = list.filter((r) => {
          const n = norm(r.Naam);
          return tokens.every((t) => n.includes(t));
        });
      const matches = list.slice(0, 10).map((r) => ({
        name: r.Naam,
        address: addressText(r.Adres) + (r.Adres && r.Adres.Afstand ? ` (${r.Adres.Afstand})` : ''),
        ...contractOf(r),
      }));
      return { status: 'ok', matches };
    } catch (e) {
      return { status: 'error', reason: errorText(e) };
    }
  };

export const achmeaFinders: Finder[] = SITES.map((site) => ({
  concern: site.concern,
  labels: [site.concern],
  check: makeCheck(site),
}));
