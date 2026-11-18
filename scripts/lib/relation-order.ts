import { z } from 'zod';
import type { Osm } from './osm-network.js';

const overrideSchema = z.object({
  version: z.literal(1),
  overrides: z
    .array(
      z.object({
        relationId: z.literal(5317704),
        line: z.literal('TCL'),
        expectedWayOrder: z.array(z.number()).min(5),
        movedWayIds: z.tuple([
          z.literal(1176509649),
          z.literal(1558652644),
          z.literal(1558652643),
        ]),
        insertAfter: z.literal(1558652640),
        insertBefore: z.literal(1558652637),
        source: z.array(z.string()).min(1),
        reason: z.string().min(1),
      }),
    )
    .max(1),
});

/** One source-reviewed exception. Never a topology search, snap or nearest-neighbour join. */
export function applyApprovedRelationOrder(
  r: Osm['relations'][number],
  d: Osm,
  input: unknown,
) {
  const config = overrideSchema.parse(input);
  const override = config.overrides.find((o) => o.relationId === r.id);
  if (!override) return r;
  if (r.tags.ref !== override.line)
    throw Error('RELATION_OVERRIDE_LINE_CHANGED');
  const track = r.members.filter(
    (m) => m.type === 'w' && !m.role.startsWith('platform'),
  );
  if (
    JSON.stringify(track.map((m) => m.ref)) !==
    JSON.stringify(override.expectedWayOrder)
  )
    throw Error('RELATION_OVERRIDE_SOURCE_ORDER_CHANGED');
  if (
    JSON.stringify(track.slice(-3).map((m) => m.ref)) !==
    JSON.stringify(override.movedWayIds)
  )
    throw Error('RELATION_OVERRIDE_MOVED_GROUP_CHANGED');
  const afterIndex = track.findIndex((m) => m.ref === override.insertAfter);
  if (track[afterIndex + 1]?.ref !== override.insertBefore)
    throw Error('RELATION_OVERRIDE_NEIGHBOURS_CHANGED');
  const junctions = [
    override.insertAfter,
    ...override.movedWayIds,
    override.insertBefore,
  ];
  const expected = [10930801895, 10930801903, 13238819880, 10931051406];
  for (let i = 0; i < junctions.length - 1; i++) {
    const a = d.ways[junctions[i]],
      b = d.ways[junctions[i + 1]];
    if (
      !a ||
      !b ||
      a.nodes.at(-1) !== expected[i] ||
      b.nodes[0] !== expected[i]
    )
      throw Error('RELATION_OVERRIDE_ENDPOINT_ID_CHANGED');
  }
  const moved = new Set<number>(override.movedWayIds);
  const members = r.members.filter(
    (m) => !(m.type === 'w' && moved.has(m.ref)),
  );
  const index = members.findIndex(
    (m) => m.type === 'w' && m.ref === override.insertAfter,
  );
  members.splice(index + 1, 0, ...track.slice(-3));
  return { ...r, members };
}
