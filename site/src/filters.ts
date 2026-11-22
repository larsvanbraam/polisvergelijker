import { D, membersOnly, P } from './data';
import { $, esc } from './format';
import { renderNeeds } from './needs';
import { renderPackages } from './packages';
import { renderPlan } from './plan';
import { renderList } from './sidebar';
import { GONE, S, TODO, type View } from './state';
import { renderTreatment } from './treatment';

/** Filter bar: labels, deductible, free choice, members-only insurers, rows to check. */
export function initFilters(): void {
  const labels = [...new Set(P.map((p) => p.label))];
  $('#f-label').innerHTML = labels
    .map(
      (l) =>
        `<button class="chip" aria-pressed="true" data-l="${esc(l)}">${esc(l)}<span class="n">${P.filter((p) => p.label === l).length}</span></button>`,
    )
    .join('');
  $('#f-label').onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
    if (!b) return;
    const l = b.dataset.l!;
    if (S.labels.has(l)) S.labels.delete(l);
    else S.labels.add(l);
    b.setAttribute('aria-pressed', String(S.labels.has(l)));
    render();
  };
  $('#f-check').onchange = (e) => {
    S.check = (e.target as HTMLInputElement).checked;
    render();
  };
  $('#f-deductible').onchange = (e) => {
    S.deductible = +(e.target as HTMLInputElement).value;
    render();
  };
  $('#f-free').onchange = (e) => {
    S.freeChoice = (e.target as HTMLInputElement).checked;
    render();
  };
  $('#f-members').onchange = (e) => {
    S.members = (e.target as HTMLInputElement).checked;
    try {
      localStorage.setItem('pv-members', S.members ? '1' : '');
    } catch {
      // storage unavailable
    }
    render();
  };
  try {
    S.members = !!localStorage.getItem('pv-members');
  } catch {
    // storage unavailable
  }
  $<HTMLInputElement>('#f-members').checked = S.members;
  const membersChips = () =>
    document.querySelectorAll<HTMLElement>('#f-label .chip').forEach((c) => {
      if (membersOnly(c.dataset.l ?? '')) c.hidden = !S.members;
    });
  membersChips();
  $('#f-members').addEventListener('change', membersChips);
  $('#n-sort').onchange = (e) => {
    S.needSort = (e.target as HTMLInputElement).value as 'coverage' | 'price';
    renderNeeds();
  };
  $('#b-none').onchange = (e) => {
    S.showUncovered = (e.target as HTMLInputElement).checked;
    renderTreatment();
  };
  $('#p-diff').onchange = (e) => {
    S.diff = (e.target as HTMLInputElement).checked;
    renderPackages();
  };
  $('#q').oninput = renderList;
  const st =
    labels
      .map((l) => {
        const p = P.find((x) => x.label === l);
        return `<span>✓ <a href="${esc(p?.source)}">${esc(l)}</a></span>`;
      })
      .join('') +
    TODO.map((t) => `<span class="todo">${esc(t)}</span>`).join('') +
    GONE.map((t) => `<span class="todo">${esc(t)}</span>`).join('');
  $('#status').innerHTML = st;
}
/** The URL hash selects the tab. */
export function route(): void {
  const h = location.hash.slice(1);
  S.view = (VIEWS as string[]).includes(h) ? (h as View) : 'stappenplan';
  document
    .querySelectorAll<HTMLElement>('nav.tabs a')
    .forEach((a) =>
      a.dataset.v === S.view ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'),
    );
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + S.view));
  render();
}
const VIEWS: View[] = ['stappenplan', 'behandeling', 'pakketten', 'behoefte'];

export function render(): void {
  if (!D) return;
  renderList();
  ({
    stappenplan: renderPlan,
    behandeling: renderTreatment,
    pakketten: renderPackages,
    behoefte: renderNeeds,
  })[S.view]();
}
