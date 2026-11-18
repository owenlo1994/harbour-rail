import { z } from 'zod';
const point = z.tuple([z.number(), z.number()]);
export const toyCitySchema = z.object({
  metadata: z.object({
    source: z.string(),
    timestamp: z.string().nullable(),
    sha256: z.string(),
    attribution: z.string(),
    license: z.string(),
    appearance: z.literal('decorative-not-survey'),
    inferred: z.literal(true),
    anchorMethod: z.string(),
  }),
  buildings: z.array(
    z.tuple([
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
      z.number(),
    ]),
  ),
  roads: z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z.object({
        type: z.literal('Feature'),
        geometry: z.object({
          type: z.literal('LineString'),
          coordinates: z.array(point).min(2),
        }),
        properties: z.object({
          id: z.number(),
          class: z.string(),
          bridge: z.boolean(),
          tunnel: z.boolean(),
        }),
      }),
    ),
  }),
  hills: z.array(
    z.object({ id: z.number(), coordinates: point, name: z.string() }),
  ),
  greens: z.array(z.tuple([z.number(), z.number(), z.number()])),
  landmarks: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      name: z.string(),
      coordinates: point,
      sourceTags: z.record(z.string(), z.string()),
    }),
  ),
});
export type ToyCity = z.infer<typeof toyCitySchema>;
