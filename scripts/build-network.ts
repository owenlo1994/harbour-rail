import { readFile, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { inspectLocalPbf } from './lib/pbf-preflight.js';
import { parseMtrCsv } from './lib/csv.js';
import { buildOsmNetwork, osmSchema } from './lib/osm-network.js';
import { checkTcl, tclCheckMarkdown } from './lib/tcl-check.js';
import { developmentMapSchema } from '../packages/shared/src/network.js';
const readJson = async (file: string) =>
  JSON.parse(await readFile(file, 'utf8'));
const input = await inspectLocalPbf(process.cwd());
if (!input.available) {
  console.error(input.message);
  process.exit(2);
}
const extract = spawnSync('.venv/bin/python', ['scripts/extract-pbf.py'], {
  stdio: 'inherit',
});
if (extract.status !== 0) {
  console.error(
    'PBF_READER_FAILED: install requirements-osm.txt in .venv; no download/fallback.',
  );
  process.exit(2);
}
const d = osmSchema.parse(await readJson('data/reports/osm-extract.json'));
const csv = parseMtrCsv(
  await readFile('data/raw/mtr_lines_and_stations.csv', 'utf8'),
);
const decision = await readJson('data/way-review-status.json');
if (
  decision.status !== 'user-confirmed-alignment' ||
  decision.line !== 'TCL' ||
  decision.relationId !== 5317704
)
  throw Error('INVALID_WAY_REVIEW_DECISION');
const excluded = new Set<number>(decision.excludedWayIds);
const result = buildOsmNetwork(
  d,
  csv.stations,
  await readJson('data/interchange-overrides.json'),
  await readJson('data/segment-overrides.json'),
  await readJson('data/station-ref-overrides.json'),
  excluded,
  await readJson('data/relation-order-overrides.json'),
);
const old = await readJson('data/raw/overpass-4-subway.json');
const crossCheck = {
  note: 'Cross-validation only; never used to fill geometry.',
  pbfHeavyRelations: result.routes.length,
  overpassSubwayRelations: old.elements.length,
  onlyPbf: result.routes
    .filter(
      (r) => !old.elements.some((o: { id: number }) => o.id === r.relationId),
    )
    .map((r) => r.relationId),
  onlyOverpass: old.elements
    .filter(
      (o: { id: number }) => !result.routes.some((r) => r.relationId === o.id),
    )
    .map((o: { id: number }) => o.id),
};
const knownGaps = new Set([
  '5317704:1558652640:1558652637',
  '5317704:249196544:1176509649',
]);
const unexpectedGaps = result.routes.flatMap((r) =>
  r.gaps.filter(
    (g) => !knownGaps.has(`${r.relationId}:${g.after}:${g.before}`),
  ),
);
const fatal = result.warnings.filter((w) =>
  ['STATION_UNMATCHED', 'STATION_REF_CONFLICT'].includes(w.code),
);
if (unexpectedGaps.length)
  fatal.push({
    code: 'UNAPPROVED_ROUTE_GAP',
    message: JSON.stringify(unexpectedGaps),
  });
for (const id of excluded) {
  result.warnings.push({
    code: 'UNCERTAIN_CONSTRUCTION_EXCLUDED',
    message: `way/${id}: uncertain-construction per user decision; excluded globally from network and animation routes.`,
    sourceIds: [id],
  });
}
result.warnings.push({
  code: 'TCL_SOURCE_ORDER_OVERRIDE',
  message:
    'User confirms TCL uses the new alignment. Only relation 5317704 moves ways 1176509649,1558652644,1558652643 between exact source-node neighbours; source-order gaps remain in the raw audit. Original OSM construction descriptions retained. Toy simulation only; colour_source=osm-unverified.',
});
result.warnings.push({
  code: 'TCL_SOURCE_DESCRIPTION_RETAINED',
  message:
    'OSM descriptions on the three reviewed ways still say Construction; latest in-service alignment status comes from user confirmation, not an independently verified official notice. No raw source tags were rewritten.',
  sourceIds: [1176509649, 1558652644, 1558652643],
});
result.warnings.push({
  code: 'UPCOMING_STATIONS_NOT_OPEN',
  message:
    'Tung Chung East and Tung Chung West use original construction=station nodes; displayed as not open, separate from official CSV keys, no invented station codes, API boards or connecting geometry.',
  sourceIds: [11039819034, 11039819033],
});
const tclReport = checkTcl(d, result.stations.stations, true);
for (const [file, value] of Object.entries({
  'data/reports/routes.json': result.routes,
  'data/reports/animation-routes.json': result.animationRoutes,
  'data/reports/uncertain-ways.geojson': {
    ...result.auditedNetwork,
    features: result.auditedNetwork.features.filter(
      (f) => f.properties.status === 'uncertain-construction',
    ),
  },
  'data/reports/interchange-candidates.json': result.candidates,
  'data/reports/build-warnings.json': result.warnings,
  'data/reports/overpass-cross-check.json': crossCheck,
  'data/reports/pbf-provenance.json': d.metadata,
  'data/reports/tcl-extension-check.json': tclReport,
  'data/reports/network-blockers.json': {
    status: fatal.length ? 'blocked' : 'toy-ready',
    outputsWritten: false,
    developmentPreviewWritten: !fatal.length,
    source: 'geofabrik-local-pbf',
    matchedStationKeys: result.stations.stations.length,
    expectedStationKeys: csv.stations.length,
    pendingLine: null,
    fatal,
    knownGapsKept: result.routes.flatMap((r) => r.gaps),
    excludedWayIds: [...excluded],
    colour_source: 'osm-unverified',
    overpassFallback: false,
  },
}))
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
await writeFile('docs/tcl-extension-check.md', tclCheckMarkdown(tclReport));
await writeFile(
  'docs/build-warnings.md',
  [
    '# Milestone 1 建置警告',
    '',
    '宋皇臺指定節點例外保留。使用者已確認 TCL 新路段：僅 relation 5317704 的三條指定 way 排序覆蓋，四個接點均使用相同原始 node ID，沒有補畫線段。原始排序兩處斷口仍列在審核表；修正後動畫路徑無斷點。東涌東／西用原始 OSM 節點、標示未開通，不虛構官方站碼或到站查詢。',
    '',
    '| Code | 內容 |',
    '| --- | --- |',
    ...result.warnings.map(
      (w) => `| ${w.code} | ${w.message.replaceAll('|', '/')} |`,
    ),
  ].join('\n') + '\n',
);
// The original full-network publication remains separate from the explicit toy-world snapshot.
for (const file of [
  'public/data/network.geojson',
  'public/data/stations.json',
  'public/data/lines.json',
])
  await rm(file, { force: true });
if (fatal.length) {
  await rm('data/reports/development-map.json', { force: true });
  console.error(
    `UNAPPROVED_SOURCE_CONFLICT: ${fatal.length}; no preview produced.`,
  );
  process.exitCode = 2;
} else {
  const warningSummary = result.warnings.reduce<Record<string, number>>(
    (a, w) => ((a[w.code] = (a[w.code] ?? 0) + 1), a),
    {},
  );
  const preview = developmentMapSchema.parse({
    publication: 'development-only',
    excludedLines: [],
    timestamp: d.metadata.header.osmosis_replication_timestamp,
    allMatchedKeys: result.stations.stations.length,
    network: {
      ...result.network,
      features: result.network.features,
    },
    stations: {
      ...result.stations,
      stations: result.stations.stations,
    },
    colours: result.colours,
    colour_source: 'osm-unverified',
    warningSummary,
  });
  await writeFile(
    'data/reports/development-map.json',
    JSON.stringify(preview) + '\n',
  );
  console.log(
    JSON.stringify({
      status: 'toy-ready',
      matchedStationKeys: result.stations.stations.length,
      developmentFeatures: preview.network.features.length,
      developmentStationKeys: preview.stations.stations.length,
      pendingLine: null,
      publicOutputs: false,
      warnings: result.warnings.length,
    }),
  );
}
