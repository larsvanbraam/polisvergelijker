/**
 * Shared helper for "z-zoeker" provider finders (Menzis, Salland/ENO, ONVZ).
 * Two variants of the same software:
 *  - classic (Nuxt 2): Menzis + Salland. POST <host>/api/zadvies/<afnemer>/zorginkoop/zorgaanbieders
 *  - nuxt3: ONVZ. GET <host>/api/zoektermen + /api/zorgaanbieders (contractantCode required)
 */
import type { ContractStatus, FinderMatch, FinderQuery, FinderResult } from './types.js';
import { errorText, getJson, isPostcode, normalizeWords as norm } from './util.js';

/** Search variants for a name: full, then fewer and fewer words (the search-term API matches word prefixes). */
function variants(name: string): string[] {
  const w = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let n = w.length; n >= 1 && out.length < 3; n--) out.push(w.slice(0, n).join(' '));
  const longest = [...w].sort((a, b) => b.length - a.length)[0];
  if (longest && !out.includes(longest)) out.push(longest);
  return out;
}

/** Keep names that contain all words of the query first. */
function rank(matches: FinderMatch[], name: string): FinderMatch[] {
  const q = norm(name).split(' ').filter(Boolean);
  const score = (m: FinderMatch) => q.filter((t) => norm(m.name).includes(t)).length;
  return matches
    .map((m, i) => [m, i] as const)
    .sort((a, b) => score(b[0]) - score(a[0]) || a[1] - b[1])
    .map((x) => x[0]);
}

export function mapStatus(st: string | undefined): [ContractStatus, string] {
  switch (st) {
    case 'GECONTRACTEERD':
      return ['yes', 'Gecontracteerd'];
    case 'DEELS_GECONTRACTEERD':
      return ['yes', 'Deels gecontracteerd (deel van de zorg niet vergoed/afspraken beperkt)'];
    case 'IN_ONDERHANDELING':
      return ['negotiating', 'In onderhandeling'];
    case 'GEEN_CONTRACT_VERGOED_TIJDENS_ONDERHANDELING':
      return ['negotiating', 'Geen contract (nog), wordt vergoed tijdens onderhandeling'];
    case 'GEEN_CONTRACT_WEL_VERGOED':
      return ['negotiating', 'Geen contract, maar wel vergoed (let op eventueel lagere vergoeding)'];
    case 'NIET_GECONTRACTEERD':
      return ['no', 'Niet gecontracteerd'];
    default:
      return ['unknown', st ? 'Status: ' + st : 'Geen contractstatus'];
  }
}

interface ZAddress {
  straat?: string;
  huisnummer?: string | number;
  huisletter?: string;
  toevoeging?: string;
  postcode?: string;
  plaats?: string;
}
const address = (a: ZAddress): string =>
  [[a.straat, a.huisnummer, a.huisletter, a.toevoeging].filter(Boolean).join(' '), a.postcode, a.plaats]
    .filter(Boolean)
    .join(', ');

function guarded(fn: (q: FinderQuery) => Promise<FinderResult>): (q: FinderQuery) => Promise<FinderResult> {
  return async (q) => {
    try {
      if (!q || !q.name) return { status: 'error', reason: 'naam ontbreekt' };
      return await fn(q);
    } catch (e) {
      return { status: 'error', reason: errorText(e) };
    }
  };
}

// ---------- classic (Menzis, Salland) ----------

export interface ClassicConfig {
  host: string;
  afnemer: string;
  pakketId: string;
  pakketLijst: string;
}

interface ClassicProvider extends ZAddress {
  naam: string;
  afstand?: number;
  pakketten?: { jaar?: number; contractStatus?: string }[];
}

export function makeClassic(cfg: ClassicConfig): (q: FinderQuery) => Promise<FinderResult> {
  const base = `${cfg.host}/api/zadvies/${cfg.afnemer}/zorginkoop`;
  return guarded(async ({ name, location, careType }) => {
    const loc: { postcode?: string; woonplaatsId?: number | string } = {};
    const km = 20;
    const p = String(location || '').trim();
    if (isPostcode(p)) loc.postcode = p.replace(/\s/g, '').toUpperCase();
    else if (p) {
      const w = await getJson<{ id: number | string; woonplaats: string }[]>(
        `${base}/woonplaatsen?zoekterm=${encodeURIComponent(p)}`,
      );
      const hit = (w || []).find((x) => norm(x.woonplaats) === norm(p)) || (w || [])[0];
      if (!hit) return { status: 'error', reason: 'plaats niet gevonden: ' + p };
      loc.woonplaatsId = hit.id;
    }
    let specIds: (string | number)[] | undefined;
    if (careType) {
      try {
        const z = await getJson<{ SPECIALISME?: { zoekWaarde: string; referentieId?: string | number }[] }>(
          `${base}/zoektermenPerType?zoekterm=${encodeURIComponent(careType)}&zoektermTypes=SPECIALISME&aantal=5`,
        );
        const s = (z.SPECIALISME || []).find((x) => norm(x.zoekWaarde) === norm(careType));
        if (s && s.referentieId) specIds = [s.referentieId];
      } catch {
        // search without care type
      }
    }
    const search = (q: string, spec?: (string | number)[]) => {
      const body: Record<string, unknown> = {
        zorgaanbieder: { type: '', naam: q },
        locatiebepaling: { ...loc, afstandKm: km },
        paginaEnSortering: { offset: 0, aantal: 10, sortering: 'AFSTAND' },
        pakketIds: [cfg.pakketId],
        pakketLijst: cfg.pakketLijst,
      };
      if (spec) body.specialismeIds = spec;
      return getJson<{ zorgaanbieders?: ClassicProvider[] }>(`${base}/zorgaanbieders`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      });
    };
    let res: ClassicProvider[] = [];
    for (const v of variants(name)) {
      let d = await search(v, specIds);
      if (!(d.zorgaanbieders || []).length && specIds) d = await search(v, undefined);
      res = d.zorgaanbieders || [];
      if (res.length) break;
    }
    const matches = rank(
      res.map((z) => {
        const pk = (z.pakketten || []).slice().sort((a, b) => (b.jaar || 0) - (a.jaar || 0))[0] || {};
        const [contract, status] = mapStatus(pk.contractStatus);
        return {
          name: z.naam,
          address: address(z),
          contract,
          text: `${status}${pk.jaar ? ' (' + pk.jaar + ')' : ''}${z.afstand != null ? ', ' + z.afstand + ' km' : ''}`,
        };
      }),
      name,
    );
    return { status: 'ok', matches };
  });
}

