import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { app } from '../src/app.js';
import { config } from '../src/config.js';
import {
  resetRedisClientForTests,
  setRedisClientForTests,
  type RedisClient,
} from '../src/services/redisClient.js';
import { createSession, getSession, saveSessionResource } from '../src/services/sessionStore.js';
import {
  resetRuntimeDependenciesForTests,
  setRuntimeDependenciesForTests,
} from '../src/services/runtime.js';
import type { AuthTokens, SessionResource } from '../src/types/session.js';

class MemoryRedis implements RedisClient {
  readonly values = new Map<string, string>();

  get = (key: string): Promise<string | null> => Promise.resolve(this.values.get(key) ?? null);

  getDel = (key: string): Promise<string | null> => {
    const value = this.values.get(key) ?? null;
    this.values.delete(key);
    return Promise.resolve(value);
  };

  setJson = (key: string, value: unknown): Promise<string> => {
    this.values.set(key, JSON.stringify(value));
    return Promise.resolve('OK');
  };

  del = (key: string): Promise<number> => Promise.resolve(this.values.delete(key) ? 1 : 0);

  setRaw(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const memoryRedis = new MemoryRedis();
const fixedNow = Date.parse('2026-07-30T00:00:00.000Z');

const tokens = (name: string): AuthTokens => ({
  accessToken: `${name}-access`,
  refreshToken: `${name}-refresh`,
  expiresIn: 900,
  tokenType: 'Bearer',
});

const jsonResponse = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const inputUrl = (input: Parameters<typeof globalThis.fetch>[0]): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

const requestBody = (body: BodyInit | null | undefined): string | null => {
  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  return null;
};

const setFetch = (
  implementation: (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: RequestInit
  ) => Promise<Response>
): void => {
  setRuntimeDependenciesForTests({ fetch: implementation });
};

const sessionCookie = (sessionId: string): string =>
  `${config.sessionCookieName}=${encodeURIComponent(sessionId)}`;

const connectResource = async (
  sessionId: string,
  resource: SessionResource,
  resourceTokens = tokens(resource)
): Promise<void> => {
  const session = await getSession(sessionId);
  assert.ok(session);
  await saveSessionResource(sessionId, session, resource, resourceTokens);
};

const createConnectedSession = async (resources: SessionResource[]): Promise<string> => {
  assert.ok(resources.length > 0);
  const first = resources[0];
  assert.ok(first);
  const sessionId = await createSession(tokens(first), first);

  for (const resource of resources.slice(1)) {
    await connectResource(sessionId, resource);
  }

  return sessionId;
};

const toolboxNote = {
  id: '11111111-1111-4111-8111-111111111111',
  ownerSub: 'toolbox-user',
  title: 'A note',
  content: 'Body',
  createdAt: '2026-07-30T00:00:00.000Z',
  updatedAt: '2026-07-30T00:00:00.000Z',
};

beforeEach(() => {
  memoryRedis.values.clear();
  setRedisClientForTests(memoryRedis);
  setRuntimeDependenciesForTests({
    now: () => fixedNow,
    fetch: () => {
      throw new Error('Unexpected real service request in a unit test.');
    },
  });
});

after(() => {
  resetRedisClientForTests();
  resetRuntimeDependenciesForTests();
});

void test('GET /health returns the typed health response', async () => {
  const response = await app.request('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

void test('GET /openapi.json exposes every explicit BFF route family', async () => {
  const response = await app.request('/openapi.json');
  const document = (await response.json()) as {
    paths?: Record<string, unknown>;
    components?: { securitySchemes?: Record<string, unknown> };
  };

  assert.equal(response.status, 200);
  assert.ok(document.paths?.['/api/expenses/summary']);
  assert.ok(document.paths?.['/api/toolbox/notes/{noteId}']);
  assert.ok(document.paths?.['/api/arcade/leaderboards/{gameKey}']);
  assert.ok(document.paths?.['/auth/toolbox/login']);
  assert.ok(document.paths?.['/auth/arcade/register']);
  assert.ok(document.paths?.['/auth/arcade/disconnect']);
  assert.ok(document.components?.securitySchemes?.SessionCookie);
  assert.equal(document.components?.securitySchemes?.BearerAuth, undefined);
});

void test('POST /auth/login rejects invalid and malformed input before auth', async () => {
  const invalid = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invalid', password: 'short' }),
  });
  const invalidData = (await invalid.json()) as { message?: string; issues?: unknown[] };

  assert.equal(invalid.status, 400);
  assert.equal(invalidData.message, 'Request validation failed.');
  assert.ok(invalidData.issues && invalidData.issues.length >= 2);

  const malformed = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(malformed.status, 400);
});

void test('GET /auth/callback rejects a response not bound to this browser', async () => {
  const response = await app.request('/auth/callback?code=test-code&state=test-state');
  const html = await response.text();

  assert.equal(response.status, 400);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-security-policy') ?? '', /connect-src 'self'/);
  assert.match(html, /ログインをやり直してください/);
  assert.match(html, /href="\/auth\/login"/);
});

void test('session status reports resource connections without tokens', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'arcade']);
  const response = await app.request('/auth/session', {
    headers: { cookie: sessionCookie(sessionId) },
  });
  const data = (await response.json()) as Record<string, unknown>;

  assert.equal(response.status, 200);
  assert.deepEqual(data, {
    authenticated: true,
    resources: { matsuApi: true, toolbox: false, arcade: true },
  });
  assert.doesNotMatch(JSON.stringify(data), /access|refresh|Bearer/i);
});

