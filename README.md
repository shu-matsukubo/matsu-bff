# matsu BFF

matsu front-end talks to this BFF instead of calling the Laravel backend or auth server directly.

## Responsibilities

- Owns the browser session using an `HttpOnly` cookie.
- Stores auth server access/refresh tokens in Redis.
- Calls the auth server for login, registration, and token refresh.
- Proxies all `/api/*` requests to the Laravel backend with `Authorization: Bearer <access token>`.

## Local Development

```bash
npm run dev
```

This BFF currently uses only Node.js built-in modules, so dependency installation is not required.

Default local endpoints:

- BFF: `http://localhost:18082`
- Frontend origin: `http://localhost:5173`
- Backend API: `http://localhost:18080/api`
- Auth server: `http://localhost:18081`
- Redis: `localhost:16379`

## Docker

```bash
docker compose up -d
```

The BFF owns its Redis container. Other services should not depend on this Redis instance.

## Cookie Security

The session cookie is `HttpOnly` and `SameSite=Lax`.

For local HTTP development, `COOKIE_SECURE=false` is configured in `docker-compose.yml`. Use `COOKIE_SECURE=true` for HTTPS environments.
