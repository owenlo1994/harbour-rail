import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assembleRoute,
  buildOsmNetwork,
  heavyRelations,
  osmSchema,
} from './osm-network.js';
import { parseMtrCsv } from './csv.js';
import {
  networkSchema,
  stationsSchema,
} from '../../packages/shared/src/network.js';
const d = osmSchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../fixtures/pbf-junctions.json', import.meta.url),
      'utf8',
    ),
  ),
);
const csv = parseMtrCsv(
  readFileSync(
    new URL('../../data/raw/mtr_lines_and_stations.csv', import.meta.url),
    'utf8',
  ),
);
const empty = { version: 1, groups: [] },
  segments = { version: 1, segments: [] };
describe('genuine PBF junction subset (original OSM object identities)', () => {
  it('keeps Lo Wu and Lok Ma Chau service relations separate', () => {
    const lmc = d.relations.find((r) => r.id === 4248589)!;
    const low = d.relations.find((r) => r.id === 4248590)!;
    expect(lmc.tags.from).toContain('Lok Ma Chau');
    expect(low.tags.from).toContain('Lo Wu');
    const lmcRefs = lmc.members
      .filter((m) => m.type === 'n')
      .map((m) => d.nodes[m.ref]?.tags.ref);
    const lowRefs = low.members
      .filter((m) => m.type === 'n')
      .map((m) => d.nodes[m.ref]?.tags.ref);
    expect(lmcRefs).not.toContain('LOW');
    expect(lowRefs).not.toContain('LMC');
    expect(assembleRoute(lmc, d).relationId).not.toBe(
      assembleRoute(low, d).relationId,
    );
  });
  it('keeps Po Lam and LOHAS Park branches in their original distinct relations', () => {
    const poa = d.relations.find((r) => r.id === 269672)!;
    const lhp = d.relations.find((r) => r.id === 13352937)!;
    expect(poa.tags.to).toContain('Po Lam');
    expect(lhp.tags.to).toContain('LOHAS Park');
    expect(
      poa.members
        .filter((m) => m.type === 'n')
        .map((m) => d.nodes[m.ref]?.tags.ref),
    ).not.toContain('LHP');
    expect(
      lhp.members
        .filter((m) => m.type === 'n')
        .map((m) => d.nodes[m.ref]?.tags.ref),
    ).not.toContain('POA');
  });
  it('preserves shared AEL/TCL way identities without relabelling either line', () => {
    const result = buildOsmNetwork(d, [], empty, segments);
    const shared = result.network.features.filter(
      (f) =>
        f.properties.line === 'AEL' && f.properties.sharedWith.includes('TCL'),
    );
    expect(shared.length).toBeGreaterThan(0);
    for (const a of shared) {
      const t = result.network.features.find(
        (f) =>
          f.properties.line === 'TCL' &&
          f.properties.sourceWayId === a.properties.sourceWayId,
      )!;
      expect(t.geometry).toEqual(a.geometry);
      expect(t.properties.colour).not.toBe(a.properties.colour);
    }
  });
  it('detects the real TCL source-order gap instead of joining or reordering it', () => {
    const result = assembleRoute(
      d.relations.find((r) => r.id === 5317704)!,
      d,
    );
    expect(result.gaps).toContainEqual({
      after: 1558652640,
      before: 1558652637,
      reason: 'unshared-endpoint',
    });
    expect(
      result.parts.some((p) =>
        p.some((n, i) => n === 10930801895 && p[i + 1] === 10931051406),
      ),
    ).toBe(false);
  });
  it('reports SUW/SWT identity conflict and never invents a station coordinate', () => {
    const s = csv.stations.find((s) => s.key === 'TML:SUW')!;
    const result = buildOsmNetwork(d, [s], empty, segments);
    expect(result.stations.stations).toHaveLength(0);
    expect(result.warnings.map((w) => w.code)).toContain(
      'STATION_REF_CONFLICT',
    );
    expect(result.warnings.map((w) => w.code)).toContain('STATION_UNMATCHED');
  });
  it('requires manual confirmation for every candidate', () => {
    const selected = csv.stations.filter((s) =>
      ['TCL:TUC', 'EAL:LOW', 'EAL:LMC'].includes(s.key),
    );
    const result = buildOsmNetwork(d, selected, empty, segments);
    expect(result.stations.stations.length).toBeGreaterThan(0);
    expect(
      result.stations.stations.every(
        (s) => s.confirmedInterchanges.length === 0,
      ),
    ).toBe(true);
    expect(result.candidates.every((c) => !c.confirmed)).toBe(true);
  });
  it('validates GeoJSON/station output and rejects invalid coordinates', () => {
    const result = buildOsmNetwork(d, [], empty, segments);
    expect(networkSchema.safeParse(result.network).success).toBe(true);
    expect(stationsSchema.safeParse(result.stations).success).toBe(true);
    const invalid = structuredClone(result.network);
    invalid.features[0].geometry.coordinates[0] = [999, 22];
    expect(networkSchema.safeParse(invalid).success).toBe(false);
  });
  it('does not include light rail or high-speed lines in the heavy network', () => {
    expect(
      heavyRelations(d).every((r) =>
        ['EAL', 'TML', 'TKL', 'TCL', 'AEL'].includes(r.tags.ref),
      ),
    ).toBe(true);
  });
});

