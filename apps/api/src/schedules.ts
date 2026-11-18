import { z } from 'zod';
import {
  scheduleRowSchema,
  hkTime,
  type OfficialBoard,
} from '@hk-mtr/shared/live';
import { lineCodeSchema, type LineCode } from '@hk-mtr/shared';
export type BoardResult =
  | OfficialBoard
  | {
      state: 'unavailable';
      line: LineCode;
      station: string;
      message: string;
      updatedAt: string | null;
      fetchedAt: string;
      url?: string;
    };
export type ScheduleEntry = {
  result: BoardResult;
  polledAt: number;
  latencyMs: number;
  expiresAt: number;
};
/** Share numbers only across Worker requests: pending I/O belongs to its request. */
export class ScheduleBudget {
  nextStart = 0;
  quotaStart = 0;
  quota = 0;
  upstreamPause = 0;
  backoff = new Map<string, { failures: number; until: number }>();
}
const rawSchema = z
  .object({
    status: z.number(),
    message: z.string().optional(),
    curr_time: z.string().optional(),
    isdelay: z.string().optional(),
    Isdelay: z.string().optional(),
    url: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
const boardSchema = z
  .object({
    UP: z.array(scheduleRowSchema).optional(),
    DOWN: z.array(scheduleRowSchema).optional(),
    curr_time: z.string().optional(),
  })
  .passthrough();
export function normalizeSchedule(
  raw: unknown,
  line: LineCode,
  station: string,
  now = Date.now(),
): BoardResult {
  const parsed = rawSchema.parse(raw),
    b = boardSchema.safeParse(parsed.data?.[`${line}-${station}`]);
  if (
    parsed.status === 1 &&
    b.success &&
    Number.isFinite(hkTime(b.data.curr_time ?? parsed.curr_time))
  )
    return {
      state: 'official',
      line,
      station,
      updatedAt: b.data.curr_time ?? parsed.curr_time ?? null,
      fetchedAt: new Date(now).toISOString(),
      delay: parsed.isdelay ?? parsed.Isdelay ?? null,
      directions: {
        UP: b.data.UP?.slice(0, 4) ?? [],
        DOWN: b.data.DOWN?.slice(0, 4) ?? [],
      },
    };
  return {
    state: 'unavailable',
    line,
    station,
    message:
      parsed.status === 1
        ? '官方目前未提供班次及有效資料時間'
        : (parsed.message ?? '暫未有官方預報'),
    updatedAt: parsed.curr_time ?? null,
    fetchedAt: new Date(now).toISOString(),
    ...(parsed.url ? { url: parsed.url } : {}),
  };
}
export class ScheduleClient {
  readonly entries = new Map<string, ScheduleEntry>();
  private inflight = new Map<string, Promise<ScheduleEntry>>();
  private active = 0;
  private waiting: (() => void)[] = [];
  constructor(
    private options = {
      gapMs: 250,
      maxConcurrent: 3,
      perMinute: 240,
      timeoutMs: 6500,
      ttlMs: 15000,
    },
    private budget = new ScheduleBudget(),
  ) {}
  get rateLimit() {
    return this.options.perMinute;
  }
  restore(key: string, entry: ScheduleEntry) {
    const old = this.entries.get(key);
    if (!old || old.polledAt < entry.polledAt) this.entries.set(key, entry);
  }
  async get(line: LineCode, station: string): Promise<ScheduleEntry> {
    const key = `${line}:${station}`,
      now = Date.now(),
      cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) return cached;
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const req = this.request(line, station, key).finally(() =>
      this.inflight.delete(key),
    );
    this.inflight.set(key, req);
    return req;
  }
  private async request(line: LineCode, station: string, key: string) {
    if (this.active >= this.options.maxConcurrent)
      await new Promise<void>((r) => this.waiting.push(r));
    else this.active++;
    const fail = (message: string): ScheduleEntry => ({
      result: {
        state: 'unavailable',
        line,
        station,
        message,
        updatedAt: null,
        fetchedAt: new Date().toISOString(),
      },
      polledAt: Date.now(),
      expiresAt: Date.now() + 5000,
      latencyMs: 0,
    });
    try {
      const now = Date.now();
      if (
        now < this.budget.upstreamPause ||
        now < (this.budget.backoff.get(key)?.until ?? 0)
      )
        return fail('官方連線暫時中斷，重試中');
      if (now - this.budget.quotaStart >= 60000) {
        this.budget.quotaStart = now;
        this.budget.quota = 0;
      }
      if (this.budget.quota >= this.options.perMinute)
        return fail('查詢已達更新上限，稍後重試');
      const start = Math.max(Date.now(), this.budget.nextStart);
      this.budget.nextStart = start + this.options.gapMs;
      this.budget.quota++;
      const wait = start - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), this.options.timeoutMs),
        began = Date.now();
      try {
        const response = await fetch(
          `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${line}&sta=${station}&lang=TC`,
          {
            signal: controller.signal,
            headers: {
              'User-Agent':
                'hk-mtr-live/0.2 (+https://github.com/owenlo1994/harbour-rail)',
              Accept: 'application/json',
            },
          },
        );
        if (response.status === 429) {
          const retry = Number(response.headers.get('Retry-After'));
          this.budget.upstreamPause =
            Date.now() +
            Math.max(30000, Number.isFinite(retry) ? retry * 1000 : 30000);
          throw Error('UPSTREAM_RATE_LIMIT');
        }
        if (!response.ok) throw Error('UPSTREAM_HTTP');
        const result = normalizeSchedule(await response.json(), line, station);
        const entry = {
          result,
          polledAt: Date.now(),
          latencyMs: Date.now() - began,
          expiresAt: Date.now() + this.options.ttlMs,
        };
        this.entries.set(key, entry);
        this.budget.backoff.delete(key);
        return entry;
      } catch {
        const failures = (this.budget.backoff.get(key)?.failures ?? 0) + 1;
        this.budget.backoff.set(key, {
          failures,
          until: Date.now() + Math.min(60000, 5000 * 2 ** (failures - 1)),
        });
        const entry = fail('未能取得官方預報，請以車站顯示為準');
        // Preserve old official observations for bounded, labelled interruption handling.
        if (!this.entries.has(key)) this.entries.set(key, entry);
        return entry;
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }
}
export const schedules = new ScheduleClient();
export function validLine(value: string) {
  return lineCodeSchema.safeParse(value);
}
