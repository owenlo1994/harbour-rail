import {
  officialBoardSchema,
  liveTripSchema,
  hkTime,
  type LiveTrip,
} from '@hk-mtr/shared/live';
import type { ScheduleEntry } from './schedules.js';
export interface PreparedStatement {
  bind(...values: (string | number | null)[]): PreparedStatement;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface RailDatabase {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown>;
}
export interface SnapshotStore {
  load(
    line: string,
    now: number,
  ): Promise<{ entries: [string, ScheduleEntry][]; trips: LiveTrip[] }>;
  save(
    entries: [string, ScheduleEntry][],
    trips: LiveTrip[],
    touchedLines: string[],
    now: number,
  ): Promise<void>;
}
export type CacheBackend = RailDatabase | SnapshotStore;
export type RailEnvironment = { DB?: CacheBackend };
/** Only official API snapshots and virtual IDs live here. No user/GPS data. */
export async function loadPersistentCache(
  db: CacheBackend,
  line: string,
  now = Date.now(),
) {
  if ('load' in db) return db.load(line, now);
  const rows = await (
    line === 'all'
      ? db
          .prepare(
            'SELECT key, payload FROM rail_observations WHERE polled_at >= ?',
          )
          .bind(now - 180000)
      : db
          .prepare(
            'SELECT key, payload FROM rail_observations WHERE polled_at >= ? AND line = ?',
          )
          .bind(now - 180000, line)
  ).all<{ key: string; payload: string }>();
  const entries: [string, ScheduleEntry][] = [];
  for (const row of rows.results) {
    try {
      const e = JSON.parse(row.payload) as ScheduleEntry;
      if (!Number.isFinite(e.polledAt) || !Number.isFinite(e.expiresAt))
        continue;
      if (e.result.state === 'official') {
        const parsed = officialBoardSchema.safeParse(e.result);
        if (!parsed.success) continue;
        e.result = parsed.data;
      } else if (e.result.state !== 'unavailable') continue;
      entries.push([row.key, e]);
    } catch {
      /* Corrupt rows never become invented observations. */
    }
  }
  const groups = await (
    line === 'all'
      ? db
          .prepare('SELECT payload FROM rail_trip_cache WHERE updated_at >= ?')
          .bind(now - 180000)
      : db
          .prepare(
            'SELECT payload FROM rail_trip_cache WHERE updated_at >= ? AND line = ?',
          )
          .bind(now - 180000, line)
  ).all<{ payload: string }>();
  const trips: LiveTrip[] = [];
  for (const group of groups.results) {
    try {
      for (const raw of JSON.parse(group.payload)) {
        const t = liveTripSchema.safeParse(raw);
        if (t.success) trips.push(t.data);
      }
    } catch {
      /* Unusable identities can be rebuilt from official observations. */
    }
  }
  return { entries, trips };
}
export async function savePersistentCache(
  db: CacheBackend,
  entries: [string, ScheduleEntry][],
  trips: LiveTrip[],
  touchedLines: string[],
  now = Date.now(),
) {
  if ('save' in db) return db.save(entries, trips, touchedLines, now);
  const statements = entries.map(([key, e]) => {
    const source =
      e.result.state === 'official' ? hkTime(e.result.updatedAt) : e.polledAt;
    return db
      .prepare(
        'INSERT INTO rail_observations (key, line, payload, polled_at, expires_at, source_time) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, polled_at=excluded.polled_at, expires_at=excluded.expires_at, source_time=excluded.source_time WHERE excluded.polled_at >= rail_observations.polled_at AND excluded.source_time >= rail_observations.source_time',
      )
      .bind(
        key,
        e.result.line,
        JSON.stringify(e),
        e.polledAt,
        e.expiresAt,
        Number.isFinite(source) ? source : e.polledAt,
      );
  });
  for (const line of touchedLines)
    statements.push(
      db
        .prepare(
          'INSERT INTO rail_trip_cache (line, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(line) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at WHERE excluded.updated_at >= rail_trip_cache.updated_at',
        )
        .bind(line, JSON.stringify(trips.filter((t) => t.line === line)), now),
    );
  if (statements.length) await db.batch(statements);
}
