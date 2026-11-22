/** Menzis (zorgvinder.menzis.nl, z-zoeker classic). */
import type { Finder } from './types.js';
import { makeClassic } from './z-zoeker.js';

export const menzis: Finder = {
  concern: 'Menzis',
  labels: ['Menzis'],
  check: makeClassic({
    host: 'https://zorgvinder.menzis.nl',
    afnemer: 'MENZIS_ZZ',
    pakketId: 'H231538222',
    pakketLijst: 'voor_advies_2027',
  }),
};