void test('each API family selects only its own upstream and token', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'toolbox', 'arcade']);
  const calls: { url: string; authorization: string | null }[] = [];

  setFetch((input, init) => {
    const url = inputUrl(input);
    calls.push({
      url,
      authorization: new Headers(init?.headers).get('authorization'),
    });

    if (url.includes('/expenses?')) {
      return Promise.resolve(
        jsonResponse({
          data: [],
          meta: { total_net_amount: 0, fixed_costs: [] },
        })
      );
    }

    if (url.endsWith('/me') && url.includes(':18083')) {
      return Promise.resolve(
        jsonResponse({
          sub: 'toolbox-user',
          issuer: 'http://localhost:18081',
          audience: 'matsu-toolbox-api',
        })
      );
    }

    if (url.endsWith('/games') && url.includes(':18085')) {
      return Promise.resolve(jsonResponse({ items: [] }));
    }

    throw new Error(`Unexpected URL: ${url}`);
  });

  const headers = {
    cookie: sessionCookie(sessionId),
    authorization: 'Bearer browser-controlled-token',
  };
  const expenses = await app.request(
    '/api/expenses/summary?start_date=2026-07-01&end_date=2026-07-31',
    { headers }
  );
  const toolbox = await app.request('/api/toolbox/me', { headers });
  const arcade = await app.request('/api/arcade/games', { headers });

  assert.equal(expenses.status, 200);
  assert.equal(toolbox.status, 200);
  assert.equal(arcade.status, 200);
  assert.equal(calls.length, 3);
  assert.match(calls[0]?.url ?? '', /:18080\/api\/expenses/);
  assert.equal(calls[0]?.authorization, 'Bearer matsuApi-access');
  assert.match(calls[1]?.url ?? '', /:18083\/api\/me$/);
  assert.equal(calls[1]?.authorization, 'Bearer toolbox-access');
  assert.match(calls[2]?.url ?? '', /:18085\/api\/games$/);
  assert.equal(calls[2]?.authorization, 'Bearer arcade-access');
});

void test('Toolbox path, query, and body mapping strip only the BFF prefix', async () => {
  const sessionId = await createConnectedSession(['toolbox']);
  const requests: { url: string; method?: string; body?: string | null }[] = [];

  setFetch((input, init) => {
    requests.push({ url: inputUrl(input), method: init?.method, body: requestBody(init?.body) });

    if (init?.method === 'PATCH') {
      return Promise.resolve(jsonResponse({ ...toolboxNote, title: 'Updated' }));
    }

    return Promise.resolve(jsonResponse([]));
  });

  const update = await app.request(`/api/toolbox/notes/${toolboxNote.id}`, {
    method: 'PATCH',
    headers: {
      cookie: sessionCookie(sessionId),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ title: 'Updated' }),
  });
  const list = await app.request('/api/toolbox/bookmarks?tag=typescript', {
    headers: { cookie: sessionCookie(sessionId) },
  });

  assert.equal(update.status, 200);
  assert.equal(list.status, 200);
  assert.match(requests[0]?.url ?? '', new RegExp(`/api/notes/${toolboxNote.id}$`));
  assert.equal(requests[0]?.method, 'PATCH');
  assert.deepEqual(JSON.parse(requests[0]?.body ?? ''), { title: 'Updated' });
  assert.match(requests[1]?.url ?? '', /\/api\/bookmarks\?tag=typescript$/);
});

