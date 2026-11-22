/**
 * VGZ, Univé and IZA (same finder API; label in the path: vgz, unive, iza).
 * Endpoint (public, no auth): GET https://api.vgz.nl/zorgzoeker/api/v2/zorgaanbieder/zoekopnaam/<label>/<year>/<name>
 */
import type { ContractStatus, Finder, FinderMatch, FinderQuery, FinderResult } from './types.js';
import { UA, errorText, isPostcode, timeout } from './util.js';

const BASE = 'https://api.vgz.nl/zorgzoeker/api/v2/zorgaanbieder/zoekopnaam';
const strip = (s: string | null | undefined): string =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

interface VgzResult {
  basisInfo?: {
    naam?: string;
    straat?: string;
    huisnummer?: string | number;
    huisnummerToevoeging?: string;
    postcode?: string;
    plaatsnaam?: string;
    contractStatus?: string;
    soortContractering?: string;
    gecontracteerd?: boolean;
    inOnderhandeling?: boolean;
    deelsGecontracteerd?: boolean;
    afstand?: number;
  };
}

const makeCheck =
  (path: string) =>
  async ({ name, location, careType }: FinderQuery): Promise<FinderResult> => {
    try {
      const term = strip(name) || strip(careType);
      if (!term) return { status: 'error', reason: 'geen zoekterm' };
      const p = new URLSearchParams({ sortering: 'AfstandOplopend', skip: '0', take: '15' });
      if (location) {
        if (isPostcode(location)) p.set('postcode', location.replace(/\s/g, '').toUpperCase());
        else p.set('plaats', location.trim());
      }
      const u = `${BASE}/${path}/2027/${encodeURIComponent(term.replace(/\//g, '-'))}?${p.toString()}`;
      const r = await fetch(u, {
        headers: { 'user-agent': UA, accept: 'application/json' },
        signal: timeout(),
      });
      if (!r.ok) return { status: 'error', reason: 'HTTP ' + r.status };
      const d = (await r.json()) as { zoekresultaat?: VgzResult[] };
      const seen = new Set<string>();
      const matches: FinderMatch[] = [];
      for (const z of d.zoekresultaat || []) {
        const b = z.basisInfo || {};
        const address =
          `${b.straat || ''} ${b.huisnummer || ''}${b.huisnummerToevoeging || ''}, ${b.postcode || ''} ${b.plaatsnaam || ''}`
            .replace(/\s+/g, ' ')
            .replace(/^ ?,/, '')
            .trim();
        const key = strip(b.naam) + '|' + address;
        if (seen.has(key)) continue;
        seen.add(key);
        const st = b.contractStatus || '';
        const contract: ContractStatus = b.gecontracteerd
          ? 'yes'
          : b.inOnderhandeling
            ? 'negotiating'
            : /niet/i.test(st)
              ? 'no'
              : 'unknown';
        let text = `${st || 'onbekend'}${b.soortContractering && b.gecontracteerd ? ' (' + b.soortContractering + ')' : ''}, contract 2027`;
        if (b.deelsGecontracteerd) text += ', deels gecontracteerd';
        if (typeof b.afstand === 'number') text += `, ${(b.afstand / 1000).toFixed(1)} km`;
        matches.push({ name: strip(b.naam), address, contract, text });
        if (matches.length >= 10) break;
      }
      return { status: 'ok', matches };
    } catch (e) {
      return { status: 'error', reason: errorText(e) };
    }
  };

/** The finder API has a label in its path and gives different contracts per label. */
export const vgzFinders: Finder[] = [
  { concern: 'VGZ', labels: ['VGZ'], check: makeCheck('vgz') },
  { concern: 'Univé', labels: ['Univé'], check: makeCheck('unive') },
  { concern: 'IZA', labels: ['IZA'], check: makeCheck('iza') },
];
export const vgz = vgzFinders[0];
