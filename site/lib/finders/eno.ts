/** Salland / ENO (salland.z-zoeker.nl, z-zoeker classic). */
import type { Finder } from './types.js';
import { makeClassic } from './z-zoeker.js';

export const eno: Finder = {
  concern: 'ENO',
  labels: ['Salland'],
  check: makeClassic({
    host: 'https://salland.z-zoeker.nl',
    afnemer: 'ENO-zz',
    pakketId: 'H231537938',
    pakketLijst: 'voor_advies_2027',
  }),
};
