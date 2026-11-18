import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { MercatorCoordinate } from 'maplibre-gl';
import type { ToyCity } from './city';
import type { ToyWorld } from '@hk-mtr/shared/toy';
import type { LineCode } from '@hk-mtr/shared';

const PASTELS = [
  '#f2c48c',
  '#df9eaa',
  '#a9c9d8',
  '#b4aedb',
  '#e8d789',
  '#99c5a8',
  '#efbaa1',
  '#9fc4bf',
];
const lambert = (color: string) => new THREE.MeshLambertMaterial({ color });
const rounded = new RoundedBoxGeometry(1, 1, 1, 1, 0.07);
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2);
const ball = new THREE.SphereGeometry(1, 8, 5);
const cone = new THREE.ConeGeometry(1, 1, 8).rotateX(Math.PI / 2);
const dummy = new THREE.Object3D();
export const cityOrigin = MercatorCoordinate.fromLngLat([114.1, 22.35]);
export const cityScale = cityOrigin.meterInMercatorCoordinateUnits();
export function localPoint(point: [number, number]) {
  const p = MercatorCoordinate.fromLngLat(point);
  return [
    (p.x - cityOrigin.x) / cityScale,
    -(p.y - cityOrigin.y) / cityScale,
  ] as const;
}
function part(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  color: string,
  size: number[],
  at: number[],
  rotation = 0,
) {
  const mesh = new THREE.Mesh(geometry, lambert(color));
  mesh.scale.set(size[0], size[1], size[2]);
  mesh.position.set(at[0], at[1], at[2]);
  mesh.rotation.z = rotation;
  group.add(mesh);
  return mesh;
}
function cube(
  g: THREE.Group,
  color: string,
  size: number[],
  at: number[],
  rotation = 0,
) {
  return part(g, rounded, color, size, at, rotation);
}
function flat(
  g: THREE.Group,
  color: string,
  size: number[],
  at: number[],
  rotation = 0,
) {
  return part(g, box, color, size, at, rotation);
}
function round(g: THREE.Group, color: string, size: number[], at: number[]) {
  return part(g, ball, color, size, at);
}
function tube(g: THREE.Group, color: string, size: number[], at: number[]) {
  return part(g, cylinder, color, size, at);
}
function peak(g: THREE.Group, color: string, size: number[], at: number[]) {
  return part(g, cone, color, size, at);
}

/** Original miniature sculptures. Coordinates from named PBF nodes/footprints;
 * all silhouettes and dimensions are explicitly illustrative, not surveyed. */