const approvedRefs = JSON.parse(
  readFileSync(
    new URL('../../data/station-ref-overrides.json', import.meta.url),
    'utf8',
  ),
);
const uncertain = new Set<number>([1176509649, 1558652644, 1558652643]);
describe('2026-11-17 explicit decisions', () => {
  it('matches SUW only through the two approved original SWT nodes and retains both source codes', () => {
    const s = csv.stations.find((s) => s.key === 'TML:SUW')!;
    const result = buildOsmNetwork(
      d,
      [s],
      empty,
      segments,
      approvedRefs,
      uncertain,
    );
    expect(result.stations.stations).toHaveLength(1);
    const matched = result.stations.stations[0];
    expect(matched).toMatchObject({
      key: 'TML:SUW',
      stationCode: 'SUW',
      osmRef: 'SWT',
      coordinateInferred: false,
    });
    expect([2308404918, 2308405006]).toContain(matched.sourceNodeId);
    expect(matched.coordinates).toEqual(
      d.nodes[matched.sourceNodeId].coordinates,
    );
    expect(matched.refOverride?.source).toContain(
      'https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.6.pdf',
    );
    expect(matched.refOverride?.reason.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.code === 'STATION_REF_CONFLICT')).toBe(
      false,
    );
  });
  it('does not relax a different official key even when its name is identical', () => {
    const s = {
      ...csv.stations.find((s) => s.key === 'TML:SUW')!,
      key: 'TML:XYZ',
      stationCode: 'XYZ',
    };
    const result = buildOsmNetwork(
      d,
      [s],
      empty,
      segments,
      approvedRefs,
      uncertain,
    );
    expect(result.stations.stations).toHaveLength(0);
    expect(result.warnings.map((w) => w.code)).toContain(
      'STATION_REF_CONFLICT',
    );
  });
  it('rejects unapproved ref values on an approved node', () => {
    const changed = structuredClone(d);
    for (const id of [2308404918, 2308405006])
      changed.nodes[id].tags.ref = 'BAD';
    const result = buildOsmNetwork(
      changed,
      [csv.stations.find((s) => s.key === 'TML:SUW')!],
      empty,
      segments,
      approvedRefs,
    );
    expect(result.stations.stations).toHaveLength(0);
    expect(result.warnings.map((w) => w.code)).toContain(
      'STATION_REF_CONFLICT',
    );
  });
  it('does not allow SWT on other node IDs and leaves every other station match unchanged', () => {
    const changed = structuredClone(d);
    const id = 2308404918;
    const replacement = 9000000000000;
    changed.nodes[replacement] = { ...changed.nodes[id], id: replacement };
    delete changed.nodes[id];
    delete changed.nodes[2308405006];
    for (const r of changed.relations)
      r.members = r.members
        .filter((m) => m.ref !== 2308405006)
        .map((m) => (m.ref === id ? { ...m, ref: replacement } : m));
    const result = buildOsmNetwork(
      changed,
      [csv.stations.find((s) => s.key === 'TML:SUW')!],
      empty,
      segments,
      approvedRefs,
    );
    expect(result.stations.stations).toHaveLength(0);
    const sample = csv.stations.filter((s) =>
      ['EAL:LOW', 'EAL:LMC', 'TCL:TUC', 'TKL:LHP'].includes(s.key),
    );
    expect(
      buildOsmNetwork(d, sample, empty, segments, approvedRefs).stations,
    ).toEqual(buildOsmNetwork(d, sample, empty, segments).stations);
  });
  it('marks the three original ways uncertain and excludes them globally from network and animation member lists', () => {
    const result = buildOsmNetwork(
      d,
      [],
      empty,
      segments,
      approvedRefs,
      uncertain,
    );
    const held = result.auditedNetwork.features.filter((f) =>
      uncertain.has(f.properties.sourceWayId),
    );
    expect(held.length).toBeGreaterThanOrEqual(3);
    expect(
      held.every((f) => f.properties.status === 'uncertain-construction'),
    ).toBe(true);
    expect(
      result.network.features.every(
        (f) => !uncertain.has(f.properties.sourceWayId),
      ),
    ).toBe(true);
    expect(
      result.animationRoutes.every((r) =>
        r.memberWayIds.every((id) => !uncertain.has(id)),
      ),
    ).toBe(true);
    expect(result.routes.find((r) => r.relationId === 5317704)!.gaps).toEqual(
      assembleRoute(
        d.relations.find((r) => r.id === 5317704)!,
        d,
      ).gaps,
    );
  });
  it('keeps relative-layer-only evidence unknown and marks every colour unverified', () => {
    const result = buildOsmNetwork(
      d,
      [],
      empty,
      segments,
      approvedRefs,
      uncertain,
    );
    expect(
      result.auditedNetwork.features.every(
        (f) => f.properties.colour_source === 'osm-unverified',
      ),
    ).toBe(true);
    for (const f of result.auditedNetwork.features)
      if (f.properties.basis === 'relative-layer-only-needs-review')
        expect(f.properties.layer).toBe('unknown');
  });
});
