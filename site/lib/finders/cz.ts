/** CZ group: CZ, CZdirect, OHRA, Nationale-Nederlanden, Just. Reads the server-rendered result page of zorgvinder.cz.nl. */
import type { Finder, FinderMatch, FinderQuery, FinderResult } from './types';
import { UA, errorText, timeout } from './util';

const strip = (h: string): string =>
  h
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

async function check({ name, location, careType }: FinderQuery): Promise<FinderResult> {
  if (!careType) return { status: 'error', reason: "zorgsoort '' niet gevonden bij CZ" };
  try {
    const u = `https://zorgvinder.cz.nl/resultaten/${encodeURIComponent(careType)}/${encodeURIComponent(location)}?afstand=10&jaar=2027&naam=${encodeURIComponent(name)}&vergoedbv=ja%2Cinclafsp%2Cnogniet`;
    const r = await fetch(u, { headers: { 'user-agent': UA }, redirect: 'follow', signal: timeout() });
    if (r.status === 404) return { status: 'error', reason: `zorgsoort '${careType}' niet gevonden bij CZ` };
    if (!r.ok) return { status: 'error', reason: 'HTTP ' + r.status };
    const t = strip(await r.text());
    const i = t.indexOf('Contract 2027 Reviews');
    const body = i < 0 ? t : t.slice(i + 21);
    const matches: FinderMatch[] = [];
    const re =
      /(\S[^|]*?)\s+(?:0,\d+ km|\d+(?:,\d+)? km) - [^.]*?locatie ([^C]*?)\s*(Contract: vergoed|\(Nog\) geen contract: wel vergoed|Nog geen contract: een deel niet vergoed|Geen contract[^R]*?)(?= Reviews| [A-Z]|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) && matches.length < 10) {
      const s = m[3];
      matches.push({
        name: m[1]
          .trim()
          .split(/\s{1}(?=[A-Z0-9])/)
          .slice(-6)
          .join(' '),
        address: m[2].trim(),
        contract: s.startsWith('Contract: vergoed')
          ? 'yes'
          : /Nog\)? geen|\(Nog\)/.test(s)
            ? 'negotiating'
            : 'no',
        text: s,
      });
    }
    return { status: 'ok', matches };
  } catch (e) {
    return { status: 'error', reason: errorText(e) };
  }
}

export const cz: Finder = {
  concern: 'CZ groep',
  labels: ['CZ', 'CZdirect', 'OHRA', 'Nationale-Nederlanden', 'Just'],
  check,
};
