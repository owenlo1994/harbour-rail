import { z } from 'zod';
import { coordinateSchema, lineCodeSchema } from './index.ts';
export const layerSchema = z.enum([
  'underground',
  'elevated',
  'surface',
  'unknown',
]);
export const networkSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      id: z.string(),
      geometry: z.object({
        type: z.literal('LineString'),
        coordinates: z.array(coordinateSchema).min(2),
      }),
      properties: z.object({
        line: lineCodeSchema,
        sourceWayId: z.number(),
        relationIds: z.array(z.number()).min(1),
        layer: layerSchema,
        inferred: z.boolean(),
        basis: z.string(),
        sharedWith: z.array(lineCodeSchema),
        colour: z.string().regex(/^#[a-fA-F0-9]{6}$/),
        colour_source: z.literal('osm-unverified'),
        status: z.enum(['source-track', 'uncertain-construction']),
      }),
    }),
  ),
});
export const stationSchema = z.object({
  key: z.string(),
  line: lineCodeSchema,
  stationCode: z.string(),
  chineseName: z.string(),
  englishName: z.string(),
  coordinates: coordinateSchema,
  sourceNodeId: z.number(),
  osmRef: z.string().nullable(),
  refOverride: z
    .object({ source: z.array(z.string()), reason: z.string() })
    .nullable(),
  stopAreaIds: z.array(z.number()),
  matchingInferred: z.literal(true),
  coordinateInferred: z.literal(false),
  matchEvidence: z.array(z.string()),
  alternativeNodeIds: z.array(z.number()),
  confirmedInterchanges: z.array(z.string()),
});
export const stationsSchema = z.object({
  version: z.literal(1),
  attribution: z.string(),
  timestamp: z.string().nullable(),
  stations: z.array(stationSchema),
});
export type Network = z.infer<typeof networkSchema>;
export type Station = z.infer<typeof stationSchema>;
export const lineInfo = {
  AEL: { zh: '機場快綫', en: 'Airport Express' },
  TCL: { zh: '東涌綫', en: 'Tung Chung Line' },
  TML: { zh: '屯馬綫', en: 'Tuen Ma Line' },
  TKL: { zh: '將軍澳綫', en: 'Tseung Kwan O Line' },
  EAL: { zh: '東鐵綫', en: 'East Rail Line' },
  SIL: { zh: '南港島綫', en: 'South Island Line' },
  TWL: { zh: '荃灣綫', en: 'Tsuen Wan Line' },
  ISL: { zh: '港島綫', en: 'Island Line' },
  KTL: { zh: '觀塘綫', en: 'Kwun Tong Line' },
  DRL: { zh: '迪士尼綫', en: 'Disneyland Resort Line' },
};

export const stationRefOverridesSchema = z.object({
  version: z.literal(1),
  exceptions: z.array(
    z.object({
      key: z.string(),
      line: lineCodeSchema,
      stationCode: z.string(),
      osmRef: z.string(),
      nodeIds: z.array(z.number()).min(1),
      source: z.array(z.string()).min(1),
      reason: z.string().min(1),
      approvedAt: z.string(),
    }),
  ),
});
export type StationRefOverrides = z.infer<typeof stationRefOverridesSchema>;
export const developmentMapSchema = z.object({
  publication: z.literal('development-only'),
  excludedLines: z.array(lineCodeSchema),
  timestamp: z.string().nullable(),
  allMatchedKeys: z.number(),
  network: networkSchema,
  stations: stationsSchema,
  colours: z.record(z.string(), z.string()),
  colour_source: z.literal('osm-unverified'),
  warningSummary: z.record(z.string(), z.number()),
});
export type DevelopmentMap = z.infer<typeof developmentMapSchema>;
