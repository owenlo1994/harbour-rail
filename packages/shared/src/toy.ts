import { z } from 'zod';
import type { LiveTrip } from './live.ts';
import { coordinateSchema, lineCodeSchema } from './index.ts';
import { networkSchema, stationsSchema } from './network.ts';
export const toyWorldSchema = z.object({
  publication: z.literal('toy-simulation'),
  timestamp: z.string().nullable(),
  network: networkSchema,
  stations: stationsSchema,
  colours: z.record(z.string(), z.string()),
  routes: z.array(
    z.object({
      id: z.string(),
      line: lineCodeSchema,
      path: z.array(z.tuple([z.number(), z.number()])).min(2),
    }),
  ),
  pendingLines: z.array(lineCodeSchema),
  upcomingStations: z
    .array(
      z.object({
        id: z.string(),
        line: z.literal('TCL'),
        chineseName: z.string(),
        englishName: z.string(),
        coordinates: coordinateSchema,
        sourceNodeId: z.number(),
        status: z.literal('not-open'),
        source: z.string(),
        sourceTags: z.record(z.string(), z.string()),
      }),
    )
    .default([]),
});
export type ToyWorld = z.infer<typeof toyWorldSchema>;
export interface ToyTrain {
  mode?: 'simulation' | 'live';
  live?: LiveTrip;
  correcting?: boolean;
  dataState?: 'predicted' | 'interrupted';
  id: string;
  line: z.infer<typeof lineCodeSchema>;
  coordinates: [number, number];
  heading: number;
  progress: number;
}
export function pathLengths(path: number[][]) {
  const lengths = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    lengths.push(
      lengths[i - 1] +
        Math.hypot(
          (a[0] - b[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360),
          a[1] - b[1],
        ),
    );
  }
  return lengths;
}
/** Ping-pong with endpoint dwell. This is a toy clock, not a timetable or train identity. */
export function sampleToy(
  path: [number, number][],
  lengths: number[],
  seconds: number,
  offset: number,
) {
  const cycle = 180,
    leg = 80,
    dwell = 10;
  const t = (((seconds + offset) % cycle) + cycle) % cycle;
  const forward = t < leg + dwell;
  let p = forward
    ? Math.min(t / leg, 1)
    : Math.max(1 - (t - leg - dwell) / leg, 0);
  p = Math.max(0, Math.min(1, p));
  const target = p * lengths.at(-1)!;
  let i = lengths.findIndex((x) => x >= target);
  i = Math.max(1, i);
  const a = path[i - 1],
    b = path[i],
    r = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1);
  let heading = Math.atan2(
    b[1] - a[1],
    (b[0] - a[0]) * Math.cos((a[1] * Math.PI) / 180),
  );
  if (!forward) heading += Math.PI;
  return {
    coordinates: [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r] as [
      number,
      number,
    ],
    heading,
    progress: p,
  };
}
