type Theme = 'auto' | 'light' | 'dark';

/** Light/dark switch; 'auto' follows the system (or the theme the host page sets). */
export function initTheme(): void {
  const root = document.documentElement;
  const hostTheme = root.getAttribute('data-theme');
  let t: Theme = 'auto';
  try {
    t = (localStorage.getItem('pv-theme') as Theme) || 'auto';
  } catch {
    // storage unavailable
  }
  const buttons = document.querySelectorAll<HTMLButtonElement>('#theme button');
  function apply(v: Theme): void {
    if (v === 'auto') {
      if (hostTheme) root.setAttribute('data-theme', hostTheme);
      else root.removeAttribute('data-theme');
    } else root.setAttribute('data-theme', v);
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === v)));
    try {
      localStorage.setItem('pv-theme', v);
    } catch {
      // storage unavailable
    }
  }
  buttons.forEach((b) => (b.onclick = () => apply(b.dataset.t as Theme)));
  apply(t);
}
