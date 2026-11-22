/** a.s.r. + VvAA (same provider-finder platform as DSW, see pw-platform.ts). */
import { checkPw } from './pw-platform';
import type { Finder } from './types';

const cfg = {
  api: 'https://content.zorgzoeker.asr.nl/api',
  origin: 'https://zorgzoeker.asr.nl',
  label: 'a.s.r.',
};

export const asr: Finder = { concern: 'a.s.r.', labels: ['a.s.r.', 'VvAA'], check: (q) => checkPw(cfg, q) };
