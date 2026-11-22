import { activePackages, rows } from './data';
import { fnList, fnPremium, fnRec, resetFootnotes } from './footnotes';
import { $, cut, esc, eur, key } from './format';
import { purchaseLine } from './links';
import { cellMap, combo } from './pricing';
import { S } from './state';

/** Tab "behoefte": rank packages by how many of the ticked treatments they cover. */
export function renderNeeds(): void {
  resetFootnotes();
  const need = [...S.need],
    cell = cellMap(rows());
  if (!need.length) {
    $('#n-sum').textContent = 'Vink links minstens één behandeling aan.';
    $('#n-rank').innerHTML = '';
    return;
  }
  const ranked = activePackages()
    .map((p) => {
      const hits = need.map((t) => ({ treatment: t, r: cell.get(key(p) + '|' + t) }));
      const cov = hits.filter((h) => h.r && h.r.covered);
      const euro = cov.reduce((s, h) => s + (h.r?.eur_per_year || 0), 0);
      return { p, hits, n: cov.length, euro, c: combo(p) };
    })
    .sort((a, b) =>
      S.needSort === 'price'
        ? Number(b.n === need.length) - Number(a.n === need.length) ||
          (a.c.total ?? 9999) - (b.c.total ?? 9999)
        : b.n - a.n || (a.c.total ?? 9999) - (b.c.total ?? 9999),
    );
  const full = ranked.filter((x) => x.n === need.length);
  const cheapest = full
    .filter((x) => x.c.total != null)
    .sort((a, b) => (a.c.total as number) - (b.c.total as number))[0];
  $('#n-sum').innerHTML =
    `<b>${full.length}</b> pakketten dekken alle ${need.length} gekozen behandelingen.` +
    (cheapest
      ? ` Goedkoopste daarvan: <b>${esc(cheapest.c.base?.name)} + ${esc(cheapest.p.label)} ${esc(cheapest.p.package)}</b> voor ${eur(cheapest.c.total)} per maand (${eur((cheapest.c.total as number) * 12)} per jaar).`
      : '');
  $('#n-rank').innerHTML = ranked
    .map(
      (x, i) => `<div class="card"><span class="pos">${i + 1}</span>
    <div><b>${esc(x.p.label)} ${esc(x.p.package)}</b><div class="small">Afsluiten: ${purchaseLine(x.p, x.c)}${x.euro ? ` · ${eur(x.euro)} per jaar aan vaste maxima` : ''}</div></div>
    <div class="score"><b>${x.c.total != null ? eur(x.c.total) : 'n.b.'}</b>${x.c.total != null ? fnPremium(x.p, x.c) : ''}<div class="small">totaal p/m · ${x.n}/${need.length} gedekt</div></div>
    <ul>${x.hits.map((h) => (h.r && h.r.covered ? `<li title="${esc(h.r.provider)}">${esc(h.treatment)}: ${esc(cut(h.r.coverage, 70))}${fnRec(h.r)}</li>` : `<li class="miss">${esc(h.treatment)}</li>`)).join('')}</ul></div>`,
    )
    .join('');
  $('#n-fn').innerHTML = fnList();
}
