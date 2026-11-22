import { defineConfig } from 'vite-plus';

export default defineConfig({
  // Serve /api/contract in `vp dev` with the same handler Vercel runs as a serverless function.
  plugins: [
    {
      name: 'api-contract',
      configureServer(server) {
        server.middlewares.use('/api/contract', (req, res) => {
          server
            .ssrLoadModule('/api/contract.ts')
            .then((mod) => (mod as typeof import('./api/contract')).default(req, res))
            .catch((e: unknown) => {
              res.statusCode = 500;
              res.end(String(e));
            });
        });
      },
    },
  ],
  test: {
    include: ['src/**/*.test.ts', 'lib/**/*.test.ts', 'api/**/*.test.ts'],
  },
  lint: {
    ignorePatterns: ['dist/**'],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    singleQuote: true,
    printWidth: 110,
    ignorePatterns: ['public/**'],
  },
});
