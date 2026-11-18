import { serve } from '@hono/node-server';
import { createApp } from './app.js';
const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid PORT');
serve({ fetch: createApp(process.env.WEB_ORIGIN).fetch, port }, (info) => {
  console.log(`hk-mtr-live API listening on http://localhost:${info.port}`);
});
