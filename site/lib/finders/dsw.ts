/** DSW + Stad Holland (same provider-finder platform as a.s.r., see pw-platform.ts). */
import { checkPw } from './pw-platform.js';
import type { Finder } from './types.js';

const cfg = { api: 'https://content.dsw.nl/api', origin: 'https://www.dsw.nl', label: 'DSW' };

export const dsw: Finder = { concern: 'DSW', labels: ['DSW', 'Stad Holland'], check: (q) => checkPw(cfg, q) };
