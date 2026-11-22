/**
 * Shared helper for the "pw-zorgzoeker" platform (Angular app + content BFF) used by both DSW/Stad Holland
 * (www.dsw.nl, BFF https://content.dsw.nl/api) and a.s.r./VvAA (zorgzoeker.asr.nl, BFF https://content.zorgzoeker.asr.nl/api).
 * Endpoints (no login/captcha): GET v1/Zorgzoeker/GetZorgsoorten, POST v1/Zorgzoeker/FindZorgpartijen.
 */
import type { ContractStatus, FinderQuery, FinderResult } from './types.js';
import { UA, errorText, normalize, timeout } from './util.js';

export interface PwConfig {
  api: string;
  origin: string;
  label: string;
}

/** statusCode from the app bundle (StatusService.getContractStatus). */
const STATUS: Record<number, [ContractStatus, string]> = {
  2: ['yes', 'Contract: vergoed'],
  1: ['no', 'Geen contract: een deel niet vergoed'],
  3: ['negotiating', 'Nog geen contract: een deel niet vergoed'],
  6: ['negotiating', '(Nog) geen contract: wel vergoed'],
  0: ['unknown', 'Meerdere zorgsoorten/contracten, zie detailpagina'],
};

interface CareType {
  zorgsoortName?: string;
  synonym?: string;
  years?: number[];
  subZorgsoortCode?: string | null;
  mainZorgsoortCode?: string | null;
}
interface Party {
  name: string;
  statusCode: number;
  distance?: number;
  hasOmzetplafond?: boolean;
  hasSpecificMessage?: boolean;
  address?: {
    street?: string;
    houseNumber?: string;
    houseNumberAddition?: string;
    postalCode?: string;
    city?: string;
  };
}

const cache: Record<string, { t: number; d: CareType[] }> = {};

async function careTypes(api: string, origin: string): Promise<CareType[]> {
  const hit = cache[api];
  if (hit && Date.now() - hit.t < 3600e3) return hit.d;
  const y = new Date().getFullYear();
  const q = [y, y + 1].map((x) => 'availableYears=' + x).join('&');
  const r = await fetch(`${api}/v1/Zorgzoeker/GetZorgsoorten?${q}`, {
    headers: { 'user-agent': UA, origin },
    signal: timeout(),
  });
  if (!r.ok) throw new Error('GetZorgsoorten HTTP ' + r.status);
  const d = (await r.json()) as CareType[];
  cache[api] = { t: Date.now(), d };
  return d;
}

function pick(list: CareType[], careType: string): CareType | null {
  const s = normalize(careType);
  return (
    list.find((z) => normalize(z.zorgsoortName) === s) ||
    list.find((z) => normalize(z.synonym) === s) ||
    list.find((z) => normalize(z.zorgsoortName).includes(s)) ||
    list.find((z) => normalize(z.synonym).includes(s)) ||
    null
  );
}

export async function checkPw(
  cfg: PwConfig,
  { name, location, careType }: FinderQuery,
): Promise<FinderResult> {
  try {
    const list = await careTypes(cfg.api, cfg.origin);
    // Empty care type = search on name + place only (as the finder itself does without a care type)
    const z: CareType | null = careType
      ? pick(list, careType)
      : { years: list.flatMap((x) => x.years || []), subZorgsoortCode: null };
    if (!z) return { status: 'error', reason: `zorgsoort '${careType}' niet gevonden bij ${cfg.label}` };
    const years = z.years && z.years.length ? z.years : [new Date().getFullYear()];
    const year = Math.max(...years);
    const body = {
      zorgsoortCode: careType ? (z.subZorgsoortCode ?? z.mainZorgsoortCode) : null,
      location: String(location || '').trim(),
      radius: name ? 25 : 10,
      zorgpartijName: name || '',
      year,
      isWorkAreaSearch: false,
      zorgsoortsearchTerm: '',
    };
    const r = await fetch(`${cfg.api}/v1/Zorgzoeker/FindZorgpartijen`, {
      method: 'POST',
      headers: { 'user-agent': UA, origin: cfg.origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: timeout(),
    });
    if (!r.ok) return { status: 'error', reason: 'FindZorgpartijen HTTP ' + r.status };
    const d = (await r.json()) as { addressType?: string; results?: Party[] };
    if (d.addressType === 'country') return { status: 'error', reason: 'ongeldige postcode/plaats' };
    const matches = (d.results || []).slice(0, 15).map((p) => {
      const a = p.address || {};
      const [contract, status] = STATUS[p.statusCode] || ['unknown', 'Onbekende status ' + p.statusCode];
      const extra = [p.hasOmzetplafond && 'met omzetplafond', p.hasSpecificMessage && 'met bijzonderheden']
        .filter(Boolean)
        .join(', ');
      return {
        name: p.name,
        address:
          `${a.street || ''} ${a.houseNumber || ''}${a.houseNumberAddition ? '-' + a.houseNumberAddition : ''}, ${a.postalCode || ''} ${a.city || ''}`
            .replace(/\s+/g, ' ')
            .trim(),
        contract,
        text: `${status} (${year}${p.distance ? `, ${p.distance} km` : ''}${extra ? `, ${extra}` : ''})`,
      };
    });
    return { status: 'ok', matches };
  } catch (e) {
    return { status: 'error', reason: errorText(e) };
  }
}
