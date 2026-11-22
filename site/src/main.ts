import { inject } from '@vercel/analytics';
import './style.css';
import { loadData, P, R, setData } from './data';
import { initFilters, route } from './filters';
import { $, key } from './format';
import { S } from './state';
import { initTheme } from './theme';

initTheme();
// Vercel Web Analytics: cookieless page views; only reports from the deployed site.
inject();

loadData()
  .then((d) => {
    setData(d);
    for (const l of new Set(P.map((p) => p.label))) S.labels.add(l);
    S.pick = [
      'VGZ|Aanvullend Beter',
      'DSW|AV-Standaard',
      'Menzis|ExtraVerzorgd 2',
      'Univé|Aanvullend Beter',
    ].filter((k) => P.some((p) => key(p) === k));
    initFilters();
    route();
    addEventListener('hashchange', route);
    $('#gen').textContent =
      `Dataset gegenereerd op ${d.generated}: ${P.length} pakketten, ${R.length} vergoedingsregels.`;
  })
  .catch((e: unknown) => {
    console.error(e);
    $('main').innerHTML =
      '<p class="empty">De vergoedingsdata kon niet worden geladen (' +
      String((e instanceof Error && e.message) || e).replace(/[<>&]/g, '') +
      '). Herlaad de pagina.</p>';
  });
