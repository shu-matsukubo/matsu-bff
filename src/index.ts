import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { config } from './config.js';
import { apiRoutes } from './routes/api.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: config.frontendOrigin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['content-type', 'accept'],
  }),
);

app.route('/', healthRoutes);
app.route('/auth', authRoutes);
app.route('/api', apiRoutes);

app.notFound((c) => c.json({ message: 'Not found.' }, 404));

app.onError((error, c) => {
  console.error(error);
  return c.json({ message: 'Internal server error.' }, 500);
});

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
