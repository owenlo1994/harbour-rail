import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import { geometryInputSchema } from '../../packages/shared/src/index.js';

const featureCollectionSchema = z
  .object({
    type: z.literal('FeatureCollection'),
    features: z.array(
      z
        .object({
          type: z.literal('Feature'),
          properties: z.record(z.string(), z.unknown()).nullable(),
          geometry: z
            .object({ type: z.string(), coordinates: z.unknown() })
            .passthrough()
            .nullable(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

/** Ingestion boundary only: no field names, GML axis order or CRS transformations guessed. */
export async function loadLocalSpatialInput(root: string, input: unknown) {
  const config = geometryInputSchema.parse(input);
  const rawRoot = await realpath(path.join(root, 'data/raw'));
  const filename = await realpath(path.resolve(root, config.file));
  const relative = path.relative(rawRoot, filename);
  if (relative.startsWith('..') || path.isAbsolute(relative))
    throw new Error('SPATIAL_INPUT_OUTSIDE_RAW');
  const text = await readFile(filename, 'utf8');
  if (config.format === 'geojson') {
    if (!['EPSG:4326', 'OGC:CRS84'].includes(config.crs))
      throw new Error(`CRS_MAPPING_REQUIRED: ${config.crs}`);
    return {
      format: 'geojson' as const,
      config,
      document: featureCollectionSchema.parse(JSON.parse(text)),
    };
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('GML_EXTERNAL_ENTITIES_FORBIDDEN');
  if (XMLValidator.validate(text) !== true) throw new Error('GML_INVALID_XML');
  const document: unknown = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    processEntities: false,
  }).parse(text);
  return { format: 'gml' as const, config, document };
}
export function inferLayer(
  tags: Record<string, string>,
  override?: { layer: 'underground' | 'elevated' | 'surface' | 'unknown' },
) {
  if (override)
    return { layer: override.layer, inferred: false, basis: 'manual-override' };
  const tunnel =
    tags.tunnel !== undefined && !['no', 'false', '0'].includes(tags.tunnel);
  const bridge =
    tags.bridge !== undefined && !['no', 'false', '0'].includes(tags.bridge);
  if (tunnel && bridge)
    return {
      layer: 'unknown',
      inferred: true,
      basis: 'conflicting-tunnel-and-bridge',
    };
  if (tunnel) return { layer: 'underground', inferred: true, basis: 'tunnel' };
  if (bridge) return { layer: 'elevated', inferred: true, basis: 'bridge' };
  if (
    tags.layer !== undefined &&
    tags.layer.trim() !== '' &&
    Number.isFinite(Number(tags.layer))
  ) {
    return {
      layer: 'unknown',
      inferred: true,
      basis: 'relative-layer-only-needs-review',
    };
  }
  if (tags.tunnel === 'no' && tags.bridge === 'no')
    return {
      layer: 'surface',
      inferred: true,
      basis: 'explicit-tunnel-no-bridge-no',
    };
  return { layer: 'unknown', inferred: true, basis: 'missing-tags' };
}
