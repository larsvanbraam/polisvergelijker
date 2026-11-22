import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { setData } from './data';
import { cellMap, combo, estimate, modBest, noCtrFactor, pctOf, perVisitCap, score } from './pricing';
import { S } from './state';
import type { CoverageRecord, Dataset, Package } from './types';

const pkg = (label: string, name: string, premium: number | null, module: string | null = null): Package => ({
  label,
  concern: label,
  package: name,
  premium,
  source: '',
  policy: '',
  module,
});

const row = (
  label: string,
  name: string,
  treatment: string,
  coverage: string,
  extra: Partial<CoverageRecord> = {},
) =>
  ({
    label,
    package: name,
    treatment,
    category: 'Paramedisch',
    source_heading: treatment,
    coverage,
    covered: true,
    ref: 'p. 1',
    ...extra,
  }) as CoverageRecord;

function fixture(): Dataset {
  return {
    year: 2027,
    generated: '2026-11-22',
    categories: ['Paramedisch'],
    packages: [
      pkg('A', 'Plus', 20),
      pkg('A', 'Top', 40),
      pkg('F', 'Fysio 3', 5, 'Fysio'),
      pkg('F', 'Fysio 9', 15, 'Fysio'),
      pkg('F', 'Voet', 3, 'Voet'),
    ],
    records: [
      row('A', 'Plus', 'Fysiotherapie', 'Max. 6 behandelingen per jaar', { sessions: 6 }),
      row('A', 'Top', 'Fysiotherapie', 'Max. 12 behandelingen per jaar', { sessions: 12 }),
      row('A', 'Plus', 'Alternatieve geneeswijzen', 'Max. € 300 per jaar, max. € 40 per dag', {
        eur_per_year: 300,
        eur: 300,
      }),
      row('A', 'Plus', 'Podotherapie en voetzorg', 'Max. € 100 per jaar', {
        eur_per_year: 100,
        eur: 100,
        source_heading: 'Voetzorg',
      }),
      row('A', 'Plus', 'Steunzolen', 'Max. € 100 per jaar', {
        eur_per_year: 100,
        eur: 100,
        source_heading: 'Voetzorg',
      }),
      row('F', 'Fysio 3', 'Fysiotherapie', 'Max. 3 behandelingen per jaar', { sessions: 3 }),
      row('F', 'Fysio 9', 'Fysiotherapie', 'Max. 9 behandelingen per jaar', { sessions: 9 }),
      row('F', 'Voet', 'Podotherapie en voetzorg', 'Max. € 150 per jaar', { eur_per_year: 150, eur: 150 }),
    ],
    base: {
      A: {
        source: '',
        policies: [
          { name: 'A Natura', type: 'natura', free_choice: false, p400: 160, p900: 150, packages: '*' },
          { name: 'A Vrij', type: 'combinatie', free_choice: true, p400: 180, p900: null, packages: '*' },
        ],
      },
      F: {
        source: '',
        policies: [
          {
            name: 'F Basis',
            type: 'natura',
            free_choice: false,
            p400: 150,
            p900: 140,
            packages: ['Fysio 3', 'Voet'],
          },
          { name: 'F Plus', type: 'natura', free_choice: false, p400: 165, p900: 150, packages: '*' },
        ],
      },
    },
  };
}

let data: Dataset;
const packageNamed = (name: string) => data.packages.find((p) => p.package === name)!;

beforeEach(() => {
  data = fixture();
  setData(data);
  Object.assign(S, {
    deductible: 400,
    freeChoice: false,
    members: false,
    check: true,
    plan: {},
    chosen: [],
    providers: {},
    contracts: {},
  });
  S.labels = new Set(['A', 'F']);
});

