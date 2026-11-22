# Provider finders

`api/contract.ts` asks the insurers' provider finders ("zorgzoekers") whether a provider has a contract. Each concern has one finder in this folder; `index.ts` lists them.

Each finder exports a `Finder` (see `types.ts`):

```ts
{ concern: string; labels: string[]; check(query: FinderQuery): Promise<FinderResult> }
```

- `query.name`: search text for the provider (e.g. "Fysio Jansen"); `query.location`: postcode ("3511AB") or place; `query.careType`: care type in the finder's words (e.g. "fysiotherapie"), empty to search on name and place only.
- Returns `{ status: 'ok', matches: [{ name, address, contract, text }] }` or `{ status: 'unsupported' | 'error', reason }`. Never throw; catch errors.
- `contract`: `yes` = contracted/reimbursed, `no` = no contract, `negotiating` = still negotiating (put what the insurer reimburses meanwhile in `text`), `unknown`.
- Only the built-in `fetch` of Node 22+, no npm packages. Every request uses `timeout()` (8 s) from `util.ts`.

The finders call undocumented endpoints of the insurers' websites. Field names of those responses are Dutch and stay as they are; the texts shown to users (`text`, `reason`) are Dutch too. `finders.test.ts` checks the mapping with recorded-style responses; whether the live endpoints still answer the same way can only be checked against the real sites.

| File                                                 | Concern           | Labels                                          |
| ---------------------------------------------------- | ----------------- | ----------------------------------------------- |
| `achmea.ts`                                          | Achmea            | Zilveren Kruis, Interpolis, FBTO, De Friesland  |
| `cz.ts`                                              | CZ groep          | CZ, CZdirect, OHRA, Nationale-Nederlanden, Just |
| `vgz.ts`                                             | VGZ               | VGZ, Univé, IZA                                 |
| `dsw.ts`, `asr.ts` (via `pw-platform.ts`)            | DSW, a.s.r.       | DSW, Stad Holland; a.s.r., VvAA                 |
| `menzis.ts`, `eno.ts`, `onvz.ts` (via `z-zoeker.ts`) | Menzis, ENO, ONVZ | Menzis; Salland; ONVZ                           |
| `zorgenzekerheid.ts`                                 | Zorg en Zekerheid | Zorg en Zekerheid                               |
| `eucare.ts`                                          | Eucare            | Aevitae                                         |
