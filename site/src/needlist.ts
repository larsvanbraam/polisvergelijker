import type { Need } from './types';

export const NEEDS: Need[] = [
  {
    id: 'physio',
    treatment: 'Fysiotherapie',
    label: 'Fysiotherapie',
    kind: 'sessions',
    unit: 'behandelingen',
    rate: 42,
    hint: '± € 42 per behandeling',
  },
  {
    id: 'podiatry',
    treatment: 'Podotherapie en voetzorg',
    label: 'Podotherapie / voetzorg',
    kind: 'eur',
    unit: '€ per jaar',
  },
  { id: 'insoles', treatment: 'Steunzolen', label: 'Steunzolen', kind: 'eur', unit: '€ per jaar' },
  {
    id: 'alternative',
    treatment: 'Alternatieve geneeswijzen',
    label: 'Alternatieve zorg (osteopaat, acupunctuur, homeopaat…)',
    kind: 'visits',
    unit: 'consulten',
    rate: 75,
    hint: '± € 75 per consult',
  },
  {
    id: 'glasses',
    treatment: 'Brillen en lenzen volwassenen',
    label: 'Bril of lenzen',
    kind: 'eur',
    unit: '€ per jaar',
  },
  {
    id: 'psychology',
    treatment: 'Psychologische zorg / mentale ondersteuning',
    label: 'Psychologische zorg (aanvullend)',
    kind: 'eur',
    unit: '€ per jaar',
  },
  {
    id: 'mindfulness',
    treatment: 'Mindfulness bij burn-out',
    label: 'Mindfulnesstraining',
    kind: 'eur',
    unit: '€ per jaar',
  },
  {
    id: 'dietitian',
    treatment: 'Diëtetiek',
    label: 'Diëtist (boven de basis)',
    kind: 'eur',
    unit: '€ per jaar',
  },
  {
    id: 'contraception',
    treatment: 'Anticonceptie',
    label: 'Anticonceptie (21+)',
    kind: 'eur',
    unit: '€ per jaar',
    hint: 'pil ± € 60 per jaar',
  },
  {
    id: 'dentist',
    treatment: 'Tandarts (aanvullend)',
    label: 'Tandarts (18+)',
    kind: 'eur',
    unit: '€ per jaar',
    hint: 'alleen als tandarts in het pakket zit',
  },
  {
    id: 'orthodontics',
    treatment: 'Orthodontie',
    label: 'Orthodontie (beugel)',
    kind: 'eur',
    unit: '€ totaal',
  },
  {
    id: 'travel_vaccines',
    treatment: 'Vaccinaties buitenland',
    label: 'Reisvaccinaties',
    kind: 'eur',
    unit: '€ per jaar',
  },
];
/** Common names that map to a treatment in the data. */
export const SYN: Record<string, string> = {
  Osteopathie: 'Alternatieve geneeswijzen',
  Acupunctuur: 'Alternatieve geneeswijzen',
  Chiropractie: 'Alternatieve geneeswijzen',
  Homeopathie: 'Alternatieve geneeswijzen',
  Haptotherapie: 'Alternatieve geneeswijzen',
  Natuurgeneeskunde: 'Alternatieve geneeswijzen',
  'Manuele therapie': 'Fysiotherapie',
  Oefentherapie: 'Fysiotherapie',
  Psycholoog: 'Psychologische zorg / mentale ondersteuning',
  Beugel: 'Orthodontie',
  Podoloog: 'Podotherapie en voetzorg',
  Pedicure: 'Pedicure bij diabetes',
  Contactlenzen: 'Brillen en lenzen volwassenen',
  'Laseren ogen': 'Ooglaseren',
  Huidtherapie: 'Acne / huidbehandelingen',
  Epileren: 'Ontharing (hirsutisme)',
  Kraamzorg: 'Kraamzorg eigen bijdrage',
  Borstvoeding: 'Lactatiekundige',
  Sportarts: 'Sportmedisch onderzoek',
  Hoortoestel: 'Hoortoestellen eigen bijdrage',
};
/** Preset need, or a custom need for any treatment (id "t:<treatment>"). */
export function needDef(id: string): Need {
  const n = NEEDS.find((x) => x.id === id);
  if (n) return n;
  return { id, treatment: id.slice(2), label: id.slice(2), kind: 'eur', unit: '€ per jaar' };
}
