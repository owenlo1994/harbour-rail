import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { boardRoutes } from './board.js';
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../data/raw/next-train-suw-20261117.json', import.meta.url),
    'utf8',
  ),
);
afterEach(() => vi.unstubAllGlobals());
describe('Next Train proxy', () => {
  it('coalesces requests, caches results and uses official time rather than dummy fields', async () => {
    const raw = structuredClone(fixture);
    for (const direction of ['UP', 'DOWN'])
      for (const r of raw.data['TML-SUW'][direction] ?? []) {
        r.valid = 'DUMMY';
        r.ttnt = 'DUMMY';
      }
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify(raw), {
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const app = boardRoutes();
    const results = await Promise.all([
      app.request('/api/board?line=TML&station=SUW'),
      app.request('/api/board?line=TML&station=SUW'),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const b = await results[0].json();
    expect(b.state).toBe('official');
    expect(b.directions.UP.length + b.directions.DOWN.length).toBeGreaterThan(
      0,
    );
    expect(
      (await (await app.request('/api/board?line=TML&station=SUW')).json())
        .state,
    ).toBe('official');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not turn upstream status 0 into fabricated predictions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ status: 0, message: 'Service alert' })),
      ),
    );
    const r = await boardRoutes().request('/api/board?line=ISL&station=CHW');
    expect((await r.json()).state).toBe('unavailable');
  });
  it('rejects arbitrary upstream destinations', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const r = await boardRoutes().request(
      '/api/board?line=https://example.com&station=BAD',
    );
    expect(r.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });
});
