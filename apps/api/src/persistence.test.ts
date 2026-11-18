import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  loadPersistentCache,
  savePersistentCache,
  type RailDatabase,
  type PreparedStatement,
} from './persistence';
import {
  normalizeSchedule,
  ScheduleClient,
  type ScheduleEntry,
} from './schedules';
import { LiveService } from './trains';
import { boardRoutes } from './board';
import { hkTime } from '@hk-mtr/shared/live';
function database() {
  const sql = new DatabaseSync(':memory:');
  for (const file of readdirSync('drizzle')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    sql.exec(readFileSync('drizzle/' + file, 'utf8'));
  const db: RailDatabase = {
    prepare(query) {
      let values: (string | number | null)[] = [];
      const statement: PreparedStatement = {
        bind(...args) {
          values = args;
          return statement;
        },
        async all<T>() {
          return { results: sql.prepare(query).all(...values) as T[] };
        },
        async run() {
          return sql.prepare(query).run(...values);
        },
      };
      return statement;
    },
    async batch(statements) {
      return Promise.all(statements.map((s) => s.run()));
    },
  };
  return { db, close: () => sql.close() };
}
const raw = JSON.parse(
  readFileSync('data/raw/next-train-20261118/TWL-ADM.json', 'utf8'),
);
const now = hkTime('2026-11-18 09:00:30');
function entry(station: string, at = now): ScheduleEntry {
  const json = structuredClone(raw);
  json.data = { [`TWL-${station}`]: json.data['TWL-ADM'] };
  return {
    result: normalizeSchedule(json, 'TWL', station, at),
    polledAt: at,
    expiresAt: at + 15000,
    latencyMs: 10,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('shared official cache across independent Worker instances', () => {
  it('reuses a station board TTL across independent Worker request clients', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { db, close } = database();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(raw)));
    vi.stubGlobal('fetch', fetcher);
    try {
      for (let i = 0; i < 2; i++) {
        const response = await boardRoutes(new ScheduleClient()).request(
          '/api/board?line=TWL&station=ADM',
          undefined,
          { DB: db },
        );
        expect(response.status).toBe(200);
        expect((await response.json()).state).toBe('official');
      }
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      close();
    }
  });
  it('accumulates station rows atomically instead of replacing another instance’s line snapshot', async () => {
    const { db, close } = database();
    try {
      await savePersistentCache(
        db,
        [['TWL:ADM', entry('ADM')]],
        [],
        ['TWL'],
        now,
      );
      await savePersistentCache(
        db,
        [['TWL:TST', entry('TST', now + 1000)]],
        [],
        ['TWL'],
        now + 1000,
      );
      const loaded = await loadPersistentCache(db, 'TWL', now + 1000);
      expect(loaded.entries.map(([k]) => k).sort()).toEqual([
        'TWL:ADM',
        'TWL:TST',
      ]);
      await savePersistentCache(
        db,
        [['TWL:ADM', entry('ADM', now - 5000)]],
        [],
        ['TWL'],
        now - 5000,
      );
      expect(
        (await loadPersistentCache(db, 'all', now)).entries.find(
          ([key]) => key === 'TWL:ADM',
        )?.[1].polledAt,
      ).toBe(now);
    } finally {
      close();
    }
  });
  it('retains complete coverage and IDs when each poll runs in a fresh service instance', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const { db, close } = database();
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const station = new URL(String(url)).searchParams.get('sta')!;
      const json = structuredClone(raw);
      json.data = { [`TWL-${station}`]: json.data['TWL-ADM'] };
      return new Response(JSON.stringify(json));
    });
    vi.stubGlobal('fetch', fetcher);
    const create = () =>
      new LiveService(
        new ScheduleClient({
          gapMs: 0,
          maxConcurrent: 3,
          perMinute: 240,
          timeoutMs: 1000,
          ttlMs: 15000,
        }),
      );
    try {
      const first = await create().feed(
        'TWL',
        0,
        undefined,
        'https://test',
        db,
      );
      const second = await create().feed(
        'TWL',
        8,
        undefined,
        'https://test',
        db,
      );
      expect(first.coverage.stationsLoaded).toBe(8);
      expect(second.coverage.stationsLoaded).toBe(16);
      expect(second.coverage.stationsFresh).toBe(16);
      expect(second.diagnostics.cacheState).toBe('d1');
      expect(new Set(second.trains.map((t) => t.id)).size).toBe(
        second.trains.length,
      );
      expect(
        second.trains.some((t) => first.trains.some((old) => old.id === t.id)),
      ).toBe(true);
      await create().feed('TWL', 0, undefined, 'https://test', db);
      expect(fetcher).toHaveBeenCalledTimes(16);
    } finally {
      close();
    }
  });
});
