import { activePackages, rows } from './data';
import { fnList, fnPremium, fnRec, resetFootnotes } from './footnotes';
import { $, esc, eur, key, more, shortValue, val } from './format';
import { purchaseLine } from './links';
import { cellMap, combo } from './pricing';
import { treatmentIndex } from './sidebar';
import { S } from './state';
import type { Package } from './types';

/** Tab "pakketten": 2 to 5 packages side by side. */
export function renderPackages(): void {
  resetFootnotes();
  const all = activePackages();
  S.pick = S.pick.filter((k) => all.some((p) => key(p) === k));
  $('#p-pick').innerHTML = all
    .map(
      (p) =>
        `<button class="chip" data-k="${esc(key(p))}" aria-pressed="${S.pick.includes(key(p))}">${esc(p.label)} ${esc(p.package)}${combo(p).total != null ? `<span class="n">${eur(combo(p).total)}</span>` : ''}</button>`,
    )
    .join('');
  $('#p-pick').onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!b) return;
    const k = b.dataset.k!;
    if (S.pick.includes(k)) S.pick = S.pick.filter((x) => x !== k);
    else if (S.pick.length < 5) S.pick.push(k);
    renderPackages();
  };
  const sel = S.pick.map((k) => all.find((p) => key(p) === k)).filter((p): p is Package => !!p);
  if (sel.length < 2) {
    $('#p-table').innerHTML = `<tbody><tr><td class="empty">Kies minstens twee pakketten.</td></tr></tbody>`;
    return;
  }
  const cell = cellMap(rows());
  let h = `<thead><tr><th>Behandeling</th>${sel
    .map((p) => {
      const c = combo(p);
      return `<th>${esc(p.label)}<br>${esc(p.package)}<br><span class="mono">${c.total != null ? eur(c.total) + ' totaal p/m' : 'totaal n.b.'}</span>${c.total != null ? fnPremium(p, c) : ''}</th>`;
    })
    .join('')}</tr></thead><tbody>
  <tr><td class="rh">Afsluiten</td>${sel.map((p) => `<td class="small">${purchaseLine(p, combo(p))}</td>`).join('')}</tr>`;
  const idx = treatmentIndex();
  for (const [g, m] of idx) {
    let gh = '';
    for (const b of [...m.keys()].sort()) {
      const cs = sel.map((p) => cell.get(key(p) + '|' + b));
      if (cs.every((c) => !c || !c.covered)) continue;
      const txt = cs.map((c) => (c && c.covered ? c.coverage : ''));
      if (S.diff && new Set(txt).size === 1) continue;
      const vs = cs.map((c) => (c && c.covered ? (val(c) ?? 0) : -1)),
        mx = Math.max(...vs),
        uniq = vs.filter((v) => v === mx).length === 1;
      gh += `<tr><td class="rh">${esc(b)}</td>${cs.map((c, i) => (c && c.covered ? `<td class="${uniq && vs[i] === mx ? 'best' : ''}">${shortValue(c.coverage)}${fnRec(c)} ${c.needs_check ? '<span class="pill">controleren</span>' : ''}${c.provider ? more(c.provider, '') : ''}</td>` : `<td class="small" style="color:var(--none)">${c ? 'Geen dekking' : 'Niet genoemd'}</td>`)).join('')}</tr>`;
    }
    if (gh) h += `<tr class="g"><td colspan="${sel.length + 1}">${esc(g)}</td></tr>` + gh;
  }
  $('#p-table').innerHTML = h + '</tbody>';
  $('#p-fn').innerHTML = fnList();
}
