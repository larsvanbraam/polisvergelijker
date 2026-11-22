export const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36';

/** Timeout for every request to a provider finder. */
export const timeout = (): AbortSignal => AbortSignal.timeout(8000);

/** Lower case without accents and with single spaces, for comparing names. */
export const normalize = (s: string | null | undefined): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Like normalize(), but also turns punctuation into spaces. */
export const normalizeWords = (s: string | null | undefined): string =>
  normalize(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isPostcode = (s: string): boolean => /^\d{4}\s?[A-Za-z]{2}$/.test(s.trim());

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, {
    ...init,
    headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers as Record<string, string>) },
    signal: timeout(),
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.split('?')[0]);
  return (await r.json()) as T;
}

/** Session cookies from a response (name=value pairs only). */
export function cookiesOf(r: Response): string {
  return r.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}
