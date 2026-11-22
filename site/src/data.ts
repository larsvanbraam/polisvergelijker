import { S } from './state';
import type { CoverageRecord, Dataset, Package } from './types';

export let D: Dataset;
export let R: CoverageRecord[] = [];
export let P: Package[] = [];

export function loadData(attempt = 0): Promise<Dataset> {
  return fetch('data.json', { cache: attempt ? 'reload' : 'default' })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json() as Promise<Dataset>;
    })
    .catch((e: unknown) => {
      if (attempt < 2) return new Promise((ok) => setTimeout(ok, 800)).then(() => loadData(attempt + 1));
      throw e;
    });
}

/** Store the dataset and restore the fields build.py drops from records to keep data.json small. */
export function setData(d: Dataset): void {
  D = d;
  R = d.records;
  P = d.packages;
  const byKey = new Map(P.map((p) => [p.label + '|' + p.package, p]));
  for (const r of R) {
    const p = byKey.get(r.label + '|' + r.package);
    r.source = p?.source || '';
    r.policy = p?.policy || r.source;
    r.concern = p?.concern || r.label;
    r.premium = p?.premium ?? null;
    r.provider ||= '';
    r.conditions ||= '';
    r.ref ||= '';
    r.source_heading ||= '';
    r.coverage ||= '';
    r.covered = !!r.covered;
    r.needs_check = !!r.needs_check;
    r.eur_per_year ??= null;
    r.sessions ??= null;
    r.eur ??= null;
    r.pct ??= null;
  }
}

export const membersOnly = (label: string): boolean => /alleen voor/i.test(D.base[label]?.note || '');
export const labelOn = (label: string): boolean => S.labels.has(label) && (S.members || !membersOnly(label));

export function rows(): CoverageRecord[] {
  return R.filter((r) => labelOn(r.label) && (S.check || !r.needs_check));
}

export function activePackages(): Package[] {
  return P.filter((p) => labelOn(p.label));
}
