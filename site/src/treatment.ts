import { cardify } from './cards';
import { activePackages, rows } from './data';
import { fnList, fnPremium, fnRec, resetFootnotes, srcUrl } from './footnotes';
import { $, esc, eur, key, more, shortValue, unit, val } from './format';
import { purchaseLine, totalCell } from './links';
import { combo, packageOf } from './pricing';
import { S } from './state';
import type { CoverageRecord } from './types';

/** Tab "behandeling": every package for one treatment, sortable. */
export function renderTreatment(): void {
  resetFootnotes();
  const all = activePackages(),
    rs = rows().filter((r) => r.treatment === S.treatment);
  const byK = new Map(rs.map((r) => [key(r), r]));
  let list: CoverageRecord[] = all.map(
    (p) =>
      byK.get(key(p)) || {
        ...p,
        category: '',
        source_heading: '',
        needs_check: false,
        eur_per_year: null,
        sessions: null,
        eur: null,
        pct: null,
        treatment: S.treatment,
        coverage: 'Niet genoemd in bron',
        covered: false,
        provider: '',
        conditions: '',
        ref: '',
        unknown: true,
      },
  );
  const cov = list.filter((r) => r.covered);
  if (!S.showUncovered) list = cov;
  const k = S.sort.k,
    d = S.sort.d;
  list.sort((a, b) => {
    let x: number | string, y: number | string;
    if (k === 'val') {
      x = val(a) ?? -1;
      y = val(b) ?? -1;
    } else if (k === 'premium') {
      x = combo(packageOf(a)).total ?? 9999;
      y = combo(packageOf(b)).total ?? 9999;
    } else {
      x = (a.label + a.package).toLowerCase();
      y = (b.label + b.package).toLowerCase();
    }
    return (x > y ? 1 : x < y ? -1 : 0) * d;
  });
  const max = Math.max(...cov.map((r) => r.eur_per_year ?? 0), 0),
    maxb = Math.max(...cov.map((r) => r.sessions ?? 0), 0);
  $('#b-title').textContent = S.treatment;
  const top = [...cov].sort((a, b) => (val(b) ?? 0) - (val(a) ?? 0))[0];
  const cheapest = cov
    .map((r) => ({ r, c: combo(packageOf(r)) }))
    .filter((x) => x.c.total != null)
    .sort((a, b) => (a.c.total as number) - (b.c.total as number))[0];
  $('#b-sum').innerHTML = cov.length
    ? `<b>${cov.length} van ${all.length}</b> pakketten vergoeden dit. Hoogste vergoeding: <b>${esc(top.label)} ${esc(top.package)}</b> (${esc(top.coverage)}).` +
      (cheapest
        ? ` Goedkoopste totaal met dekking: <b>${esc(cheapest.c.base?.name)} + ${esc(cheapest.r.package)}</b> voor ${eur(cheapest.c.total)} per maand.`
        : '')
    : 'Geen van de geselecteerde pakketten vergoedt dit.';
  const arrow = (c: string) => (S.sort.k === c ? (S.sort.d > 0 ? ' ↑' : ' ↓') : '');
  const head = `<thead><tr><th><button data-s="name">Pakket${arrow('name')}</button></th><th><button data-s="premium">Totaal p/m${arrow('premium')}</button></th><th><button data-s="val">Vergoeding${arrow('val')}</button></th><th>Zorgverlener en voorwaarden</th><th>Waar in de polis</th></tr></thead>`;
  const body = list
    .map((r) => {
      const w =
        r.eur_per_year != null && max
          ? r.eur_per_year / max
          : r.sessions != null && maxb
            ? r.sessions / maxb
            : null;
      const p = packageOf(r),
        c = combo(p);
      return `<tr class="${r.covered ? '' : 'none'}"><td class="pk"><b>${esc(r.label)}</b><span>${esc(r.package)}</span><div class="buy">Afsluiten: ${purchaseLine(p, c)}</div></td>
    <td class="num">${totalCell(c)}${c.total != null ? fnPremium(p, c) : ''}</td>
    <td>${shortValue(r.coverage)}${r.unknown ? '' : fnRec(r)} ${r.needs_check ? '<span class="pill">controleren</span>' : ''}${w != null ? `<div class="bar" title="${esc(unit(r))}"><i style="width:${Math.max(4, w * 100)}%"></i></div>` : ''}</td>
    <td>${more(r.provider, r.conditions)}</td>
    <td class="src">${r.unknown ? '' : `<a href="${esc(srcUrl(r))}">${esc(r.ref || 'document')}</a>`}</td></tr>`;
    })
    .join('');
  $('#b-table').innerHTML =
    head +
    `<tbody>${body || `<tr><td colspan="5" class="empty">Geen pakketten met dekking bij de huidige filters.</td></tr>`}</tbody>`;
  cardify($<HTMLTableElement>('#b-table'), { main: 0, full: [2, 3], sortable: true });
  $('#b-fn').innerHTML = fnList();
  $('#b-table').onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button[data-s]');
    if (!b) return;
    const s = b.dataset.s!;
    S.sort = { k: s, d: S.sort.k === s ? -S.sort.d : s === 'val' ? -1 : 1 };
    renderTreatment();
  };
}
