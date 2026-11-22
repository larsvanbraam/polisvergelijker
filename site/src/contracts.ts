import { cardify } from './cards';
import { CTR_GROUPS, FINDER_URL } from './concerns';
import { activePackages } from './data';
import { $, esc } from './format';
import { needDef } from './needlist';
import { renderPlanResult } from './plan';
import { S, saveCtr } from './state';
import type { ContractState } from './types';

/** Table to record, per concern, whether the user's own provider has a contract. */
export function renderCtr() {
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
  let h = `<div class="ctr"><h3>Heeft jouw zorgverlener een contract?</h3><p class="small">Contracten verschillen per verzekeraar en staan niet in de polisvoorwaarden. Zoek je zorgverlener op via de link (met <i>kopieer</i> zet je de naam op je klembord) en kies wat de zorgzoeker zegt. Labels van één concern delen meestal hun contracten; de berekening hieronder gebruikt dan de vergoeding zónder contract als die in de polis staat.</p>
  <table><thead><tr><th>Verzekeraar</th>${needs.map((n) => `<th data-short="${esc(n.label.split(' (')[0])}">${esc(n.label.split(' (')[0])}: ${esc(S.providers[n.id])} <button class="cp" data-cp="${esc(S.providers[n.id])}">kopieer</button></th>`).join('')}</tr></thead><tbody>`;
  for (const g of groups) {
    h +=
      `<tr><td><b>${esc(g.group)}</b><div class="small">${g.labels.map((l) => (FINDER_URL[l] ? `<a href="${esc(FINDER_URL[l])}" target="_blank" rel="noopener">${esc(l)} ↗</a>` : esc(l))).join(' · ')}</div></td>` +
      needs
        .map((n) => {
          const k = n.id + '|' + g.group,
            v = S.contracts[k] || '?';
          return `<td><select data-ctr="${esc(k)}" class="${v === 'yes' ? 'yes' : v === 'no' ? 'no' : ''}" aria-label="Contract ${esc(g.group)} – ${esc(S.providers[n.id])}"><option value="?"${v === '?' ? ' selected' : ''}>Nog niet gecheckt</option><option value="yes"${v === 'yes' ? ' selected' : ''}>Contract</option><option value="no"${v === 'no' ? ' selected' : ''}>Geen contract</option></select></td>`;
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
