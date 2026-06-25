# matsu BFF

TypeScript + Hono BFF for the matsu workspace.

The frontend talks to this service instead of calling the Laravel API or auth server directly.

## Responsibilities

- Own the browser session using an `HttpOnly` cookie.
- Store auth server access and refresh tokens in Redis.
- Call `matsu-auth` for login, registration, session refresh, and session checks.
- Proxy all `/api/*` requests to `matsu-api` with `Authorization: Bearer <access token>`.

## Tech Stack

- TypeScript
- Hono
- `@hono/node-server`
- Redis
- Docker / Docker Compose

## Local Development

Start the development container with hot reload:

```bash
docker compose --profile dev up bff-dev
```

Start a production-like local container:

```bash
docker compose up -d --build
```

Default local endpoints:

- BFF: `http://localhost:18082`
- Frontend origin: `http://localhost:5173`
- Laravel API target: `http://host.docker.internal:18080/api`
- Auth server target: `http://host.docker.internal:18081`
- Redis: `localhost:16379`

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the app with `tsx watch`. |
| `npm run build` | Compile TypeScript into `dist/`. |
| `npm run start` | Run the compiled `dist/index.js`. |
| `npm run typecheck` | Run TypeScript without emitting files. |

On Windows PowerShell, use `npm.cmd run ...` if `npm.ps1` is blocked by execution policy.

## Environment

See `.env.example` for local defaults.

Important values:

```text
PORT=18082
FRONTEND_ORIGIN=http://localhost:5173
BACKEND_API_BASE_URL=http://host.docker.internal:18080/api
AUTH_BASE_URL=http://host.docker.internal:18081
REDIS_URL=redis://redis:6379
SESSION_COOKIE_NAME=matsu-session
SESSION_TTL_SECONDS=2592000
COOKIE_SECURE=false
```

For local HTTP development, `COOKIE_SECURE=false` is expected. Use `COOKIE_SECURE=true` for HTTPS environments.

## Project Structure

- `src/index.ts`: Hono app entry point.
- `src/config.ts`: Environment configuration.
- `src/middleware/session.ts`: Session cookie and auth middleware.
- `src/routes/health.ts`: `GET /health`.
- `src/routes/auth.ts`: `/auth/*` routes.
- `src/routes/api.ts`: `/api/*` proxy routes.
- `src/services/authClient.ts`: HTTP client for `matsu-auth`.
- `src/services/sessionStore.ts`: Redis-backed session store.
- `src/services/sessionRefresh.ts`: Token refresh helper.
- `src/services/redisClient.ts`: Redis client factory.
- `src/types`: Shared TypeScript types.

## Docker

The BFF owns its Redis container. Other services should not depend on this Redis instance.
