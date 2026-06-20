# matsu BFF

matsu front-end talks to this BFF instead of calling the Laravel backend or auth server directly.

Built with **TypeScript** and **[Hono](https://hono.dev/)**.

## Responsibilities

- Owns the browser session using an `HttpOnly` cookie.
- Stores auth server access/refresh tokens in Redis.
- Calls the auth server for login, registration, and token refresh.
- Proxies all `/api/*` requests to the Laravel backend with `Authorization: Bearer <access token>`.

## Local Development

Docker 内で依存関係をインストールして開発サーバーを起動します。

```bash
docker compose --profile dev up bff-dev
```

本番相当のビルド済みイメージで起動する場合:

```bash
docker compose up -d --build
```

Default local endpoints:

- BFF: `http://localhost:18082`
- Frontend origin: `http://localhost:5173`
- Backend API: `http://localhost:18080/api`
- Auth server: `http://localhost:18081`
- Redis: `localhost:16379`

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | TypeScript を `tsx watch` でホットリロード実行 |
| `npm run build` | `tsc` で `dist/` にコンパイル |
| `npm run start` | ビルド済み `dist/index.js` を起動 |
| `npm run typecheck` | 型チェックのみ |

## Project Structure

```
src/
├── index.ts              # Hono アプリのエントリポイント
├── config.ts             # 環境変数
├── middleware/session.ts # セッション Cookie / 認証ミドルウェア
├── routes/
│   ├── health.ts         # GET /health
│   ├── auth.ts           # /auth/*
│   └── api.ts            # /api/* プロキシ
├── services/
│   ├── authClient.ts     # matsu-auth への HTTP クライアント
│   ├── sessionStore.ts   # Redis セッション管理
│   ├── sessionRefresh.ts # トークンリフレッシュ
│   └── redisClient.ts    # 最小 Redis クライアント
└── types/
```

## Docker

```bash
docker compose up -d --build
```

The BFF owns its Redis container. Other services should not depend on this Redis instance.

## Cookie Security

The session cookie is `HttpOnly` and `SameSite=Lax`.

For local HTTP development, `COOKIE_SECURE=false` is configured in `docker-compose.yml`. Use `COOKIE_SECURE=true` for HTTPS environments.
