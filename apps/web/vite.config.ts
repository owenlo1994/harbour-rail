import { defineConfig } from 'vite';
import { readFile } from 'node:fs/promises';
// Development-only middleware. No configurePreviewServer, static copy or bundled dataset.
export default defineConfig({
  plugins: [
    {
      name: 'local-reviewed-map-preview',
      configureServer(server) {
        server.middlewares.use('/__dev/map', async (req, res) => {
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('{"error":"METHOD_NOT_ALLOWED"}');
            return;
          }
          try {
            res.end(
              await readFile(
                new URL(
                  '../../data/reports/development-map.json',
                  import.meta.url,
                ),
                'utf8',
              ),
            );
          } catch {
            res.statusCode = 503;
            res.end(
              JSON.stringify({
                error: 'DEVELOPMENT_DATA_NOT_BUILT',
                message:
                  '請先執行 npm run data:network；不提供 public 或舊資料 fallback。',
              }),
            );
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build: { target: 'es2022' },
});