void test('a missing resource slot returns 401 without calling an upstream', async () => {
  const sessionId = await createConnectedSession(['matsuApi']);
  let calls = 0;
  setFetch(() => {
    calls += 1;
    return Promise.resolve(jsonResponse({}));
  });

  const response = await app.request('/api/toolbox/notes', {
    headers: { cookie: sessionCookie(sessionId) },
  });

  assert.equal(response.status, 401);
  assert.equal(calls, 0);
});

void test('non-JSON, schema-invalid, and failed upstream responses normalize to 502', async t => {
  await t.test('non-JSON', async () => {
    const sessionId = await createConnectedSession(['arcade']);
    setFetch(() => Promise.resolve(new Response('<html>bad gateway</html>', { status: 200 })));
    const response = await app.request('/api/arcade/games', {
      headers: { cookie: sessionCookie(sessionId) },
    });
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /host\.docker\.internal|18085/);
  });

  await t.test('schema mismatch', async () => {
    const sessionId = await createConnectedSession(['arcade']);
    setFetch(() => Promise.resolve(jsonResponse({ items: [{ key: 123 }] })));
    const response = await app.request('/api/arcade/games', {
      headers: { cookie: sessionCookie(sessionId) },
    });
    assert.equal(response.status, 502);
  });

  await t.test('connection failure or timeout', async () => {
    const sessionId = await createConnectedSession(['arcade']);
    setFetch(() => Promise.reject(new DOMException('The operation was aborted.', 'AbortError')));
    const response = await app.request('/api/arcade/games', {
      headers: { cookie: sessionCookie(sessionId) },
    });
    assert.equal(response.status, 502);
  });
});

void test('401 refreshes only the target slot and retries the request once', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'toolbox']);
  const toolboxAuthorizations: string[] = [];
  let toolboxAttempts = 0;

  setFetch((input, init) => {
    const url = inputUrl(input);

    if (url.includes(':18083')) {
      toolboxAttempts += 1;
      toolboxAuthorizations.push(new Headers(init?.headers).get('authorization') ?? '');
      return Promise.resolve(
        toolboxAttempts === 1 ? jsonResponse({ message: 'expired' }, 401) : jsonResponse([])
      );
    }

    if (url.endsWith('/oauth/token')) {
      assert.match(requestBody(init?.body) ?? '', /refresh_token=toolbox-refresh/);
      return Promise.resolve(
        jsonResponse({
          access_token: 'toolbox-refreshed-access',
          refresh_token: 'toolbox-refreshed-refresh',
          expires_in: 900,
          token_type: 'Bearer',
        })
      );
    }

    throw new Error(`Unexpected URL: ${url}`);
  });

  const response = await app.request('/api/toolbox/notes', {
    headers: { cookie: sessionCookie(sessionId) },
  });
  const session = await getSession(sessionId);

  assert.equal(response.status, 200);
  assert.equal(toolboxAttempts, 2);
  assert.deepEqual(toolboxAuthorizations, [
    'Bearer toolbox-access',
    'Bearer toolbox-refreshed-access',
  ]);
  assert.equal(session?.toolbox?.refreshToken, 'toolbox-refreshed-refresh');
  assert.equal(session?.matsuApi?.accessToken, 'matsuApi-access');
});

void test('refresh failure removes only the failed slot and preserves the browser session', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'toolbox']);

  setFetch(input => {
    const url = inputUrl(input);
    return Promise.resolve(
      url.includes(':18083')
        ? jsonResponse({ message: 'expired' }, 401)
        : jsonResponse({ message: 'invalid refresh' }, 401)
    );
  });

  const response = await app.request('/api/toolbox/notes', {
    headers: { cookie: sessionCookie(sessionId) },
  });
  const session = await getSession(sessionId);

  assert.equal(response.status, 401);
  assert.equal(session?.toolbox, undefined);
  assert.equal(session?.matsuApi?.accessToken, 'matsuApi-access');
  assert.equal(response.headers.get('set-cookie'), null);
});