function sculpture(kind: string) {
  const g = new THREE.Group();
  cube(g, '#eddfbd', [390, 280, 28], [0, 0, 14]);
  if (kind === 'castle' || kind === 'temple') {
    const temple = kind === 'temple';
    cube(g, temple ? '#e3b174' : '#f1bdca', [220, 130, 120], [0, 0, 85]);
    for (const x of [-105, 105])
      for (const y of [-70, 70]) {
        tube(g, temple ? '#d85e50' : '#f3dfa8', [37, 37, 210], [x, y, 125]);
        peak(g, temple ? '#d19c4d' : '#9c94d3', [53, 53, 100], [x, y, 280]);
      }
    tube(g, '#ecd9ab', [44, 44, 220], [0, 0, 180]);
    peak(g, temple ? '#d48748' : '#a39bdc', [65, 65, 120], [0, 0, 345]);
    cube(g, '#8da8ad', [44, 10, 70], [0, -71, 65]);
  } else if (kind === 'wheel') {
    for (const x of [-72, 72])
      cube(g, '#efb477', [13, 24, 240], [x, 0, 125], x > 0 ? -0.3 : 0.3);
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(140, 9, 8, 40),
      lambert('#f7f0da'),
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.z = 260;
    g.add(wheel);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      cube(
        g,
        PASTELS[i % 8],
        [42, 35, 40],
        [Math.cos(a) * 140, 0, 260 + Math.sin(a) * 140],
      );
      const spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 3, 140, 6),
        lambert('#e7cba0'),
      );
      spoke.position.set(Math.cos(a) * 70, 0, 260 + Math.sin(a) * 70);
      spoke.rotation.z = -a;
      spoke.rotation.x = Math.PI / 2;
      g.add(spoke);
    }
  } else if (kind === 'buddha') {
    for (let i = 0; i < 3; i++)
      tube(
        g,
        ['#b8be9a', '#d8c398', '#ecdbb6'][i],
        [145 - i * 22, 145 - i * 22, 24],
        [0, 0, 35 + i * 24],
      );
    round(g, '#af9d74', [92, 65, 75], [0, 0, 135]);
    round(g, '#b8a781', [57, 44, 90], [0, 0, 205]);
    round(g, '#c8b58a', [41, 38, 45], [0, 0, 307]);
    for (const x of [-54, 54]) round(g, '#bfa77f', [26, 27, 60], [x, 0, 215]);
    for (const x of [-12, 12]) round(g, '#665c50', [4, 3, 4], [x, -36, 313]);
    round(g, '#8b8872', [42, 36, 15], [0, 0, 345]);
  } else if (kind === 'space') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(
        120,
        16,
        10,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2,
      ).rotateX(Math.PI / 2),
      lambert('#f7ecd5'),
    );
    dome.position.z = 35;
    g.add(dome);
    cube(g, '#dfc795', [170, 95, 55], [125, 0, 55]);
    for (let i = 0; i < 3; i++)
      flat(g, '#a6c5c8', [150, 5, 7], [125, -49, 40 + i * 15]);
  } else if (kind === 'convention' || kind === 'tower') {
    for (let i = 0; i < 3; i++) {
      const roof = cube(
        g,
        i % 2 ? '#b2cad1' : '#e6e8d3',
        [270 - i * 30, 100, 26],
        [i * 20, (i - 1) * 75, 110 + i * 30],
      );
      roof.rotation.x = 0.1 * (i - 1);
    }
    for (const x of [-100, 100])
      for (const y of [-70, 70]) cube(g, '#e5d2a9', [18, 18, 100], [x, y, 60]);
    cube(g, '#89b8c2', [230, 180, 70], [15, 0, 50]);
  } else if (kind === 'stadium') {
    tube(g, '#beaccf', [145, 105, 90], [0, 0, 70]);
    tube(g, '#efe4bc', [120, 80, 15], [0, 0, 121]);
    tube(g, '#7eac7b', [94, 56, 16], [0, 0, 132]);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      round(
        g,
        '#a8cdd4',
        [18, 12, 35],
        [Math.cos(a) * 142, Math.sin(a) * 102, 89],
      );
    }
  } else if (kind === 'clock') {
    cube(g, '#d39c77', [85, 85, 270], [0, 0, 160]);
    cube(g, '#e6bf95', [100, 100, 35], [0, 0, 290]);
    peak(g, '#86a4a0', [78, 78, 65], [0, 0, 340]);
    for (const y of [-44, 44]) {
      const face = new THREE.Mesh(
        new THREE.CircleGeometry(25, 24),
        lambert('#fff5d6'),
      );
      face.rotation.x = y < 0 ? Math.PI / 2 : -Math.PI / 2;
      face.position.set(0, y, 252);
      g.add(face);
      flat(g, '#61706f', [5, 3, 18], [0, y * 1.03, 255]);
      flat(g, '#61706f', [16, 3, 4], [6, y * 1.03, 251]);
    }
  } else if (kind === 'ferry') {
    cube(g, '#8faf89', [240, 100, 80], [0, 0, 60]);
    cube(g, '#fff4d7', [260, 120, 25], [0, 0, 115]);
    cube(g, '#7db8bf', [200, 110, 36], [0, 0, 150]);
  } else {
    const h =
      kind === 'icc' ? 520 : kind === 'ifc' ? 470 : kind === 'bank' ? 380 : 270;
    cube(
      g,
      kind === 'bank' ? '#a5c2cf' : '#a1c6cb',
      [130, 100, h],
      [0, 0, h / 2 + 28],
    );
    for (let i = 0; i < 8; i++)
      flat(g, '#d9efe2', [134, 104, 10], [0, 0, 60 + (i * (h - 50)) / 8]);
    cube(g, '#d9e4c9', [80, 65, 55], [0, 0, h + 45]);
    if (kind === 'bank') {
      for (const sign of [-1, 1]) {
        const a = flat(g, '#f5ebcb', [7, 104, h * 0.8], [0, 0, h / 2 + 30]);
        a.rotation.y = sign * 0.26;
      }
      tube(g, '#e9e2c8', [4, 4, 100], [35, 15, h + 100]);
    }
  }
  return g;
}

