import { Hono } from 'hono';
import {
  loadPersistentCache,
  savePersistentCache,
  type CacheBackend,
  type RailEnvironment,
} from './persistence.js';
import {
  liveNetworkSchema,
  liveTripSchema,
  hkTime,
  type LiveFeed,
  type LiveTrip,
} from '@hk-mtr/shared/live';
import { lineCodeSchema, type LineCode } from '@hk-mtr/shared';
import networkJson from './generated/live-network.json' with { type: 'json' };
import configJson from '../../../data/config/segment_times.json' with { type: 'json' };
import { ScheduleClient, schedules, type ScheduleEntry } from './schedules.js';
import { TripMerger } from './sim/merger.js';
export const liveNetwork = liveNetworkSchema.parse(networkJson);
const lines = [...new Set(liveNetwork.stations.map((s) => s.line))];
const interleaved = Array.from(
  {
    length: Math.max(
      ...lines.map(
        (line) => liveNetwork.stations.filter((s) => s.line === line).length,
      ),
    ),
  },
  (_, i) =>
    lines
      .map((line) => liveNetwork.stations.filter((s) => s.line === line)[i])
      .filter(Boolean),
).flat();
type EdgeCache = {
  match: (request: Request) => Promise<Response | undefined>;
  put: (request: Request, response: Response) => Promise<void>;
};
function edgeCache() {
  return (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches
    ?.default;
}
export class LiveService {
  private merger = new TripMerger(liveNetwork, configJson);
  private restoredAt = new Map<string, number>();
  private lastTrains: LiveTrip[] = [];
  constructor(readonly client: ScheduleClient = schedules) {}
  private async restore(line: LineCode, origin: string) {
    const cache = edgeCache();
    if (!cache || Date.now() - (this.restoredAt.get(line) ?? 0) < 10000) return;
    this.restoredAt.set(line, Date.now());
    try {
      const response = await cache.match(
        new Request(`${origin}/__internal-live-cache/${line}`),
      );
      if (!response) return;
      const data = (await response.json()) as {
        entries: [string, ScheduleEntry][];
        trains: unknown[];
      };
      for (const [key, entry] of data.entries ?? [])
        if (entry.polledAt > Date.now() - 180000)
          this.client.restore(key, entry);
      this.merger.restore(
        (data.trains ?? [])
          .map((t) => liveTripSchema.safeParse(t))
          .filter((r) => r.success)
          .map((r) => r.data!),
      );
    } catch {
      /* Optional edge cache must never replace official data with fixtures. */
    }
  }
  private async persist(line: LineCode, origin: string) {
    const cache = edgeCache();
    if (!cache) return;
    const entries = [...this.client.entries].filter(([k]) =>
      k.startsWith(line + ':'),
    );
    try {
      await cache.put(
        new Request(`${origin}/__internal-live-cache/${line}`),
        new Response(
          JSON.stringify({
            entries,
            trains: this.lastTrains.filter((t) => t.line === line),
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=180',
            },
          },
        ),
      );
    } catch {
      /* Node and some preview runtimes have no Cache API. */
    }
  }
  async feed(
    line: LineCode | 'all',
    cursor: number,
    priority: string | undefined,
    origin: string,
    db?: CacheBackend,
  ): Promise<LiveFeed> {
    let cacheState:
      'd1' | 'netlify-blobs' | 'edge-or-memory' | 'persistence-error' = db
      ? 'load' in db
        ? 'netlify-blobs'
        : 'd1'
      : 'edge-or-memory';
    if (db) {
      try {
        const stored = await loadPersistentCache(db, line);
        for (const [key, entry] of stored.entries)
          this.client.restore(key, entry);
        this.merger.restore(stored.trips);
      } catch {
        cacheState = 'persistence-error';
      }
    } else
      await Promise.all(
        (line === 'all' ? lines : [line]).map((l) => this.restore(l, origin)),
      );
    let stations =
      line === 'all'
        ? interleaved
        : liveNetwork.stations.filter((s) => s.line === line);
    if (priority) {
      const index = stations.findIndex((s) => s.code === priority);
      if (index >= 0)
        stations = [...stations.slice(index), ...stations.slice(0, index)];
    }
    const start =
      ((cursor % stations.length) + stations.length) % stations.length;
    const batch = Array.from(
      { length: Math.min(8, stations.length) },
      (_, i) => stations[(start + i) % stations.length],
    );
    const entries = await Promise.all(
      batch.map((s) => this.client.get(s.line, s.code)),
    );
    const now = Date.now(),
      current = [...this.client.entries.values()];
    const official = current.flatMap((e) =>
      e.result.state === 'official' &&
      (line === 'all' || e.result.line === line)
        ? [e.result]
        : [],
    );
    const merged = this.merger.build(official, now);
    this.lastTrains = merged.trains;
    const selectedLines = line === 'all' ? lines : [line];
    const status = selectedLines.map((l) => {
      const known = current.filter((e) => e.result.line === l),
        total = liveNetwork.stations.filter((s) => s.line === l).length;
      const fresh = known.filter(
        (e) =>
          e.result.state === 'official' &&
          now - hkTime(e.result.updatedAt) < 75000 &&
          now - e.polledAt < 75000,
      );
      const latest = known
        .filter((e) => e.result.state === 'official')
        .map((e) => hkTime(e.result.updatedAt))
        .filter(Number.isFinite);
      const hasPredictions = fresh.some(
        (e) =>
          e.result.state === 'official' &&
          e.result.directions.UP.length + e.result.directions.DOWN.length > 0,
      );
      const error = entries.find(
        (e) => e.result.line === l && e.result.state === 'unavailable',
      )?.result;
      return {
        line: l,
        state: !known.length
          ? ('loading' as const)
          : !fresh.length
            ? ('unavailable' as const)
            : !hasPredictions
              ? ('empty' as const)
              : fresh.length < total
                ? ('partial' as const)
                : ('live' as const),
        fresh: fresh.length,
        total,
        updatedAt: latest.length ? Math.max(...latest) : null,
        ...(error?.state === 'unavailable' ? { message: error.message } : {}),
      };
    });
    if (db) {
      try {
        const keys = new Set(batch.map((s) => `${s.line}:${s.code}`));
        await savePersistentCache(
          db,
          [...this.client.entries].filter(([k]) => keys.has(k)),
          this.lastTrains,
          [...new Set(batch.map((s) => s.line))],
          now,
        );
      } catch {
        cacheState = 'persistence-error';
      }
    } else
      await Promise.all(
        [...new Set(batch.map((s) => s.line))].map((l) =>
          this.persist(l, origin),
        ),
      );
    return {
      mode: 'official-predictions',
      serverTime: now,
      trains: merged.trains.filter((t) => line === 'all' || t.line === line),
      coverage: {
        stationsTotal: stations.length,
        stationsLoaded: current.filter(
          (e) => line === 'all' || e.result.line === line,
        ).length,
        stationsFresh: status.reduce((s, l) => s + l.fresh, 0),
        nextCursor: (start + batch.length) % stations.length,
        polledKeys: batch.map((s) => `${s.line}:${s.code}`),
      },
      lines: status,
      diagnostics: {
        unmappedObservations: merged.unmapped,
        apiLatencyMs: Math.round(
          entries.reduce((s, e) => s + e.latencyMs, 0) /
            Math.max(1, entries.length),
        ),
        rateLimitPerMinute: this.client.rateLimit,
        cacheState,
        unmappedExamples: merged.unmappedExamples,
      },
    };
  }
}
const service = new LiveService();
export function trainRoutes(liveService: LiveService = service) {
  const app = new Hono<{ Bindings: RailEnvironment }>();
  app.get('/api/trains', async (c) => {
    c.header('Cache-Control', 'no-store');
    const raw = c.req.query('line') ?? 'all',
      line = raw === 'all' ? 'all' : lineCodeSchema.safeParse(raw).data;
    const cursor = Number(c.req.query('cursor') ?? 0);
    if (!line || !Number.isInteger(cursor) || cursor < 0 || cursor > 10000)
      return c.json({ error: 'INVALID_QUERY' }, 400);
    return c.json(
      await liveService.feed(
        line,
        cursor,
        c.req.query('priority'),
        new URL(c.req.url).origin,
        c.env?.DB,
      ),
    );
  });
  return app;
}
