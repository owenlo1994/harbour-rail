import { distance, type Osm } from './osm-network.js';
import type { Station } from '../../packages/shared/src/network.js';
const checkIds = [1176509649, 1558652644, 1558652643, 1558652640, 1558652637];
const uncertain = new Set(checkIds.slice(0, 3));
const round = (n: number) => Math.round(n * 10) / 10;
export function polylineLength(points: number[][]) {
  return points.slice(1).reduce((sum, p, i) => sum + distance(points[i], p), 0);
}
function nearestSegment(p: number[], a: number[], b: number[]) {
  const scale = Math.cos((p[1] * Math.PI) / 180),
    k = (Math.PI / 180) * 6371008.8;
  const ax = (a[0] - p[0]) * scale * k,
    ay = (a[1] - p[1]) * k,
    bx = (b[0] - p[0]) * scale * k,
    by = (b[1] - p[1]) * k;
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(
      0,
      Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)),
    );
  return Math.hypot(ax + t * dx, ay + t * dy);
}
export function pointToPolyline(p: number[], line: number[][]) {
  return Math.min(
    ...line.slice(1).map((b, i) => nearestSegment(p, line[i], b)),
  );
}
const bearing = (a: number[], b: number[]) =>
  Math.atan2(
    b[1] - a[1],
    (b[0] - a[0]) * Math.cos(((a[1] + b[1]) * Math.PI) / 360),
  );
