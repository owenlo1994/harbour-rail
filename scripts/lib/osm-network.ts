import { z } from 'zod';
import {
  lineCodeSchema,
  interchangeOverridesSchema,
  segmentOverridesSchema,
  keyOf,
  type LineCode,
} from '../../packages/shared/src/index.js';
import {
  networkSchema,
  stationsSchema,
  type Station,
  stationRefOverridesSchema,
} from '../../packages/shared/src/network.js';
import type { CsvStation } from './csv.js';
import { inferLayer } from './spatial-input.js';
import { applyApprovedRelationOrder } from './relation-order.js';
const tags = z.record(z.string(), z.string());
const member = z.object({
  type: z.string(),
  ref: z.number(),
  role: z.string(),
});
const relation = z.object({ id: z.number(), tags, members: z.array(member) });
export const osmSchema = z.object({
  metadata: z
    .object({
      sha256: z.string(),
      header: z.object({
        osmosis_replication_timestamp: z.string().nullable(),
      }),
    })
    .passthrough(),
  relations: z.array(relation),
  tclWayMemberships: z.array(relation).default([]),
  stopAreas: z.array(relation),
  ways: z.record(
    z.string(),
    z.object({ id: z.number(), tags, nodes: z.array(z.number()) }),
  ),
  nodes: z.record(
    z.string(),
    z.object({
      id: z.number(),
      tags,
      coordinates: z.tuple([z.number(), z.number()]),
    }),
  ),
});
export type Osm = z.infer<typeof osmSchema>;
type Relation = Osm['relations'][number];
export interface Warning {
  code: string;
  message: string;
  sourceIds?: number[];
  stationKeys?: string[];
}
const norm = (s: string) =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s’'·]/g, '');
export function distance(a: number[], b: number[]) {
  const rad = Math.PI / 180;
  const lat = ((a[1] + b[1]) / 2) * rad;
  return (
    Math.hypot((a[0] - b[0]) * Math.cos(lat), a[1] - b[1]) * rad * 6371008.8
  );
}
export function heavyRelations(d: Osm) {
  return d.relations.filter(
    (r) =>
      lineCodeSchema.safeParse(r.tags.ref).success &&
      ['subway', 'train'].includes(r.tags.route) &&
      /MTR|港鐵/i.test(r.tags.operator ?? ''),
  );
}
export function orderedWays(r: Relation, d: Osm) {
  return r.members
    .filter((m) => m.type === 'w' && !m.role.startsWith('platform'))
    .filter(
      (m) =>
        !d.ways[m.ref] ||
        ['subway', 'rail', 'light_rail'].includes(d.ways[m.ref].tags.railway),
    );
}
/** Identity-based joins only: never snap endpoints or fabricate connecting segments. */
export function assembleRoute(
  r: Relation,
  d: Osm,
  excludedWayIds: ReadonlySet<number> = new Set(),
) {
  const members = orderedWays(r, d).filter((m) => !excludedWayIds.has(m.ref));
  const parts: number[][] = [];
  const gaps: { after: number | null; before: number; reason: string }[] = [];
  let previous: number | null = null;
  for (let i = 0; i < members.length; i++) {
    const m = members[i],
      way = d.ways[m.ref];
    if (!way || way.nodes.some((n) => !d.nodes[n])) {
      gaps.push({
        after: previous,
        before: m.ref,
        reason: 'missing-way-or-node',
      });
      previous = null;
      parts.push([]);
      continue;
    }
    const ids = [...way.nodes];
    if (m.role === 'backward') ids.reverse();
    const current = parts.at(-1);
    const end = current?.at(-1);
    if (end === undefined) {
      const next = d.ways[members[i + 1]?.ref];
      if (m.role !== 'forward' && m.role !== 'backward' && next) {
        const ends = [next.nodes[0], next.nodes.at(-1)];
        if (ends.includes(ids[0]) && !ends.includes(ids.at(-1))) ids.reverse();
      }
      parts.push(ids);
    } else if (end === ids[0]) current!.push(...ids.slice(1));
    else if (
      end === ids.at(-1) &&
      m.role !== 'forward' &&
      m.role !== 'backward'
    )
      current!.push(...ids.reverse().slice(1));
    else {
      gaps.push({
        after: previous,
        before: m.ref,
        reason: 'unshared-endpoint',
      });
      parts.push(ids);
    }
    previous = m.ref;
  }
  return {
    relationId: r.id,
    line: r.tags.ref,
    from: r.tags.from ?? null,
    to: r.tags.to ?? null,
    via: r.tags.via ?? null,
    memberWayIds: members.map((m) => m.ref),
    excludedWayIds: orderedWays(r, d)
      .filter((m) => excludedWayIds.has(m.ref))
      .map((m) => m.ref),
    parts: parts.filter((p) => p.length > 1),
    gaps,
  };
}
export function buildOsmNetwork(
  d: Osm,
  csv: CsvStation[],
  manual: unknown,
  segmentInput: unknown,
  refInput: unknown = { version: 1, exceptions: [] },
  excludedWayIds: ReadonlySet<number> = new Set(),
  routeOrderInput: unknown = { version: 1, overrides: [] },
) {
  const warnings: Warning[] = [];
  const refOverrides = stationRefOverridesSchema.parse(refInput);
  if (
    new Set(refOverrides.exceptions.map((e) => e.key)).size !==
    refOverrides.exceptions.length
  )
    throw Error('DUPLICATE_REF_OVERRIDE');
  for (const e of refOverrides.exceptions)
    if (e.key !== keyOf(e)) throw Error('INVALID_REF_OVERRIDE_KEY');
  const allowedRef = (s: CsvStation, n: Osm['nodes'][string]) =>
    refOverrides.exceptions.find(
      (e) =>
        e.key === s.key &&
        e.line === s.line &&
        e.stationCode === s.stationCode &&
        e.osmRef === n.tags.ref &&
        e.nodeIds.includes(n.id),
    );

  const relations = heavyRelations(d),
    overrides = interchangeOverridesSchema.parse(manual),
    segments = segmentOverridesSchema.parse(segmentInput);
  const routes = relations.map((r) => assembleRoute(r, d));
  const animationRoutes = relations.map((r) => {
    const reviewed = applyApprovedRelationOrder(r, d, routeOrderInput);
    const route = assembleRoute(reviewed, d, excludedWayIds);
    const approvedTcl = r.tags.ref === 'TCL' && reviewed !== r;
    return {
      ...route,
      reviewStatus: approvedTcl
        ? 'user-confirmed-alignment'
        : r.tags.ref === 'TCL'
          ? 'review-held'
          : 'source-track',
      orderOverrideApplied: reviewed !== r,
      usableForAnimation:
        (r.tags.ref !== 'TCL' || approvedTcl) && route.gaps.length === 0,
    };
  });
  for (const route of routes)
    for (const gap of route.gaps)
      warnings.push({
        code: 'ROUTE_GAP',
        message: `${route.line} relation ${route.relationId}: ${gap.reason} (${gap.after} → ${gap.before}); no join created.`,
        sourceIds: [
          route.relationId,
          ...[gap.after, gap.before].filter((x): x is number => x !== null),
        ],
      });
  const ways = new Map<
    string,
    { way: Osm['ways'][string]; line: LineCode; relations: number[] }
  >();
  for (const r of relations)
    for (const member of orderedWays(r, d)) {
      const w = d.ways[member.ref];
      if (!w || w.nodes.length < 2 || w.nodes.some((n) => !d.nodes[n]))
        continue;
      const key = `${r.tags.ref}:${w.id}`,
        found = ways.get(key);
      if (found) found.relations.push(r.id);
      else
        ways.set(key, {
          way: w,
          line: r.tags.ref as LineCode,
          relations: [r.id],
        });
    }
  const colours = new Map<string, string>();
  for (const r of relations) {
    if (!/^#[a-fA-F0-9]{6}$/.test(r.tags.colour ?? ''))
      throw Error(`MISSING_LINE_COLOUR ${r.id}`);
    const old = colours.get(r.tags.ref);
    if (old && old.toLowerCase() !== r.tags.colour.toLowerCase())
      throw Error(`CONFLICTING_LINE_COLOUR ${r.tags.ref}`);
    colours.set(r.tags.ref, r.tags.colour);
  }
  const auditedNetwork = networkSchema.parse({
    type: 'FeatureCollection',
    features: [...ways].map(([key, entry]) => {
      const sourceId = `way/${entry.way.id}`;
      const override = segments.segments.find((s) => s.sourceId === sourceId);
      let layer = inferLayer(entry.way.tags, override);
      if (!override && entry.way.tags['railway:position']) {
        const position = entry.way.tags['railway:position'];
        const map: Record<string, string> = {
          underground: 'underground',
          elevated: 'elevated',
          ground: 'surface',
          surface: 'surface',
        };
        if (map[position])
          layer = {
            layer: map[position],
            inferred: true,
            basis: 'railway:position',
          };
        else
          warnings.push({
            code: 'UNKNOWN_RAILWAY_POSITION',
            message: `${sourceId}: ${position}`,
            sourceIds: [entry.way.id],
          });
      }
      const weakLayer = layer.basis === 'relative-layer-only-needs-review';
      if (weakLayer) layer = { ...layer, layer: 'unknown' };
      if (
        layer.layer === 'unknown' ||
        layer.basis === 'relative-layer-only-needs-review'
      )
        warnings.push({
          code: weakLayer ? 'LAYER_RELATIVE_ONLY' : 'LAYER_UNKNOWN',
          message: `${sourceId}: ${layer.basis}; ${entry.line}`,
          sourceIds: [entry.way.id],
        });
      return {
        type: 'Feature',
        id: key,
        geometry: {
          type: 'LineString',
          coordinates: entry.way.nodes.map((n) => d.nodes[n].coordinates),
        },
        properties: {
          line: entry.line,
          sourceWayId: entry.way.id,
          relationIds: [...new Set(entry.relations)],
          ...layer,
          sharedWith: [...ways.values()]
            .filter((v) => v.way.id === entry.way.id && v.line !== entry.line)
            .map((v) => v.line),
          colour: colours.get(entry.line),
          colour_source: 'osm-unverified',
          status: excludedWayIds.has(entry.way.id)
            ? 'uncertain-construction'
            : 'source-track',
        },
      };
    }),
  });
  const network = networkSchema.parse({
    ...auditedNetwork,
    features: auditedNetwork.features.filter(
      (f) => f.properties.status !== 'uncertain-construction',
    ),
  });
  const areaByNode = new Map<number, number[]>();
  for (const a of d.stopAreas)
    for (const m of a.members)
      if (m.type === 'n')
        areaByNode.set(m.ref, [...(areaByNode.get(m.ref) ?? []), a.id]);
  const stations: Station[] = [];
  for (const s of csv) {
    const lineRels = relations.filter((r) => r.tags.ref === s.line),
      memberIds = new Set(
        lineRels.flatMap((r) =>
          r.members.filter((m) => m.type === 'n').map((m) => m.ref),
        ),
      );
    const trackIds = new Set(
      [...ways.values()]
        .filter((w) => w.line === s.line)
        .flatMap((w) => w.way.nodes),
    );
    const lineAreas = new Set(
      [...memberIds].flatMap((id) => areaByNode.get(id) ?? []),
    );
    const conflictingNames = Object.values(d.nodes)
      .filter((n) =>
        ['station', 'stop', 'halt', 'stop_position'].includes(
          n.tags.railway ?? '',
        ),
      )
      .filter(
        (n) =>
          (norm(n.tags['name:zh-Hant'] ?? n.tags['name:zh'] ?? '') ===
            norm(s.chineseName) ||
            norm(n.tags['name:en'] ?? '') === norm(s.englishName)) &&
          n.tags.ref &&
          n.tags.ref !== s.stationCode &&
          memberIds.has(n.id) &&
          !allowedRef(s, n),
      );
    if (conflictingNames.length)
      warnings.push({
        code: 'STATION_REF_CONFLICT',
        message: `${s.key}: official CSV ref ${s.stationCode}; matching OSM route stop ref(s) ${[...new Set(conflictingNames.map((n) => n.tags.ref))].join(', ')}. No alias applied.`,
        stationKeys: [s.key],
        sourceIds: conflictingNames.map((n) => n.id),
      });
    const candidates = Object.values(d.nodes)
      .filter((n) =>
        ['station', 'stop', 'halt', 'stop_position'].includes(
          n.tags.railway ?? '',
        ),
      )
      .filter((n) => {
        const zh = norm(n.tags['name:zh-Hant'] ?? n.tags['name:zh'] ?? ''),
          en = norm(n.tags['name:en'] ?? '');
        return (
          (zh === norm(s.chineseName) || en === norm(s.englishName)) &&
          (!n.tags.ref || n.tags.ref === s.stationCode || !!allowedRef(s, n))
        );
      })
      .map((n) => {
        const direct = memberIds.has(n.id),
          onTrack = trackIds.has(n.id),
          sameArea = (areaByNode.get(n.id) ?? []).some((id) =>
            lineAreas.has(id),
          );
        const trackDistance = onTrack
          ? 0
          : Math.min(
              ...[...memberIds]
                .map((id) => d.nodes[id])
                .filter(Boolean)
                .map((p) => distance(n.coordinates, p.coordinates)),
            );
        return {
          n,
          direct,
          onTrack,
          sameArea,
          trackDistance,
          rank: (direct ? 0 : 1) + (onTrack ? 0 : 2) + (sameArea ? 0 : 1),
        };
      })
      .filter(
        (c) => (c.direct || c.onTrack || c.sameArea) && c.trackDistance <= 500,
      )
      .sort(
        (a, b) =>
          a.rank - b.rank ||
          a.trackDistance - b.trackDistance ||
          a.n.id - b.n.id,
      );
    if (!candidates.length) {
      warnings.push({
        code: 'STATION_UNMATCHED',
        message: `No verified name/ref + route/stop_area match for ${s.key}; no coordinate generated.`,
        stationKeys: [s.key],
      });
      continue;
    }
    const best = candidates[0],
      sameStation = candidates.filter(
        (c) => distance(c.n.coordinates, best.n.coordinates) <= 500,
      );
    if (sameStation.length > 1)
      warnings.push({
        code: 'PLATFORM_REPRESENTATIVE',
        message: `${s.key}: retained original OSM node ${best.n.id}, ${sameStation.length} matching station/platform nodes; no averaging.`,
        stationKeys: [s.key],
        sourceIds: sameStation.map((c) => c.n.id),
      });
    if (allowedRef(s, best.n))
      warnings.push({
        code: 'STATION_REF_OVERRIDE_APPROVED',
        message: `${s.key}: approved node-specific ref ${best.n.tags.ref}; original official code and OSM ref retained.`,
        stationKeys: [s.key],
        sourceIds: [best.n.id],
      });
    if (norm(best.n.tags['name:zh'] ?? '') !== norm(s.chineseName))
      warnings.push({
        code: 'CHINESE_NAME_VARIANT',
        message: `${s.key}: CSV ${s.chineseName}; OSM ${best.n.tags['name:zh'] ?? 'missing'}; matched using English and route evidence.`,
        stationKeys: [s.key],
        sourceIds: [best.n.id],
      });
    stations.push({
      key: s.key,
      line: s.line,
      stationCode: s.stationCode,
      chineseName: s.chineseName,
      englishName: s.englishName,
      coordinates: best.n.coordinates,
      sourceNodeId: best.n.id,
      osmRef: best.n.tags.ref ?? null,
      refOverride: allowedRef(s, best.n)
        ? {
            source: allowedRef(s, best.n)!.source,
            reason: allowedRef(s, best.n)!.reason,
          }
        : null,
      stopAreaIds: areaByNode.get(best.n.id) ?? [],
      matchingInferred: true,
      coordinateInferred: false,
      matchEvidence: [
        best.direct ? 'route-node-member' : 'stop-area/track-membership',
        best.n.tags.ref === s.stationCode ? 'matching-ref' : 'name-only',
        `distance-to-line-stop:${Math.round(best.trackDistance)}m`,
      ],
      alternativeNodeIds: sameStation.slice(1).map((c) => c.n.id),
      confirmedInterchanges: [],
    });
  }
  for (const group of overrides.groups) {
    const members = group.members.map(keyOf);
    if (members.some((k) => !stations.some((s) => s.key === k)))
      throw Error(`INVALID_INTERCHANGE_OVERRIDE ${group.id}`);
    for (const s of stations)
      if (members.includes(s.key))
        s.confirmedInterchanges.push(...members.filter((k) => k !== s.key));
  }
  const candidates = [];
  for (let i = 0; i < stations.length; i++)
    for (let j = i + 1; j < stations.length; j++) {
      const a = stations[i],
        b = stations[j];
      if (a.line === b.line) continue;
      const metres = distance(a.coordinates, b.coordinates);
      const sameStopArea = a.stopAreaIds.some((id) =>
        b.stopAreaIds.includes(id),
      );
      if (metres <= 600 || sameStopArea)
        candidates.push({
          a: {
            key: a.key,
            chineseName: a.chineseName,
            englishName: a.englishName,
            sourceNodeId: a.sourceNodeId,
          },
          b: {
            key: b.key,
            chineseName: b.chineseName,
            englishName: b.englishName,
            sourceNodeId: b.sourceNodeId,
          },
          distanceMetres: Math.round(metres * 10) / 10,
          sameStopArea,
          confirmed: a.confirmedInterchanges.includes(b.key),
          inferred: true,
        });
    }
  warnings.push({
    code: 'INTERCHANGE_CONFIRMATION_REQUIRED',
    message: `${candidates.filter((c) => !c.confirmed).length} unconfirmed candidates are not treated as interchanges.`,
  });
  warnings.push({
    code: 'LIGHT_RAIL_PHASE_2',
    message:
      'Light rail and high-speed relations are audited but excluded from the heavy rail network.',
  });
  return {
    network,
    auditedNetwork,
    animationRoutes,
    stations: stationsSchema.parse({
      version: 1,
      attribution: '© OpenStreetMap contributors',
      timestamp: d.metadata.header.osmosis_replication_timestamp,
      stations,
    }),
    routes,
    candidates,
    warnings,
    colours: Object.fromEntries(colours),
  };
}