void test('a repeated 401 removes only the refreshed target slot', async () => {
  const sessionId = await createConnectedSession(['toolbox', 'arcade']);
  let toolboxAttempts = 0;

  setFetch((input, init) => {
    const url = inputUrl(input);

    if (url.includes(':18083')) {
      toolboxAttempts += 1;
      return Promise.resolve(jsonResponse({ message: 'still expired' }, 401));
    }

    assert.match(url, /\/oauth\/token$/);
    assert.match(requestBody(init?.body) ?? '', /refresh_token=toolbox-refresh/);
    return Promise.resolve(
      jsonResponse({
        access_token: 'toolbox-retried-access',
        refresh_token: 'toolbox-retried-refresh',
        expires_in: 900,
        token_type: 'Bearer',
      })
    );
  });

  const response = await app.request('/api/toolbox/notes', {
    headers: { cookie: sessionCookie(sessionId) },
  });
  const session = await getSession(sessionId);

  assert.equal(response.status, 401);
  assert.equal(toolboxAttempts, 2);
  assert.equal(session?.toolbox, undefined);
  assert.equal(session?.arcade?.accessToken, 'arcade-access');
});

void test('an unavailable Arcade upstream does not break matsu API routes or session slots', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'toolbox', 'arcade']);

  setFetch((input, init) => {
    const url = inputUrl(input);

    if (url.includes(':18085')) {
      return Promise.reject(new Error('Arcade unavailable'));
    }

    assert.match(url, /:18080\/api\/categories$/);
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer matsuApi-access');
    return Promise.resolve(jsonResponse([]));
  });

  const arcade = await app.request('/api/arcade/games', {
    headers: { cookie: sessionCookie(sessionId) },
  });
  const matsu = await app.request('/api/categories', {
    headers: { cookie: sessionCookie(sessionId) },
  });
  const session = await getSession(sessionId);

  assert.equal(arcade.status, 502);
  assert.equal(matsu.status, 200);
  assert.ok(session?.matsuApi);
  assert.ok(session?.toolbox);
  assert.ok(session?.arcade);
});

void test('legacy sessions migrate to matsuApi and invalid sessions are deleted', async () => {
  memoryRedis.setRaw(
    'session:legacy',
    JSON.stringify({
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh',
      expiresIn: 900,
      tokenType: 'Bearer',
      accessTokenExpiresAt: fixedNow + 900_000,
    })
  );

  const migrated = await getSession('legacy');
  assert.deepEqual(migrated, {
    version: 2,
    matsuApi: {
      accessToken: 'legacy-access',
      refreshToken: 'legacy-refresh',
      expiresAt: fixedNow + 900_000,
      tokenType: 'Bearer',
    },
  });
  assert.match(memoryRedis.values.get('session:legacy') ?? '', /"version":2/);

  memoryRedis.setRaw('session:invalid-json', '{invalid');
  memoryRedis.setRaw('session:invalid-shape', JSON.stringify({ version: 2, matsuApi: {} }));
  assert.equal(await getSession('invalid-json'), null);
  assert.equal(await getSession('invalid-shape'), null);
  assert.equal(memoryRedis.values.has('session:invalid-json'), false);
  assert.equal(memoryRedis.values.has('session:invalid-shape'), false);
});

void test('Toolbox login uses its fixed scope, PKCE, state, and secure cookie attributes', async () => {
  const response = await app.request('/auth/toolbox/login');
  const location = response.headers.get('location');
  const setCookie = response.headers.get('set-cookie') ?? '';
  assert.ok(location);
  const authorizationUrl = new URL(location);
  const state = authorizationUrl.searchParams.get('state');

  assert.equal(response.status, 302);
  assert.equal(authorizationUrl.searchParams.get('scope'), 'matsu-toolbox-api');
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(authorizationUrl.searchParams.get('code_challenge'));
  assert.ok(state);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/auth\/callback/i);
  assert.ok(memoryRedis.values.has(`authorization-flow:${state}`));
  assert.doesNotMatch(memoryRedis.values.get(`authorization-flow:${state}`) ?? '', /accessToken/);
});

void test('Toolbox callback merges tokens into an existing browser session', async () => {
  const sessionId = await createConnectedSession(['matsuApi']);
  const begin = await app.request('/auth/toolbox/login');
  const location = new URL(begin.headers.get('location') ?? '');
  const state = location.searchParams.get('state');
  const stateCookie = (begin.headers.get('set-cookie') ?? '').split(';')[0];
  assert.ok(state);
  assert.ok(stateCookie);

  setFetch(input => {
    assert.match(inputUrl(input), /\/oauth\/token$/);
    return Promise.resolve(
      jsonResponse({
        access_token: 'toolbox-oauth-access',
        refresh_token: 'toolbox-oauth-refresh',
        expires_in: 900,
        token_type: 'Bearer',
      })
    );
  });

  const callback = await app.request(`/auth/callback?code=code-1&state=${state}`, {
    headers: { cookie: `${sessionCookie(sessionId)}; ${stateCookie}` },
  });
  const session = await getSession(sessionId);

  assert.equal(callback.status, 302);
  assert.equal(session?.matsuApi?.accessToken, 'matsuApi-access');
  assert.equal(session?.toolbox?.accessToken, 'toolbox-oauth-access');
});

