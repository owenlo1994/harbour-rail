import { z } from 'zod';

export const lineCodeSchema = z.enum([
  'AEL',
  'TCL',
  'TML',
  'TKL',
  'EAL',
  'SIL',
  'TWL',
  'ISL',
  'KTL',
  'DRL',
]);
export type LineCode = z.infer<typeof lineCodeSchema>;
export const stationKeySchema = z.object({
  line: lineCodeSchema,
  stationCode: z.string().regex(/^[A-Z]{3}$/),
});
export type StationKey = z.infer<typeof stationKeySchema>;
export const keyOf = (s: StationKey) => `${s.line}:${s.stationCode}`;
export const interchangeOverridesSchema = z.object({
  version: z.literal(1),
  groups: z.array(
    z.object({
      id: z.string().min(1),
      members: z.array(stationKeySchema).min(2),
      reason: z.string().min(1),
      source: z.string().min(1),
    }),
  ),
});
export const segmentOverridesSchema = z.object({
  version: z.literal(1),
  segments: z.array(
    z.object({
      sourceId: z.string().min(1),
      layer: z.enum(['underground', 'elevated', 'surface', 'unknown']),
      reason: z.string().min(1),
      source: z.string().min(1),
    }),
  ),
});
export const coordinateSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const geometryInputSchema = z.object({
  version: z.literal(1),
  provider: z.enum(['csdi', 'osm']),
  file: z.string().min(1),
  format: z.enum(['geojson', 'gml']),
  sourceUrl: z.url(),
  licenseUrl: z.url(),
  retrievedAt: z.iso.datetime({ offset: true }),
  crs: z.string().min(1),
  // Explicit mapping, never guessed from a geometry property's name.
  fields: z.object({
    lineCode: z.string().min(1),
    stationCode: z.string().min(1).optional(),
    chineseName: z.string().min(1).optional(),
    englishName: z.string().min(1).optional(),
    sourceId: z.string().min(1),
    layer: z.string().min(1).optional(),
  }),
});
export interface BuildWarning {
  code: string;
  message: string;
  members?: string[];
}
export const apiStatusSchema = z.object({
  milestone: z.literal(1),
  geometry: z.literal('toy-source-backed'),
  message: z.string(),
  realtime: z.literal('official-predictions'),
});
