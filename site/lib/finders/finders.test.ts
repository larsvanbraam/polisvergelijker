import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { asr } from './asr';
import { cz } from './cz';
import { vgz } from './vgz';
import { mapStatus } from './z-zoeker';

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('z-zoeker status', () => {
  it('maps contract statuses', () => {
    expect(mapStatus('GECONTRACTEERD')[0]).toBe('yes');
    expect(mapStatus('NIET_GECONTRACTEERD')[0]).toBe('no');
    expect(mapStatus('IN_ONDERHANDELING')[0]).toBe('negotiating');
    expect(mapStatus(undefined)[0]).toBe('unknown');
  });
});

describe('VGZ finder', () => {
  it('reads name, address and contract from the search API', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      json({
        zoekresultaat: [
          {
            basisInfo: {
              naam: 'Fysio <b>De Brug</b>',
              straat: 'Brugstraat',
              huisnummer: 1,
              postcode: '3511AB',
              plaatsnaam: 'Utrecht',
              contractStatus: 'Gecontracteerd',
              gecontracteerd: true,
              afstand: 1200,
            },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const r = await vgz.check({ name: 'Fysio De Brug', location: '3511 ab', careType: 'fysiotherapie' });
    expect(fetchMock.mock.calls[0][0]).toContain('postcode=3511AB');
    expect(r).toEqual({
      status: 'ok',
      matches: [
        {
          name: 'Fysio De Brug',
          address: 'Brugstraat 1, 3511AB Utrecht',
          contract: 'yes',
          text: 'Gecontracteerd, contract 2027, 1.2 km',
        },
      ],
    });
  });

  it('reports HTTP errors without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    expect(await vgz.check({ name: 'X', location: 'Utrecht', careType: '' })).toEqual({
      status: 'error',
      reason: 'HTTP 503',
    });
  });
});

describe('a.s.r. / DSW platform', () => {
  it('picks the care type and maps status codes', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes('GetZorgsoorten'))
        return json([{ zorgsoortName: 'Fysiotherapie', years: [2026, 2027], subZorgsoortCode: 'F1' }]);
      return json({
        results: [
          {
            name: 'Fysio De Brug',
            statusCode: 1,
            distance: 2,
            address: { street: 'Brugstraat', houseNumber: '1', postalCode: '3511AB', city: 'Utrecht' },
          },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const r = await asr.check({ name: 'Fysio De Brug', location: '3511AB', careType: 'fysiotherapie' });
    const body = JSON.parse(fetchMock.mock.calls[1][1]?.body as string) as unknown;
    expect(body).toMatchObject({ zorgsoortCode: 'F1', year: 2027, zorgpartijName: 'Fysio De Brug' });
    expect(r).toEqual({
      status: 'ok',
      matches: [
        {
          name: 'Fysio De Brug',
          address: 'Brugstraat 1, 3511AB Utrecht',
          contract: 'no',
          text: 'Geen contract: een deel niet vergoed (2027, 2 km)',
        },
      ],
    });
  });
});

describe('CZ finder', () => {
  it('needs a care type', async () => {
    expect(await cz.check({ name: 'X', location: 'Utrecht', careType: '' })).toMatchObject({
      status: 'error',
    });
  });
});
