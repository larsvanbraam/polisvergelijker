import type { ContractState } from './types';

export const TODO = [
  'Just Live: premie 2027 nog niet bekend',
  'Aevitae (ook Caresq): premies aanvullend nog niet bekend',
  'PNOzorg: geen 2027-aanbod gevonden',
];
export const GONE = [
  'Zekur: per 2027 Univé',
  'Anderzorg: per 2027 opgegaan in Menzis',
  'Caresq: loopt via Aevitae (Eucare)',
];

export type View = 'stappenplan' | 'behandeling' | 'pakketten' | 'behoefte';

/** UI state. View names are also the URL hashes, so they stay Dutch. */
export const S = {
  deductible: 400,
  freeChoice: false,
  members: false,
  needSort: 'coverage' as 'coverage' | 'price',
  view: 'behandeling' as View,
  treatment: 'Podotherapie en voetzorg',
  labels: new Set<string>(),
  check: true,
  showUncovered: false,
  sort: { k: 'val', d: -1 },
  pick: [] as string[],
  diff: false,
  need: new Set(['Podotherapie en voetzorg', 'Alternatieve geneeswijzen', 'Fysiotherapie']),
  /** Amount per chosen need id. */
  plan: {} as Record<string, number>,
  /** Ids of the chosen needs. */
  chosen: [] as string[],
  per: 'maand' as 'maand' | 'jaar',
  /** Own provider name per need id. */
  providers: {} as Record<string, string>,
  /** Contract state per "<need id>|<concern group>". */
  contracts: {} as Record<string, ContractState>,
  /** Postcode or place of the own provider per need id, for the automatic contract lookup. */
  places: {} as Record<string, string>,
  s1done: false,
  s2done: false,
  showBase: false,
};

try {
  const o = JSON.parse(localStorage.getItem('pv-contracts') || '{}');
  S.providers = o.providers || {};
  S.contracts = o.contracts || {};
  S.places = o.places || {};
} catch {
  // storage unavailable
}

export function saveCtr(): void {
  try {
    localStorage.setItem(
      'pv-contracts',
      JSON.stringify({ providers: S.providers, contracts: S.contracts, places: S.places }),
    );
  } catch {
    // storage unavailable
  }
}
