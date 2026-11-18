import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { toyCitySchema } from './city';
import { toyWorldSchema } from '@hk-mtr/shared/toy';
describe('source-backed toy city assets', () => {
  it('keeps illustrative appearance separate from the same attributed PBF snapshot', () => {
    const city = toyCitySchema.parse(
      JSON.parse(readFileSync('apps/web/public/data/toy-city.json', 'utf8')),
    );
    const source = JSON.parse(
      readFileSync('data/raw/geofabrik-source.json', 'utf8'),
    );
    expect(city.metadata.sha256).toBe(source.sha256);
    expect(city.metadata.timestamp).toBe(
      source.header.osmosis_replication_timestamp,
    );
    expect(city.metadata.inferred).toBe(true);
    expect(city.metadata.appearance).toBe('decorative-not-survey');
    expect(new Set(city.buildings.map((b) => b[0])).size).toBe(
      city.buildings.length,
    );
    expect(city.buildings.length).toBeGreaterThan(1000);
    expect(
      city.landmarks.every(
        (l) =>
          /^(way|node)\/[0-9]+$/.test(l.id) &&
          Object.keys(l.sourceTags).length > 0,
      ),
    ).toBe(true);
  });
  it('includes all ten lines without treating unopened stations as official API station codes', () => {
    const world = toyWorldSchema.parse(
      JSON.parse(readFileSync('apps/web/public/data/toy-world.json', 'utf8')),
    );
    expect(new Set(world.routes.map((r) => r.line)).size).toBe(10);
    expect(world.upcomingStations.map((s) => s.chineseName)).toEqual([
      '東涌東',
      '東涌西',
    ]);
    expect(
      world.upcomingStations.every(
        (s) => !('stationCode' in s) && s.status === 'not-open',
      ),
    ).toBe(true);
    expect(world.stations.stations).toHaveLength(120);
  });
});
