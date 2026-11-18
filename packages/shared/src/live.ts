import { z } from 'zod';
import { coordinateSchema, lineCodeSchema } from './index.ts';
export const directionSchema = z.enum(['UP', 'DOWN']);
export const liveNetworkSchema = z.object({
  version: z.literal(1),
  sourceTimestamp: z.string().nullable(),
  stations: z.array(
    z.object({
      line: lineCodeSchema,
      code: z.string(),
      nameZh: z.string(),
      nameEn: z.string(),
      coordinates: coordinateSchema,
      identitySource: z.string().optional(),
    }),
  ),
  routes: z.array(
    z.object({
      id: z.string(),
      line: lineCodeSchema,
      direction: directionSchema,
      via: z.enum(['RAC']).nullable(),
      path: z.array(coordinateSchema).min(2),
      stops: z
        .array(
          z.object({
            code: z.string(),
            nameZh: z.string(),
            distance: z.number(),
          }),
        )
        .min(2),
      geometryBasis: z.string(),
    }),
  ),
});
export type LiveNetwork = z.infer<typeof liveNetworkSchema>;
export type LiveRoute = LiveNetwork['routes'][number];
export const scheduleRowSchema = z
  .object({
    dest: z.string(),
    plat: z.union([z.string(), z.number()]).transform(String),
    time: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
    seq: z.union([z.string(), z.number()]).transform(Number),
    timetype: z.enum(['A', 'D']).optional(),
    timeType: z.enum(['A', 'D']).optional(),
    route: z.string().optional(),
  })
  .passthrough();
