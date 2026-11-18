import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { parseMtrCsv } from './lib/csv.js';
import { buildInterchanges } from './lib/interchanges.js';

const csv = parseMtrCsv(
  await readFile('data/raw/mtr_lines_and_stations.csv', 'utf8'),
);
const { interchanges, warnings } = buildInterchanges(
  csv.stations,
  JSON.parse(await readFile('data/interchange-overrides.json', 'utf8')),
);
await mkdir('data/reports', { recursive: true });
const report = {
  records: csv.rows.length,
  stationCodes: new Set(csv.stations.map((s) => s.stationCode)).size,
  lineStationKeys: csv.stations.length,
  blankRecords: csv.blankRecords,
  routes: csv.routes,
  stations: csv.stations,
  interchanges,
  warnings,
};
await writeFile(
  'data/reports/csv-audit.json',
  JSON.stringify(report, null, 2) + '\n',
);
await writeFile(
  'data/reports/csv-warnings.json',
  JSON.stringify(warnings, null, 2) + '\n',
);
console.log(
  `CSV verified: ${report.records} rows, ${report.stationCodes} codes, ${report.lineStationKeys} line/station keys, ${interchanges.length} interchange candidates. ${warnings.length} warning(s).`,
);
