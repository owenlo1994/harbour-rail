import { useEffect, useState } from 'react';
import { liveFeedSchema, type LiveFeed } from '@hk-mtr/shared/live';
import type { LineCode } from '@hk-mtr/shared';
export function useLiveFeed(
  enabled: boolean,
  line: LineCode | null,
  priority: string | undefined,
) {
  const key = line ?? 'all';
  const [state, setState] = useState<{
      key: string;
      feed: LiveFeed;
      offset: number;
    } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return;
    let disposed = false,
      cursor = 0,
      timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      if (disposed) return;
      try {
        const query = new URLSearchParams({
          line: key,
          cursor: String(cursor),
        });
        if (priority) query.set('priority', priority);
        const response = await fetch('/api/trains?' + query, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw Error('UPSTREAM_UNAVAILABLE');
        const feed = liveFeedSchema.parse(await response.json());
        cursor = feed.coverage.nextCursor;
        if (!disposed) {
          setState({ key, feed, offset: feed.serverTime - Date.now() });
          setError('');
        }
      } catch {
        if (!disposed) setError('官方連線中斷・位置續推中');
      }
      if (!disposed) timer = setTimeout(poll, document.hidden ? 10000 : 1000);
    };
    void poll();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [enabled, key, priority]);
  return {
    feed: state?.key === key ? state.feed : null,
    clockOffset: state?.offset ?? 0,
    error,
  };
}
