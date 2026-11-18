import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import {
  keyOf,
  lineCodeSchema,
  type LineCode,
} from '../../packages/shared/src/index.js';

export const CSV_COLUMNS = [
  'Line Code',
  'Direction',
  'Station Code',
  'Station ID',
  'Chinese Name',
  'English Name',
  'Sequence',
] as const;
export const csvRowSchema = z
  .object({
    'Line Code': lineCodeSchema,
    Direction: z.string().regex(/^(?:[A-Z]+-)?(?:UT|DT)$/),
    'Station Code': z.string().regex(/^[A-Z]{3}$/),
    'Station ID': z.string().regex(/^\d+$/),
    'Chinese Name': z.string().trim().min(1),
    'English Name': z.string().trim().min(1),
    Sequence: z
      .string()
      .regex(/^\d+(?:\.\d+)?$/)
      .transform(Number)
      .pipe(z.number().positive()),
  })
  .strict();
export type CsvRow = z.infer<typeof csvRowSchema>;
export interface CsvStation {
  key: string;
  line: LineCode;
  stationCode: string;
  stationId: string;
  chineseName: string;
  englishName: string;
  directions: string[];
}
export interface CsvRoute {
  line: LineCode;
  direction: string;
  directionFamily: 'UT' | 'DT';
  branchToken: string | null;
  stations: string[];
}
export function parseMtrCsv(text: string) {
  let headers: string[] = [];
  const records: Record<string, string>[] = parse(text, {
    bom: true,
    columns: (columns: string[]) => {
      headers = columns;
      if (
        columns.length !== CSV_COLUMNS.length ||
        CSV_COLUMNS.some((c) => !columns.includes(c))
      ) {
        throw new Error(
          `CSV_SCHEMA_MISMATCH: expected ${CSV_COLUMNS.join(', ')}; received ${columns.join(', ')}`,
        );
      }
      return columns;
    },
    skip_empty_lines: true,
    trim: true,
  });
  if (!headers.length) throw new Error('CSV_SCHEMA_MISMATCH: missing header');
  const rows = records
    .filter((r) => Object.values(r).some((v) => v !== ''))
    .map((r, i) => {
      const result = csvRowSchema.safeParse(r);
      if (!result.success)
        throw new Error(`CSV_INVALID_RECORD ${i + 1}: ${result.error.message}`);
      return result.data;
    });
  if (!rows.length) throw new Error('CSV_EMPTY: no valid records');
  const stationMap = new Map<string, CsvStation>();
  const routeMap = new Map<string, CsvRow[]>();
  const identities = new Set<string>();
  for (const row of rows) {
    const line = row['Line Code'];
    const stationCode = row['Station Code'];
    const key = keyOf({ line, stationCode });
    const identity = `${key}:${row.Direction}`;
    if (identities.has(identity)) throw new Error(`CSV_DUPLICATE: ${identity}`);
    identities.add(identity);
    const station = stationMap.get(key);
    if (station) {
      if (
        station.chineseName !== row['Chinese Name'] ||
        station.englishName !== row['English Name'] ||
        station.stationId !== row['Station ID']
      ) {
        throw new Error(`CSV_STATION_CONFLICT: ${key}`);
      }
      station.directions.push(row.Direction);
    } else {
      stationMap.set(key, {
        key,
        line,
        stationCode,
        stationId: row['Station ID'],
        chineseName: row['Chinese Name'],
        englishName: row['English Name'],
        directions: [row.Direction],
      });
    }
    const routeKey = `${line}:${row.Direction}`;
    routeMap.set(routeKey, [...(routeMap.get(routeKey) ?? []), row]);
  }
  const routes: CsvRoute[] = [...routeMap].map(([routeKey, routeRows]) => {
    routeRows.sort((a, b) => a.Sequence - b.Sequence);
    if (new Set(routeRows.map((r) => r.Sequence)).size !== routeRows.length)
      throw new Error(`CSV_DUPLICATE_SEQUENCE: ${routeKey}`);
    const { Direction: direction, 'Line Code': line } = routeRows[0];
    const tokens = direction.split('-');
    return {
      line,
      direction,
      directionFamily: tokens.at(-1) as 'UT' | 'DT',
      branchToken: tokens.length > 1 ? tokens[0] : null,
      stations: routeRows.map((r) => r['Station Code']),
    };
  });
  return {
    rows,
    stations: [...stationMap.values()],
    routes,
    blankRecords: records.length - rows.length,
  };
}
