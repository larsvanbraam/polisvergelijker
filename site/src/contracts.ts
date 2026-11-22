import { cardify } from './cards';
import { CTR_GROUPS, FINDER_URL } from './concerns';
import { activePackages } from './data';
import { $, esc } from './format';
import { needDef } from './needlist';
import { renderPlanResult } from './plan';
import { S, saveCtr } from './state';
import type { ContractState, Need } from './types';

/** Answer of /api/contract (field names follow the adapter contract, see lib/adapters/README.md). */
interface FinderMatch {
  naam: string;
  adres?: string;
  contract: 'ja' | 'nee' | 'gesprek' | 'onbekend';
  tekst?: string;
}
interface FinderResult {
  concern: string;
  status: 'ok' | 'unsupported' | 'error';
  matches?: FinderMatch[];
  reden?: string;
}
type Lookup =
  | { state: 'busy' }
  | { state: 'done'; result: FinderResult }
  | { state: 'failed'; error: string };

/** Lookup results per "<need id>|<concern group>"; kept for the session only. */
const lookups: Record<string, Lookup> = {};

const CONTRACT_STATE: Record<FinderMatch['contract'], ContractState> = {
  ja: 'yes',
  nee: 'no',
  gesprek: '?',
  onbekend: '?',
};
const CONTRACT_TEXT: Record<FinderMatch['contract'], string> = {
  ja: 'contract',
  nee: 'geen contract',
  gesprek: 'nog in gesprek',
  onbekend: 'status onbekend',
};

/** Ask the provider finders of all shown concerns at once; fills the dropdowns with what they report. */
async function lookUp(n: Need, groups: string[]): Promise<void> {
  const name = S.providers[n.id];
  const place = S.place.trim();
  for (const g of groups) lookups[n.id + '|' + g] = { state: 'busy' };
  renderCtr();
  const q = new URLSearchParams({
    naam: name,
    postcode: place,
    soort: n.finderTypes ?? n.treatment.toLowerCase(),
    concerns: groups.join(','),
  });
  try {
    const res = await fetch('/api/contract?' + q.toString());
    const body = (await res.json()) as { results?: FinderResult[]; error?: string };
    if (!res.ok || !body.results) throw new Error(body.error || 'HTTP ' + res.status);
    for (const g of groups) {
      const result = body.results.find((r) => r.concern === g);
      const k = n.id + '|' + g;
      if (!result) {
        lookups[k] = {
          state: 'done',
          result: { concern: g, status: 'unsupported', reden: 'geen antwoord van deze zorgzoeker' },
        };
        continue;
      }
      lookups[k] = { state: 'done', result };
      const best = result.status === 'ok' ? result.matches?.[0] : undefined;
      if (best) S.contracts[k] = CONTRACT_STATE[best.contract] ?? '?';
    }
    saveCtr();
  } catch (e) {
    for (const g of groups)
      lookups[n.id + '|' + g] = { state: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
  renderCtr();
  renderPlanResult();
}

function lookupNote(k: string): string {
  const l = lookups[k];
  if (!l) return '';
  if (l.state === 'busy') return '<div class="lookup small">Bezig met opzoeken…</div>';
  if (l.state === 'failed') return `<div class="lookup small warn-t">Opzoeken mislukt: ${esc(l.error)}</div>`;
  const r = l.result;
  if (r.status !== 'ok')
    return `<div class="lookup small">Niet automatisch te controleren${r.reden ? ': ' + esc(r.reden) : ''}</div>`;
  const m = r.matches ?? [];
  if (!m.length)
    return '<div class="lookup small">Niet gevonden in de zorgzoeker; controleer de naam of zoek zelf via de link.</div>';
  const best = m[0];
  const more = m.length > 1 ? ` <span class="muted">(+${m.length - 1} andere treffers)</span>` : '';
  return `<div class="lookup small" title="${esc(best.tekst)}">Zorgzoeker: <b>${esc(best.naam)}</b>${best.adres ? ', ' + esc(best.adres) : ''} – ${esc(CONTRACT_TEXT[best.contract] ?? best.contract)}${more}</div>`;
}

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
  const busy = Object.values(lookups).some((l) => l.state === 'busy');
  let h = `<div class="ctr"><h3>Heeft jouw zorgverlener een contract?</h3><p class="small">Contracten verschillen per verzekeraar en staan niet in de polisvoorwaarden. Vul de postcode of plaats van je zorgverlener in en laat de zorgzoekers van de verzekeraars automatisch nakijken, of zoek zelf via de links (met <i>kopieer</i> zet je de naam op je klembord). Controleer of de gevonden praktijk de jouwe is; je kunt de keuze altijd zelf aanpassen. Labels van één concern delen meestal hun contracten; de berekening hieronder gebruikt dan de vergoeding zónder contract als die in de polis staat.</p>
  <div class="lookup-bar"><label for="ctr-place">Postcode of plaats</label><input id="ctr-place" value="${esc(S.place)}" placeholder="bijv. 3511AB of Utrecht" autocomplete="postal-code"><button class="btn" id="ctr-lookup"${busy ? ' disabled' : ''}>${busy ? 'Bezig…' : 'Zoek automatisch op'}</button><span class="small" id="ctr-msg"></span></div>
  <table><thead><tr><th>Verzekeraar</th>${needs.map((n) => `<th data-short="${esc(n.label.split(' (')[0])}">${esc(n.label.split(' (')[0])}: ${esc(S.providers[n.id])} <button class="cp" data-cp="${esc(S.providers[n.id])}">kopieer</button></th>`).join('')}</tr></thead><tbody>`;
  for (const g of groups) {
    h +=
      `<tr><td><b>${esc(g.group)}</b><div class="small">${g.labels.map((l) => (FINDER_URL[l] ? `<a href="${esc(FINDER_URL[l])}" target="_blank" rel="noopener">${esc(l)} ↗</a>` : esc(l))).join(' · ')}</div></td>` +
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
  const placeInput = box.querySelector<HTMLInputElement>('#ctr-place')!;
  placeInput.oninput = () => {
    S.place = placeInput.value;
    saveCtr();
  };
  const run = () => {
    if (S.place.trim().length < 2) {
      $('#ctr-msg').textContent = 'Vul eerst de postcode of plaats van je zorgverlener in.';
      placeInput.focus();
      return;
    }
    void Promise.all(needs.map((n) => lookUp(n, groupNames)));
  };
  box.querySelector<HTMLButtonElement>('#ctr-lookup')!.onclick = run;
  placeInput.onkeydown = (e) => {
    if (e.key === 'Enter') run();
  };
  box.onchange = (e) => {
    const sel = e.target as HTMLSelectElement;
    if (sel.id === 'ctr-place') return;
    const k = sel.dataset.ctr;
    if (!k) return;
    S.contracts[k] = sel.value as ContractState;
    sel.className = sel.value === 'yes' ? 'yes' : sel.value === 'no' ? 'no' : '';
    saveCtr();
    renderPlanResult();
  };
  box.onclick = (e) => {
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
