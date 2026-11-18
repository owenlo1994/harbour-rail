import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist/netlify-functions', { recursive: true });
await build({
  entryPoints: ['netlify/functions/rail.ts'],
  outfile: 'dist/netlify-runtime/handler.mjs',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  external: ['@netlify/blobs'],
});
await writeFile(
  'dist/netlify-functions/rail.mjs',
  "export { default } from '../netlify-runtime/handler.mjs';\nexport const config = { path: '/api/*' };\n",
);
