import { createApp } from './app.js';
import type { RailEnvironment } from './persistence.js';
import { ScheduleBudget, ScheduleClient } from './schedules.js';
declare const __SITE_ASSETS__: Record<string, { body: string; type: string }>;
const budget = new ScheduleBudget();
const bodies = new Map<string, Uint8Array<ArrayBuffer>>();
export default {
  async fetch(request: Request, env?: RailEnvironment) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      // Never retain fetch promises/semaphore waiters from a previous request.
      // Workers cancel request-owned I/O; D1 retains snapshots and virtual IDs.
      return createApp(
        new URL(request.url).origin,
        new ScheduleClient(undefined, budget),
      ).fetch(request, env);
    }
    if (!['GET', 'HEAD'].includes(request.method))
      return new Response('Method not allowed', { status: 405 });
    const asset = __SITE_ASSETS__[path === '/' ? '/index.html' : path];
    if (!asset) return new Response('Not found', { status: 404 });
    let bytes = bodies.get(path);
    if (!bytes) {
      bytes = Uint8Array.from(atob(asset.body), (c) => c.charCodeAt(0));
      bodies.set(path, bytes);
    }
    return new Response(request.method === 'HEAD' ? null : bytes, {
      headers: {
        'Content-Type': asset.type,
        'Cache-Control':
          path === '/sw.js' || path === '/' || path.startsWith('/data/')
            ? 'no-cache'
            : 'public, max-age=3600',
      },
    });
  },
};
