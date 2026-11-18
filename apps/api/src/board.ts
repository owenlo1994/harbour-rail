import { Hono } from 'hono';
import topology from './generated/live-network.json' with { type: 'json' };
import { schedules, validLine, type ScheduleClient } from './schedules.js';
import {
  loadPersistentCache,
  savePersistentCache,
  type RailEnvironment,
} from './persistence.js';
export function boardRoutes(client: ScheduleClient = schedules) {
  const app = new Hono<{ Bindings: RailEnvironment }>();
  app.get('/api/board', async (c) => {
    c.header('Cache-Control', 'no-store');
    const line = validLine(c.req.query('line') ?? ''),
      station = c.req.query('station') ?? '';
    if (
      !line.success ||
      !/^[A-Z]{3}$/.test(station) ||
      !topology.stations.some((s) => s.line === line.data && s.code === station)
    )
      return c.json({ state: 'error', message: '無效車站' }, 400);
    const db = c.env?.DB;
    if (db) {
      try {
        const stored = await loadPersistentCache(db, line.data);
        for (const [key, entry] of stored.entries) client.restore(key, entry);
      } catch {
        /* A cache failure must still allow a direct official query. */
      }
    }
    const entry = await client.get(line.data, station);
    if (db) {
      try {
        await savePersistentCache(
          db,
          [[`${line.data}:${station}`, entry]],
          [],
          [],
        );
      } catch {
        /* Return the actual official result even if persistence fails. */
      }
    }
    return c.json(entry.result);
  });
  return app;
}
