import { createRequire } from 'node:module';
import { defineConfig } from 'vite-plus';

const require = createRequire(import.meta.url);

export default defineConfig({
  // Serve /api/contract in `vp dev` with the same handler Vercel runs as a serverless function.
  plugins: [
    {
      name: 'api-contract',
      configureServer(server) {
        server.middlewares.use('/api/contract', (req, res) => {
          const handler = require('./api/contract.js');
          const url = new URL(req.url ?? '', 'http://localhost');
          const vreq = Object.assign(req, { query: Object.fromEntries(url.searchParams) });
          const vres = Object.assign(res, {
            json(body: unknown) {
              res.setHeader('content-type', 'application/json');
              res.end(JSON.stringify(body));
            },
          });
          Promise.resolve(handler(vreq, vres)).catch((e: unknown) => {
            res.statusCode = 500;
            res.end(String(e));
          });
        });
      },
    },
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
  lint: {
    ignorePatterns: ['dist/**', 'api/**', 'lib/**'],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    singleQuote: true,
    printWidth: 110,
    ignorePatterns: ['api/**', 'lib/**', 'public/**'],
  },
});
