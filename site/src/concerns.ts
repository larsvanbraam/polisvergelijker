/* Contract with the user's own provider, per concern (contracts usually apply to all labels of a concern) */
export const CTR_GROUPS: { group: string; labels: string[] }[] = [
  { group: 'Achmea', labels: ['Zilveren Kruis', 'Interpolis', 'FBTO', 'De Friesland'] },
  { group: 'CZ groep', labels: ['CZ', 'CZdirect', 'OHRA', 'Nationale-Nederlanden', 'Just'] },
  { group: 'VGZ', labels: ['VGZ', 'Univé', 'IZA'] },
  { group: 'DSW', labels: ['DSW', 'Stad Holland'] },
  { group: 'a.s.r.', labels: ['a.s.r.', 'VvAA'] },
  { group: 'Menzis', labels: ['Menzis'] },
  { group: 'ONVZ', labels: ['ONVZ'] },
  { group: 'Zorg en Zekerheid', labels: ['Zorg en Zekerheid'] },
  { group: 'ENO', labels: ['Salland'] },
  { group: 'Eucare', labels: ['Aevitae'] },
];
/** Provider-finder page per label. */
export const FINDER_URL: Record<string, string> = {
  'Zilveren Kruis': 'https://zorgzoeker.zilverenkruis.nl/',
  Interpolis: 'https://zorgzoeker.interpolis.nl/',
  FBTO: 'https://zorgzoeker.fbto.nl/',
  'De Friesland': 'https://www.defriesland.nl/zorgwijzer/vind-uw-zorgverlener',
  CZ: 'https://www.cz.nl/zorgvinder',
  CZdirect: 'https://www.cz.nl/zorgvinder',
  Just: 'https://www.cz.nl/zorgvinder',
  OHRA: 'https://www.ohra.nl/zorgverzekering/zorgverlener-zoeken',
  'Nationale-Nederlanden': 'https://www.nn.nl/zorgvinder',
  VGZ: 'https://www.vgz.nl/zorgzoeker',
  Univé: 'https://www.unive.nl/zorgzoeker',
  IZA: 'https://www.iza.nl/zorgzoeker',
  DSW: 'https://www.dsw.nl/Consumenten/Vergoedingen/zorgzoeker',
  'Stad Holland': 'https://www.stadholland.nl/Consumenten/Vergoedingen/zorgzoeker',
  'a.s.r.': 'https://zorgzoeker.asr.nl/',
  VvAA: 'https://zorgzoeker.asr.nl/',
  Menzis: 'https://www.menzis.nl/zorgvinder',
  ONVZ: 'https://www.onvz.nl/zorgzoeker',
  'Zorg en Zekerheid': 'https://www.zorgenzekerheid.nl/zorgzoeker',
  Salland: 'https://salland.z-zoeker.nl/',
  Aevitae: 'https://www3.aevitae.com/zoek-eucare-zorgverlener',
};
export const groupOf = (l: string): string =>
  (CTR_GROUPS.find((x) => x.labels.includes(l)) || { group: l }).group;
