/** Shapes of site/public/data.json, written by build.py. Values (names, coverage texts) are Dutch. */

export interface Package {
  label: string;
  concern: string;
  package: string;
  /** Monthly premium of the supplementary package; null when unknown. */
  premium: number | null;
  source: string;
  policy: string;
  /** Module family for modular insurers (FBTO); packages in one family are alternatives. */
  module: string | null;
  /** Set on virtual packages that combine several modules. */
  mods?: Package[];
}

/** One coverage row: what one package reimburses for one treatment. */
export interface CoverageRecord {
  label: string;
  package: string;
  treatment: string;
  category: string;
  source_heading: string;
  coverage: string;
  covered: boolean;
  provider: string;
  conditions: string;
  ref: string;
  needs_check: boolean;
  eur_per_year: number | null;
  sessions: number | null;
  eur: number | null;
  pct: number | null;
  // copied from the package when the data is loaded
  source: string;
  policy: string;
  concern: string;
  premium: number | null;
  /** Placeholder row for a package that does not mention the treatment. */
  unknown?: boolean;
}

export interface BasePolicy {
  name: string;
  type: string;
  free_choice: boolean;
  p400: number | null;
  p900: number | null;
  /** '*' = every supplementary package of the label can be added. */
  packages: '*' | string[];
  premium_source?: string;
  out_of_network?: string;
  out_of_network_note?: string;
  out_of_network_source?: string;
  out_of_network_check?: boolean;
}

export interface BaseLabel {
  source: string;
  supplementary_source?: string;
  note?: string;
  modular?: boolean;
  policies: BasePolicy[];
}

export interface Dataset {
  year: number;
  generated: string;
  categories: string[];
  packages: Package[];
  records: CoverageRecord[];
  base: Record<string, BaseLabel>;
}

export type NeedKind = 'sessions' | 'visits' | 'eur';

export interface Need {
  id: string;
  treatment: string;
  label: string;
  kind: NeedKind;
  unit: string;
  rate?: number;
  hint?: string;
}

export type ContractState = 'yes' | 'no' | '?';

/** Cheapest base policy for a package and the resulting monthly total. */
export interface Combo {
  base: BasePolicy | null;
  basePremium: number | null;
  total: number | null;
  reason: string | null;
}
