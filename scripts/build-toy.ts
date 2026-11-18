import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { toyWorldSchema, pathLengths } from '../packages/shared/src/toy.js';
const read = async (p: string) => JSON.parse(await readFile(p, 'utf8'));
const preview = await read('data/reports/development-map.json'),
  d = await read('data/reports/osm-extract.json');
const routes: {
  relationId: number;
  line: string;
  parts: number[][];
  from: string;
  to: string;
  via: string | null;
  usableForAnimation: boolean;
}[] = await read('data/reports/animation-routes.json');
const selected = [];
for (const line of Object.keys(preview.colours)) {
  let candidates = routes.filter(
    (r) => r.line === line && r.usableForAnimation && r.parts.length === 1,
  );
  if (line === 'EAL')
    candidates = candidates.filter(
      (r) =>
        r.from.includes('Admiralty') &&
        !r.via &&
        /Lo Wu|Lok Ma Chau/.test(r.to),
    );
  else if (line === 'TKL')
    candidates = candidates.filter(
      (r) => r.from.includes('North Point') && /Po Lam|LOHAS Park/.test(r.to),
    );
  else
    candidates.sort(
      (a, b) =>
        pathLengths(b.parts[0].map((n) => d.nodes[n].coordinates)).at(-1)! -
        pathLengths(a.parts[0].map((n) => d.nodes[n].coordinates)).at(-1)!,
    );
  for (const r of candidates.slice(0, ['EAL', 'TKL'].includes(line) ? 2 : 1))
    selected.push({
      id: `toy-${r.relationId}`,
      line: r.line,
      path: r.parts[0].map((n) => d.nodes[n].coordinates),
    });
}
const toy = toyWorldSchema.parse({
  ...preview,
  publication: 'toy-simulation',
  pendingLines: [],
  routes: selected,
  upcomingStations: [11039819034, 11039819033].map((id) => {
    const node = d.nodes[id];
    if (
      !node ||
      node.tags.railway !== 'construction' ||
      node.tags.construction !== 'station'
    )
      throw Error(`UPCOMING_STATION_SOURCE_CHANGED ${id}`);
    return {
      id: `osm-node-${id}`,
      line: 'TCL',
      chineseName: node.tags['name:zh-Hant'] ?? node.tags['name:zh'],
      englishName: node.tags['name:en'],
      coordinates: node.coordinates,
      sourceNodeId: node.id,
      status: 'not-open',
      source: `https://www.openstreetmap.org/node/${id}`,
      sourceTags: node.tags,
    };
  }),
});
await mkdir('apps/web/public/data', { recursive: true });
await writeFile('apps/web/public/data/toy-world.json', JSON.stringify(toy));
console.log(
  `Toy world: ${toy.routes.length} connected source paths, 10 lines; TCL exact-node order override. ${toy.upcomingStations.length} unopened source stations. Explicit simulation, no real train identities.`,
);
