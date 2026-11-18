import { Hono } from 'hono';
import type { RailEnvironment } from './persistence.js';
import { cors } from 'hono/cors';
import { boardRoutes } from './board.js';
import { trainRoutes, LiveService } from './trains.js';
import type { ScheduleClient } from './schedules.js';

export function createApp(
  origin = 'http://localhost:5173',
  client?: ScheduleClient,
) {
  const app = new Hono<{ Bindings: RailEnvironment }>();
  app.use('/api/*', cors({ origin, allowMethods: ['GET', 'OPTIONS'] }));
  app.route('/', boardRoutes(client));
  app.route('/', trainRoutes(client ? new LiveService(client) : undefined));
  app.get('/api/health', (c) =>
    c.json({ ok: true, service: 'hk-mtr-live-api' }),
  );
  app.get('/api/status', (c) =>
    c.json({
      milestone: 1 as const,
      geometry: 'toy-source-backed' as const,
      realtime: 'official-predictions' as const,
      message:
        '可切換模擬及官方預報模式；即時列車位置與班次身份均為推算，並非 GPS。未開通站不查詢。',
    }),
  );
  app.notFound((c) =>
    c.json(
      {
        error: 'NOT_IMPLEMENTED',
        message: 'Unknown API endpoint.',
      },
      404,
    ),
  );
  app.onError((error, c) => {
    console.error('RAIL_API_ERROR', error.name, error.message);
    return c.json({ error: 'INTERNAL_ERROR' }, 500);
  });
  return app;
}
