/* Contract with the user's own provider, per label: labels of one concern do not necessarily share contracts */
export const CTR_GROUPS: { group: string; labels: string[] }[] = [
  // Every label is its own row; a finder only answers for the label whose finder it queries (FINDER_CONCERN).
  { group: 'Zilveren Kruis', labels: ['Zilveren Kruis'] },
  { group: 'Interpolis', labels: ['Interpolis'] },
  { group: 'FBTO', labels: ['FBTO'] },
  { group: 'De Friesland', labels: ['De Friesland'] },
  { group: 'CZ', labels: ['CZ'] },
  { group: 'CZdirect', labels: ['CZdirect'] },
  { group: 'OHRA', labels: ['OHRA'] },
  { group: 'Nationale-Nederlanden', labels: ['Nationale-Nederlanden'] },
  { group: 'Just', labels: ['Just'] },
  { group: 'VGZ', labels: ['VGZ'] },
  { group: 'Univé', labels: ['Univé'] },
  { group: 'IZA', labels: ['IZA'] },
  { group: 'DSW', labels: ['DSW'] },
  { group: 'Stad Holland', labels: ['Stad Holland'] },
  { group: 'a.s.r.', labels: ['a.s.r.'] },
  { group: 'VvAA', labels: ['VvAA'] },
  { group: 'Menzis', labels: ['Menzis'] },
  { group: 'ONVZ', labels: ['ONVZ'] },
  { group: 'Zorg en Zekerheid', labels: ['Zorg en Zekerheid'] },
  { group: 'ENO', labels: ['Salland'] },
  { group: 'Eucare', labels: ['Aevitae'] },
];
/**
 * Concern name of the finder (lib/finders) that answers for a group; null = no finder is queried, check by hand.
 * Groups not listed are answered by the finder of the same name.
 */
export const FINDER_CONCERN: Record<string, string | null> = {
  CZ: 'CZ groep',
  CZdirect: null,
  OHRA: null,
  'Nationale-Nederlanden': null,
  Just: null,
  'Stad Holland': null,
  VvAA: null,
};
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
