import { D, activePackages, rows } from './data';
import { $, esc } from './format';
import { renderNeeds } from './needs';
import { S } from './state';
import { renderTreatment } from './treatment';

type Counts = { n: number; c: number };

/** Per category: treatment -> number of rows and number of packages that cover it. */
export function treatmentIndex(): Map<string, Map<string, Counts>> {
  const rs = rows(),
    m = new Map<string, Map<string, Counts>>();
  for (const g of D.categories) m.set(g, new Map());
  for (const r of rs) {
    const g = m.get(r.category) || m.set(r.category, new Map()).get(r.category)!;
    const o = g.get(r.treatment) || { n: 0, c: 0 };
    o.n++;
    if (r.covered) o.c++;
    g.set(r.treatment, o);
  }
  return m;
}
/** Treatment list in the sidebar of the 'behandeling' and 'behoefte' tabs. */
export function renderList(): void {
  const q = ($<HTMLInputElement>('#q').value || '').toLowerCase(),
    idx = treatmentIndex(),
    np = activePackages().length;
  let h = '',
    hn = '';
  for (const [g, m] of idx) {
    const items = [...m]
      .filter(([b]) => b.toLowerCase().includes(q))
      .sort((a, b) => b[1].c - a[1].c || a[0].localeCompare(b[0]));
    if (!items.length) continue;
    h +=
      `<div class="grp">${esc(g)}</div>` +
      items
        .map(
          ([b, o]) =>
            `<button class="treat" data-b="${esc(b)}" aria-current="${b === S.treatment}"><span>${esc(b)}</span><span class="c">${o.c}/${np}</span></button>`,
        )
        .join('');
    hn +=
      `<div class="grp">${esc(g)}</div>` +
      items
        .map(
          ([b, o]) =>
            `<label class="treat" for="n-${esc(b)}"><span><input type="checkbox" id="n-${esc(b)}" data-b="${esc(b)}" ${S.need.has(b) ? 'checked' : ''}>${esc(b)}</span><span class="c">${o.c}</span></label>`,
        )
        .join('');
  }
  $('#treatment-list').innerHTML = h || '<p class="empty">Geen behandeling gevonden.</p>';
  $('#treatment-list').onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.treat');
    if (b) {
      S.treatment = b.dataset.b!;
      renderList();
      renderTreatment();
    }
  };
  $('#n-list').innerHTML = hn;
  $('#n-list').onchange = (e) => {
    const b = (e.target as HTMLInputElement).dataset.b;
    if (!b) return;
    if ((e.target as HTMLInputElement).checked) S.need.add(b);
    else S.need.delete(b);
    renderNeeds();
  };
}
