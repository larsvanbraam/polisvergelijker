/**
 * Eucare / Aevitae: the provider finder is an embed (iframe) of https://zorgzoeker.caresq.nl (Faceit app), API: /api/v4/search.
 * Note: without the uzovi parameter this is the generic Eucare finder (the Aevitae iframe does not pass uzovi either).
 */
import type { Finder, FinderQuery, FinderResult } from './types.js';
import { errorText, getJson, normalize } from './util.js';

const B = 'https://zorgzoeker.caresq.nl';

interface Qualification {
  id: string;
  naam: string;
  alias?: boolean;
}
let qualifications: { t: number; d: Qualification[] } | null = null;

async function qualification(careType: string): Promise<Qualification | null> {
  if (!qualifications || Date.now() - qualifications.t > 3600e3)
    qualifications = {
      t: Date.now(),
      d: (await getJson<{ kwalificaties: Qualification[] }>(B + '/api/v4/meta/zoektermen')).kwalificaties,
    };
  const s = normalize(careType),
    l = qualifications.d;
  return (
    l.find((k) => normalize(k.naam) === s && !k.alias) ||
    l.find((k) => normalize(k.naam) === s) ||
    l.find((k) => normalize(k.naam).includes(s)) ||
    null
  );
}

/** Contract year the finder shows: next year from 12 November on (same rule as the app). */
function targetYear(d = new Date()): number {
  const m = d.getMonth();
  return (m === 10 && d.getDate() >= 12) || m > 10 ? d.getFullYear() + 1 : d.getFullYear();
}

interface EucareProvider {
  naam: string;
  straatnaam?: string;
  huisnummer?: string | number;
  postcode?: string;
  plaats?: string;
  gecontracteerd?: number[];
}

async function check({ name, location, careType }: FinderQuery): Promise<FinderResult> {
  try {
    const k = await qualification(careType);
    if (!k) return { status: 'error', reason: `zorgsoort '${careType}' niet gevonden in Eucare-zorgzoeker` };
    let id = k.id.padStart(8, '0');
    if (id.endsWith('0000')) id = id.slice(0, 4) + '????'; // main group incl. sub-qualifications, like the app
    const pc = String(location || '').trim();
    const loc =
      /^[1-9]\d{3} ?(?!sa|sd|ss)[a-z]{2}$/i.test(pc) || /^[1-9]\d{3}$/.test(pc)
        ? 'postcode=' + pc.replace(' ', '')
        : 'plaats=' + encodeURIComponent(pc);
    const year = targetYear();
    const u = `${B}/api/v4/search?${loc}&kwalificatie=${encodeURIComponent(id)}${name ? '&naam=' + encodeURIComponent(name) : ''}&straal=${name ? 25000 : 10000}&jaar=${year}&count=15`;
    const d = await getJson<{ status?: string; results?: EucareProvider[] }>(u);
    if (d.status && d.status !== 'Ok') return { status: 'error', reason: 'zoeker status ' + d.status };
    const matches = (d.results || []).map((p) => {
      const years = p.gecontracteerd || [];
      const yes = years.includes(year);
      return {
        name: p.naam,
        address: `${p.straatnaam || ''} ${p.huisnummer || ''}, ${p.postcode || ''} ${p.plaats || ''}`
          .replace(/\s+/g, ' ')
          .trim(),
        contract: yes ? ('yes' as const) : ('no' as const),
        text: yes
          ? `Gecontracteerd ${year} (contractjaren: ${years.join(', ')})`
          : `Geen contract ${year}` + (years.length ? ` (wel: ${years.join(', ')})` : ''),
      };
    });
    return { status: 'ok', matches };
  } catch (e) {
    return { status: 'error', reason: errorText(e) };
  }
}

export const eucare: Finder = { concern: 'Eucare', labels: ['Aevitae'], check };
