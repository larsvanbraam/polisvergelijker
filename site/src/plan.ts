import { cardify } from './cards';
import { renderCtr } from './contracts';
import { D, activePackages, labelOn, membersOnly, rows } from './data';
import { docName, fn, fnList, fnPremium, fnRec, resetFootnotes } from './footnotes';
import { $, esc, eur, money } from './format';
import { purchaseLine, siteLink } from './links';
import { NEEDS, SYN, needDef } from './needlist';
import { cellMap, modBest, score, type Scored } from './pricing';
import { S, saveCtr } from './state';
import type { BasePolicy } from './types';

/* ---------- Step-by-step plan (tab "stappenplan") ---------- */

/** Treatments in the active data: category and number of packages that cover it. */
function allTreatments(): Map<string, { g: string; n: number }> {
  const m = new Map<string, { g: string; n: number }>();
  for (const r of rows()) {
    if (!m.has(r.treatment)) m.set(r.treatment, { g: r.category, n: 0 });
    if (r.covered) m.get(r.treatment)!.n++;
  }
  return m;
}
function renderPlanInputs(): void {
  const chosen = S.chosen.map(needDef);
  const cards = chosen
    .map(
      (
        n,
      ) => `<div class="need"><div class="nh"><label for="nd-${esc(n.id)}">${esc(n.label)}</label><button class="x" data-rm="${esc(n.id)}" aria-label="${esc(n.label)} verwijderen" title="Verwijderen">×</button></div>
    <div class="in"><input type="number" min="0" step="1" id="nd-${esc(n.id)}" data-id="${esc(n.id)}" value="${S.plan[n.id] || ''}" placeholder="0"> ${esc(n.unit)}</div>
    <div class="small">${n.hint ? esc(n.hint) : '&nbsp;'}</div>
    <input class="prov" data-prov="${esc(n.id)}" value="${esc(S.providers[n.id] || '')}" placeholder="Eigen zorgverlener (optioneel)" aria-label="Eigen zorgverlener voor ${esc(n.label)}"></div>`,
    )
    .join('');
  const m = allTreatments(),
    taken = new Set(chosen.map((n) => n.treatment));
  const quick = NEEDS.filter((n) => !S.chosen.includes(n.id));
  const opts = [...m]
    .filter(([b]) => !taken.has(b))
    .sort((a, b) => a[1].g.localeCompare(b[1].g) || b[1].n - a[1].n);
  $('#plan-needs').innerHTML =
    cards +
    `<div class="need add"><label for="nd-add">Zorg toevoegen</label>
    <input list="nd-list" id="nd-add" placeholder="Zoek, bijv. osteopathie, ergotherapie, acne…" autocomplete="off">
    <datalist id="nd-list">${Object.keys(SYN)
      .filter((k) => !taken.has(SYN[k]))
      .map((k) => `<option value="${esc(k)}">valt onder ${esc(SYN[k])}</option>`)
      .join('')}${opts.map(([b, o]) => `<option value="${esc(b)}">${esc(o.g)}</option>`).join('')}</datalist>
    <div class="chips">${quick.map((n) => `<button class="chip" data-add="${n.id}">+ ${esc(n.label.split(' (')[0])}</button>`).join('')}</div></div>`;
  const box = $('#plan-needs');
  box.oninput = (e) => {
    const target = e.target as HTMLInputElement;
    const id = target.dataset.id;
    if (id) {
      S.plan[id] = +target.value || 0;
      renderPlanResult();
      return;
    }
    const pv = target.dataset.prov;
    if (pv !== undefined) {
      S.providers[pv] = target.value.trim();
      saveCtr();
      clearTimeout(providerTimer);
      providerTimer = setTimeout(() => {
        renderCtr();
        renderPlanResult();
      }, 250);
      return;
    }
    if (target.id === 'nd-add') {
      const v = target.value;
      if (SYN[v]) addNeed(SYN[v]);
      else if (m.has(v)) addNeed(v);
    }
  };
  box.onclick = (e) => {
    const t = e.target as HTMLElement;
    const a = t.closest<HTMLElement>('[data-add]'),
      r = t.closest<HTMLElement>('[data-rm]');
    if (a) {
      const id = a.dataset.add!;
      S.chosen.push(id);
      renderPlan();
      setTimeout(() => {
        const el = document.getElementById('nd-' + id);
        if (el) el.focus();
      }, 0);
    }
    if (r) {
      const rm = r.dataset.rm!;
      S.chosen = S.chosen.filter((x) => x !== rm);
      delete S.plan[rm];
      renderPlan();
    }
  };
}
let providerTimer: ReturnType<typeof setTimeout> | undefined;

