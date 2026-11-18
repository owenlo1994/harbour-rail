import { createApp } from '../../apps/api/src/app';
import { blobCache } from '../../apps/api/src/netlify-cache';
import { ScheduleBudget, ScheduleClient } from '../../apps/api/src/schedules';
const budget = new ScheduleBudget();
export default function rail(request: Request) {
  return createApp(
    new URL(request.url).origin,
    new ScheduleClient(undefined, budget),
  ).fetch(request, { DB: blobCache() });
}
export const config = { path: '/api/*' };