describe('text parsing', () => {
  it('reads a per-visit cap', () => {
    expect(perVisitCap('Max. € 300 per jaar, max. € 40 per dag')).toBe(40);
    expect(perVisitCap('€ 27,50 per behandeling')).toBe(27.5);
    expect(perVisitCap('Max. € 300 per jaar')).toBeNull();
  });

  it('reads a reimbursed percentage, default 100', () => {
    expect(pctOf({ coverage: '75% tot € 250 per jaar' } as CoverageRecord)).toBe(75);
    expect(pctOf({ coverage: 'Max. € 250 per jaar' } as CoverageRecord)).toBe(100);
  });

  it('reads the reimbursement without a contract', () => {
    const r = (provider: string) => ({ provider, conditions: '', coverage: '' }) as CoverageRecord;
    expect(noCtrFactor(r('Gecontracteerd 100%; zonder contract 50% (van gemiddeld tarief)'))).toBe(0.5);
    expect(noCtrFactor(r('Alleen bij een gecontracteerde therapeut'))).toBe(0);
    expect(noCtrFactor(r('Lid van de NVvP'))).toBeNull();
  });
});

describe('combo', () => {
  it('picks the cheapest compatible base policy', () => {
    const c = combo(packageNamed('Plus'));
    expect(c.base?.name).toBe('A Natura');
    expect(c.total).toBe(180);
  });

  it('respects free choice and the € 900 deductible', () => {
    S.freeChoice = true;
    expect(combo(packageNamed('Plus')).base?.name).toBe('A Vrij');
    S.deductible = 900;
    const c = combo(packageNamed('Plus'));
    expect(c.base).toBeNull();
    expect(c.reason).toMatch(/900/);
  });

  it('only uses base policies that allow the package', () => {
    expect(combo(packageNamed('Fysio 3')).base?.name).toBe('F Basis');
    expect(combo(packageNamed('Fysio 9')).base?.name).toBe('F Plus');
  });
});

describe('estimate', () => {
  it('caps treatments at the number of sessions covered', () => {
    S.chosen = ['physio'];
    S.plan = { physio: 9 };
    const e = estimate(packageNamed('Plus'), cellMap(data.records));
    expect(e.costs).toBe(9 * 42);
    expect(e.reimbursed).toBe(6 * 42);
  });

  it('caps visits at the maximum per day', () => {
    S.chosen = ['alternative'];
    S.plan = { alternative: 4 };
    const e = estimate(packageNamed('Plus'), cellMap(data.records));
    expect(e.reimbursed).toBe(4 * 40);
  });

  it('shares one budget between treatments under the same heading', () => {
    S.chosen = ['podiatry', 'insoles'];
    S.plan = { podiatry: 80, insoles: 80 };
    const e = estimate(packageNamed('Plus'), cellMap(data.records));
    expect(e.costs).toBe(160);
    expect(e.reimbursed).toBe(100);
  });

  it('applies the reimbursement without a contract when the user says so', () => {
    data.records[0].provider = 'zonder contract 50%';
    S.chosen = ['physio'];
    S.plan = { physio: 4 };
    S.providers = { physio: 'Fysio X' };
    S.contracts = { 'physio|A': 'no' };
    const e = estimate(packageNamed('Plus'), cellMap(data.records));
    expect(e.reimbursed).toBe(4 * 42 * 0.5);
    expect(e.detail[0].contractNote).toBe('geen contract: 50%');
  });

  it('adds premiums and own costs per year', () => {
    S.chosen = ['physio'];
    S.plan = { physio: 9 };
    const s = score(packageNamed('Plus'), cellMap(data.records));
    expect(s.yearly).toBe(180 * 12 + 3 * 42);
  });
});

describe('modBest', () => {
  it('picks the cheapest combination of modules for the needs', () => {
    S.chosen = ['physio', 'podiatry'];
    S.plan = { physio: 3, podiatry: 150 };
    const [best] = modBest(cellMap(data.records));
    expect(best.p.package).toBe('Fysio 3 + Voet');
    expect(best.p.premium).toBe(8);
    expect(best.c.base?.name).toBe('F Basis');
    expect(best.e.reimbursed).toBe(3 * 42 + 150);
  });
});
