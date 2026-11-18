import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { apiStatusSchema } from '../../../packages/shared/src/index.js';
describe('Milestone 1 review status API', () => {
  const app = createApp();
  it('reports source-backed toy geometry without claiming live train data', async () => {
    const res = await app.request('/api/status');
    expect(res.status).toBe(200);
    expect(apiStatusSchema.parse(await res.json())).toMatchObject({
      geometry: 'toy-source-backed',
      realtime: 'official-predictions',
    });
  });
  it('allows the configured frontend origin', async () => {
    const res = await app.request('/api/status', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    );
  });
  it('never enables arbitrary origins', async () => {
    const res = await app.request('/api/status', {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).not.toBe(
      'https://untrusted.example',
    );
  });
  it('does not fabricate future train endpoints', async () =>
    expect((await app.request('/api/trains?line=INVALID')).status).toBe(400));
});
