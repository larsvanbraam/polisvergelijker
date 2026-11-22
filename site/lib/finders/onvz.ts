/** ONVZ (onvz.z-zoeker.nl, z-zoeker Nuxt 3). onvz.nl/api/v1/find/suggest only gives site search suggestions; not used. */
import type { Finder } from './types.js';
import { makeNuxt3 } from './z-zoeker.js';

export const onvz: Finder = {
  concern: 'ONVZ',
  labels: ['ONVZ'],
  check: makeNuxt3({ host: 'https://onvz.z-zoeker.nl', contractant: 'ONVZ' }),
};
