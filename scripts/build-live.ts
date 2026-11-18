/** Offline-only derived topology for estimated live positions. No network and no invented geometry. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { format } from 'prettier';
import { lineCodeSchema, type LineCode } from '../packages/shared/src/index.js';
import { developmentMapSchema } from '../packages/shared/src/network.js';
import { parseMtrCsv } from './lib/csv.js';
import { distance, osmSchema } from './lib/osm-network.js';

const read = async (p: string): Promise<unknown> =>
  JSON.parse(await readFile(p, 'utf8'));
const osm = osmSchema.parse(await read('data/reports/osm-extract.json'));
const preview = developmentMapSchema.parse(
  await read('data/reports/development-map.json'),
);
const csv = parseMtrCsv(
  await readFile('data/raw/mtr_lines_and_stations.csv', 'utf8'),
);
const sourceRoutes = z
  .array(
    z.object({
      relationId: z.number(),
      line: lineCodeSchema,
      parts: z.array(z.array(z.number())),
      gaps: z.array(z.unknown()),
      usableForAnimation: z.boolean(),
      orderOverrideApplied: z.boolean().default(false),
    }),
  )
  .parse(await read('data/reports/animation-routes.json'));
const point = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
const liveSchema = z.object({
  version: z.literal(1),
  sourceTimestamp: z.string().nullable(),
  stations: z.array(
    z.object({
      line: lineCodeSchema,
      code: z.string(),
      nameZh: z.string(),
      nameEn: z.string(),
      coordinates: point,
      sourceNodeId: z.number(),
      identitySource: z.enum(['official-csv+osm', 'next-train-v1.7+osm']),
      coordinateInferred: z.literal(false),
    }),
  ),
  routes: z.array(
    z.object({
      id: z.string(),
      line: lineCodeSchema,
      direction: z.enum(['UP', 'DOWN']),
      via: z.enum(['RAC']).nullable(),
      path: z.array(point).min(2),
      stops: z
        .array(
          z.object({
            code: z.string(),
            nameZh: z.string(),
            distance: z.number().nonnegative(),
          }),
        )
        .min(2),
      geometryBasis: z.string(),
    }),
  ),
});
type Selection = {
  relationId: number;
  line: LineCode;
  direction: 'UP' | 'DOWN';
  from: string;
  to: string;
  via?: 'RAC';
  reverse?: boolean;
};
// UP/DOWN is mapped from the destination table in Next Train v1.7 pp8–9, never from CSV UT/DT tokens.
const selections: Selection[] = [
  { relationId: 5317239, line: 'AEL', direction: 'UP', from: 'HOK', to: 'AWE' },
  {
    relationId: 5317238,
    line: 'AEL',
    direction: 'DOWN',
    from: 'AWE',
    to: 'HOK',
  },
  {
    relationId: 5317704,
    line: 'TCL',
    direction: 'UP',
    from: 'HOK',
    to: 'TUC',
    reverse: true,
  },
  {
    relationId: 5317704,
    line: 'TCL',
    direction: 'DOWN',
    from: 'TUC',
    to: 'HOK',
  },
  { relationId: 6102299, line: 'TML', direction: 'UP', from: 'WKS', to: 'TUM' },
  {
    relationId: 6102298,
    line: 'TML',
    direction: 'DOWN',
    from: 'TUM',
    to: 'WKS',
  },
  { relationId: 269672, line: 'TKL', direction: 'UP', from: 'NOP', to: 'POA' },
  {
    relationId: 13352937,
    line: 'TKL',
    direction: 'UP',
    from: 'NOP',
    to: 'LHP',
  },
  {
    relationId: 9736611,
    line: 'TKL',
    direction: 'DOWN',
    from: 'POA',
    to: 'NOP',
  },
  {
    relationId: 13352938,
    line: 'TKL',
    direction: 'DOWN',
    from: 'LHP',
    to: 'NOP',
  },
  { relationId: 4248591, line: 'EAL', direction: 'UP', from: 'ADM', to: 'LMC' },
  { relationId: 4248592, line: 'EAL', direction: 'UP', from: 'ADM', to: 'LOW' },
  {
    relationId: 4248589,
    line: 'EAL',
    direction: 'DOWN',
    from: 'LMC',
    to: 'ADM',
  },
  {
    relationId: 4248590,
    line: 'EAL',
    direction: 'DOWN',
    from: 'LOW',
    to: 'ADM',
  },
  {
    relationId: 4250434,
    line: 'EAL',
    direction: 'UP',
    from: 'ADM',
    to: 'LMC',
    via: 'RAC',
  },
  {
    relationId: 4250435,
    line: 'EAL',
    direction: 'UP',
    from: 'ADM',
    to: 'LOW',
    via: 'RAC',
  },
  {
    relationId: 4250432,
    line: 'EAL',
    direction: 'DOWN',
    from: 'LMC',
    to: 'ADM',
    via: 'RAC',
  },
  {
    relationId: 4250433,
    line: 'EAL',
    direction: 'DOWN',
    from: 'LOW',
    to: 'ADM',
    via: 'RAC',
  },
  {
    relationId: 6587848,
    line: 'EAL',
    direction: 'UP',
    from: 'ADM',
    to: 'RAC',
    via: 'RAC',
  },
  {
    relationId: 6587852,
    line: 'EAL',
    direction: 'DOWN',
    from: 'RAC',
    to: 'ADM',
    via: 'RAC',
  },
  { relationId: 6827211, line: 'SIL', direction: 'UP', from: 'ADM', to: 'SOH' },
  {
    relationId: 6827212,
    line: 'SIL',
    direction: 'DOWN',
    from: 'SOH',
    to: 'ADM',
  },
  { relationId: 9736530, line: 'TWL', direction: 'UP', from: 'CEN', to: 'TSW' },
  {
    relationId: 269669,
    line: 'TWL',
    direction: 'DOWN',
    from: 'TSW',
    to: 'CEN',
  },
  { relationId: 4432666, line: 'ISL', direction: 'UP', from: 'KET', to: 'CHW' },
  {
    relationId: 4432665,
    line: 'ISL',
    direction: 'DOWN',
    from: 'CHW',
    to: 'KET',
  },
  { relationId: 6452935, line: 'KTL', direction: 'UP', from: 'WHA', to: 'TIK' },
  {
    relationId: 272125,
    line: 'KTL',
    direction: 'DOWN',
    from: 'TIK',
    to: 'WHA',
  },
  { relationId: 4709541, line: 'DRL', direction: 'UP', from: 'DIS', to: 'SUN' },
  {
    relationId: 4709540,
    line: 'DRL',
    direction: 'DOWN',
    from: 'SUN',
    to: 'DIS',
  },
];
const stations: z.infer<typeof liveSchema>['stations'] =
  preview.stations.stations.map((s) => ({
    line: s.line,
    code: s.stationCode,
    nameZh: s.chineseName,
    nameEn: s.englishName,
    coordinates: s.coordinates,
    sourceNodeId: s.sourceNodeId,
    identitySource: 'official-csv+osm' as const,
    coordinateInferred: false as const,
  }));
const rac = osm.nodes[2325225341];
if (
  !rac ||
  rac.tags.ref !== 'RAC' ||
  rac.tags['name:en'] !== 'Racecourse' ||
  rac.tags.railway !== 'station'
)
  throw Error('RAC_SOURCE_STATION_CHANGED');
stations.push({
  line: 'EAL',
  code: 'RAC',
  nameZh: rac.tags['name:zh'],
  nameEn: rac.tags['name:en'],
  coordinates: rac.coordinates,
  sourceNodeId: rac.id,
  identitySource: 'next-train-v1.7+osm',
  coordinateInferred: false,
});
const stationByKey = new Map(stations.map((s) => [`${s.line}:${s.code}`, s]));

function officialStopOrder(s: Selection) {
  let codes = csv.routes.find(
    (r) =>
      r.line === s.line &&
      r.stations[0] === s.from &&
      r.stations.at(-1) === s.to,
  )?.stations;
  // Official CSV's LOHAS branch starts at TIK. Compose its shared NOP–TIK trunk with that explicit branch.
  if (!codes && s.line === 'TKL' && [s.from, s.to].includes('LHP')) {
    const trunk = csv.routes.find(
      (r) =>
        r.line === 'TKL' &&
        r.stations[0] === 'NOP' &&
        r.stations.at(-1) === 'POA',
    )!.stations;
    const branch = csv.routes.find(
      (r) =>
        r.line === 'TKL' &&
        r.stations[0] === 'TIK' &&
        r.stations.at(-1) === 'LHP',
    )!.stations;
    codes = [...trunk.slice(0, trunk.indexOf('TIK')), ...branch];
    if (s.from === 'LHP') codes.reverse();
  }
  // The v1.7 route=RAC definition explicitly replaces Fo Tan by Racecourse, including RAC terminating services.
  if (!codes && s.line === 'EAL' && [s.from, s.to].includes('RAC')) {
    const normal = csv.routes.find(
      (r) =>
        r.line === 'EAL' &&
        r.stations[0] === 'ADM' &&
        r.stations.at(-1) === 'LOW',
    )!.stations;
    codes = normal
      .slice(0, normal.indexOf('FOT') + 1)
      .map((c) => (c === 'FOT' ? 'RAC' : c));
    if (s.from === 'RAC') codes.reverse();
  } else if (codes && s.via === 'RAC')
    codes = codes.map((c) => (c === 'FOT' ? 'RAC' : c));
  if (!codes) throw Error(`UNVERIFIED_STOP_ORDER ${JSON.stringify(s)}`);
  return codes;
}
function project(p: number[], path: number[][]) {
  let cumulative = 0,
    bestError = Infinity,
    bestDistance = 0;
  const k = (Math.PI * 6371008.8) / 180,
    scale = Math.cos((p[1] * Math.PI) / 180);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      ax = (a[0] - p[0]) * scale * k,
      ay = (a[1] - p[1]) * k,
      bx = (b[0] - p[0]) * scale * k,
      by = (b[1] - p[1]) * k,
      dx = bx - ax,
      dy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)),
    );
    const error = Math.hypot(ax + t * dx, ay + t * dy),
      length = distance(a, b);
    if (error < bestError) {
      bestError = error;
      bestDistance = cumulative + t * length;
    }
    cumulative += length;
  }
  return { distance: bestDistance, error: bestError };
}
const audits: {
  routeId: string;
  line: LineCode;
  direction: string;
  via: string | null;
  relationId: number;
  stopCount: number;
  lengthMetres: number;
  maxProjectionMetres: number;
  projectedStops: {
    code: string;
    sourceNodeId: number;
    errorMetres: number;
    distanceMetres: number;
  }[];
}[] = [];
const warnings: string[] = [];
const liveRoutes = selections.map((s) => {
  const source = sourceRoutes.find((r) => r.relationId === s.relationId);
  if (
    !source ||
    source.line !== s.line ||
    !source.usableForAnimation ||
    source.gaps.length ||
    source.parts.length !== 1
  )
    throw Error(`LIVE_ROUTE_SOURCE_UNUSABLE ${s.relationId}`);
  if (s.line === 'TCL' && !source.orderOverrideApplied)
    throw Error('TCL_APPROVED_ORDER_REQUIRED');
  const ids = [...source.parts[0]];
  if (s.reverse) ids.reverse();
  const originalEdges = new Set(
    osm.relations
      .find((r) => r.id === s.relationId)!
      .members.filter((m) => m.type === 'w')
      .flatMap((m) => {
        const way = osm.ways[m.ref];
        return (
          way?.nodes
            .slice(1)
            .flatMap((n, i) => [
              `${way.nodes[i]}:${n}`,
              `${n}:${way.nodes[i]}`,
            ]) ?? []
        );
      }),
  );
  if (!ids.slice(1).every((n, i) => originalEdges.has(`${ids[i]}:${n}`)))
    throw Error(`NON_SOURCE_GEOMETRY_EDGE ${s.relationId}`);
  const path = ids.map((id) => osm.nodes[id].coordinates),
    id = `live-${s.relationId}-${s.direction}${s.via ? '-RAC' : ''}`;
  const projectedStops = officialStopOrder(s).map((code) => {
    const station = stationByKey.get(`${s.line}:${code}`);
    if (!station) throw Error(`LIVE_STATION_MISSING ${s.line}:${code}`);
    const p = project(station.coordinates, path);
    if (p.error > 350)
      throw Error(`STATION_PROJECTION_GT_350M ${id} ${code}: ${p.error}`);
    return {
      code,
      nameZh: station.nameZh,
      distance: p.distance,
      sourceNodeId: station.sourceNodeId,
      errorMetres: p.error,
    };
  });
  if (
    projectedStops.some(
      (p, i) => i > 0 && p.distance <= projectedStops[i - 1].distance,
    )
  )
    throw Error(`STOP_ORDER_NOT_MONOTONIC ${id}`);
  const lengthMetres = path
    .slice(1)
    .reduce((sum, p, i) => sum + distance(path[i], p), 0);
  audits.push({
    routeId: id,
    line: s.line,
    direction: s.direction,
    via: s.via ?? null,
    relationId: s.relationId,
    stopCount: projectedStops.length,
    lengthMetres,
    maxProjectionMetres: Math.max(...projectedStops.map((p) => p.errorMetres)),
    projectedStops: projectedStops.map((p) => ({
      code: p.code,
      sourceNodeId: p.sourceNodeId,
      errorMetres: p.errorMetres,
      distanceMetres: p.distance,
    })),
  });
  if (s.relationId === 4250434)
    warnings.push(
      `${id}: raw route stop members omit SHT, but its true source station node is on this original track. The official common station order is retained; projection ${projectedStops.find((p) => p.code === 'SHT')!.errorMetres.toFixed(1)}m. This is an inferred stop-to-path correspondence, not a new coordinate or track.`,
    );
  return {
    id,
    line: s.line,
    direction: s.direction,
    via: s.via ?? null,
    path,
    stops: projectedStops.map((p) => ({
      code: p.code,
      nameZh: p.nameZh,
      distance: p.distance,
    })),
    geometryBasis:
      s.line === 'TCL'
        ? `OSM relation/5317704; exact-node approved member-order exception; ${s.reverse ? 'reversed same source edges for UP display centreline, not a separately verified directional track' : 'original source edges for DOWN'}; station distances are inferred projections`
        : `OSM relation/${s.relationId}; original complete ${s.direction} service track and every source vertex; station distances are inferred projections`,
  };
});
const live = liveSchema.parse({
  version: 1,
  sourceTimestamp: osm.metadata.header.osmosis_replication_timestamp,
  stations,
  routes: liveRoutes,
});
if (
  new Set(live.stations.map((s) => `${s.line}:${s.code}`)).size !== 121 ||
  live.routes.length !== 30
)
  throw Error('LIVE_NETWORK_COUNT_CHANGED');
const encoded = JSON.stringify(live) + '\n';
for (const dir of [
  'apps/api/src/generated',
  'apps/web/public/data',
  'data/config',
])
  await mkdir(dir, { recursive: true });
for (const file of [
  'apps/api/src/generated/live-network.json',
  'apps/web/public/data/live-network.json',
])
  await writeFile(file, encoded);

const configSchema = z
  .object({
    version: z.literal(1),
    source: z.literal('model-parameter-not-official'),
    defaults: z.object({
      cruiseSpeedMps: z.number().positive(),
      minTravelSeconds: z.number().positive(),
      dwellSeconds: z.number().min(20).max(40),
    }),
  })
  .passthrough();
let defaults = { cruiseSpeedMps: 15, minTravelSeconds: 45, dwellSeconds: 25 };
try {
  defaults = configSchema.parse(
    await read('data/config/segment_times.json'),
  ).defaults;
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
    throw error;
}
const pairs = new Map<
  string,
  { line: LineCode; from: string; to: string; samples: number[]; ids: string[] }
>();
for (const r of live.routes)
  for (let i = 1; i < r.stops.length; i++) {
    const a = r.stops[i - 1],
      b = r.stops[i],
      key = `${r.line}:${a.code}:${b.code}`;
    const entry = pairs.get(key) ?? {
      line: r.line,
      from: a.code,
      to: b.code,
      samples: [],
      ids: [],
    };
    entry.samples.push(b.distance - a.distance);
    entry.ids.push(r.id);
    pairs.set(key, entry);
  }
const segments = [...pairs.values()]
  .map((p) => {
    const sorted = p.samples.sort((a, b) => a - b),
      m = Math.floor(sorted.length / 2),
      median = sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
    return {
      line: p.line,
      from: p.from,
      to: p.to,
      distanceMetres: Math.round(median),
      travelSeconds: Math.ceil(
        Math.max(defaults.minTravelSeconds, median / defaults.cruiseSpeedMps),
      ),
      dwellSeconds: defaults.dwellSeconds,
      source: 'model-parameter-not-official',
      geometrySourceRouteIds: p.ids,
    };
  })
  .sort((a, b) =>
    `${a.line}:${a.from}:${a.to}`.localeCompare(`${b.line}:${b.from}:${b.to}`),
  );
await writeFile(
  'data/config/segment_times.json',
  await format(
    JSON.stringify(
      {
        version: 1,
        source: 'model-parameter-not-official',
        defaults,
        segments,
      },
      null,
      2,
    ),
    { parser: 'json' },
  ),
);
const maxProjection = Math.max(...audits.map((a) => a.maxProjectionMetres));
await writeFile(
  'docs/live-network-audit.md',
  [
    '# 即時列車推算用本地路網審核',
    '',
    '建置：`node --import tsx scripts/build-live.ts`。只讀已驗證本地 PBF 衍生報告；不連網、不補線、不簡化來源 path。',
    '',
    `來源：Geofabrik hong-kong-261114.osm.pbf；SHA-256 \`${osm.metadata.sha256}\`；PBF 檔頭時間 \`${live.sourceTimestamp}\`。© OpenStreetMap contributors，ODbL 1.0。`,
    '',
    '身份與方向：港鐵官方 mtr_lines_and_stations.csv（120 個線路站鍵）；[Next Train v1.7](https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf) p5 的 RAC 車站、pp8–9 的 UP/DOWN 目的地及 route=RAC 定義。沒有使用 CSV UT/DT 名稱推斷 API 方向。',
    '',
    '輸出契約：`{version:1,sourceTimestamp,stations:[{line,code,nameZh,nameEn,coordinates,sourceNodeId,identitySource,coordinateInferred:false}],routes:[{id,line,direction,via,path,stops:[{code,nameZh,distance}],geometryBasis}]}`。distance 是由 path 起點累計的米數；path 完整保留原始頂點。API 與 web 的 live-network.json 為相同 bytes。',
    '',
    `結果：**${live.stations.length} 線路站鍵／${new Set(live.stations.map((s) => s.code)).size} 個站碼；${live.routes.length} 條方向／分支路徑；${segments.length} 個有方向相鄰站時間模型**。`,
    '',
    '## RAC 與分支',
    '',
    'RAC 沒有在該 CSV 出現，但資料字典 v1.7 明確列於可查詢站表、EAL 目的地和 route=RAC 欄位。新增第 121 個線路站鍵只採原始 OSM station node2325225341，[114.2028994,22.4004756]，名稱馬場／Racecourse，identitySource=next-train-v1.7+osm；沒有虛構座標或官方 CSV 紀錄。來源 stop nodes316731315／2185507407 亦存在於相關原 relation。',
    '',
    'EAL 各包含羅湖、落馬洲，普通經火炭及經馬場的雙方向路徑；另保留實際 ADM↔RAC relation，供 RAC 終點班次使用。route=RAC 依字典取代 FOT，不把兩站串在一起。其他短途目的地（如 SHT/FOT/TAP/SHS、AEL AIR）是完整方向路徑上的原站碼，由 trip 引擎在終點封頂。TKL 康城的 CSV 支線從 TIK 開始；只有站序使用 CSV NOP→TIK 共幹加 TIK→LHP 支線，幾何仍直接採原完整 NOP↔LHP source relation。',
    '',
    'TCL 只使用已批准 relation5317704 的相同來源頂點／邊：DOWN 為 TUC→HOK，UP 反轉該中心顯示路徑。這不是獨立驗證的 UP 月台軌道，geometryBasis 有明示；沒有改用另一條舊路軌或補線。未開通東涌東／西不在此即時路網、站鍵或時間模型中。',
    '',
    '## 車站投影：推斷而非原座標改寫',
    '',
    `各線車站保留原平台／station node座標，沿原 polyline 作最近線段投影，只用所得弧長作進度定位。採 WGS84 局部等距近似，R=6371008.8m；每段長度與前次路網 distance helper一致。最大投影差 **${maxProjection.toFixed(1)}m**，沒有超過350m；任何超標、站序倒退、缺站或非原始 source edge 均停止建置。推斷的 station-to-path correspondence 不等於官方站中心或 GPS 誤差。`,
    '',
    '## 模型時間',
    '',
    `data/config/segment_times.json 的 source=model-parameter-not-official。預設巡航 ${defaults.cruiseSpeedMps}m/s、最短站間 ${defaults.minTravelSeconds}s、停站 ${defaults.dwellSeconds}s，是可替換模型參數，**不是官方班次、實測行車時間或速度限制**。travelSeconds=ceil(max(minTravelSeconds,原軌道距離/cruiseSpeedMps))，同線同方向相鄰站多來源取距離中位數；source route IDs 保留。重跑保留已配置 defaults，再重建 derived segments；如手改個別 segment 值，重建前應另存，builder 會按 defaults 重新生成。引擎位置須標示推算。`,
    '',
    '## 來源差異',
    '',
    ...warnings.map((w) => '- ' + w),
    '',
    '## 逐路徑結果',
    '',
    '| 路徑 | 線 | API方向 | RAC | 起點→終點 | 站數 | 原線長(m) | 最大投影差(m) |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...audits.map((a) => {
      const r = live.routes.find((r) => r.id === a.routeId)!;
      return `| ${a.routeId} | ${a.line} | ${a.direction} | ${a.via ?? '普通'} | ${r.stops[0].code}→${r.stops.at(-1)!.code} | ${a.stopCount} | ${a.lengthMetres.toFixed(1)} | ${a.maxProjectionMetres.toFixed(1)} |`;
    }),
    '',
    '所有 path 邊均與其來源 relation 的原 way node pair比對。站碼唯一、121站鍵、30路徑、投影門檻及嚴格遞增弧長均在 builder 驗證。',
    '',
  ].join('\n'),
);
console.log(
  JSON.stringify({
    stations: live.stations.length,
    routes: live.routes.length,
    segments: segments.length,
    maxProjectionMetres: Number(maxProjection.toFixed(1)),
    bytes: Buffer.byteLength(encoded),
    warnings,
  }),
);
