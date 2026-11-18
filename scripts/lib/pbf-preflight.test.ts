import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectLocalPbf, PBF_RELATIVE_PATH } from './pbf-preflight.js';

const roots: string[] = [];
async function makeRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'mtr-pbf-preflight-'));
  roots.push(root);
  await mkdir(path.join(root, 'data/raw'), { recursive: true });
  return root;
}
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
describe('local PBF input gate (no parser fixtures)', () => {
  it('reports the exact missing path and no-download/no-fallback policy', async () => {
    const result = await inspectLocalPbf(await makeRoot());
    expect(result).toMatchObject({
      available: false,
      code: 'PBF_INPUT_MISSING',
      file: PBF_RELATIVE_PATH,
    });
    expect(result.message).toContain('不會自動下載或 fallback 到 Overpass');
  });
  it('rejects empty files', async () => {
    const root = await makeRoot();
    await writeFile(path.join(root, PBF_RELATIVE_PATH), '');
    expect(await inspectLocalPbf(root)).toMatchObject({
      available: false,
      code: 'PBF_INPUT_INVALID',
    });
  });
  it('rejects directories at the expected input path', async () => {
    const root = await makeRoot();
    await mkdir(path.join(root, PBF_RELATIVE_PATH));
    expect(await inspectLocalPbf(root)).toMatchObject({
      available: false,
      code: 'PBF_INPUT_INVALID',
    });
  });
});
