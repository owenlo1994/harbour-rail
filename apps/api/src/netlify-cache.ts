import { getStore } from '@netlify/blobs';
import { lineCodeSchema } from '@hk-mtr/shared';
import type { LiveTrip } from '@hk-mtr/shared/live';
import type { SnapshotStore } from './persistence.js';
import type { ScheduleEntry } from './schedules.js';

interface LineSnapshot {
  entries: Record<string, ScheduleEntry>;
  trips: LiveTrip[];
  updatedAt: number;
}
export function blobCache(): SnapshotStore {
  const store = getStore({ name: 'rail-forecasts-v1', consistency: 'strong' });
  return {
    async load(line, now) {
      const lines = line === 'all' ? lineCodeSchema.options : [line];
      const groups = await Promise.all(
        lines.map(
          (code) =>
            store.get(code, { type: 'json' }) as Promise<LineSnapshot | null>,
        ),
      );
      return {
        entries: groups.flatMap((group) =>
          Object.entries(group?.entries ?? {}).filter(
            ([, entry]) => entry.polledAt >= now - 180000,
          ),
        ),
        trips: groups.flatMap(
          (group) =>
            group?.trips.filter((t) => t.observedAt >= now - 180000) ?? [],
        ),
      };
    },
    async save(entries, trips, touchedLines, now) {
      const lines = new Set([
        ...touchedLines,
        ...entries.map(([, e]) => e.result.line),
      ]);
      await Promise.all(
        [...lines].map(async (line) => {
          for (let attempt = 0; attempt < 5; attempt++) {
            const previous = await store.getWithMetadata(line, {
              type: 'json',
            });
            const snapshot: LineSnapshot = previous?.data ?? {
              entries: {},
              trips: [],
              updatedAt: 0,
            };
            let dirty = false;
            for (const [key, e] of entries)
              if (
                e.result.line === line &&
                e.polledAt > (snapshot.entries[key]?.polledAt ?? 0)
              ) {
                snapshot.entries[key] = e;
                dirty = true;
              }
            if (touchedLines.includes(line) && now > snapshot.updatedAt) {
              snapshot.trips = trips.filter((t) => t.line === line);
              snapshot.updatedAt = now;
              dirty = true;
            }
            if (!dirty) return;
            const result = await store.setJSON(
              line,
              snapshot,
              previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true },
            );
            if (result.modified) return;
          }
          throw Error('FORECAST_CACHE_CONCURRENT_UPDATE');
        }),
      );
    },
  };
}
