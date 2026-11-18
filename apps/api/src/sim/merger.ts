import destinationOverrides from '../../../../data/config/destination-overrides.json' with { type: 'json' };
import {
  hkTime,
  timelineDistance,
  type OfficialBoard,
  type LiveNetwork,
  type LiveRoute,
  type LiveTrip,
} from '@hk-mtr/shared/live';
import type { LineCode } from '@hk-mtr/shared';
export type SegmentConfig = {
  defaults: {
    cruiseSpeedMps: number;
    minTravelSeconds: number;
    dwellSeconds: number;
  };
  segments: {
    line: string;
    from: string;
    to: string;
    travelSeconds: number;
    dwellSeconds: number;
  }[];
};
type Observation = {
  station: string;
  eta: number;
  sourceTime: number;
  observedAt: number;
  dest: string;
  direction: 'UP' | 'DOWN';
  line: LineCode;
  platform: string;
  kind: 'arrival' | 'departure' | 'schedule';
  via: 'RAC' | null;
  seq: number;
  routes: LiveRoute[];
  delay: boolean;
};
type Group = { route: LiveRoute; dest: string; observations: Observation[] };
const allowed: Record<LineCode, { UP: string[]; DOWN: string[] }> = {
  AEL: { UP: ['AIR', 'AWE'], DOWN: ['HOK'] },
  TCL: { UP: ['TUC'], DOWN: ['HOK'] },
  TML: { UP: ['TUM'], DOWN: ['WKS'] },
  TKL: { UP: ['POA', 'LHP'], DOWN: ['TIK', 'NOP'] },
  EAL: {
    UP: ['LMC', 'LOW', 'SHS', 'TAP', 'RAC', 'FOT', 'SHT'],
    DOWN: ['ADM', 'HUH', 'MKK'],
  },
  SIL: { UP: ['SOH'], DOWN: ['ADM'] },
  TWL: { UP: ['TSW'], DOWN: ['CEN'] },
  ISL: { UP: ['CHW'], DOWN: ['KET'] },
  KTL: { UP: ['TIK'], DOWN: ['WHA'] },
  DRL: { UP: ['SUN'], DOWN: ['DIS'] },
};
export function resolveRoutes(
  network: LiveNetwork,
  line: LineCode,
  direction: 'UP' | 'DOWN',
  station: string,
  dest: string,
  via: string | null,
) {
  if (
    !allowed[line][direction].includes(dest) &&
    !destinationOverrides.exceptions.some(
      (e) => e.line === line && e.direction === direction && e.dest === dest,
    )
  )
    return [];
  const race =
    line === 'EAL' && (via === 'RAC' || station === 'RAC' || dest === 'RAC');
  return network.routes.filter((r) => {
    if (
      r.line !== line ||
      r.direction !== direction ||
      (r.via === 'RAC') !== race
    )
      return false;
    const s = r.stops.findIndex((x) => x.code === station),
      d = r.stops.findIndex((x) => x.code === dest);
    return s >= 0 && d >= s;
  });
}
function median(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
export class TripMerger {
  private previous = new Map<string, LiveTrip>();
  private serial = 0;
  private currentNow = 0;
  private calibration = new Map<string, { milliseconds: number; at: number }>();
  private segments: Map<
    string,
    { travelSeconds: number; dwellSeconds: number }
  >;
  constructor(
    private network: LiveNetwork,
    private config: SegmentConfig,
  ) {
    this.segments = new Map(
      config.segments.map((s) => [`${s.line}:${s.from}:${s.to}`, s]),
    );
  }
  restore(trips: LiveTrip[]) {
    for (const t of trips) {
      const old = this.previous.get(t.id);
      if (!old || old.observedAt < t.observedAt) this.previous.set(t.id, t);
    }
  }
  private duration(route: LiveRoute, a: number, b: number) {
    let t = 0;
    for (let i = a; i < b; i++) {
      const calibrated = this.calibration.get(
        `${route.line}:${route.direction}:${route.stops[i].code}:${route.stops[i + 1].code}`,
      );
      if (calibrated && this.currentNow - calibrated.at < 600000) {
        t += calibrated.milliseconds / 1000;
        continue;
      }

      const s = this.segments.get(
        `${route.line}:${route.stops[i].code}:${route.stops[i + 1].code}`,
      );
      t +=
        (s?.travelSeconds ??
          Math.max(
            this.config.defaults.minTravelSeconds,
            (route.stops[i + 1].distance - route.stops[i].distance) /
              this.config.defaults.cruiseSpeedMps,
          )) + (s?.dwellSeconds ?? this.config.defaults.dwellSeconds);
    }
    return t * 1000;
  }
  private calibrate(observations: Observation[], now: number) {
    const done = new Set<string>();
    for (const route of this.network.routes)
      for (let i = 1; i < route.stops.length; i++) {
        const a = route.stops[i - 1],
          b = route.stops[i],
          key = `${route.line}:${route.direction}:${a.code}:${b.code}`;
        if (done.has(key)) continue;
        done.add(key);
        const before = observations.filter(
          (o) =>
            o.line === route.line &&
            o.direction === route.direction &&
            o.station === a.code &&
            o.routes.some((r) => r.id === route.id),
        );
        const after = observations.filter(
          (o) =>
            o.line === route.line &&
            o.direction === route.direction &&
            o.station === b.code &&
            o.routes.some((r) => r.id === route.id),
        );
        const physical = ((b.distance - a.distance) / 45) * 1000;
        const configured = this.segments.get(
          `${route.line}:${a.code}:${b.code}`,
        );
        const normal =
          ((configured?.travelSeconds ?? (b.distance - a.distance) / 15) +
            (configured?.dwellSeconds ?? 25)) *
          1000;
        let best: { delta: number; matches: number; error: number } | null =
          null;
        for (const x of before)
          for (const y of after) {
            const delta = y.eta - x.eta;
            if (
              x.dest !== y.dest ||
              Math.abs(x.sourceTime - y.sourceTime) > 20000 ||
              delta < physical ||
              delta >
                Math.max(
                  normal * 2,
                  ((b.distance - a.distance) / 6) * 1000 + 60000,
                )
            )
              continue;
            const used = new Set<number>();
            let matches = 0;
            for (const p of before) {
              const index = after.findIndex(
                (q, j) =>
                  !used.has(j) &&
                  p.dest === q.dest &&
                  Math.abs(q.eta - p.eta - delta) <= 15000,
              );
              if (index >= 0) {
                used.add(index);
                matches++;
              }
            }
            const error = Math.abs(delta - normal);
            if (
              matches >= 2 &&
              (!best ||
                matches > best.matches ||
                (matches === best.matches && error < best.error))
            )
              best = { delta, matches, error };
          }
        if (best)
          this.calibration.set(key, { milliseconds: best.delta, at: now });
      }
  }
  build(boards: OfficialBoard[], now = Date.now()) {
    this.currentNow = now;
    const observations: Observation[] = [];
    let unmapped = 0;
    const unmappedExamples: {
      line: LineCode;
      station: string;
      direction: 'UP' | 'DOWN';
      dest: string;
      via: string | null;
    }[] = [];
    for (const board of boards) {
      const sourceTime = hkTime(board.updatedAt);
      if (
        !Number.isFinite(sourceTime) ||
        now - sourceTime > 105000 ||
        sourceTime - now > 60000
      )
        continue;
      for (const direction of ['UP', 'DOWN'] as const)
        for (const row of board.directions[direction]) {
          const eta = hkTime(row.time);
          if (!Number.isFinite(eta) || eta < now - 35000 || eta > now + 1800000)
            continue;
          const routes = resolveRoutes(
            this.network,
            board.line,
            direction,
            board.station,
            row.dest,
            row.route ?? null,
          );
          if (!routes.length) {
            unmapped++;
            if (unmappedExamples.length < 8)
              unmappedExamples.push({
                line: board.line,
                station: board.station,
                direction,
                dest: row.dest,
                via: row.route ?? null,
              });
            continue;
          }
          const timeType =
            row.timeType && row.timetype && row.timeType !== row.timetype
              ? undefined
              : (row.timeType ?? row.timetype);
          observations.push({
            line: board.line,
            station: board.station,
            eta,
            sourceTime,
            observedAt: Date.parse(board.fetchedAt),
            dest: row.dest,
            direction,
            platform: row.plat,
            kind:
              timeType === 'A'
                ? 'arrival'
                : timeType === 'D'
                  ? 'departure'
                  : 'schedule',
            via: routes[0].via,
            seq: row.seq,
            routes,
            delay: board.delay === 'Y',
          });
        }
    }
    this.calibrate(observations, now);
    // Branch-specific evidence goes first. An ambiguous shared-station observation
    // is assigned at most once, never cloned onto both branch tracks.
    observations.sort(
      (a, b) =>
        a.routes.length - b.routes.length || a.seq - b.seq || a.eta - b.eta,
    );
    const groups: Group[] = [];
    for (const o of observations) {
      const headways = observations
        .filter(
          (x) =>
            x.line === o.line &&
            x.direction === o.direction &&
            x.station === o.station &&
            x.eta !== o.eta,
        )
        .map((x) => Math.abs(x.eta - o.eta));
      const tolerance = Math.min(
        45000,
        (headways.length ? Math.min(...headways) : 150000) * 0.32,
      );
      let best: Group | undefined,
        bestCost = Infinity;
      for (const g of groups) {
        if (
          g.route.line !== o.line ||
          g.route.direction !== o.direction ||
          g.dest !== o.dest ||
          !o.routes.some((r) => r.id === g.route.id) ||
          g.observations.some((a) => a.station === o.station)
        )
          continue;
        const at = g.route.stops.findIndex((s) => s.code === o.station);
        let cost = Infinity,
          valid = true;
        for (const a of g.observations) {
          const ai = g.route.stops.findIndex((s) => s.code === a.station),
            sign = at > ai ? 1 : -1;
          const dt =
            this.duration(g.route, Math.min(at, ai), Math.max(at, ai)) * sign;
          const physical =
            (Math.abs(g.route.stops[at].distance - g.route.stops[ai].distance) /
              45) *
            1000;
          if (
            (at > ai && o.eta < a.eta + physical) ||
            (at < ai && a.eta < o.eta + physical)
          ) {
            valid = false;
            break;
          }
          cost = Math.min(cost, Math.abs(o.eta - (a.eta + dt)));
        }
        if (valid && cost < tolerance && cost < bestCost) {
          best = g;
          bestCost = cost;
        }
      }
      if (best) best.observations.push(o);
      else {
        const remembered = [...this.previous.values()]
          .filter(
            (t) =>
              t.line === o.line &&
              t.dest === o.dest &&
              t.direction === o.direction &&
              o.routes.some((r) => r.id === t.pathId),
          )
          .map((t) => ({
            t,
            error: Math.min(
              ...t.points
                .filter((p) => p.official && p.station === o.station)
                .map((p) => Math.abs(p.at - o.eta)),
            ),
          }))
          .sort((a, b) => a.error - b.error)[0];
        const route =
          remembered && remembered.error < 45000
            ? o.routes.find((r) => r.id === remembered.t.pathId)!
            : o.routes[0];
        groups.push({ route, dest: o.dest, observations: [o] });
      }
    }
    const output: LiveTrip[] = [],
      used = new Set<string>();
    for (const g of groups) {
      const obs = g.observations.sort(
        (a, b) =>
          g.route.stops.findIndex((s) => s.code === a.station) -
          g.route.stops.findIndex((s) => s.code === b.station),
      );
      const first = obs[0],
        firstIndex = g.route.stops.findIndex((s) => s.code === first.station),
        destIndex = g.route.stops.findIndex((s) => s.code === g.dest);
      let firstKnown = 0;
      if (obs.every((o) => o.routes.length > 1)) {
        const allCandidates = obs[0].routes;
        firstKnown = g.route.stops.findIndex((s) =>
          allCandidates.every((r) => r.stops.some((t) => t.code === s.code)),
        );
        firstKnown = Math.max(0, Math.min(firstKnown, firstIndex));
      }
      const inferredOrigin =
        first.eta - this.duration(g.route, firstKnown, firstIndex);
      // Future departures far beyond the route origin are not yet moving trains.
      if (inferredOrigin > now + 25000) continue;
      if (obs.length === 1 && (first.seq !== 1 || first.eta > now + 240000))
        continue;
      const points: LiveTrip['points'] = [];
      for (let i = firstKnown; i < firstIndex; i++) {
        const at = first.eta - this.duration(g.route, i, firstIndex),
          s = g.route.stops[i];
        points.push({
          at,
          distance: s.distance,
          station: s.code,
          official: false,
          kind: 'model',
        });
        points.push({
          at: at + this.config.defaults.dwellSeconds * 1000,
          distance: s.distance,
          station: s.code,
          official: false,
          kind: 'model',
        });
      }
      for (let k = 0; k < obs.length; k++) {
        const o = obs[k],
          index = g.route.stops.findIndex((s) => s.code === o.station),
          s = g.route.stops[index];
        if (o.kind === 'departure')
          points.push({
            at: o.eta - this.config.defaults.dwellSeconds * 1000,
            distance: s.distance,
            station: s.code,
            official: false,
            kind: 'model',
          });
        points.push({
          at: o.eta,
          distance: s.distance,
          station: s.code,
          official: true,
          kind: o.kind,
        });
        if (index < destIndex && o.kind !== 'departure')
          points.push({
            at: o.eta + this.config.defaults.dwellSeconds * 1000,
            distance: s.distance,
            station: s.code,
            official: false,
            kind: 'model',
          });
        const next = obs[k + 1];
        if (next) {
          const ni = g.route.stops.findIndex((s) => s.code === next.station),
            duration = this.duration(g.route, index, ni);
          for (let i = index + 1; i < ni; i++) {
            const ratio = this.duration(g.route, index, i) / duration,
              at = o.eta + (next.eta - o.eta) * ratio;
            points.push({
              at,
              distance: g.route.stops[i].distance,
              station: g.route.stops[i].code,
              official: false,
              kind: 'model',
            });
          }
        }
      }
      const last = obs.at(-1)!,
        lastIndex = g.route.stops.findIndex((s) => s.code === last.station);
      for (let i = lastIndex + 1; i <= destIndex; i++) {
        const at = last.eta + this.duration(g.route, lastIndex, i);
        if (at > last.sourceTime + 105000) break;
        points.push({
          at,
          distance: g.route.stops[i].distance,
          station: g.route.stops[i].code,
          official: false,
          kind: 'model',
        });
      }
      points.sort((a, b) => a.at - b.at || a.distance - b.distance);
      const clean = points.filter(
        (p, i) =>
          !i ||
          (p.at > points[i - 1].at && p.distance >= points[i - 1].distance),
      );
      if (clean.length === 1)
        clean.unshift({
          ...clean[0],
          at: clean[0].at - 1000,
          official: false,
          kind: 'model',
        });
      if (clean.length < 2) continue;
      const position = timelineDistance(clean, now),
        destDistance = g.route.stops[destIndex].distance;
      if (position >= destDistance - 1 && now > last.eta + 30000) continue;
      const upcoming = clean.find((p) => p.at >= now) ?? clean.at(-1)!;
      const freshSource = Math.max(...obs.map((o) => o.sourceTime));
      let id: string | undefined,
        match = Infinity;
      for (const old of this.previous.values()) {
        if (
          used.has(old.id) ||
          old.line !== g.route.line ||
          old.direction !== g.route.direction ||
          old.dest !== g.dest ||
          old.via !== g.route.via
        )
          continue;
        // Do not reassign a known Lo Wu train to the Lok Ma Chau branch, or vice versa.
        if (old.pathId !== g.route.id) continue;
        const shared = obs.flatMap((o) =>
          old.points
            .filter((p) => p.official && p.station === o.station)
            .map((p) => Math.abs(p.at - o.eta)),
        );
        const delta = Math.abs(timelineDistance(old.points, now) - position);
        const cost = (shared.length ? Math.min(...shared) : 30000) + delta * 8;
        if (delta < 1000 && cost < 60000 && cost < match) {
          id = old.id;
          match = cost;
        }
      }
      if (!id) {
        do {
          id = `virtual-${g.route.line}-${g.route.direction}-${(++this.serial).toString(36)}-${Math.round(median(obs.map((o) => o.eta)) / 1000).toString(36)}`;
        } while (this.previous.has(id) || used.has(id));
      }
      used.add(id);
      const sourceTime = freshSource;
      const trip: LiveTrip = {
        id,
        line: g.route.line,
        direction: g.route.direction,
        dest: g.dest,
        pathId: g.route.id,
        via: g.route.via,
        platform: first.platform,
        points: clean,
        nextStation: upcoming.station,
        targetAt: upcoming.at,
        timeKind:
          upcoming.kind === 'arrival'
            ? 'arrival'
            : upcoming.kind === 'departure'
              ? 'departure'
              : 'schedule',
        targetOfficial: upcoming.official,
        sourceTime,
        observedAt: Math.max(...obs.map((o) => o.observedAt)),
        revision: clean.map((p) => `${p.station}:${p.at}:${p.kind}`).join('|'),
        evidenceCount: obs.length,
        delay: obs.some((o) => o.delay),
        inferred: true,
        nominalSpeedMps: Math.max(
          this.config.defaults.cruiseSpeedMps,
          ...clean
            .slice(1)
            .map(
              (p, i) =>
                (p.distance - clean[i].distance) /
                ((p.at - clean[i].at) / 1000 || 1),
            ),
        ),
        lastOfficialDistance: g.route.stops[lastIndex].distance,
      };
      output.push(trip);
      this.previous.set(id, trip);
    }
    // With a complete shared observation cache, unmatched identities are removed.
    // Network outages retain the old official observations themselves until fade;
    // a vanished identity must never reappear later as a phantom train.
    for (const [id, t] of this.previous)
      if (!used.has(id) || now - t.sourceTime > 105000)
        this.previous.delete(id);
    return { trains: output, unmapped, unmappedExamples };
  }
}
