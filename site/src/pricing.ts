import { groupOf } from './concerns';
import { D, P, activePackages } from './data';
import { key } from './format';
import { needDef } from './needlist';
import { S } from './state';
import type { BasePolicy, Combo, ContractState, CoverageRecord, Need, Package } from './types';

/** Lookup "<label>|<package>|<treatment>" -> coverage row. */
export type Cell = Map<string, CoverageRecord>;
export type Lookup = (treatment: string) => CoverageRecord | null | undefined;

export interface EstimateLine {
  n: Need;
  /** What the provider charges per year. */
  cost: number;
  /** Estimated reimbursement per year. */
  paid: number;
  r: CoverageRecord | null;
  contractNote?: string | null;
}

export interface Estimate {
  reimbursed: number;
  costs: number;
  detail: EstimateLine[];
}

export interface Scored {
  p: Package;
  c: Combo;
  e: Estimate;
  /** Premiums plus own costs per year; null when the premium is unknown. */
  yearly: number | null;
}

export const cellMap = (rs: CoverageRecord[]): Cell =>
  new Map(rs.map((r) => [key(r) + '|' + r.treatment, r]));

const premiumFor = (x: BasePolicy): number | null => (S.deductible === 900 ? x.p900 : x.p400);

/** Total price: cheapest compatible base policy + supplementary package. */
export function combo(p: Package): Combo {
  const policies = (D.base[p.label]?.policies ?? []).filter(
    (x) =>
      (x.packages === '*' || (p.mods || [p]).every((m) => x.packages.includes(m.package))) &&
      (!S.freeChoice || x.free_choice),
  );
  const opts = policies
    .filter((x) => premiumFor(x) != null)
    .sort((a, c) => (premiumFor(a) as number) - (premiumFor(c) as number));
  const base = opts[0] || null;
  const basePremium = base ? premiumFor(base) : null;
  const reason = !policies.length
    ? S.freeChoice
      ? 'geen vrije-keuzepolis'
      : 'basispolis onbekend'
    : !base
      ? 'premie bij € 900 eigen risico onbekend'
      : null;
  const total =
    basePremium != null && p.premium != null ? Math.round((basePremium + p.premium) * 100) / 100 : null;
  return {
    base,
    basePremium,
    total,
    reason: reason || (p.premium == null ? 'premie aanvullend onbekend' : null),
  };
}

export const packageOf = (r: Pick<CoverageRecord, 'label' | 'package'>): Package =>
  P.find((p) => p.label === r.label && p.package === r.package) as Package;

/** Maximum reimbursement per visit/day ("max. € 40 per dag"), if any. */
export function perVisitCap(text: string): number | null {
  const m = String(text).match(/€\s?([\d.]+(?:,\d+)?)[,-]*\s*per\s*(dag|behandel)/i);
  return m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null;
}

/** Reimbursed percentage ("75% tot € 250"), default 100. */
export function pctOf(r: CoverageRecord): number {
  const t = String(r.coverage);
  const m = t.match(/^(\d+)\s?%/) || t.match(/\b(\d{2})%\s*(tot|van|,)/);
  return m ? Math.min(100, +m[1]) : 100;
}

/** Reimbursement factor without a contract, taken from the policy text; null = not described. */
export function noCtrFactor(r: CoverageRecord): number | null {
  const t = (r.provider || '') + ' ' + (r.conditions || '') + ' ' + (r.coverage || '');
  const m = t.match(/(zonder contract|niet[- ]gecontracteerd\w*)[^%;]*?(\d{1,3})\s?%/i);
  if (m) return Math.min(100, +m[2]) / 100;
  if (
    /(alleen|uitsluitend)[^.;]*gecontracteerd|als je \w+ met \S+ een contract heeft|recht op deze vergoeding als[^.]*contract/i.test(
      t,
    )
  )
    return 0;
  return null;
}

/** Contract state for a need at this label; null when no own provider was entered. */
export function ctrState(n: Need, label: string): ContractState | null {
  return S.providers[n.id] ? S.contracts[n.id + '|' + groupOf(label)] || '?' : null;
}

