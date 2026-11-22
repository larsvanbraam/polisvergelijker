import { cardify } from './cards';
import { CTR_GROUPS, FINDER_CONCERN, FINDER_URL } from './concerns';
import { activePackages } from './data';
import { $, esc } from './format';
import { needDef } from './needlist';
import { renderPlanResult } from './plan';
import { S, saveCtr } from './state';
import type { ContractResponse, ContractStatus, FinderMatch, FinderResult } from '../lib/finders/types';
import type { ContractState, Need } from './types';

type Lookup =
  | { state: 'busy' }
  | { state: 'done'; result: FinderResult }
  | { state: 'failed'; error: string };

/** Lookup results per "<need id>|<concern group>"; kept for the session only. */
const lookups: Record<string, Lookup> = {};

const CONTRACT_STATE: Record<ContractStatus, ContractState> = {
  yes: 'yes',
  no: 'no',
  negotiating: '?',
  unknown: '?',
};
const CONTRACT_TEXT: Record<ContractStatus, string> = {
  yes: 'contract',
  no: 'geen contract',
  negotiating: 'nog in gesprek',
  unknown: 'status onbekend',
};

const finderOf = (group: string): string | null => (group in FINDER_CONCERN ? FINDER_CONCERN[group] : group);

/** Same search = same URL, so the CDN can serve it to everyone: trim, collapse spaces, canonical postcode. */
const canon = (name: string, place: string): { name: string; location: string } => ({
  name: name.trim().replace(/\s+/g, ' '),
  location: place
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(\d{4}) ?([a-zA-Z]{2})$/, (_m, d: string, l: string) => d + l.toUpperCase()),
});

/**
 * One request per finder (concern): each answer is cached on its own at the CDN, shared between visitors,
 * and shows up as soon as it is there.
 */