void test('direct matsu login remains compatible and never returns tokens', async () => {
  setFetch(input => {
    assert.match(inputUrl(input), /\/auth\/login$/);
    return Promise.resolve(jsonResponse(tokens('matsu-direct')));
  });

  const response = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com', password: 'password-123' }),
  });
  const data: unknown = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(data, {
    authenticated: true,
    resources: { matsuApi: true, toolbox: false, arcade: false },
  });
  assert.doesNotMatch(JSON.stringify(data), /matsu-direct|accessToken|refreshToken/);
  assert.match(response.headers.get('set-cookie') ?? '', /HttpOnly/i);
  assert.match(response.headers.get('set-cookie') ?? '', /SameSite=Lax/i);
});

void test('Arcade login and register store tokens server-side without exposing them', async t => {
  for (const action of ['login', 'register'] as const) {
    await t.test(action, async () => {
      setFetch(input => {
        assert.match(inputUrl(input), new RegExp(`/auth/${action}$`));
        return Promise.resolve(jsonResponse(tokens(`arcade-${action}`)));
      });

      const response = await app.request(`/auth/arcade/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: `${action}@example.com`, password: 'password-123' }),
      });
      const data: unknown = await response.json();
      const cookie = response.headers.get('set-cookie') ?? '';
      const sessionId = decodeURIComponent(cookie.split(';')[0]?.split('=')[1] ?? '');
      const session = await getSession(sessionId);

      assert.equal(response.status, 200);
      assert.doesNotMatch(JSON.stringify(data), /arcade-(login|register)|accessToken|refreshToken/);
      assert.equal(session?.arcade?.accessToken, `arcade-${action}-access`);
    });
  }
});

void test('Arcade disconnect preserves other resources even when revoke is unavailable', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'toolbox', 'arcade']);
  let revokeCalls = 0;

  setFetch(input => {
    assert.match(inputUrl(input), /\/auth\/revoke$/);
    revokeCalls += 1;
    return Promise.reject(new Error('Arcade Auth is unavailable'));
  });

  const response = await app.request('/auth/arcade/disconnect', {
    method: 'POST',
    headers: { cookie: sessionCookie(sessionId) },
  });
  const data: unknown = await response.json();
  const session = await getSession(sessionId);

  assert.equal(response.status, 200);
  assert.equal(revokeCalls, 1);
  assert.deepEqual(data, {
    authenticated: true,
    resources: { matsuApi: true, toolbox: true, arcade: false },
  });
  assert.equal(session?.arcade, undefined);
  assert.equal(session?.matsuApi?.accessToken, 'matsuApi-access');
  assert.equal(session?.toolbox?.accessToken, 'toolbox-access');
});

void test('explicit matsu refresh updates only matsuApi and keeps other resources', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'arcade']);

  setFetch(input => {
    assert.match(inputUrl(input), /\/oauth\/token$/);
    return Promise.resolve(
      jsonResponse({
        access_token: 'matsu-refreshed-access',
        refresh_token: 'matsu-refreshed-refresh',
        expires_in: 900,
        token_type: 'Bearer',
      })
    );
  });

  const response = await app.request('/auth/refresh', {
    method: 'POST',
    headers: { cookie: sessionCookie(sessionId) },
  });
  const session = await getSession(sessionId);

  assert.equal(response.status, 200);
  assert.equal(session?.matsuApi?.accessToken, 'matsu-refreshed-access');
  assert.equal(session?.arcade?.accessToken, 'arcade-access');
});

void test('logout removes the complete multi-resource session and cookie', async () => {
  const sessionId = await createConnectedSession(['matsuApi', 'toolbox', 'arcade']);
  const response = await app.request('/auth/logout', {
    method: 'POST',
    headers: { cookie: sessionCookie(sessionId) },
  });

  assert.equal(response.status, 200);
  assert.equal(await getSession(sessionId), null);
  assert.deepEqual(await response.json(), {
    authenticated: false,
    resources: { matsuApi: false, toolbox: false, arcade: false },
  });
  assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/i);
});
