/**
 * Contract lookup in the insurers' provider finders ("zorgzoekers").
 * Shared by the serverless function (api/contract.ts) and the page (src/contracts.ts).
 */

/** yes = contracted/reimbursed, no = no contract, negotiating = still negotiating, unknown = not reported. */
export type ContractStatus = 'yes' | 'no' | 'negotiating' | 'unknown';

export interface FinderQuery {
  /** Search text for the provider, e.g. "Fysio Jansen". */
  name: string;
  /** Postcode ("3511AB") or place name. */
  location: string;
  /** Care type in the finder's words, e.g. "fysiotherapie"; empty = search on name and place only. */
  careType: string;
}

export interface FinderMatch {
  name: string;
  address: string;
  contract: ContractStatus;
  /** Status as the finder words it (Dutch), plus year, distance or remarks. */
  text: string;
}

export type FinderResult =
  | { status: 'ok'; matches: FinderMatch[] }
  | { status: 'unsupported' | 'error'; reason: string };

/** One adapter per concern; check() never throws. */
export interface Finder {
  /** Concern name as used on the page (CTR_GROUPS in src/concerns.ts). */
  concern: string;
  labels: string[];
  check(query: FinderQuery): Promise<FinderResult>;
}

export type ConcernResult = FinderResult & { concern: string; labels: string[] };

/** Response of GET /api/contract. */
export interface ContractResponse {
  name: string;
  location: string;
  careType: string;
  results: ConcernResult[];
}
