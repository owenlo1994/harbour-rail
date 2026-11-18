import { mkdir, readFile, readdir, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
const assets: Record<string, { body: string; type: string }> = {};
async function collect(dir: string, base = '') {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name),
      key = base + '/' + e.name;
    if (e.isDirectory()) await collect(file, key);
    else {
      const types: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.webmanifest': 'application/manifest+json',
      };
      assets[key] = {
        body: (await readFile(file)).toString('base64'),
        type: types[path.extname(file)] ?? 'application/octet-stream',
      };
    }
  }
}
await collect('apps/web/dist');
if (assets['/sw.js']) {
  const sw = Buffer.from(assets['/sw.js'].body, 'base64').toString('utf8');
  const precache = ['/', ...Object.keys(assets).filter((k) => k !== '/sw.js')];
  assets['/sw.js'].body = Buffer.from(
    sw.replace(
      /cache\.addAll\(\[[\s\S]*?\]\)/,
      'cache.addAll(' + JSON.stringify(precache) + ')',
    ),
  ).toString('base64');
}

await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await cp('drizzle', 'dist/.openai/drizzle', { recursive: true });
await build({
  entryPoints: ['apps/api/src/worker.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  define: { __SITE_ASSETS__: JSON.stringify(assets) },
  minify: true,
});
await writeFile(
  'dist/.openai/hosting.json',
  await readFile('.openai/hosting.json'),
);
console.log(
  `Worker built with ${Object.keys(assets).length} embedded assets. Official forecast positions are inferred; simulation stays separate.`,
);
