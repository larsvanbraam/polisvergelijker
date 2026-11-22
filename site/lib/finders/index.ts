import { achmea } from './achmea';
import { asr } from './asr';
import { cz } from './cz';
import { dsw } from './dsw';
import { eno } from './eno';
import { eucare } from './eucare';
import { menzis } from './menzis';
import { onvz } from './onvz';
import type { Finder } from './types';
import { vgz } from './vgz';
import { zorgenzekerheid } from './zorgenzekerheid';

/** One finder per concern; concern names match CTR_GROUPS in src/concerns.ts. */
export const FINDERS: Finder[] = [cz, vgz, achmea, menzis, onvz, eno, dsw, asr, zorgenzekerheid, eucare];
