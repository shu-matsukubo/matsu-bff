# matsu BFF

TypeScript + Hono BFF for the matsu workspace.

The frontend talks to this service instead of calling the Laravel API or auth server directly.

## Responsibilities

- Own the browser session using an `HttpOnly` cookie.
- Store resource-specific access and refresh tokens in Redis.
- Act as an OAuth confidential client using Authorization Code + PKCE.
- Call `matsu-auth` for code exchange and refresh-token rotation.
- Expose explicit typed routes backed by `matsu-api`, `matsu-toolbox-api`, and
  `matsu-arcade-api`, each with its own Bearer token.
- Validate browser requests and successful upstream responses against the BFF contract.

## Tech Stack

- TypeScript
- Hono
- `@hono/node-server`
- `@hono/zod-openapi`
- Zod
- Redis
- Docker / Docker Compose

## Local Development

Start the BFF and Redis containers with hot reload:

```bash
docker compose up
```

Default local endpoints:

- BFF: `http://localhost:18082`
- Frontend origin: `http://localhost:5173`
- Laravel API target: `http://host.docker.internal:18080/api`
- Toolbox API target: `http://host.docker.internal:18083/api`
- Arcade API target: `http://host.docker.internal:18085/api`
- Auth server target: `http://host.docker.internal:18081`
- Arcade Auth target: `http://host.docker.internal:18084`
- Redis: `localhost:16379`
- OpenAPI JSON: `http://localhost:18082/openapi.json`
- Swagger UI: `http://localhost:18082/docs`

## API Contract

The BFF is the source of truth for browser-facing request and response types. Route definitions
and Zod schemas generate the OpenAPI document, and the same schemas validate requests and
successful Laravel responses at runtime. An upstream response that violates the contract returns
`502` instead of reaching the frontend as untyped data.

After changing a route or schema, regenerate the committed artifact:

```bash
npm run openapi:generate
```

## Scripts

| Script                     | Description                                                   |
| -------------------------- | ------------------------------------------------------------- |
| `npm run dev`              | Start the app with `tsx watch`.                               |
| `npm run build`            | Compile TypeScript into `dist/`.                              |
| `npm run start`            | Run the compiled `dist/index.js`.                             |
| `npm run lint`             | Run type-aware ESLint with zero warnings allowed.             |
| `npm run lint:fix`         | Auto-fix ESLint issues where possible.                        |
| `npm run format`           | Format the project with Prettier.                             |
| `npm run format:check`     | Check Prettier formatting.                                    |
| `npm run typecheck`        | Type-check source, tests, and scripts without emitting files. |
| `npm run check`            | Run ESLint, TypeScript, and Prettier checks.                  |
| `npm run fix`              | Auto-fix ESLint issues and format the project.                |
| `npm run openapi:generate` | Generate `openapi/openapi.json` from the registered routes.   |
| `npm run openapi:check`    | Verify that the generated OpenAPI artifact is current.        |
| `npm test`                 | Run contract smoke tests.                                     |

On Windows PowerShell, use `npm.cmd run ...` if `npm.ps1` is blocked by execution policy.

## Environment

See `.env.example` for local defaults.

Important values:

```text
PORT=18082
PUBLIC_BASE_URL=http://localhost:18082
FRONTEND_ORIGIN=http://localhost:5173
BACKEND_API_BASE_URL=http://host.docker.internal:18080/api
TOOLBOX_API_BASE_URL=http://host.docker.internal:18083/api
ARCADE_API_BASE_URL=http://host.docker.internal:18085/api
AUTH_BASE_URL=http://host.docker.internal:18081
AUTH_PUBLIC_BASE_URL=http://localhost:18081
ARCADE_AUTH_BASE_URL=http://host.docker.internal:18084
AUTH_CLIENT_ID=matsu-bff
AUTH_CLIENT_SECRET=matsu-bff-dev-secret
AUTH_SCOPE=matsu-api
UPSTREAM_TIMEOUT_MILLISECONDS=5000
REDIS_URL=redis://bff-redis:6379
SESSION_COOKIE_NAME=matsu-session
SESSION_TTL_SECONDS=2592000
AUTHORIZATION_FLOW_TTL_SECONDS=600
COOKIE_SECURE=false
```

For local HTTP development, `COOKIE_SECURE=false` is expected. Use `COOKIE_SECURE=true` for HTTPS environments.

## Project Structure

- `src/app.ts`: OpenAPIHono app, middleware, OpenAPI JSON, and Swagger UI.
- `src/index.ts`: Node server entry point.
- `src/config.ts`: Environment configuration.
- `src/middleware/session.ts`: Session cookie and auth middleware.
- `src/routes/health.ts`: `GET /health`.
- `src/routes/auth.ts`: `/auth/*` routes.
- `src/routes/api.ts`: Explicit typed `matsu-api` routes.
- `src/routes/toolbox.ts`: Explicit typed Toolbox routes.
- `src/routes/arcade.ts`: Explicit typed Arcade routes.
- `src/schemas`: Request and response contracts shared by Zod and OpenAPI.
- `src/services/authClient.ts`: HTTP client for `matsu-auth`.
- `src/services/authorizationFlowStore.ts`: Short-lived OAuth state and PKCE verifier storage.
- `src/services/sessionStore.ts`: Redis-backed, versioned multi-resource session store.
- `src/services/sessionRefresh.ts`: Resource-specific token refresh helper.
- `src/services/upstreamClient.ts`: Resource-aware upstream client and response validation.
- `src/services/redisClient.ts`: Redis client factory.
- `src/types`: Shared TypeScript types.
- `scripts/generate-openapi.ts`: Reproducible OpenAPI artifact generation.
- `scripts/check-openapi.ts`: Git-independent in-memory OpenAPI artifact comparison.

## Docker

The Docker environment is intended for local development only. The BFF owns its Redis
container, and other services should not depend on this Redis instance.

Run all quality checks in a one-off container (Redis is not required):

```bash
docker compose run --rm --no-deps bff npm run check
```

Auto-fix ESLint issues and format the project through Docker:

```bash
docker compose run --rm --no-deps bff npm run fix
```

## CI

GitHub Actions runs on pull requests targeting `develop` or `main`. The workflow installs
dependencies with `npm ci`, runs the quality checks, verifies the generated OpenAPI artifact,
runs the tests, and builds the TypeScript project.

```text
.github/workflows/ci.yml
```
