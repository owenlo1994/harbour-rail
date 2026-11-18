import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inferLayer, loadLocalSpatialInput } from './spatial-input.js';
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
const config = {
  version: 1,
  provider: 'csdi',
  file: 'data/raw/test.geojson',
  format: 'geojson',
  sourceUrl: 'https://example.com/fixture',
  licenseUrl: 'https://example.com/license',
  retrievedAt: '2026-11-16T00:00:00Z',
  crs: 'EPSG:4326',
  fields: { lineCode: 'line', sourceId: 'id' },
};
async function local(text: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'mtr-input-'));
  temporary.push(root);
  await mkdir(path.join(root, 'data/raw'), { recursive: true });
  await writeFile(path.join(root, config.file), text);
  return root;
}
describe('local spatial ingestion boundary', () => {
  it('reads local GeoJSON without network calls', async () => {
    const root = await local('{"type":"FeatureCollection","features":[]}');
    const r = await loadLocalSpatialInput(root, config);
    expect(r.format).toBe('geojson');
  });
  it('reads GML as structured XML without guessing its axis order', async () => {
    const root = await local('<wfs:FeatureCollection xmlns:wfs="urn:wfs"/>');
    expect(
      (await loadLocalSpatialInput(root, { ...config, format: 'gml' })).format,
    ).toBe('gml');
  });
  it('rejects unverified CRS and XML entity declarations', async () => {
    const root = await local('<!DOCTYPE foo><foo/>');
    await expect(
      loadLocalSpatialInput(root, { ...config, crs: 'EPSG:2326' }),
    ).rejects.toThrow('CRS_MAPPING_REQUIRED');
    await expect(
      loadLocalSpatialInput(root, { ...config, format: 'gml' }),
    ).rejects.toThrow('GML_EXTERNAL_ENTITIES_FORBIDDEN');
  });
  it('rejects files outside raw directory', async () => {
    const root = await local('{}');
    await writeFile(path.join(root, 'outside.json'), '{}');
    await expect(
      loadLocalSpatialInput(root, { ...config, file: 'outside.json' }),
    ).rejects.toThrow('SPATIAL_INPUT_OUTSIDE_RAW');
  });
});
describe('layer inference is explicit and conservative', () => {
  it('does not interpret absent tags as surface', () =>
    expect(inferLayer({})).toMatchObject({ layer: 'unknown', inferred: true }));
  it('labels tunnel and bridge inference', () => {
    expect(inferLayer({ tunnel: 'yes' })).toMatchObject({
      layer: 'underground',
      inferred: true,
    });
    expect(inferLayer({ bridge: 'viaduct' })).toMatchObject({
      layer: 'elevated',
      inferred: true,
    });
  });
  it('flags conflicting tunnel/bridge tags', () =>
    expect(inferLayer({ tunnel: 'yes', bridge: 'yes' }).layer).toBe('unknown'));
  it('marks layer-only inference as needing review', () =>
    expect(inferLayer({ layer: '-1' })).toMatchObject({
      layer: 'unknown',
      basis: 'relative-layer-only-needs-review',
    }));
  it('lets reviewed overrides win', () =>
    expect(inferLayer({ tunnel: 'yes' }, { layer: 'surface' })).toMatchObject({
      layer: 'surface',
      inferred: false,
    }));
});
