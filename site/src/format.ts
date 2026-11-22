import { S } from './state';
import type { CoverageRecord, Package } from './types';

export function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  return document.querySelector(selector) as T;
}

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (s: string | number | boolean | null | undefined): string =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ENTITIES[c]);

export const eur = (n: number | null | undefined): string =>
  n == null
    ? '—'
    : '€ ' + n.toLocaleString('nl-NL', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const key = (p: Pick<Package, 'label' | 'package'>): string => p.label + '|' + p.package;

/** Single number for sorting coverage: € per year, else sessions, else max €, else percentage. */
export const val = (r: CoverageRecord): number | null =>
  r.eur_per_year ?? r.sessions ?? r.eur ?? (r.pct != null ? r.pct / 100 : null) ?? (r.covered ? 0.001 : null);

export function unit(r: CoverageRecord): string {
  return r.eur_per_year != null ? 'per jaar' : r.sessions != null ? 'behandelingen/uren' : '';
}

export function cut(text: string | null | undefined, n: number): string {
  const t = String(text || '');
  if (t.length <= n) return t;
  const i = t.lastIndexOf(' ', n);
  return t.slice(0, i > 40 ? i : n) + '…';
}

export function shortValue(value: string | null | undefined): string {
  const v = String(value || '');
  const first = v.split(/;\s|\.\s(?=[A-Z])/)[0];
  if (first.length === v.length && v.length <= 95) return esc(v);
  return `${esc(cut(first, 95))}<details class="more"><summary>volledige tekst</summary><div>${esc(v)}</div></details>`;
}

export function more(provider: string, conditions: string): string {
  const t = [provider, conditions].filter(Boolean).join(' · ');
  if (!t) return '<span class="small">Niet gespecificeerd</span>';
  if (t.length <= 80) return `<span class="small">${esc(t)}</span>`;
  return `<span class="small">${esc(cut(t, 80))}</span><details class="more"><summary>meer</summary><div>${esc(t)}</div></details>`;
}

/** Amount per year, shown per month or per year depending on the toggle, with the other as subtext. */
export function money(perYear: number): string {
  const m = perYear / 12;
  const main = S.per === 'maand' ? m : perYear,
    other = S.per === 'maand' ? perYear : m;
  return `${eur(Math.round(main * 100) / 100)}<span class="alt">${eur(Math.round(other))} ${S.per === 'maand' ? 'per jaar' : 'per maand'}</span>`;
}