async function lookUpConcern(
  n: Need,
  concern: string,
  groups: string[],
  base: URLSearchParams,
): Promise<void> {
  const name = S.providers[n.id];
  try {
    const q = new URLSearchParams(base);
    q.set('concerns', concern);
    const res = await fetch('/api/contract?' + q.toString());
    const body = (await res.json()) as Partial<ContractResponse> & { error?: string };
    if (!res.ok || !body.results) throw new Error(body.error || 'HTTP ' + res.status);
    const result = body.results.find((r) => r.concern === concern);
    for (const g of groups) {
      const k = n.id + '|' + g;
      if (!result) {
        lookups[k] = {
          state: 'done',
          result: { status: 'unsupported', reason: 'geen antwoord van deze zorgzoeker' },
        };
        continue;
      }
      lookups[k] = { state: 'done', result };
      if (result.status === 'ok') {
        const best = pickMatch(result.matches, name);
        // Not in the finder = most likely no contract (the name may also be spelled differently there).
        S.contracts[k] = best ? (CONTRACT_STATE[best.contract] ?? '?') : 'no';
      }
    }
    saveCtr();
  } catch (e) {
    for (const g of groups)
      lookups[n.id + '|' + g] = { state: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
  renderCtr();
  renderPlanResult();
}

/** Ask the provider finders of all shown concerns; fills the dropdowns with what they report. */
async function lookUp(n: Need, groups: string[]): Promise<void> {
  const { name, location } = canon(S.providers[n.id], S.places[n.id] || '');
  const base = new URLSearchParams({ name, location, type: n.finderTypes ?? n.treatment.toLowerCase() });
  const byConcern = new Map<string, string[]>();
  for (const g of groups) {
    const k = n.id + '|' + g;
    const concern = finderOf(g);
    if (!concern) {
      lookups[k] = {
        state: 'done',
        result: { status: 'unsupported', reason: 'de zorgzoeker van dit label wordt niet doorzocht' },
      };
      continue;
    }
    lookups[k] = { state: 'busy' };
    byConcern.set(concern, [...(byConcern.get(concern) ?? []), g]);
  }
  renderCtr();
  await Promise.all([...byConcern].map(([concern, gs]) => lookUpConcern(n, concern, gs, base)));
}

const norm = (t: string): string =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const FILLER = new Set(['voor', 'van', 'de', 'het', 'en', 'bv', 'b.v.']);

/**
 * The finders sort on distance, not on name, and match loosely ("Praktijk Oosterhof" also finds
 * "Huisartsenpraktijk Oosterhof & Vernooij"). Only trust a hit whose name is the searched name,
 * starts with it or has all its words as whole words, and that is in the given place; take the closest.
 */
function pickMatch(matches: FinderMatch[], name: string): FinderMatch | undefined {
  const q = norm(name)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const tokens = q.split(' ').filter((t) => t.length > 1 && !FILLER.has(t));
  const rank = (m: FinderMatch): number => {
    const n = norm(m.name)
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
    if (n === q) return 0;
    if (n.startsWith(q + ' ')) return 1;
    const words = new Set(n.split(' '));
    return tokens.length && tokens.every((t) => words.has(t)) ? 2 : 9;
  };
  return matches
    .filter((m) => rank(m) < 9 && !/niet in opgegeven plaats/i.test(m.text))
    .sort((a, b) => rank(a) - rank(b))[0];
}

type Badge = { cls: 'yes' | 'no' | 'unk'; label: string };
const badge = (b: Badge, detail = '', title = ''): string =>
  `<div class="lookup small"${title ? ` title="${esc(title)}"` : ''}><span class="badge ${b.cls}">${esc(b.label)}</span>${detail ? ' ' + detail : ''}</div>`;

function lookupNote(k: string): string {
  const l = lookups[k];
  if (!l) return '';
  if (l.state === 'busy') return '<div class="lookup small">Bezig met opzoeken…</div>';
  if (l.state === 'failed') return badge({ cls: 'unk', label: '? Opzoeken mislukt' }, esc(l.error));
  const r = l.result;
  if (r.status !== 'ok')
    return badge(
      { cls: 'unk', label: '? Zelf checken' },
      'niet automatisch te controleren' + (r.reason ? ': ' + esc(r.reason) : ''),
    );
  const m = r.matches;
  if (!m.length)
    return badge(
      { cls: 'no', label: '✗ Niet gevonden' },
      'waarschijnlijk geen contract; klopt de naam? Zoek zelf via de link',
    );
  const best = pickMatch(m, S.providers[k.split('|')[0]] || '');
  if (!best) {
    const c = m[0];
    return badge(
      { cls: 'no', label: '✗ Niet gevonden' },
      `waarschijnlijk geen contract: geen treffer op deze naam, zoek zelf via de link <span class="muted">(dichtstbij: ${esc(c.name)}${c.address ? ', ' + esc(c.address) : ''})</span>`,
    );
  }
  const b: Badge =
    best.contract === 'yes'
      ? { cls: 'yes', label: '✓ Contract' }
      : best.contract === 'no'
        ? { cls: 'no', label: '✗ Geen contract' }
        : { cls: 'unk', label: '? ' + (CONTRACT_TEXT[best.contract] ?? best.contract) };
  return badge(
    b,
    `<span class="muted">${esc(best.name)}${best.address ? ', ' + esc(best.address) : ''}</span>`,
    best.text,
  );
}

/** Whether the insurers without a contract are shown; the list is folded by default. */
let showRest = false;

/** Table to record, per concern, whether the user's own provider has a contract. */
export function renderCtr(): void {
  const box = $('#plan-ctr');
  if (!box) return;
  const needs = S.chosen.map(needDef).filter((n) => S.providers[n.id]);
  if (!needs.length) {
    box.innerHTML = '';
    return;
  }
  const act = new Set(activePackages().map((p) => p.label));
  const groups = CTR_GROUPS.map((g) => ({ ...g, labels: g.labels.filter((l) => act.has(l)) })).filter(
    (g) => g.labels.length,
  );
  const groupNames = groups.map((g) => g.group);
  const isBusy = (n: Need): boolean => groupNames.some((g) => lookups[n.id + '|' + g]?.state === 'busy');
  let h = `<div class="ctr"><h3>Heeft jouw zorgverlener een contract?</h3><p class="small">Contracten verschillen per verzekeraar en staan niet in de polisvoorwaarden. Vul bij je zorg de postcode of plaats van je zorgverlener in en laat de zorgzoekers van de verzekeraars automatisch nakijken, of zoek zelf via de links (met <i>kopieer</i> zet je de naam op je klembord). Controleer of de gevonden praktijk de jouwe is; je kunt de keuze altijd zelf aanpassen. Elk label heeft zijn eigen contracten en zijn eigen zorgzoeker; automatisch zoeken kan alleen bij de labels waarvan we de zorgzoeker kunnen bevragen. Bij ‘Geen contract’ gebruikt de berekening hieronder de vergoeding zónder contract als die in de polis staat.</p>
  ${needs
    .map((n) => {
      const ok = (S.places[n.id] || '').trim().length >= 2;
      return `<div class="lookup-bar"><button class="btn" data-lookup="${esc(n.id)}"${!ok || isBusy(n) ? ' disabled' : ''}>${isBusy(n) ? 'Bezig…' : 'Zoek automatisch op'}</button><span class="small">${esc(n.label.split(' (')[0])}: <b>${esc(S.providers[n.id])}</b>${ok ? ' in ' + esc(S.places[n.id]) : ' – vul eerst een postcode of plaats in bij de zorg hierboven'}</span></div>`;
    })
    .join('')}
  <table><thead><tr><th>Verzekeraar</th>${needs.map((n) => `<th data-short="${esc(n.label.split(' (')[0])}">${esc(n.label.split(' (')[0])}: ${esc(S.providers[n.id])} <button class="cp" data-cp="${esc(S.providers[n.id])}">kopieer</button></th>`).join('')}</tr></thead><tbody>`;
  // Insurers with a contract (for most providers first) on top; the rest folded. With no contract known yet, show everything.
  const score = (g: { group: string }): number =>
    needs.filter((n) => S.contracts[n.id + '|' + g.group] === 'yes').length;
  const sorted = [...groups].sort((a, b) => score(b) - score(a));
  const withContract = sorted.filter((g) => score(g) > 0).length;
  const fold = withContract > 0 && withContract < sorted.length;
  for (const [i, g] of sorted.entries()) {
    if (fold && i === withContract)
      h += `<tr class="rest-toggle"><td colspan="${needs.length + 1}"><button class="cp" data-rest aria-expanded="${showRest}">${showRest ? '▾ Verberg' : '▸ Toon'} ${sorted.length - withContract} overige verzekeraars (geen contract of nog niet gecheckt)</button></td></tr>`;
    h +=
      `<tr${fold && i >= withContract && !showRest ? ' class="rest-hide"' : ''}><td><b>${esc(g.group)}</b><div class="small">${g.labels.map((l) => (FINDER_URL[l] ? `<a href="${esc(FINDER_URL[l])}" target="_blank" rel="noopener">${esc(l)} ↗</a>` : esc(l))).join(' · ')}</div></td>` +
      needs
        .map((n) => {
          const k = n.id + '|' + g.group,
            v = S.contracts[k] || '?';
          return `<td>${lookupNote(k)}<select data-ctr="${esc(k)}" class="${v === 'yes' ? 'yes' : v === 'no' ? 'no' : ''}" aria-label="Contract ${esc(g.group)} – ${esc(S.providers[n.id])}"><option value="?"${v === '?' ? ' selected' : ''}>Nog niet gecheckt</option><option value="yes"${v === 'yes' ? ' selected' : ''}>Contract</option><option value="no"${v === 'no' ? ' selected' : ''}>Geen contract</option></select></td>`;
        })
        .join('') +
      '</tr>';
  }
  box.innerHTML = h + '</tbody></table></div>';
  cardify(box.querySelector('table'), { main: 0, full: needs.map((_, i) => i + 1) });
  if (matchMedia('(max-width:700px)').matches)
    box
      .querySelector('table')!
      .insertAdjacentHTML(
        'beforebegin',
        `<div class="cps small">${needs.map((n) => `${esc(n.label.split(' (')[0])}: <b>${esc(S.providers[n.id])}</b> <button class="cp" data-cp="${esc(S.providers[n.id])}">kopieer</button>`).join('<br>')}</div>`,
      );
  box.querySelectorAll<HTMLButtonElement>('[data-lookup]').forEach((b) => {
    b.onclick = () => {
      const n = needs.find((x) => x.id === b.dataset.lookup);
      if (n) void lookUp(n, groupNames);
    };
  });
  box.onchange = (e) => {
    const sel = e.target as HTMLSelectElement;
    const k = sel.dataset.ctr;
    if (!k) return;
    S.contracts[k] = sel.value as ContractState;
    sel.className = sel.value === 'yes' ? 'yes' : sel.value === 'no' ? 'no' : '';
    saveCtr();
    renderPlanResult();
  };
  box.onclick = (e) => {
    if ((e.target as HTMLElement).closest('[data-rest]')) {
      showRest = !showRest;
      renderCtr();
      return;
    }
    const c = (e.target as HTMLElement).closest<HTMLElement>('[data-cp]');
    if (!c) return;
    navigator.clipboard
      .writeText(c.dataset.cp ?? '')
      .then(() => {
        c.textContent = 'gekopieerd';
        setTimeout(() => (c.textContent = 'kopieer'), 1200);
      })
      .catch(() => {});
  };
}
