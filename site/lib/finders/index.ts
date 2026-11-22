import { achmea } from './achmea.js';
import { asr } from './asr.js';
import { cz } from './cz.js';
import { dsw } from './dsw.js';
import { eno } from './eno.js';
import { eucare } from './eucare.js';
import { menzis } from './menzis.js';
import { onvz } from './onvz.js';
import type { Finder } from './types.js';
import { vgz } from './vgz.js';
import { zorgenzekerheid } from './zorgenzekerheid.js';

/** One finder per concern; concern names match CTR_GROUPS in src/concerns.ts. */
export const FINDERS: Finder[] = [cz, vgz, achmea, menzis, onvz, eno, dsw, asr, zorgenzekerheid, eucare];
