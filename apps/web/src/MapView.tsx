import { useEffect, useRef } from 'react';
import maplibregl, {
  type Map as RailMap,
  type FilterSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import { ToyLayer, type ToyControls } from './ToyLayer';
import type { ToyWorld, ToyTrain } from '@hk-mtr/shared/toy';
import type { Station } from '@hk-mtr/shared/network';
import type { ToyCity } from './city';
import 'maplibre-gl/dist/maplibre-gl.css';
export type UpcomingStation = ToyWorld['upcomingStations'][number];
type Props = {
  data: ToyWorld;
  city: ToyCity;
  controls: ToyControls;
  locationFix: { coordinates: [number, number]; accuracy: number } | null;
  selected: Station | null;
  upcoming: UpcomingStation | null;
  onSelect: (s: Station) => void;
  onUpcoming: (s: UpcomingStation) => void;
  onTrain: (t: ToyTrain) => void;
  onTick: (trains: ToyTrain[]) => void;
  onReady: (ready: boolean) => void;
  onStopFollow: () => void;
  action: {
    kind:
      | 'home'
      | 'tilt'
      | 'zoom-in'
      | 'zoom-out'
      | 'station'
      | 'follow'
      | 'upcoming'
      | 'island';
    serial: number;
  };
};
/** Purpose-built toy board. No ordinary bright-style roads, POI clutter, hillshade
 * or satellite terrain. All geographic fill/road geometry retains OSM attribution. */
function toyStyle(): StyleSpecification {
  const roadFilter: FilterSpecification = [
    'in',
    ['get', 'class'],
    [
      'literal',
      ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'],
    ],
  ];
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      world: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution:
          '<a href="https://openfreemap.org">OpenFreeMap</a> / <a href="https://openmaptiles.org">OpenMapTiles</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
      },
    },
    layers: [
      {
        id: 'toy-land',
        type: 'background',
        paint: { 'background-color': '#d6e5b3' },
      },
      {
        id: 'toy-gardens',
        type: 'fill',
        source: 'world',
        'source-layer': 'landcover',
        paint: { 'fill-color': '#c2d89e', 'fill-opacity': 0.7 },
      },
      {
        id: 'toy-neighbourhood',
        type: 'fill',
        source: 'world',
        'source-layer': 'landuse',
        filter: [
          'in',
          ['get', 'class'],
          ['literal', ['residential', 'commercial', 'industrial']],
        ],
        paint: { 'fill-color': '#e4e6bc', 'fill-opacity': 0.8 },
      },
      {
        id: 'toy-parks',
        type: 'fill',
        source: 'world',
        'source-layer': 'park',
        paint: { 'fill-color': '#bbd6a0' },
      },
      {
        id: 'toy-water',
        type: 'fill',
        source: 'world',
        'source-layer': 'water',
        paint: { 'fill-color': '#9bd2d8', 'fill-outline-color': '#7dbfc4' },
      },
      {
        id: 'toy-shore',
        type: 'line',
        source: 'world',
        'source-layer': 'water',
        paint: {
          'line-color': '#f7e9c8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2, 13, 5],
          'line-opacity': 0.85,
        },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      },
      {
        id: 'toy-streams',
        type: 'line',
        source: 'world',
        'source-layer': 'waterway',
        paint: { 'line-color': '#a5d7d4', 'line-width': 3 },
        layout: { 'line-join': 'round', 'line-cap': 'round' },
      },
      {
        id: 'toy-road-shadow',
        type: 'line',
        source: 'world',
        'source-layer': 'transportation',
        filter: roadFilter,
        paint: {
          'line-color': '#b5bfa3',
          'line-opacity': 0.55,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1,
            12,
            5,
            15,
            16,
          ],
          'line-translate': [1, 2],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'toy-road-edge',
        type: 'line',
        source: 'world',
        'source-layer': 'transportation',
        filter: roadFilter,
        paint: {
          'line-color': '#d3bea2',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0.8,
            12,
            4.2,
            15,
            14,
          ],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'toy-road-cream',
        type: 'line',
        source: 'world',
        'source-layer': 'transportation',
        filter: roadFilter,
        paint: {
          'line-color': '#fcf0d3',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            0.5,
            12,
            3,
            15,
            11,
          ],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
      {
        id: 'toy-road-stitches',
        type: 'line',
        source: 'world',
        'source-layer': 'transportation',
        minzoom: 12,
        filter: [
          'in',
          ['get', 'class'],
          ['literal', ['motorway', 'trunk', 'primary']],
        ],
        paint: {
          'line-color': '#baad8e',
          'line-width': 1,
          'line-dasharray': [2, 4],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      },
    ],
  };
}
const HOME = {
  center: [114.163, 22.3] as [number, number],
  zoom: 12.55,
  pitch: 52,
  bearing: -24,
};
export function MapView({
  data,
  city,
  controls,
  locationFix,
  selected,
  upcoming,
  onSelect,
  onUpcoming,
  onTrain,
  onTick,
  onReady,
  onStopFollow,
  action,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<RailMap | null>(null),
    layer = useRef<ToyLayer | null>(null),
    latest = useRef(controls);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  useEffect(() => {
    latest.current = controls;
    map.current?.triggerRepaint();
  }, [controls]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!locationFix) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current) {
      const element = document.createElement('div');
      element.className = 'user-location-marker';
      element.setAttribute('aria-label', '你的位置');
      userMarker.current = new maplibregl.Marker({ element })
        .setLngLat(locationFix.coordinates)
        .addTo(m);
    }
    userMarker.current.setLngLat(locationFix.coordinates);
    userMarker.current.getElement().title = `定位精確度約 ${Math.round(locationFix.accuracy)} 米`;
  }, [locationFix]);
  useEffect(() => {
    const m = map.current,
      network = controls.liveNetwork;
    if (!m || !network) return;
    const apply = () => {
      if (m.getSource('rac-rail')) return;
      m.addSource('rac-rail', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: network.routes
            .filter((r) => r.via === 'RAC' && r.direction === 'UP')
            .map((r) => ({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: r.path },
              properties: { line: r.line },
            })),
        },
      });
      m.addLayer(
        {
          id: 'rac-rail-line',
          type: 'line',
          source: 'rac-rail',
          paint: { 'line-color': data.colours.EAL, 'line-width': 3 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        },
        'station-points',
      );
    };
    if (m.getLayer('station-points')) apply();
    else m.on('style.load', apply);
    return () => {
      m.off('style.load', apply);
    };
  }, [controls.liveNetwork, data]);
  useEffect(() => {
    const mobile = window.innerWidth < 760;
    const m = new maplibregl.Map({
      container: container.current!,
      style: toyStyle(),
      ...HOME,
      zoom: mobile ? 12.35 : HOME.zoom,
      canvasContextAttributes: { antialias: true },
      attributionControl: { compact: true },
      minZoom: 9.2,
      maxZoom: 16,
      maxBounds: [
        [113.75, 22.1],
        [114.55, 22.65],
      ],
      maxPitch: 65,
    });
    map.current = m;
    m.on('dragstart', onStopFollow);
    m.on('style.load', () => {
      // Repeating hand-drawn wavelets are a tiny original canvas texture, not map data.
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#9bd2d8';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#bce1de';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      for (const [x, y] of [
        [17, 28],
        [80, 85],
      ]) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 6, y + 5, x + 12, y);
        ctx.quadraticCurveTo(x + 18, y - 5, x + 24, y);
        ctx.stroke();
      }
      m.addImage('toy-waves', ctx.getImageData(0, 0, 128, 128));
      m.setPaintProperty('toy-water', 'fill-pattern', 'toy-waves');
      m.addSource('rail', { type: 'geojson', data: data.network });
      m.addLayer({
        id: 'rail-shadow',
        type: 'line',
        source: 'rail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#78917e',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 18],
          'line-opacity': 0.2,
          'line-translate': [2, 3],
        },
      });
      m.addLayer({
        id: 'rail-case',
        type: 'line',
        source: 'rail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#fdf1d8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 2.5, 14, 12],
        },
      });
      m.addLayer({
        id: 'rail-lines',
        type: 'line',
        source: 'rail',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'colour'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.8, 14, 7],
        },
      });
      const toy = new ToyLayer(data, city, () => latest.current, onTick);
      layer.current = toy;
      m.addLayer(toy);
      m.addSource('stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: data.stations.stations.map((s) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: s.coordinates },
            properties: { key: s.key, line: s.line, name: s.chineseName },
          })),
        },
      });
      m.addLayer({
        id: 'station-points',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2.2, 14, 6],
          'circle-color': '#fffcf2',
          'circle-stroke-color': '#577c69',
          'circle-stroke-width': 1.5,
        },
      });
      m.addLayer({
        id: 'station-names',
        type: 'symbol',
        source: 'stations',
        minzoom: 11.8,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0.8, 0.9],
          'text-anchor': 'left',
          'text-font': ['Noto Sans Regular'],
        },
        paint: {
          'text-color': '#3e645a',
          'text-halo-color': '#fffbeb',
          'text-halo-width': 2,
        },
      });
      m.addSource('upcoming', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: data.upcomingStations.map((s) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: s.coordinates },
            properties: {
              id: s.id,
              line: s.line,
              name: s.chineseName + ' · 未開通',
            },
          })),
        },
      });
      m.addLayer({
        id: 'upcoming-stations',
        type: 'circle',
        source: 'upcoming',
        paint: {
          'circle-radius': 7,
          'circle-color': '#f8e2af',
          'circle-stroke-color': '#bb824f',
          'circle-stroke-width': 2,
        },
      });
      m.addLayer({
        id: 'upcoming-names',
        type: 'symbol',
        source: 'upcoming',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#815f39',
          'text-halo-color': '#fff3d4',
          'text-halo-width': 3,
        },
      });
      m.addSource('landmark-labels', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: city.landmarks.map((l) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: l.coordinates },
            properties: { name: l.name },
          })),
        },
      });
      m.addLayer({
        id: 'toy-landmark-labels',
        type: 'symbol',
        source: 'landmark-labels',
        minzoom: 12.1,
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, -1.4],
          'text-font': ['Noto Sans Regular'],
        },
        paint: {
          'text-color': '#6c6c70',
          'text-halo-color': '#fff5da',
          'text-halo-width': 2,
        },
      });
      m.on('click', (e) => {
        const next = m.queryRenderedFeatures(
          [
            [e.point.x - 12, e.point.y - 12],
            [e.point.x + 12, e.point.y + 12],
          ],
          { layers: ['upcoming-stations'] },
        )[0];
        if (next) {
          const s = data.upcomingStations.find(
            (s) => s.id === next.properties?.id,
          );
          if (s) {
            onUpcoming(s);
            return;
          }
        }
        const feature = m.queryRenderedFeatures(
          [
            [e.point.x - 9, e.point.y - 9],
            [e.point.x + 9, e.point.y + 9],
          ],
          { layers: ['station-points'] },
        )[0];
        const station = data.stations.stations.find(
          (s) => s.key === feature?.properties?.key,
        );
        if (station) {
          onSelect(station);
          return;
        }
        const train = toy.positions
          .filter(
            (t) => !latest.current.active || t.line === latest.current.active,
          )
          .map((t) => ({ t, p: m.project(t.coordinates) }))
          .find(({ p }) => Math.hypot(p.x - e.point.x, p.y - e.point.y) < 26);
        if (train) onTrain(train.t);
      });
      m.getCanvas().setAttribute(
        'data-city-buildings',
        String(city.buildings.length),
      );
      m.getCanvas().setAttribute(
        'data-city-landmarks',
        String(city.landmarks.length),
      );
      m.getCanvas().setAttribute('data-city-rails', 'double-rail-sleepers');
      onReady(true);
    });
    return () => {
      onReady(false);
      m.remove();
      map.current = null;
      layer.current = null;
    };
  }, [
    data,
    city,
    onSelect,
    onUpcoming,
    onTrain,
    onTick,
    onReady,
    onStopFollow,
  ]);
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const filter: FilterSpecification = controls.active
        ? ['==', ['get', 'line'], controls.active]
        : ['has', 'line'];
      for (const id of [
        'rail-lines',
        'rail-case',
        'rail-shadow',
        'station-points',
        'station-names',
        'upcoming-stations',
        'upcoming-names',
        'rac-rail-line',
      ])
        if (m.getLayer(id)) m.setFilter(id, filter);
      if (controls.active) {
        const points = data.routes
          .filter((r) => r.line === controls.active)
          .flatMap((r) => r.path);
        if (points.length) {
          const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
          for (const p of points) bounds.extend(p);
          m.fitBounds(bounds, {
            padding:
              window.innerWidth < 760
                ? { top: 130, bottom: 160, left: 50, right: 50 }
                : { top: 100, bottom: 100, left: 100, right: 120 },
            maxZoom: 12.4,
            pitch: 50,
            bearing: -20,
            duration: 900,
          });
        }
      }
    };
    if (m.getLayer('rail-lines')) apply();
    else m.on('style.load', apply);
    return () => {
      m.off('style.load', apply);
    };
  }, [controls.active, data]);
  useEffect(() => {
    const m = map.current;
    if (!m || !action.serial) return;
    if (action.kind === 'home')
      m.flyTo({
        ...HOME,
        zoom: window.innerWidth < 760 ? 12.35 : HOME.zoom,
        duration: 900,
      });
    if (action.kind === 'island')
      m.fitBounds(
        [
          [113.915, 22.24],
          [114.28, 22.535],
        ],
        {
          padding:
            window.innerWidth < 760
              ? { top: 95, bottom: 120, left: 25, right: 25 }
              : { top: 60, bottom: 80, left: 70, right: 80 },
          pitch: 45,
          bearing: -18,
          duration: 900,
        },
      );
    if (action.kind === 'tilt')
      m.easeTo({ pitch: m.getPitch() > 15 ? 0 : 58, duration: 650 });
    if (action.kind === 'zoom-in') m.zoomIn();
    if (action.kind === 'zoom-out') m.zoomOut();
    if (action.kind === 'station' && selected)
      m.flyTo({
        center: selected.coordinates,
        zoom: 13.2,
        pitch: 55,
        duration: 900,
      });
    if (action.kind === 'upcoming' && upcoming)
      m.flyTo({
        center: upcoming.coordinates,
        zoom: 13.2,
        pitch: 52,
        duration: 900,
      });
    if (action.kind === 'follow') {
      const train = layer.current?.positions.find(
        (t) => t.id === latest.current.followId,
      );
      if (train)
        m.flyTo({
          center: train.coordinates,
          zoom: 13,
          pitch: 58,
          duration: 900,
        });
    }
  }, [action, selected, upcoming]);
  return (
    <div
      ref={container}
      className="map-canvas"
      aria-label="立體玩具香港城市：卡通樓群、山丘、道路、雙鋼軌和移動小火車"
    />
  );
}
