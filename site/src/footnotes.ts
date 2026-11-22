import { D } from './data';
import { esc, eur } from './format';
import { S } from './state';
import type { Combo, CoverageRecord, Package } from './types';

/* Footnotes: every value links to its source document + article/page. */
let FN: string[] = [];

export function resetFootnotes(): void {
  FN = [];
}
export function docName(u: string | undefined): string {
  if (!u) return 'bron';
  try {
    const p = new URL(u);
    const f = decodeURIComponent(p.pathname.split('/').pop() || p.hostname);
    return p.hostname.replace(/^www\./, '') + ' › ' + f;
  } catch {
    return u;
  }
}
export function pageOf(ref: string | undefined): string | null {
  const m = String(ref || '').match(/p\.?\s*(\d+)/) || String(ref || '').match(/^(\d+)/);
  return m ? m[1] : null;
}
export function srcUrl(r: CoverageRecord): string {
  const u = r.policy || r.source || '';
  const pg = pageOf(r.ref);
  return pg && /\.pdf/i.test(u) ? u + '#page=' + pg : u;
}
export function fn(html: string): string {
  let i = FN.indexOf(html);
  if (i < 0) {
    FN.push(html);
    i = FN.length - 1;
  }
  return `<sup class="fn"><a href="#fn-${S.view}-${i + 1}" id="fr-${S.view}-${i + 1}">${i + 1}</a></sup>`;
}
export function fnRec(r: CoverageRecord): string {
  return fn(
    `<b>${esc(r.label)} ${esc(r.package)}</b> · ${esc(r.treatment)}: “${esc(r.coverage)}”. In de bron als <i>${esc(r.source_heading)}</i>, ${esc(r.ref || '')}. <a href="${esc(srcUrl(r))}">${esc(docName(r.policy || r.source))}${pageOf(r.ref) ? ', pagina ' + pageOf(r.ref) : ''}</a>`,
  );
}
export function fnPremium(p: Package, c: Combo): string {
  const b = D.base[p.label] ?? { source: '', policies: [] };
  let h = `<b>Premies ${esc(p.label)} ${esc(p.package)}</b>: `;
  h += c.base
    ? `basisverzekering ${esc(c.base.name)} ${eur(c.basePremium)} (eigen risico € ${S.deductible}) – <a href="${esc(b.source || '')}">${esc(docName(b.source))}</a>`
    : 'basisverzekering onbekend';
  h +=
    `; aanvullend ${eur(p.premium)}` +
    (b.supplementary_source
      ? ` – <a href="${esc(b.supplementary_source)}">${esc(docName(b.supplementary_source))}</a>`
      : ' (bron nog niet vastgesteld)') +
    (b.note ? `. ${esc(b.note)}` : '');
  return fn(h);
}
export function fnList(): string {
  return FN.length
    ? `<ol class="fnlist">${FN.map((h, i) => `<li id="fn-${S.view}-${i + 1}">${h} <a href="#fr-${S.view}-${i + 1}" aria-label="Terug naar tekst">↩</a></li>`).join('')}</ol>`
    : '';
}
