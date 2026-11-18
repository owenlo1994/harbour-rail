import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : (args[i + 1] ?? fallback);
};
const children = [
  spawn(
    process.execPath,
    [
      fileURLToPath(
        new URL('../node_modules/vite/bin/vite.js', import.meta.url),
      ),
      '--host',
      option('--host', '0.0.0.0'),
      '--port',
      option('--port', '5173'),
      '--strictPort',
    ],
    { cwd: root + '/apps/web', stdio: 'inherit' },
  ),
  spawn(process.execPath, ['--watch', '--import', 'tsx', 'src/index.ts'], {
    cwd: root + '/apps/api',
    stdio: 'inherit',
    env: {
      ...process.env,
      ...(process.env.HTTPS_PROXY ? { NODE_USE_ENV_PROXY: '1' } : {}),
    },
  }),
];
let ending = false;
function stop(code = 0) {
  if (ending) return;
  ending = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => stop());
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code ?? 0));
}