function relationSummary(r: Osm['relations'][number]) {
  return {
    id: r.id,
    ref: r.tags.ref ?? null,
    route: r.tags.route ?? null,
    name: r.tags.name ?? null,
    from: r.tags.from ?? null,
    to: r.tags.to ?? null,
    operator: r.tags.operator ?? null,
  };
}
export function checkTcl(
  d: Osm,
  stations: Station[],
  approvedNewAlignment = false,
) {
  const memberships = d.tclWayMemberships.length
    ? d.tclWayMemberships
    : d.relations;
  const ways = checkIds.map((id) => {
    const way = d.ways[id];
    if (!way) throw Error(`TCL_CHECK_WAY_MISSING ${id}`);
    const points = way.nodes.map((n) => d.nodes[n].coordinates),
      bbox = [
        Math.min(...points.map((p) => p[0])),
        Math.min(...points.map((p) => p[1])),
        Math.max(...points.map((p) => p[0])),
        Math.max(...points.map((p) => p[1])),
      ];
    const nearestStations = stations
      .map((s) => ({
        key: s.key,
        name: s.chineseName,
        sourceNodeId: s.sourceNodeId,
        distanceMetres: round(pointToPolyline(s.coordinates, points)),
      }))
      .sort((a, b) => a.distanceMetres - b.distanceMetres)
      .slice(0, 3);
    const nearby = Object.values(d.ways)
      .filter(
        (w) =>
          !checkIds.includes(w.id) &&
          ['rail', 'subway'].includes(w.tags.railway),
      )
      .flatMap((other) => {
        const otherPoints = other.nodes.map((n) => d.nodes[n]?.coordinates);
        if (otherPoints.some((p) => !p)) return [];
        // Compare source-segment midpoints to source segments. These calculated probes are never map geometry.
        const probes = points.slice(1).map((b, i) => ({
          p: [(points[i][0] + b[0]) / 2, (points[i][1] + b[1]) / 2],
          angle: bearing(points[i], b),
        }));
        const samples = probes.map((probe) => {
          const candidates = otherPoints
            .slice(1)
            .map((b, i) => ({
              metres: nearestSegment(probe.p, otherPoints[i], b),
              angle: bearing(otherPoints[i], b),
            }))
            .sort((a, b) => a.metres - b.metres);
          let difference =
            (Math.abs(probe.angle - candidates[0].angle) * 180) / Math.PI;
          difference %= 180;
          if (difference > 90) difference = 180 - difference;
          return { metres: candidates[0].metres, angle: difference };
        });
        const separations = samples.map((s) => s.metres).sort((a, b) => a - b);
        const median = separations[Math.floor(separations.length / 2)];
        if (median > 50) return [];
        const edges = new Set(
          way.nodes
            .slice(1)
            .map((n, i) => [way.nodes[i], n].sort((a, b) => a - b).join(':')),
        );
        const sharedEdges = other.nodes
          .slice(1)
          .filter((n, i) =>
            edges.has([other.nodes[i], n].sort((a, b) => a - b).join(':')),
          ).length;
        const angle =
          samples.reduce((sum, p) => sum + p.angle, 0) / samples.length;
        return [
          {
            sourceWayId: other.id,
            railway: other.tags.railway,
            name: other.tags.name ?? null,
            construction: other.tags.construction ?? null,
            description: other.tags.description ?? null,
            minProbeDistanceMetres: round(separations[0]),
            medianProbeDistanceMetres: round(median),
            meanAcuteAngleDegrees: round(angle),
            sharedSourceEdges: sharedEdges,
            geometricComparison: sharedEdges
              ? 'shared-source-edges'
              : median <= 30 && angle <= 15
                ? 'near-parallel-by-stated-threshold'
                : 'nearby-no-parallel-conclusion',
            inferred: true,
          },
        ];
      })
      .sort((a, b) => a.medianProbeDistanceMetres - b.medianProbeDistanceMetres)
      .slice(0, 5);
    return {
      sourceWayId: id,
      status: uncertain.has(id)
        ? approvedNewAlignment
          ? 'user-confirmed-alignment'
          : 'uncertain-construction'
        : 'adjacent-source-way',
      bbox,
      lengthMetres: round(polylineLength(points)),
      endpoints: {
        startNode: way.nodes[0],
        endNode: way.nodes.at(-1),
        start: points[0],
        end: points.at(-1),
      },
      nearestStations,
      tags: way.tags,
      directRelationMemberships: memberships
        .filter((r) => r.members.some((m) => m.type === 'w' && m.ref === id))
        .map(relationSummary),
      nearbyGeometryComparisons: nearby,
    };
  });
  const gaps = [
    {
      sourceIndices: '3→4',
      afterWay: 1558652640,
      beforeWay: 1558652637,
      afterNode: 10930801895,
      beforeNode: 10931051406,
    },
    {
      sourceIndices: '50→51',
      afterWay: 249196544,
      beforeWay: 1176509649,
      afterNode: 2557051037,
      beforeNode: 10930801895,
    },
  ].map((g) => ({
    ...g,
    afterCoordinates: d.nodes[g.afterNode].coordinates,
    beforeCoordinates: d.nodes[g.beforeNode].coordinates,
    distanceMetres: round(
      distance(
        d.nodes[g.afterNode].coordinates,
        d.nodes[g.beforeNode].coordinates,
      ),
    ),
    inferred: true,
  }));
  return {
    sourceSha256: d.metadata.sha256,
    sourceTimestamp: d.metadata.header.osmosis_replication_timestamp,
    operatingStatus: approvedNewAlignment
      ? 'user-confirmed-new-alignment'
      : 'not-determined',
    sourceRelationChanged: false,
    animationOrderOverrideApplied: approvedNewAlignment,
    ways,
    gaps,
    method:
      'WGS84 local equirectangular distance (R=6371008.8m); lengths sum source segments; gaps are straight-line endpoint distance only. No gap geometry is created. Parallel check: segment midpoint probes vs other source polylines; median <=30m and mean acute angle <=15 degrees is a geometric flag, never operating-status evidence. Direct parent memberships across all PBF relations; not transitive ancestors.',
  };
}
export function tclCheckMarkdown(report: ReturnType<typeof checkTcl>) {
  const lines = [
    '# 東涌線延綫 way 核對（原始來源證據與使用者確認分開）',
    '',
    `來源 PBF SHA-256：\`${report.sourceSha256}\`；檔頭時間：${report.sourceTimestamp}。`,
    '',
    report.animationOrderOverrideApplied
      ? '使用者最新確認東涌線已行新路線，新站未開通。三條原 way 已納入玩具路網；只有動畫 relation 5317704 套用指定順序例外：1558652640 → 1176509649 → 1558652644 → 1558652643 → 1558652637。四個接點全為相同原始 node ID，修正後為單一連續路徑；沒有新增幾何。這是使用者確認，不偽稱官方獨立核實；OSM 興建中描述與下列原排序報告照舊保留。'
      : '舊階段：三條指定 way 未確認，排除於營運／動畫資料。',
    '',
    '## 量度方法與限制',
    '',
    report.method,
    '',
    '長度、距離與平行旗標均為幾何計算／推斷，不是測量報告；最近車站位置為原始平台／station node，不是官方站中心。其他 railway=rail/subway ways 亦只代表 OSM 標籤，不能據此確認正在營運。',
    '',
    '## 原始排序斷口',
    '',
    '| 索引 | Way → Way | 端點 node → node | 端點直線距離（計算） |',
    '| --- | --- | --- | --- |',
    ...report.gaps.map(
      (g) =>
        `| ${g.sourceIndices} | ${g.afterWay} → ${g.beforeWay} | ${g.afterNode} → ${g.beforeNode} | ${g.distanceMetres} m |`,
    ),
    '',
    '上述距離沒有畫成補線。第二個斷口是原始末尾 way 的排序問題，距離大不代表實際存在同等長的缺軌。',
  ];
  for (const w of report.ways) {
    lines.push(
      '',
      `## Way ${w.sourceWayId}`,
      '',
      `狀態：\`${w.status}\`；原 polyline 長度：**${w.lengthMetres} m**；座標範圍 [west,south,east,north]：\`${JSON.stringify(w.bbox)}\`。`,
      '',
      `原始端點：${w.endpoints.startNode} → ${w.endpoints.endNode}；座標 ${JSON.stringify(w.endpoints.start)} → ${JSON.stringify(w.endpoints.end)}。`,
      '',
      '最近三個線路／站碼節點（不合併轉乘）：',
      '',
      ...w.nearestStations.map(
        (s) =>
          `- ${s.key} ${s.name}，原 node ${s.sourceNodeId}，距離該 way ${s.distanceMetres} m（計算）。`,
      ),
      '',
      '### 完整原始 tags',
      '',
      '未列出的欄位表示來源沒有，不能把缺欄當 construction=no／proposed=no。',
      '',
      '```json',
      JSON.stringify(w.tags, null, 2),
      '```',
      '',
      '### 其他 relation 隸屬（PBF 全體 relation 的直接成員）',
      '',
      '```json',
      JSON.stringify(w.directRelationMemberships, null, 2),
      '```',
      '',
      '### 附近其他軌道的幾何比較',
      '',
      '只有幾何關係，不使用「營運軌道已確認」結論。shared-source-edges 是同一原始 node pair；near-parallel 是上述量化門檻，非自行判斷營運。',
      '',
      '```json',
      JSON.stringify(w.nearbyGeometryComparisons, null, 2),
      '```',
    );
  }
  lines.push(
    '',
    '## 來源差異與限制',
    '',
    '- 三條 way 的 description 仍寫 Construction，start_date 原值照錄；不把這些標籤改寫為官方公告。最新使用者指示是採用新路段。',
    '- 即使其他 subway relation 同時引用，仍不代表官方已確認營運。',
    '- 排序例外只限 relation 5317704 與記錄中的完整成員序列；其他 source order 或端點 ID 變化仍停止，不泛化成最近鄰規則。',
    '- 東涌東／東涌西來自原始 construction=station 節點、標示未開通，沒有官方站碼或到站查詢；東涌西沒有畫虛構接線。',
    '',
  );
  return lines.join('\n');
}
