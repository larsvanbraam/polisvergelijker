/**
 * GET /api/contract?name=Fysio+Jansen&location=3511AB&type=fysiotherapie,oefentherapie[&concerns=CZ+groep,VGZ]
 * Asks each concern's provider finder whether the provider has a contract and returns everything in one response.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { FINDERS } from '../lib/finders/index';
import type { ConcernResult, ContractResponse, Finder, FinderResult } from '../lib/finders/types';

const clean = (s: string | string[] | undefined, max: number): string =>
  (Array.isArray(s) ? (s[0] ?? '') : (s ?? ''))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .trim()
    .slice(0, max);

const FILLER = new Set(['voor', 'van', 'de', 'het', 'en', 'bv', 'b.v.']);

async function lookUp(
  f: Finder,
  name: string,
  location: string,
  careTypes: string[],
): Promise<ConcernResult> {
  const call = async (n: string, careType: string): Promise<FinderResult> => {
    try {
      return await f.check({ name: n, location, careType });
    } catch (e) {
      return { status: 'error', reason: e instanceof Error ? e.message : String(e) };
    }
  };
  // 1. Every finder has its own care-type names: try them in order until the finder knows one.
  //    (Also on 0 hits: another care type may still know the practice. At most ~6 s per insurer.)
  const t0 = Date.now();
  let r: FinderResult | null = null;
  for (const careType of careTypes) {
    const x = await call(name, careType);
    if (x.status === 'ok') {
      r = x;
      if (x.matches.length) break;
    } else if (!r) r = x;
    if (Date.now() - t0 > 6000) break;
  }
  if (!r) r = await call(name, '');
  // 2. If the finder knows none of the care types: search on name + place only.
  if (r.status !== 'ok') {
    const x = await call(name, '');
    if (x.status === 'ok') r = x;
  }
  // 3. No hits? Retry once with a shorter name (without filler words); some finders match on part of the name.
  if (r.status === 'ok' && !r.matches.length) {
    const short = name
      .split(/\s+/)
      .filter((x) => x && !FILLER.has(x.toLowerCase()))
      .join(' ');
    if (short && short !== name) {
      const x = await call(short, '');
      if (x.status === 'ok' && x.matches.length) r = x;
    }
  }
  return { concern: f.concern, labels: f.labels, ...r };
}

type Query = Record<string, string | string[] | undefined>;

export default async function handler(
  req: IncomingMessage & { query?: Query },
  res: ServerResponse,
): Promise<void> {
  const q: Query = req.query || Object.fromEntries(new URL(req.url ?? '', 'http://x').searchParams);
  const name = clean(q.name, 80);
  const location = clean(q.location, 40).replace(
    /^(\d{4})\s*([a-zA-Z]{2})$/,
    (_m, d: string, l: string) => d + l.toUpperCase(),
  );
  const careTypes = (clean(q.type, 400) || 'fysiotherapie')
    .split(',')
    .map((x) => clean(x, 60))
    .filter(Boolean)
    .slice(0, 5);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (name.length < 2 || location.length < 2) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: 'naam en postcode zijn verplicht' }));
    return;
  }
  const concerns = clean(q.concerns, 400);
  const only = concerns ? new Set(concerns.split(',').map((s) => s.trim())) : null;
  const results = await Promise.all(
    FINDERS.filter((f) => !only || only.has(f.concern)).map((f) => lookUp(f, name, location, careTypes)),
  );
  const body: ContractResponse = { name, location, careType: careTypes[0], results };
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  res.statusCode = 200;
  res.end(JSON.stringify(body));
}