function instance(
  geometry: THREE.BufferGeometry,
  color: string,
  count: number,
) {
  const m = new THREE.InstancedMesh(geometry, lambert(color), count);
  m.frustumCulled = false;
  return m;
}
function set(
  m: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  angle = 0,
  color?: string,
) {
  dummy.position.set(x, y, z);
  dummy.scale.set(w, d, h);
  dummy.rotation.set(0, 0, angle);
  dummy.updateMatrix();
  m.setMatrixAt(i, dummy.matrix);
  if (color) m.setColorAt(i, new THREE.Color(color));
}
/** Partition large source-backed instancing batches into geographic chunks so
 * three.js can frustum-cull off-screen geometry with the MapLibre matrix. */
function spatialChunks(root: THREE.Group) {
  const meshes: THREE.InstancedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh && o.count > 400) meshes.push(o);
  });
  for (const mesh of meshes) {
    const buckets = new Map<string, number[]>();
    const matrices = mesh.instanceMatrix.array;
    for (let i = 0; i < mesh.count; i++) {
      const key =
        Math.floor(matrices[i * 16 + 12] / 4000) +
        ':' +
        Math.floor(matrices[i * 16 + 13] / 4000);
      const list = buckets.get(key) ?? [];
      list.push(i);
      buckets.set(key, list);
    }
    const parent = mesh.parent!;
    for (const indices of buckets.values()) {
      const chunk = new THREE.InstancedMesh(
        mesh.geometry,
        mesh.material,
        indices.length,
      );
      chunk.renderOrder = mesh.renderOrder;
      indices.forEach((index, i) =>
        chunk.instanceMatrix.array.set(
          matrices.slice(index * 16, index * 16 + 16),
          i * 16,
        ),
      );
      if (mesh.instanceColor) {
        const values = new Float32Array(indices.length * 3);
        indices.forEach((index, i) =>
          values.set(
            mesh.instanceColor!.array.slice(index * 3, index * 3 + 3),
            i * 3,
          ),
        );
        chunk.instanceColor = new THREE.InstancedBufferAttribute(values, 3);
      }
      chunk.computeBoundingSphere();
      chunk.frustumCulled = true;
      parent.add(chunk);
    }
    parent.remove(mesh);
    mesh.dispose();
  }
}
export class CityScenery {
  group = new THREE.Group();
  rails: { line: LineCode; group: THREE.Group }[] = [];
  landmarkObjects: {
    mesh: THREE.Group;
    point: [number, number];
    kind: string;
  }[] = [];
  constructor(city: ToyCity, world: ToyWorld) {
    const terrain = city.hills.map(({ id, coordinates }) => {
      const [x, y] = localPoint(coordinates);
      return { id, x, y, radius: 500 + (id % 450), height: 230 + (id % 190) };
    });
    // Artistic toy terrain surface, never a real elevation estimate.
    const ground = (x: number, y: number) => {
      let z = 0;
      for (const hill of terrain) {
        const a = (x - hill.x) / hill.radius,
          b = (y - hill.y) / (hill.radius * 0.85),
          r = a * a + b * b;
        if (r < 1) z = Math.max(z, -20 + hill.height * Math.sqrt(1 - r));
        const cap = (a / 0.38) ** 2 + (b / 0.4) ** 2;
        if (cap < 1)
          z = Math.max(
            z,
            hill.height * 0.7 + hill.height * 0.3 * Math.sqrt(1 - cap),
          );
      }
      return z;
    };
    const buildings = city.buildings.filter(
      (b) =>
        !city.landmarks.some((l) => {
          const dx = (b[1] - l.coordinates[0]) * 102900,
            dy = (b[2] - l.coordinates[1]) * 111320;
          return dx * dx + dy * dy < 150 * 150;
        }),
    );
    const n = buildings.length;
    const bodies = instance(rounded, '#ffffff', n),
      roofs = instance(rounded, '#ffffff', n),
      bases = instance(rounded, '#cfcaac', n),
      studs = instance(cylinder, '#ffffff', n * 2);
    const shadows = instance(box, '#839779', n);
    shadows.material.transparent = true;
    shadows.material.opacity = 0.13;
    shadows.material.depthWrite = false;
    // Just six large recessed windows per building, two instanced batches.
    const windows = instance(box, '#f9f0d5', n * 6),
      balconies = instance(box, '#fff5df', n * 3);
    buildings.forEach(([id, lon, lat, width, depth, height, angle], i) => {
      const w = width * 1.45,
        d = depth * 1.45,
        h = height * 1.65;
      const [x, y] = localPoint([lon, lat]);
      const lift = ground(x, y);
      const place = (...args: Parameters<typeof set>) => {
        args[4] += lift;
        set(...args);
      };
      const color = PASTELS[id % PASTELS.length];
      place(shadows, i, x + 18, y - 20, 1, w + 22, d + 25, 2, angle);
      place(bases, i, x, y, 7, w + 12, d + 12, 14, angle);
      place(bodies, i, x, y, h / 2 + 14, w, d, h, angle, color);
      place(
        roofs,
        i,
        x,
        y,
        h + 19,
        w + 9,
        d + 9,
        13,
        angle,
        id % 4 === 0 ? '#8bad9c' : '#f7e9c6',
      );
      for (let j = 0; j < 2; j++) {
        const off = (j - 0.5) * w * 0.43;
        place(
          studs,
          i * 2 + j,
          x + Math.cos(angle) * off,
          y + Math.sin(angle) * off,
          h + 31,
          w * 0.17,
          w * 0.17,
          15,
          0,
          color,
        );
      }
      for (let floor = 0; floor < 3; floor++) {
        for (let side = 0; side < 2; side++) {
          const xx = (side - 0.5) * w * 0.48,
            yy = -d * 0.507;
          place(
            windows,
            i * 6 + floor * 2 + side,
            x + xx * Math.cos(angle) - yy * Math.sin(angle),
            y + xx * Math.sin(angle) + yy * Math.cos(angle),
            40 + (floor * (h - 45)) / 3,
            w * 0.2,
            2.5,
            Math.min(22, h * 0.13),
            angle,
            id % 3 ? '#fff1bc' : '#61888d',
          );
        }
        const yy = -d * 0.54;
        place(
          balconies,
          i * 3 + floor,
          x - yy * Math.sin(angle),
          y + yy * Math.cos(angle),
          27 + (floor * (h - 45)) / 3,
          w * 0.9,
          8,
          5,
          angle,
        );
      }
    });
    this.group.add(shadows, bases, bodies, roofs, studs, windows, balconies);
    // Park clusters and source-building verges. Positions are decorative offsets,
    // never used as geographic data or railway/station locations.
    const trees: { x: number; y: number; id: number }[] = [];
    for (const [id, lon, lat] of city.greens) {
      const [x, y] = localPoint([lon, lat]);
      for (let j = 0; j < 5; j++) {
        const a = j * 2.4;
        trees.push({
          x: x + Math.cos(a) * 90 * (1 + (j % 3)),
          y: y + Math.sin(a) * 90 * (1 + (j % 3)),
          id: id + j,
        });
      }
    }
    buildings.forEach(([id, lon, lat, w], i) => {
      if (i % 3 !== 0) return;
      const [x, y] = localPoint([lon, lat]);
      trees.push({ x: x + w * 0.8, y: y - 40, id });
    });
    for (const hill of terrain)
      for (let j = 0; j < 8; j++) {
        const a = j * 2.4,
          d = hill.radius * (0.12 + 0.065 * j);
        trees.push({
          x: hill.x + Math.cos(a) * d,
          y: hill.y + Math.sin(a) * d * 0.85,
          id: hill.id + j,
        });
      }
    const trunks = instance(cylinder, '#b39975', trees.length),
      crowns = instance(ball, '#ffffff', trees.length),
      tops = instance(ball, '#ffffff', trees.length);
    trees.forEach(({ x, y, id }, i) => {
      const lift = ground(x, y);
      const place = (...args: Parameters<typeof set>) => {
        args[4] += lift;
        set(...args);
      };
      place(trunks, i, x, y, 40, 12, 12, 80);
      place(
        crowns,
        i,
        x,
        y,
        100,
        52,
        48,
        65,
        0,
        ['#85b29c', '#a5c981', '#b8cc85', '#79ab92'][id % 4],
      );
      place(tops, i, x + 10, y + 3, 145, 34, 32, 38, 0, '#c2da9e');
    });
    this.group.add(trunks, crowns, tops);
    const dome = new THREE.SphereGeometry(
      1,
      16,
      8,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ).rotateX(Math.PI / 2);
    const hills = instance(dome, '#ffffff', city.hills.length),
      hillCaps = instance(dome, '#ffffff', city.hills.length);
    terrain.forEach(({ id, x, y, radius, height }, i) => {
      set(
        hills,
        i,
        x,
        y,
        -20,
        radius,
        radius * 0.85,
        height,
        0,
        ['#aacb91', '#b7d29c', '#a4c697'][id % 3],
      );
      set(
        hillCaps,
        i,
        x,
        y,
        height * 0.7,
        radius * 0.38,
        radius * 0.34,
        height * 0.3,
        0,
        '#c9dda8',
      );
    });
    this.group.add(hills, hillCaps);
    // Source-located original landmark sculptures, deliberately exaggerated.
    for (const l of city.landmarks) {
      const mesh = sculpture(l.kind);
      const [x, y] = localPoint(l.coordinates);
      mesh.position.set(x, y, 0);
      mesh.scale.setScalar(1.75);
      this.group.add(mesh);
      this.landmarkObjects.push({ mesh, point: l.coordinates, kind: l.kind });
    }
    const bridgeSegments: {
      x: number;
      y: number;
      length: number;
      angle: number;
    }[] = [];
    city.roads.features.forEach((f) => {
      const pts = f.geometry.coordinates.map(localPoint);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1],
          b = pts[i];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (length > 5)
          bridgeSegments.push({
            x: (a[0] + b[0]) / 2,
            y: (a[1] + b[1]) / 2,
            length,
            angle: Math.atan2(b[1] - a[1], b[0] - a[0]),
          });
      }
    });
    const decks = instance(box, '#e4c9ab', bridgeSegments.length),
      surfaces = instance(box, '#e6e4cc', bridgeSegments.length),
      supports = instance(box, '#bcc4a3', bridgeSegments.length);
    bridgeSegments.forEach((s, i) => {
      set(decks, i, s.x, s.y, 40, s.length + 3, 80, 22, s.angle);
      set(surfaces, i, s.x, s.y, 54, s.length + 3, 61, 8, s.angle);
      set(supports, i, s.x, s.y, 19, 13, 50, 38, s.angle);
    });
    this.group.add(supports, decks, surfaces);
    // Small stations are toy platforms at the source OSM node, not official centres.
    const unique = [
      ...new Map(
        world.stations.stations.map((s) => [s.stationCode, s]),
      ).values(),
    ];
    const platforms = instance(rounded, '#f7e8bf', unique.length),
      shelters = instance(rounded, '#e6a69c', unique.length),
      pillars = instance(box, '#e9ead4', unique.length * 2);
    unique.forEach((s, i) => {
      const [x, y] = localPoint(s.coordinates);
      set(platforms, i, x, y, 21, 180, 95, 34);
      set(shelters, i, x, y + 18, 102, 150, 65, 18, 0, world.colours[s.line]);
      for (let j = 0; j < 2; j++)
        set(pillars, i * 2 + j, x + (j - 0.5) * 120, y + 18, 63, 9, 9, 70);
    });
    this.group.add(platforms, pillars, shelters);
    for (const r of world.routes)
      this.buildTrack(r.line, r.path, world.colours[r.line]);
    // Little ships and buoys sit on a toy harbour display; decorative art.
    const harbour = [
      localPoint([114.152, 22.3]),
      localPoint([114.173, 22.3]),
      localPoint([114.11, 22.325]),
    ];
    harbour.forEach(([x, y], i) => {
      const ship = new THREE.Group();
      cube(ship, '#719c86', [270, 95, 40], [0, 0, 35]);
      cube(ship, '#fff2ce', [210, 87, 48], [0, 0, 76]);
      cube(ship, '#d5b279', [230, 90, 13], [0, 0, 108]);
      for (let j = 0; j < 6; j++)
        flat(ship, '#8bbdc3', [18, 2, 20], [-80 + j * 30, -46, 78]);
      ship.position.set(x, y, 1);
      ship.rotation.z = i * 0.7;
      this.group.add(ship);
    });
    spatialChunks(this.group);
  }
  addTrack(line: LineCode, path: [number, number][], color: string) {
    this.buildTrack(line, path, color);
    const last = this.rails.at(-1);
    if (last) spatialChunks(last.group);
  }
  private buildTrack(line: LineCode, path: [number, number][], color: string) {
    const points = path.map(localPoint),
      segments: { x: number; y: number; length: number; angle: number }[] = [],
      ties: { x: number; y: number; angle: number }[] = [];
    let carry = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        length = Math.hypot(dx, dy),
        angle = Math.atan2(dy, dx);
      if (length < 0.1) continue;
      segments.push({
        x: (a[0] + b[0]) / 2,
        y: (a[1] + b[1]) / 2,
        length,
        angle,
      });
      let d = carry;
      for (; d < length; d += 95)
        ties.push({
          x: a[0] + (dx * d) / length,
          y: a[1] + (dy * d) / length,
          angle,
        });
      carry = d - length;
    }
    const g = new THREE.Group(),
      beds = instance(box, color, segments.length),
      sleepers = instance(box, '#9b7963', ties.length),
      rails = instance(box, '#e7efe5', segments.length * 2),
      outsides = instance(box, '#526971', segments.length * 2);
    segments.forEach((s, i) => {
      set(beds, i, s.x, s.y, 15, s.length + 2, 102, 22, s.angle);
      for (let j = 0; j < 2; j++) {
        const off = (j - 0.5) * 62,
          x = s.x - Math.sin(s.angle) * off,
          y = s.y + Math.cos(s.angle) * off;
        set(outsides, i * 2 + j, x, y, 42, s.length + 3, 14, 14, s.angle);
        set(rails, i * 2 + j, x, y, 51, s.length + 3, 7, 6, s.angle);
      }
    });
    ties.forEach((s, i) => set(sleepers, i, s.x, s.y, 32, 23, 115, 9, s.angle));
    for (const m of [beds, sleepers, outsides, rails]) {
      m.material.depthTest = false;
      m.renderOrder = 20 + (m === rails ? 3 : m === outsides ? 2 : 0);
      g.add(m);
    }
    this.rails.push({ line, group: g });
    this.group.add(g);
  }
  update(active: LineCode | null, metersPerPixel: number) {
    for (const r of this.rails) r.group.visible = !active || active === r.line;
    // Landmarks retain a readable miniature size at a full-island view.
    for (const l of this.landmarkObjects)
      l.mesh.scale.setScalar(Math.max(1.6, Math.min(3.2, metersPerPixel / 13)));
  }
}