// ---------- nuxt3 (ONVZ) ----------

export interface Nuxt3Config {
  host: string;
  contractant: string;
}

interface Nuxt3Provider {
  zorgwebId: string;
  naam: string;
  afstand?: number;
  adres?: ZAddress;
  contracten?: {
    contractant: string;
    jaar: number;
    contractStatus?: string;
    specialismen?: { omschrijving: string; contractStatus?: string }[];
  }[];
}

export function makeNuxt3(cfg: Nuxt3Config): (q: FinderQuery) => Promise<FinderResult> {
  return guarded(async ({ name, location, careType }) => {
    const p = String(location || '').trim();
    // 1) name -> search-term codes (provider/location)
    let codes: string[] = [];
    for (const v of variants(name)) {
      const z = await getJson<{ zoektermType: string; zoektermen?: { code: string }[] }[]>(
        `${cfg.host}/api/zoektermen?zoekterm=${encodeURIComponent(v)}&aantal=30&taal=NL`,
      );
      codes = [];
      for (const g of z || [])
        if (['VESTIGING', 'ZORGAANBIEDER'].includes(g.zoektermType))
          for (const t of g.zoektermen || []) codes.push(t.code);
      if (codes.length) break;
    }
    if (!codes.length) return { status: 'ok', matches: [] };
    // 2) fetch providers per code (no distance -> all locations), then filter on place/postcode
    const seen = new Map<string, Nuxt3Provider>();
    for (const code of codes.slice(0, 6)) {
      const d = await getJson<{ resultaten?: Nuxt3Provider[] }>(
        `${cfg.host}/api/zorgaanbieders?zoektermCode=${encodeURIComponent(code)}&afstand=-1&sortering=AFSTAND&offset=0&contractantCode=${cfg.contractant}`,
      );
      for (const z of d.resultaten || []) if (!seen.has(z.zorgwebId)) seen.set(z.zorgwebId, z);
    }
    let all = [...seen.values()];
    let elsewhere = false;
    if (p) {
      let place = p;
      if (isPostcode(p)) {
        // postcode -> place name
        try {
          const l = await getJson<{ plaatsnaam: string }[]>(
            `${cfg.host}/api/locaties?zoekterm=${encodeURIComponent(p.replace(/\s/g, ''))}&taal=NL`,
          );
          if (l && l[0]) place = l[0].plaatsnaam;
        } catch {
          // keep the postcode
        }
      }
      const pc = isPostcode(p) ? p.replace(/\s/g, '').toUpperCase() : null;
      const local = all.filter((z) => {
        const a = z.adres || {};
        return norm(a.plaats) === norm(place) || (pc && String(a.postcode || '').startsWith(pc.slice(0, 4)));
      });
      if (local.length) all = local;
      else elsewhere = true;
    }
    const matches = rank(
      all.map((z) => {
        const cs = (z.contracten || [])
          .filter((c) => c.contractant === cfg.contractant)
          .sort((a, b) => b.jaar - a.jaar);
        const c0 = cs[0];
        let st = c0?.contractStatus;
        if (careType) {
          const sp = (c0?.specialismen || []).find((s) => norm(s.omschrijving) === norm(careType));
          if (sp) st = sp.contractStatus;
        }
        const [contract, status] = mapStatus(st);
        return {
          name: z.naam,
          address: address(z.adres || {}),
          contract,
          text: `${status}${c0?.jaar ? ' (' + c0.jaar + ')' : ''}${z.afstand != null ? ', ' + z.afstand + ' km' : ''}${elsewhere ? ' (let op: niet in opgegeven plaats)' : ''}`,
        };
      }),
      name,
    ).slice(0, 10);
    return { status: 'ok', matches };
  });
}
