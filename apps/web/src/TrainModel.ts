import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { LineCode } from '@hk-mtr/shared';
import { picturePaint, carriagePanel } from './pictureTrain';
import { trainProfiles } from './trainProfiles';

const templates = new Map<LineCode, THREE.Group>();
function template(line: LineCode) {
  const group = new THREE.Group(),
    ink = '#30303a',
    body = picturePaint[line];
  const batches = new Map<string, THREE.BufferGeometry[]>();
  function add(
    color: string,
    geo: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
  ) {
    const parts = batches.get(color) ?? [];
    parts.push(geo.translate(x, y, z));
    batches.set(color, parts);
  }
  function block(
    color: string,
    w: number,
    d: number,
    h: number,
    x: number,
    y: number,
    z: number,
    r = 0.07,
  ) {
    add(color, new RoundedBoxGeometry(w, d, h, 2, r), x, y, z);
  }
  const cab = line === 'AEL' ? 0.26 : 0.12;
  const shell = new THREE.Shape();
  shell.moveTo(-1.78, 0.29);
  shell.lineTo(1.74, 0.29);
  shell.lineTo(1.74 - cab, 1.55);
  shell.lineTo(-1.78, 1.55);
  shell.closePath();
  const geom = new THREE.ExtrudeGeometry(shell, {
    depth: 1.22,
    bevelSize: 0.07,
    bevelThickness: 0.06,
    bevelSegments: 2,
    steps: 1,
  }).rotateX(Math.PI / 2);
  add(body, geom, 0, 0.61, 0);
  block(ink, 3.72, 1.42, 0.22, -0.03, 0, 0.29);
  block('#55555d', 3.62, 1.46, 0.1, -0.02, 0, 0.29);
  block(ink, 0.7, 0.65, 0.1, -0.8, 0, 1.66);
  block(body, 0.62, 0.56, 0.09, -0.8, 0, 1.71);
  if (line === 'EAL') {
    const vertices = [
      new THREE.Vector3(0.33, 0, 1.63),
      new THREE.Vector3(0.66, 0, 1.99),
      new THREE.Vector3(0.9, 0, 1.74),
    ];
    for (let i = 1; i < vertices.length; i++)
      add(
        ink,
        new THREE.TubeGeometry(
          new THREE.LineCurve3(vertices[i - 1], vertices[i]),
          1,
          0.028,
          6,
          false,
        ),
        0,
        0,
        0,
      );
    block(ink, 0.42, 0.08, 0.06, 0.66, 0, 2.0);
  }
  for (const x of [-1.24, -0.89, 0.94, 1.29])
    for (const sign of [-1, 1]) {
      add(
        ink,
        new THREE.CylinderGeometry(0.215, 0.215, 0.13, 16),
        x,
        sign * 0.62,
        0.19,
      );
      add(
        '#77757b',
        new THREE.CylinderGeometry(0.108, 0.108, 0.015, 12),
        x,
        sign * 0.695,
        0.19,
      );
    }
  for (const [color, geos] of batches) {
    const normalized = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(normalized);
    group.add(new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color })));
    for (const g of new Set([...geos, ...normalized])) g.dispose();
  }
  for (const face of [false, true]) {
    const texture = new THREE.CanvasTexture(carriagePanel(line, face));
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    if (face) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.19, 1.23),
        material,
      );
      panel.rotation.order = 'ZYX';
      panel.rotation.z = Math.PI / 2;
      panel.rotation.x = Math.PI / 2 - Math.atan(cab / 1.26);
      panel.position.set(1.82 - cab / 2, 0, 0.92);
      group.add(panel);
    } else
      for (const sign of [-1, 1]) {
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(3.37, 1.19),
          material,
        );
        panel.rotation.order = 'ZYX';
        panel.rotation.z = sign > 0 ? Math.PI : 0;
        panel.rotation.x = Math.PI / 2;
        panel.position.set(-0.06, sign * 0.678, 0.92);
        group.add(panel);
      }
  }
  return group;
}
export function createTrainModel(line: LineCode) {
  let source = templates.get(line);
  if (!source) {
    source = template(line);
    templates.set(line, source);
  }
  const group = source.clone();
  group.name = 'toy-' + line;
  group.userData = {
    representativeModel: trainProfiles[line].nameZh,
    referenceOnly: true,
  };
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) obj.material = obj.material.clone();
  });
  return group;
}