function addNeed(b: string): void {
  const preset = NEEDS.find((n) => n.treatment === b);
  const id = preset ? preset.id : 't:' + b;
  if (!S.chosen.includes(id)) S.chosen.push(id);
  renderPlan();
  setTimeout(() => {
    const el = document.getElementById('nd-' + id);
    if (el) el.focus();
  }, 0);
}
/** Step 1 controls mirror the filter bar; changes are forwarded to the filter inputs. */
function syncS1(): void {
  const dd = $<HTMLSelectElement>('#s1-deductible');
  if (!dd) return;
  dd.value = String(S.deductible);
  $<HTMLInputElement>('#s1-free').checked = !!S.freeChoice;
  $<HTMLInputElement>('#s1-members').checked = !!S.members;
  const fw = (id: string, f: string) => {
    const el = $<HTMLInputElement>(id);
    el.onchange = () => {
      const t = $<HTMLInputElement>(f);
      if (t.type === 'checkbox') t.checked = el.checked;
      else t.value = el.value;
      t.dispatchEvent(new Event('change'));
    };
  };
  fw('#s1-deductible', '#f-deductible');
  fw('#s1-free', '#f-free');
  fw('#s1-members', '#f-members');
  $('#s1-next').onclick = () => {
    S.s1done = true;
    renderPlan();
    $('#step2').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    setTimeout(() => {
      const c = document.querySelector<HTMLElement>('#plan-needs [data-add]');
      if (c) c.focus({ preventScroll: true });
    }, 350);
  };
  $('#s2-base').onclick = () => {
    S.showBase = true;
    renderPlanResult();
    renderSteps();
    $('#step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#s2-next').onclick = () => {
    S.s2done = true;
    renderPlanResult();
    renderSteps();
    $('#step3').scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  };
}
/** Step states: done (check mark), current (green), pending (grey); later steps open after 'next'. */
export function renderSteps(): void {
  const d = !!S.s1done;
  const filled = S.chosen.some((id) => S.plan[id] > 0),
    d2 = d && S.s2done && filled;
  const nb = $<HTMLButtonElement>('#s2-next');
  nb.disabled = !filled;
  $('#s2-hint').hidden = filled;
  nb.hidden = d2;
  $('#step3-body').hidden = !d2 && !S.showBase;
  $('#step1').classList.toggle('current', !d);
  $('#step1').classList.toggle('done', d);
  $('#s1-next').hidden = d;
  $('#step2-body').hidden = !d;
  if (!d) $('#step3-body').hidden = true;
  if (d) {
    $('#step2').classList.toggle('current', !d2);
    $('#step2').classList.toggle('done', d2);
    $('#step3').classList.toggle('current', d2 || !!S.showBase);
    $('#step3').classList.toggle('pending', !d2 && !S.showBase);
    if (!d2 && !S.showBase) $('#per-seg').hidden = true;
  }
  if (!d) {
    for (const i of ['#step2', '#step3']) {
      $(i).classList.remove('current', 'done');
      $(i).classList.add('pending');
    }
    $('#per-seg').hidden = true;
  } else $('#step2').classList.remove('pending');
}
export function renderPlan(): void {
  resetFootnotes();
  syncS1();
  renderPlanInputs();
  renderCtr();
  document.querySelectorAll<HTMLButtonElement>('#per-seg button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.per === S.per));
    b.onclick = () => {
      S.per = b.dataset.per as 'maand' | 'jaar';
      renderPlan();
    };
  });
  renderPlanResult();
  renderSteps();
}
interface BaseRow {
  l: string;
  x: BasePolicy;
  pr: number;
  source: string;
}

