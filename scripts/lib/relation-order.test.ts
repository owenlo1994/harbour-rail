import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyApprovedRelationOrder } from './relation-order.js';
import { assembleRoute, osmSchema } from './osm-network.js';
const input = JSON.parse(
  readFileSync(
    new URL('../../data/relation-order-overrides.json', import.meta.url),
    'utf8',
  ),
);
const d = osmSchema.parse(
  JSON.parse(
    readFileSync(
      new URL('../fixtures/tcl-approved-order.json', import.meta.url),
      'utf8',
    ),
  ),
);
const r = d.relations[0];

describe('user-confirmed TCL order exception from real PBF', () => {
  it('joins the specified original ways by identical node IDs and preserves every source edge', () => {
    expect(assembleRoute(r, d).gaps).toHaveLength(2);
    const reviewed = applyApprovedRelationOrder(r, d, input);
    const route = assembleRoute(reviewed, d);
    expect(route.gaps).toHaveLength(0);
    expect(route.parts).toHaveLength(1);
    expect(route.memberWayIds.slice(3, 8)).toEqual([
      1558652640, 1176509649, 1558652644, 1558652643, 1558652637,
    ]);
    expect([...route.memberWayIds].sort()).toEqual(
      [...assembleRoute(r, d).memberWayIds].sort(),
    );
    const edges = new Set(
      Object.values(d.ways).flatMap((w) =>
        w.nodes
          .slice(1)
          .flatMap((node, i) => [
            `${w.nodes[i]}:${node}`,
            `${node}:${w.nodes[i]}`,
          ]),
      ),
    );
    expect(
      route.parts[0]
        .slice(1)
        .every((node, i) => edges.has(`${route.parts[0][i]}:${node}`)),
    ).toBe(true);
    expect(r.members).toEqual(d.relations[0].members);
  });
  it('does not change another relation or a reverse-direction route', () => {
    const other = { ...r, id: 5317706 };
    expect(applyApprovedRelationOrder(other, d, input)).toBe(other);
    expect(() =>
      applyApprovedRelationOrder(
        { ...r, tags: { ...r.tags, ref: 'AEL' } },
        d,
        input,
      ),
    ).toThrow('LINE_CHANGED');
  });
  it('stops if any source track order or junction ID changes', () => {
    const changed = structuredClone(r);
    changed.members.push({ type: 'w', ref: 999, role: '' });
    expect(() => applyApprovedRelationOrder(changed, d, input)).toThrow(
      'SOURCE_ORDER_CHANGED',
    );
    const broken = structuredClone(d);
    broken.ways[1558652644].nodes[0] = 999;
    expect(() => applyApprovedRelationOrder(r, broken, input)).toThrow(
      'ENDPOINT_ID_CHANGED',
    );
  });
  it('keeps unopened stations separate, with real source coordinates and no invented codes', () => {
    expect(d.nodes[11039819034].coordinates).toEqual([113.9586238, 22.2972245]);
    expect(d.nodes[11039819033].coordinates).toEqual([113.9342024, 22.2811256]);
    for (const id of [11039819034, 11039819033]) {
      expect(d.nodes[id].tags.construction).toBe('station');
      expect(d.nodes[id].tags.ref).toBeUndefined();
    }
  });
});