export const officialBoardSchema = z.object({
  state: z.literal('official'),
  line: lineCodeSchema,
  station: z.string(),
  updatedAt: z.string().nullable(),
  fetchedAt: z.string(),
  delay: z.string().nullable(),
  directions: z.object({
    UP: z.array(scheduleRowSchema),
    DOWN: z.array(scheduleRowSchema),
  }),
});
export type OfficialBoard = z.infer<typeof officialBoardSchema>;
export const timePointSchema = z.object({
  at: z.number(),
  distance: z.number(),
  station: z.string(),
  official: z.boolean(),
  kind: z.enum(['arrival', 'departure', 'schedule', 'model']),
});
export const liveTripSchema = z.object({
  id: z.string(),
  line: lineCodeSchema,
  direction: directionSchema,
  dest: z.string(),
  pathId: z.string(),
  via: z.enum(['RAC']).nullable(),
  platform: z.string(),
  points: z.array(timePointSchema).min(2),
  nextStation: z.string(),
  targetAt: z.number(),
  timeKind: z.enum(['arrival', 'departure', 'schedule']),
  targetOfficial: z.boolean(),
  sourceTime: z.number(),
  observedAt: z.number(),
  revision: z.string(),
  evidenceCount: z.number(),
  delay: z.boolean(),
  inferred: z.literal(true),
  nominalSpeedMps: z.number().positive(),
  lastOfficialDistance: z.number(),
});
export type LiveTrip = z.infer<typeof liveTripSchema>;
export const liveFeedSchema = z.object({
  mode: z.literal('official-predictions'),
  serverTime: z.number(),
  trains: z.array(liveTripSchema),
  coverage: z.object({
    stationsTotal: z.number(),
    stationsLoaded: z.number(),
    stationsFresh: z.number(),
    nextCursor: z.number(),
    polledKeys: z.array(z.string()),
  }),
  lines: z.array(
    z.object({
      line: lineCodeSchema,
      state: z.enum(['live', 'partial', 'unavailable', 'empty', 'loading']),
      fresh: z.number(),
      total: z.number(),
      updatedAt: z.number().nullable(),
      message: z.string().optional(),
    }),
  ),
  diagnostics: z.object({
    unmappedObservations: z.number(),
    apiLatencyMs: z.number(),
    rateLimitPerMinute: z.number(),
    cacheState: z.enum([
      'd1',
      'netlify-blobs',
      'edge-or-memory',
      'persistence-error',
    ]),
    unmappedExamples: z.array(
      z.object({
        line: lineCodeSchema,
        station: z.string(),
        direction: directionSchema,
        dest: z.string(),
        via: z.string().nullable(),
      }),
    ),
  }),
});
export type LiveFeed = z.infer<typeof liveFeedSchema>;
export function hkTime(value: string | null | undefined) {
  if (!value) return NaN;
  return Date.parse(value.replace(' ', 'T') + '+08:00');
}
export function haversine(a: readonly number[], b: readonly number[]) {
  const rad = Math.PI / 180,
    dlat = (b[1] - a[1]) * rad,
    dlon = (b[0] - a[0]) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dlon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function routeLengths(path: readonly (readonly number[])[]) {
  const lengths = [0];
  for (let i = 1; i < path.length; i++)
    lengths.push(lengths[i - 1] + haversine(path[i - 1], path[i]));
  return lengths;
}
export function pointAtDistance(
  path: [number, number][],
  lengths: number[],
  distance: number,
) {
  const d = Math.max(0, Math.min(distance, lengths.at(-1)!));
  let lo = 1,
    hi = lengths.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo),
    a = path[i - 1],
    b = path[i],
    r = (d - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  return {
    coordinates: [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r] as [
      number,
      number,
    ],
    heading: Math.atan2(
      b[1] - a[1],
      (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180),
    ),
  };
}
export function timelineDistance(points: LiveTrip['points'], now: number) {
  if (now <= points[0].at) return points[0].distance;
  const next = points.findIndex((p) => p.at >= now);
  if (next < 0) return points.at(-1)!.distance;
  const a = points[next - 1],
    b = points[next],
    t = Math.max(0, Math.min(1, (now - a.at) / (b.at - a.at || 1))),
    u = t * t * (3 - 2 * t);
  return a.distance + (b.distance - a.distance) * u;
}
/** Stateful correction is continuous; a revised forecast never teleports a marker.
 * Implausibly large changes are speed-limited and explicitly reported as correcting. */
export class LiveMotion {
  private state = new Map<
    string,
    {
      revision: string;
      points: LiveTrip['points'];
      distance: number;
      at: number;
      correcting: boolean;
    }
  >();
  sample(trip: LiveTrip, now: number) {
    let s = this.state.get(trip.id);
    if (!s) {
      s = {
        revision: trip.revision,
        points: trip.points,
        distance: timelineDistance(trip.points, now),
        at: now,
        correcting: false,
      };
      this.state.set(trip.id, s);
    }
    // Returning from a suspended/background renderer must use the real clock,
    // rather than replaying seconds of unseen motion and arriving late.
    if (now - s.at > 5000) {
      s.revision = trip.revision;
      s.points = trip.points;
      s.distance = timelineDistance(trip.points, now);
      s.at = now;
      s.correcting = false;
    }
    if (s.revision !== trip.revision) {
      const current = s.distance;
      const future = trip.points.filter(
        (p) => p.at > now && p.distance >= current,
      );
      s.points = [
        {
          at: now,
          distance: current,
          station: '',
          official: false,
          kind: 'model',
        },
        ...future,
      ];
      if (s.points.length === 1)
        s.points.push({ ...s.points[0], at: now + 1000 });
      s.revision = trip.revision;
    }
    const desired = timelineDistance(s.points, now),
      dt = Math.max(0, Math.min((now - s.at) / 1000, 2)),
      limit = trip.nominalSpeedMps * 2 * dt;
    const delta = desired - s.distance;
    s.correcting = delta > limit + 3 || delta < -3;
    s.distance = Math.max(s.distance, Math.min(desired, s.distance + limit));
    s.at = now;
    const age = Math.max(0, now - trip.sourceTime),
      opacity = age < 75000 ? 1 : Math.max(0, 1 - (age - 75000) / 30000);
    return {
      distance: s.distance,
      opacity,
      correcting: s.correcting,
      state: age > 75000 ? ('interrupted' as const) : ('predicted' as const),
    };
  }
  prune(ids: Set<string>) {
    for (const id of this.state.keys()) if (!ids.has(id)) this.state.delete(id);
  }
}
