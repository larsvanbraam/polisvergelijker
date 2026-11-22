import { esc, eur } from './format';
import type { Combo, Package } from './types';

/** Insurer websites, for the 'naar …' links. */
export const SITE: Record<string, string> = {
  Aevitae: 'https://www.aevitae.com',
  'a.s.r.': 'https://www.asr.nl',
  CZ: 'https://www.cz.nl',
  CZdirect: 'https://www.czdirect.nl',
  'De Friesland': 'https://www.defriesland.nl',
  DSW: 'https://www.dsw.nl',
  FBTO: 'https://www.fbto.nl',
  Interpolis: 'https://www.interpolis.nl',
  IZA: 'https://www.iza.nl',
  Just: 'https://www.just.nl',
  Menzis: 'https://www.menzis.nl',
  'Nationale-Nederlanden': 'https://www.nn.nl',
  OHRA: 'https://www.ohra.nl',
  ONVZ: 'https://www.onvz.nl',
  Salland: 'https://www.salland.nl',
  'Stad Holland': 'https://www.stadholland.nl',
  Univé: 'https://www.unive.nl',
  VGZ: 'https://www.vgz.nl',
  VvAA: 'https://www.vvaa.nl',
  'Zilveren Kruis': 'https://www.zilverenkruis.nl',
  'Zorg en Zekerheid': 'https://www.zorgenzekerheid.nl',
};
export const siteLink = (l: string): string =>
  SITE[l] ? ` <a class="site" href="${SITE[l]}" target="_blank" rel="noopener">naar ${esc(l)} ↗</a>` : '';
/** "Base policy (type, €) + package (€) · link": what to buy. */
export function purchaseLine(p: Package, c: Combo): string {
  return (
    (c.base
      ? `${esc(c.base.name)} <span class="small">(${esc(c.base.type)}, ${eur(c.basePremium)})</span> + ${esc(p.label)} ${esc(p.package)} <span class="small">(${eur(p.premium)})</span>`
      : `<span class="small">${esc(c.reason)}</span>`) + siteLink(p.label)
  );
}
export function totalCell(c: Combo): string {
  return c.total != null
    ? `<b class="mono">${eur(c.total)}</b><div class="small mono">${eur(c.total * 12)} p/j</div>`
    : `<span class="small">n.b.</span>`;
}
