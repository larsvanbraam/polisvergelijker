import { esc } from './format';

interface CardOptions {
  /** Column shown as card title (full width, no label). */
  main?: number;
  /** Columns spanning the full card width. */
  full?: number[];
  /** Columns hidden on mobile; the first one (rank) is prefixed to the title. */
  hide?: number[];
  /** Keep the sort buttons from the header visible. */
  sortable?: boolean;
}

/** Mobile: tables become cards; each cell gets its column header as label (via CSS). */
export function cardify(
  t: HTMLTableElement | null,
  { main = 0, full = [], hide = [], sortable = false }: CardOptions = {},
): void {
  if (!t) return;
  t.classList.add('cards');
  t.classList.toggle('sortable', sortable);
  const hs = [...t.querySelectorAll<HTMLElement>('thead th')].map(
    (th) => th.dataset.short || (th.textContent ?? '').replace(/[↑↓]/g, '').trim(),
  );
  for (const tr of t.querySelectorAll('tbody tr')) {
    const tds = [...tr.children] as HTMLElement[];
    if (tds.length === 1) {
      tds[0].classList.add('c-full');
      continue;
    }
    tds.forEach((td, i) => {
      if (hs[i]) td.dataset.l = hs[i];
      if (hide.includes(i)) td.classList.add('c-hide');
      if (i === main) td.classList.add('c-main', 'c-full');
      if (full.includes(i)) td.classList.add('c-full');
    });
    if (hide.length && tds[main] && !tds[main].querySelector('.rkm')) {
      const rk = (tds[hide[0]].textContent ?? '').trim();
      if (rk) tds[main].insertAdjacentHTML('afterbegin', `<span class="rkm">${esc(rk)}</span>`);
    }
  }
}
