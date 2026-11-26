import { createApp } from './app.js';
import type { RailDatabase } from './persistence.js';
import { ScheduleBudget, ScheduleClient } from './schedules.js';

const budget = new ScheduleBudget();

export default {
  fetch(request: Request, env: { DB: RailDatabase }) {
    return createApp(
      new URL(request.url).origin,
      new ScheduleClient(undefined, budget),
    ).fetch(request, env);
  },
};
