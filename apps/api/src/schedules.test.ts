import { describe, it, expect, vi, afterEach } from 'vitest';
import { ScheduleBudget, ScheduleClient, normalizeSchedule } from './schedules';
import { readFileSync } from 'node:fs';
const sample = JSON.parse(
  readFileSync('data/raw/next-train-20261118/TWL-ADM.json', 'utf8'),
);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('bounded official polling', () => {
  it('shares the rate budget across independent request scopes without sharing pending I/O', async () => {
    vi.useFakeTimers();
    const budget = new ScheduleBudget();
    let release!: () => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = () => resolve(new Response(JSON.stringify(sample)));
          }),
      )
      .mockImplementation(async () => new Response(JSON.stringify(sample)));
    vi.stubGlobal('fetch', fetcher);
    const options = {
      gapMs: 250,
      maxConcurrent: 3,
      perMinute: 2,
      timeoutMs: 1000,
      ttlMs: 15000,
    };
    const a = new ScheduleClient(options, budget);
    const b = new ScheduleClient(options, budget);
    const pending = a.get('TWL', 'ADM');
    const independent = b.get('TWL', 'ADM');
    await vi.advanceTimersByTimeAsync(260);
    expect((await independent).result.state).toBe('official');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect((await b.get('TWL', 'TST')).result.state).toBe('unavailable');
    release();
    await pending;
  });
  it('coalesces identical requests and enforces concurrency and start spacing', async () => {
    vi.useFakeTimers();
    const starts: number[] = [];
    let active = 0,
      max = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        starts.push(Date.now());
        active++;
        max = Math.max(max, active);
        await new Promise((r) => setTimeout(r, 100));
        active--;
        return new Response(JSON.stringify(sample));
      }),
    );
    const client = new ScheduleClient({
      gapMs: 250,
      maxConcurrent: 2,
      perMinute: 240,
      timeoutMs: 1000,
      ttlMs: 15000,
    });
    const requests = Promise.all([
      client.get('TWL', 'ADM'),
      client.get('TWL', 'ADM'),
      client.get('TWL', 'TST'),
      client.get('TWL', 'CEN'),
    ]);
    await vi.advanceTimersByTimeAsync(2000);
    await requests;
    expect(starts).toHaveLength(3);
    expect(max).toBeLessThanOrEqual(2);
    expect(starts.slice(1).every((t, i) => t - starts[i] >= 250)).toBe(true);
  });
  it('caps uncached upstream requests per minute', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(sample)));
    vi.stubGlobal('fetch', fetcher);
    const client = new ScheduleClient({
      gapMs: 0,
      maxConcurrent: 2,
      perMinute: 2,
      timeoutMs: 1000,
      ttlMs: 15000,
    });
    await client.get('TWL', 'ADM');
    await client.get('TWL', 'TST');
    const third = await client.get('TWL', 'CEN');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(third.result.state).toBe('unavailable');
  });
  it('aborts an unresponsive source and backs off without inventing observations', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(
      (_url: unknown, options: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          options.signal?.addEventListener('abort', () =>
            reject(Error('aborted')),
          ),
        ),
    );
    vi.stubGlobal('fetch', fetcher);
    const client = new ScheduleClient({
      gapMs: 0,
      maxConcurrent: 2,
      perMinute: 240,
      timeoutMs: 100,
      ttlMs: 15000,
    });
    const first = client.get('TWL', 'ADM');
    await vi.advanceTimersByTimeAsync(110);
    expect((await first).result.state).toBe('unavailable');
    await client.get('TWL', 'ADM');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not treat status 1 with placeholder time and no trains as fresh official predictions', () => {
    const missing = JSON.parse(
      readFileSync(
        'data/raw/next-train-20261118/ISL-ADM-missing-time.json',
        'utf8',
      ),
    );
    const result = normalizeSchedule(missing, 'ISL', 'ADM');
    expect(result.state).toBe('unavailable');
    expect(result.state === 'unavailable' && result.message).toContain(
      '有效資料時間',
    );
  });
  it('preserves recorded errors and delay flags, and accepts both observed time field spellings', () => {
    const error = JSON.parse(
      readFileSync(
        'data/raw/next-train-20261118/error-invalid-station.json',
        'utf8',
      ),
    );
    expect(normalizeSchedule(error, 'TWL', 'ADM').state).toBe('unavailable');
    const delayed = { ...sample, isdelay: 'Y' };
    const result = normalizeSchedule(delayed, 'TWL', 'ADM');
    expect(result.state === 'official' && result.delay).toBe('Y');
  });
});
