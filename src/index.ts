import { serve } from '@hono/node-server';
import { app } from './app.js';
import { config } from './config.js';

serve(
  {
    fetch: app.fetch,
    hostname: '0.0.0.0',
    port: config.port,
  },
  (info) => {
    console.log(`matsu BFF listening on :${info.port}`);
  },
);