/** Estimated reimbursement for all entered needs. */
export function estimate(p: Package, cell: Cell, look?: Lookup): Estimate {
  const find: Lookup = look || ((t) => cell.get(key(p) + '|' + t));
  const budgets = new Map<string, { cap: number | null; used: number }>();
  const detail: EstimateLine[] = [];
  for (const n of S.chosen.map(needDef)) {
    const q = S.plan[n.id] || 0;
    if (!q) continue;
    const rate = n.rate ?? 0;
    const cost = n.kind === 'eur' ? q : q * rate;
    const r = find(n.treatment);
    if (!r || !r.covered) {
      detail.push({ n, cost, paid: 0, r: null });
      continue;
    }
    let c = cost;
    if (n.kind === 'sessions') {
      const mb = String(r.coverage).match(/(\d+)\s*behandelingen/);
      if (mb) c = Math.min(q, +mb[1]) * rate;
    }
    if (n.kind === 'visits') {
      const pd = perVisitCap(r.coverage);
      if (pd) c = q * Math.min(rate, pd);
    }
    c = (c * pctOf(r)) / 100;
    let contractNote: string | null = null;
    const st = ctrState(n, p.label);
    if (st === 'no') {
      const f = noCtrFactor(r);
      contractNote =
        f == null
          ? 'geen contract: vergoeding zonder contract staat niet in de polistekst'
          : f === 0
            ? 'geen contract: geen vergoeding'
            : `geen contract: ${Math.round(f * 100)}%`;
      if (f != null) c = c * f;
    } else if (st === 'yes') contractNote = 'contract';
    const g = r.source_heading + '|' + r.ref; // one shared budget per source heading
    const cap = r.eur_per_year ?? (r.sessions == null ? r.eur : null);
    const o = budgets.get(g) || { cap, used: 0 };
    let paid = c;
    if (o.cap != null) paid = Math.max(0, Math.min(c, o.cap - o.used));
    o.used += paid;
    budgets.set(g, o);
    detail.push({ n, cost, paid, r, contractNote });
  }
  const reimbursed = detail.reduce((s, d) => s + d.paid, 0),
    costs = detail.reduce((s, d) => s + d.cost, 0);
  return { reimbursed, costs, detail };
}

export function score(p: Package, cell: Cell, look?: Lookup): Scored {
  const c = combo(p);
  const e = estimate(p, cell, look);
  const yearly = c.total != null ? c.total * 12 + (e.costs - e.reimbursed) : null;
  return { p, c, e, yearly };
}

/** Modular insurers (FBTO): cheapest combination of separate modules for the entered needs. */
export function modBest(cell: Cell): Scored[] {
  const out: Scored[] = [];
  const needs = S.chosen.map(needDef).filter((n) => S.plan[n.id]);
  const modular = new Set(
    activePackages()
      .filter((p) => p.module)
      .map((p) => p.label),
  );
  for (const l of modular) {
    const families = new Map<string, Package[]>();
    for (const p of activePackages().filter((p) => p.label === l && p.module && p.premium != null)) {
      if (!needs.some((n) => cell.get(key(p) + '|' + n.treatment)?.covered)) continue;
      const fam = p.module as string;
      if (!families.has(fam)) families.set(fam, []);
      families.get(fam)!.push(p);
    }
    let combos: Package[][] = [[]];
    for (const opts of families.values()) combos = combos.flatMap((c) => [c, ...opts.map((o) => [...c, o])]);
    let best: Scored | null = null;
    for (const mods of combos) {
      if (!mods.length) continue;
      const v: Package = {
        label: l,
        concern: mods[0].concern,
        package: mods.map((m) => m.package).join(' + '),
        premium: Math.round(mods.reduce((s, m) => s + (m.premium as number), 0) * 100) / 100,
        mods,
        source: mods[0].source,
        policy: mods[0].policy,
        module: 'combination',
      };
      const x = score(v, cell, (t) => {
        for (const m of mods) {
          const r = cell.get(key(m) + '|' + t);
          if (r && r.covered) return r;
        }
        return null;
      });
      if (x.yearly != null && (!best || x.yearly < (best.yearly as number))) best = x;
    }
    if (best) out.push(best);
  }
  return out;
}