export function renderPlanResult(): void {
  if (!S.s1done) {
    renderSteps();
    return;
  }
  setTimeout(renderSteps, 0);
  resetFootnotes();
  const cell = cellMap(rows());
  const list: Scored[] = activePackages()
    .filter((p) => !p.module)
    .map((p) => score(p, cell))
    .concat(modBest(cell))
    .filter((x) => x.yearly != null)
    .sort((a, b) => (a.yearly as number) - (b.yearly as number));
  // reference: base insurance only
  const bases: BaseRow[] = [];
  for (const [l, b] of Object.entries(D.base)) {
    if (!labelOn(l)) continue;
    for (const x of b.policies) {
      if (S.freeChoice && !x.free_choice) continue;
      const pr = S.deductible === 900 ? x.p900 : x.p400;
      if (pr != null && !bases.some((y) => y.x.name === x.name))
        bases.push({ l, x, pr, source: x.premium_source || b.source });
    }
  }
  bases.sort((a, b) => a.pr - b.pr);
  const costs = list[0]
    ? list[0].e.costs
    : S.chosen
        .map(needDef)
        .reduce((s, n) => s + (S.plan[n.id] || 0) * (n.kind === 'eur' ? 1 : (n.rate ?? 0)), 0);
  const ref = bases[0]
    ? { name: bases[0].x.name, yearly: bases[0].pr * 12 + costs, pr: bases[0].pr, source: bases[0].source }
    : null;
  const best = list[0] as (Scored & { yearly: number }) | undefined;
  $('#plan-sum').innerHTML = best
    ? `Je verwacht ongeveer <b>${eur(costs)}</b> aan zorgkosten. Goedkoopst in totaal: <b>${esc(best.c.base?.name)} + ${esc(best.p.label)} ${esc(best.p.package)}</b> voor ${eur(Math.round((best.yearly / 12) * 100) / 100)} per maand, ${eur(Math.round(best.yearly))} per jaar (premie plus wat je zelf betaalt).` +
      (ref
        ? ` Alleen een basisverzekering (${esc(ref.name)}) kost je ${eur(Math.round((ref.yearly / 12) * 100) / 100)} per maand (${eur(Math.round(ref.yearly))} per jaar); ${ref.yearly <= best.yearly ? '<b>een aanvullende verzekering loont dan niet</b>.' : `een aanvullend pakket bespaart je dus ${eur(Math.round(ref.yearly - best.yearly))} per jaar.`}`
        : '')
    : 'Geen pakketten met bekende premie bij deze filters.';
  const noNeed = !S.chosen.some((id) => S.plan[id] > 0);
  $('#step2').classList.toggle('current', noNeed);
  $('#step2').classList.toggle('done', !noNeed);
  $('#step3').classList.toggle('current', !noNeed || !!S.showBase);
  $('#step3').classList.toggle('pending', noNeed && !S.showBase);
  $('#plan-out').hidden = noNeed && !S.showBase;
  $('#per-seg').hidden = noNeed && !S.showBase;
  if (noNeed && !S.showBase) {
    $('#plan-sum').innerHTML =
      `<span class="empty-step">Nog niets ingevuld. Kies bij stap 2 welke zorg je in 2027 verwacht en vul in hoeveel; dan zie je hier welk pakket in totaal het voordeligst is.</span> <button class="linkbtn" id="show-base">Of vergelijk alleen de basisverzekeringen</button>`;
    $('#show-base').onclick = () => {
      S.showBase = true;
      renderPlanResult();
    };
    return;
  }
  if (noNeed) {
    // no needs entered: ranking of base insurances only
    $('#plan-sum').innerHTML = bases.length
      ? `Je hebt geen zorg ingevuld, dus een aanvullende verzekering levert je niets op. Goedkoopste basisverzekering: <b>${esc(bases[0].x.name)}</b> voor ${eur(bases[0].pr)} per maand (${eur(Math.round(bases[0].pr * 12))} per jaar), bij een eigen risico van € ${S.deductible}${S.freeChoice ? ' en vrije zorgkeuze' : ''}. Vul hierboven zorg in om aanvullende pakketten mee te vergelijken. <button class="linkbtn" id="hide-base">Verbergen</button>`
      : 'Geen basisverzekeringen met bekende premie bij deze filters.';
    const hb = document.querySelector<HTMLElement>('#hide-base');
    if (hb)
      hb.onclick = () => {
        S.showBase = false;
        renderPlanResult();
      };
    const P2 = S.per === 'maand' ? 'per maand' : 'per jaar';
    const oonCell = (x: BasePolicy) =>
      x.out_of_network
        ? `<b>${esc(x.out_of_network)}</b>${fn(`<b>Vergoeding zonder contract ${esc(x.name)}</b>: ${esc(x.out_of_network)}${x.out_of_network_note ? ' (' + esc(x.out_of_network_note) + ')' : ''} van het gemiddeld gecontracteerde of marktconforme tarief – <a href="${esc(x.out_of_network_source)}">${esc(docName(x.out_of_network_source))}</a>${x.out_of_network_check ? '. Bron is een vergelijkingssite of een ouder overzicht; controleer bij de verzekeraar.' : ''}`)}${x.out_of_network_note ? `<div class="small">${esc(x.out_of_network_note)}</div>` : ''}${x.out_of_network_check ? ' <span class="pill">controleren</span>' : ''}`
        : '<span class="small">onbekend</span>';
    $('#plan-table').innerHTML =
      `<thead><tr><th>#</th><th>Basisverzekering</th><th>Soort polis</th><th>Zonder contract</th><th>Premie ${P2}</th></tr></thead><tbody>` +
      bases
        .slice(0, 25)
        .map(
          (x, i) =>
            `<tr class="${i === 0 ? 'best-row' : ''}"><td class="rk">${i + 1}</td><td><b>${esc(x.x.name)}</b>${fn(`<b>Premie ${esc(x.x.name)}</b>: ${eur(x.pr)} per maand bij eigen risico € ${S.deductible} – <a href="${esc(x.source)}">${esc(docName(x.source))}</a>`)}<div class="small">${esc(x.l)}${membersOnly(x.l) ? ' <span class="pill">alleen voor leden</span>' : ''}${siteLink(x.l)}</div></td><td>${esc(x.x.type)}</td><td>${oonCell(x.x)}</td><td class="num"><b>${money(x.pr * 12)}</b></td></tr>`,
        )
        .join('') +
      '</tbody>';
    cardify($<HTMLTableElement>('#plan-table'), { main: 1, hide: [0] });
    $('#plan-fn').innerHTML =
      fnList() +
      `<p class="small">Basispremies voor 18 jaar en ouder. <i>Zonder contract</i> is wat de polis maximaal vergoedt bij een zorgverlener zonder contract, als percentage van het gemiddeld gecontracteerde tarief (bij combinatiepolissen: marktconform tarief). Met contract is het bij elke polis 100%; vink vrije zorgkeuze aan om alleen combinatie- en restitutiepolissen te zien.</p>`;
    return;
  }
  if (ref && best && ref.yearly <= best.yearly)
    $('#plan-sum').innerHTML =
      `Je verwacht ongeveer <b>${eur(costs)}</b> aan zorgkosten. <b>Een aanvullende verzekering loont dan niet</b>: alleen ${esc(ref.name)} kost je ${eur(Math.round((ref.yearly / 12) * 100) / 100)} per maand (${eur(Math.round(ref.yearly))} per jaar, inclusief wat je zelf betaalt). Het voordeligste aanvullende pakket, ${esc(best.p.label)} ${esc(best.p.package)}, komt uit op ${eur(Math.round((best.yearly / 12) * 100) / 100)} per maand.`;
  const top = list.slice(0, 15);
  const per = S.per === 'maand' ? 'per maand' : 'per jaar';
  let h = `<thead><tr><th>#</th><th>Wat je afsluit</th><th>Premie ${per}</th><th>Verwachte vergoeding</th><th>Zelf betalen</th><th>Totaal ${per}</th></tr></thead><tbody>`;
  if (ref)
    h += `<tr class="ref-row"><td class="rk">–</td><td>Alleen ${esc(ref.name)}${fn(`<b>Premie ${esc(ref.name)}</b>: ${eur(ref.pr)} per maand – <a href="${esc(ref.source)}">${esc(docName(ref.source))}</a>`)}<div class="small">Geen aanvullende verzekering (referentie)</div></td><td class="num">${money(ref.pr * 12)}</td><td class="num">€ 0</td><td class="num">${money(costs)}</td><td class="num"><b>${money(ref.yearly)}</b></td></tr>`;
  h += top
    .map(
      (x, i) => `<tr class="${i === 0 ? 'best-row' : ''}"><td class="rk">${i + 1}</td>
    <td><b>${esc(x.p.label)} ${esc(x.p.package)}</b>${fnPremium(x.p, x.c)}${membersOnly(x.p.label) ? ' <span class="pill">alleen voor leden</span>' : ''}${x.p.mods ? ' <span class="pill">losse modules</span>' : ''}<div class="small">Afsluiten: ${purchaseLine(x.p, x.c)}</div>
      <details class="more"><summary>wat wordt vergoed</summary><div>${x.e.detail.length ? '' : 'Je hebt nog geen zorg ingevuld; vul bij stap 2 een aantal of bedrag in.'}${x.e.detail.map((d) => `${esc(d.n.label)}: ${eur(Math.round(d.paid))} van ${eur(d.cost)}${d.r ? fnRec(d.r) : ' (niet gedekt)'}${d.contractNote ? ` <span class="small${d.contractNote.startsWith('geen') ? ' warn-t' : ''}">(${esc(d.contractNote)})</span>` : ''}`).join('<br>')}</div></details></td>
    <td class="num">${money((x.c.total as number) * 12)}</td><td class="num">${money(x.e.reimbursed)}</td><td class="num">${money(x.e.costs - x.e.reimbursed)}</td><td class="num"><b>${money(x.yearly as number)}</b></td></tr>`,
    )
    .join('');
  $('#plan-table').innerHTML = h + '</tbody>';
  cardify($<HTMLTableElement>('#plan-table'), { main: 1, hide: [0] });
  $('#plan-fn').innerHTML =
    fnList() +
    `<p class="small">Schatting: fysiotherapie gerekend met € 42 en alternatieve consulten met € 75 per keer. Vergoedingen die samen één budget delen (bijvoorbeeld podotherapie en steunzolen) zijn één keer gemaximeerd. Tandartsverzekeringen die je apart afsluit en pakketten zonder bekende premie zitten niet in deze ranglijst. Bij FBTO, dat met losse modules werkt, kiest het stappenplan zelf de goedkoopste combinatie van modules voor jouw zorg. Controleer de voorwaarden via de voetnoten voordat je beslist.</p>`;
}
