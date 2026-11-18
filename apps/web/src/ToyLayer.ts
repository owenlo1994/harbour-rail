import * as THREE from 'three';
import { createTrainModel } from './TrainModel';
import {
  LiveMotion,
  pointAtDistance,
  routeLengths,
  type LiveFeed,
  type LiveNetwork,
} from '@hk-mtr/shared/live';
import {
  MercatorCoordinate,
  type Map as RailMap,
  type CustomLayerInterface,
} from 'maplibre-gl';
import {
  pathLengths,
  sampleToy,
  type ToyTrain,
  type ToyWorld,
} from '@hk-mtr/shared/toy';
import type { LineCode } from '@hk-mtr/shared';
import type { ToyCity } from './city';
import { CityScenery } from './CityScenery';
export interface ToyControls {
  mode: 'simulation' | 'live';
  liveFeed: LiveFeed | null;
  liveNetwork: LiveNetwork | null;
  clockOffset: number;
  paused: boolean;
  speed: number;
  active: LineCode | null;
  followId: string | null;
}
export class ToyLayer implements CustomLayerInterface {
  id = 'toy-trains';
  type = 'custom' as const;
  renderingMode = '3d' as const;
  map!: RailMap;
  renderer!: THREE.WebGLRenderer;
  camera = new THREE.Camera();
  scene = new THREE.Scene();
  origin = MercatorCoordinate.fromLngLat([114.1, 22.35]);
  scale = this.origin.meterInMercatorCoordinateUnits();
  trains: {
    id: string;
    line: LineCode;
    path: [number, number][];
    lengths: number[];
    offset: number;
    mesh: THREE.Group;
  }[] = [];
  city!: CityScenery;
  liveMeshes = new Map<string, { mesh: THREE.Group; line: LineCode }>();
  livePaths = new Map<
    string,
    { path: [number, number][]; lengths: number[] }
  >();
  motion = new LiveMotion();
  lastFeed: LiveFeed | null = null;
  liveNetworkReady = false;
  previousMode = 'simulation';
  positions: ToyTrain[] = [];
  clock = 0;
  last = 0;
  lastReport = 0;
  lastFollow = 0;
  repaintTimer: ReturnType<typeof setTimeout> | null = null;
  cameraTarget: [number, number] | null = null;
  constructor(
    private world: ToyWorld,
    private cityData: ToyCity,
    private controls: () => ToyControls,
    private onTick: (trains: ToyTrain[]) => void,
  ) {}
  onAdd(map: RailMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
    this.scene.add(new THREE.HemisphereLight('#fff7db', '#8fa7a7', 2.6));
    const sun = new THREE.DirectionalLight('#fff8e5', 2.4);
    sun.position.set(-300, -400, 1000);
    this.scene.add(sun);
    this.city = new CityScenery(this.cityData, this.world);
    this.scene.add(this.city.group);
    this.world.routes.forEach((r, i) => {
      for (let j = 0; j < 1; j++) {
        const mesh = createTrainModel(r.line);
        mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.material.depthTest = true;
            o.renderOrder = 40;
          }
        });
        this.scene.add(mesh);
        this.trains.push({
          id: `${r.line}-${i}-${j}`,
          line: r.line,
          path: r.path,
          lengths: pathLengths(r.path),
          offset: j * 85 + i * 13,
          mesh,
        });
      }
    });
  }
  render: NonNullable<CustomLayerInterface['render']> = (gl, args) => {
    const time = performance.now(),
      dt = this.last ? Math.min((time - this.last) / 1000, 0.1) : 0;
    this.last = time;
    const controls = this.controls();
    if (controls.mode !== this.previousMode) {
      if (controls.mode === 'live') this.motion = new LiveMotion();
      this.previousMode = controls.mode;
    }
    if (!controls.paused) this.clock += dt * controls.speed;
    const metersPerPixel =
        (40075016.686 * Math.cos((22.35 * Math.PI) / 180)) /
        (512 * 2 ** this.map.getZoom()),
      size = metersPerPixel * 10;
    this.positions = this.trains.map((t) => {
      const p = sampleToy(t.path, t.lengths, this.clock, t.offset);
      const m = MercatorCoordinate.fromLngLat(p.coordinates);
      t.mesh.position.set(
        (m.x - this.origin.x) / this.scale,
        -(m.y - this.origin.y) / this.scale,
        56 + size * 0.05,
      );
      t.mesh.rotation.z = p.heading;
      t.mesh.scale.setScalar(size * (t.id === controls.followId ? 2.4 : 1));
      t.mesh.visible =
        controls.mode === 'simulation' &&
        (!controls.active || controls.active === t.line);
      return { id: t.id, line: t.line, mode: 'simulation' as const, ...p };
    });
    if (controls.liveNetwork && !this.liveNetworkReady) {
      for (const r of controls.liveNetwork.routes) {
        this.livePaths.set(r.id, {
          path: r.path,
          lengths: routeLengths(r.path),
        });
        if (r.via === 'RAC' && r.direction === 'UP')
          this.city.addTrack(r.line, r.path, this.world.colours[r.line]);
      }
      this.liveNetworkReady = true;
    }
    if (controls.liveFeed) this.lastFeed = controls.liveFeed;
    const livePositions: ToyTrain[] = [];
    const ids = new Set<string>();
    for (const t of this.lastFeed?.trains ?? []) {
      ids.add(t.id);
      const route = this.livePaths.get(t.pathId);
      if (!route) continue;
      const sample = this.motion.sample(t, Date.now() + controls.clockOffset);
      let item = this.liveMeshes.get(t.id);
      if (!item) {
        const mesh = createTrainModel(t.line);
        mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.material.depthTest = true;
            o.renderOrder = 42;
          }
        });
        item = { mesh, line: t.line };
        this.liveMeshes.set(t.id, item);
        this.scene.add(mesh);
      }
      const p = pointAtDistance(route.path, route.lengths, sample.distance),
        m = MercatorCoordinate.fromLngLat(p.coordinates);
      item.mesh.position.set(
        (m.x - this.origin.x) / this.scale,
        -(m.y - this.origin.y) / this.scale,
        56 + size * 0.05,
      );
      item.mesh.rotation.z = p.heading;
      item.mesh.scale.setScalar(size * (t.id === controls.followId ? 2.4 : 1));
      item.mesh.visible =
        controls.mode === 'live' &&
        sample.opacity > 0.01 &&
        (!controls.active || controls.active === t.line);
      item.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.material.opacity = sample.opacity;
          o.material.transparent = sample.opacity < 1;
        }
      });
      if (sample.opacity > 0.01)
        livePositions.push({
          id: t.id,
          line: t.line,
          mode: 'live',
          live: t,
          correcting: sample.correcting,
          dataState: sample.state,
          coordinates: p.coordinates,
          heading: p.heading,
          progress: sample.distance / route.lengths.at(-1)!,
        });
    }
    for (const [id, item] of this.liveMeshes)
      if (!ids.has(id)) {
        this.scene.remove(item.mesh);
        item.mesh.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material.dispose();
        });
        this.liveMeshes.delete(id);
      }
    this.motion.prune(ids);
    if (controls.mode === 'live') this.positions = livePositions;
    this.city.update(controls.active, metersPerPixel);
    const matrix = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix,
    );
    const local = new THREE.Matrix4()
      .makeTranslation(this.origin.x, this.origin.y, this.origin.z)
      .scale(new THREE.Vector3(this.scale, -this.scale, this.scale));
    this.camera.projectionMatrix = matrix.multiply(local);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    if ((controls.mode === 'live' || !controls.paused) && !this.repaintTimer)
      this.repaintTimer = setTimeout(() => {
        this.repaintTimer = null;
        this.map.triggerRepaint();
      }, 50);
    if (time - this.lastReport > 700) {
      this.lastReport = time;
      const canvas = this.map.getCanvas();
      canvas.dataset.trainMode = controls.mode;
      canvas.dataset.trainCount = String(
        this.positions.filter(
          (t) => !controls.active || t.line === controls.active,
        ).length,
      );
      canvas.dataset.liveTrainCount = String(
        this.positions.filter(
          (t) =>
            t.mode === 'live' &&
            (!controls.active || t.line === controls.active),
        ).length,
      );

      this.onTick(this.positions);
    }
    if (
      controls.followId &&
      (controls.mode === 'live' || !controls.paused) &&
      time - this.lastFollow > 100
    ) {
      const t = this.positions.find((p) => p.id === controls.followId);
      if (t && !this.map.isEasing()) {
        this.lastFollow = time;
        if (
          !this.cameraTarget ||
          Math.hypot(
            t.coordinates[0] - this.cameraTarget[0],
            t.coordinates[1] - this.cameraTarget[1],
          ) > 1e-8
        ) {
          this.cameraTarget = t.coordinates;
          this.map.jumpTo({ center: t.coordinates });
        }
      }
    }
  };
  onRemove() {
    if (this.repaintTimer) clearTimeout(this.repaintTimer);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        for (const material of Array.isArray(m) ? m : [m]) material.dispose();
      }
    });
    this.renderer?.dispose();
  }
}
