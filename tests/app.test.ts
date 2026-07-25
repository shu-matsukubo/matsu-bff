import assert from 'node:assert/strict';
import test from 'node:test';
import { app } from '../src/app.js';

void test('GET /health returns the typed health response', async () => {
  const response = await app.request('/health');

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

void test('GET /openapi.json exposes the registered BFF paths', async () => {
  const response = await app.request('/openapi.json');
  const document = (await response.json()) as { paths?: Record<string, unknown> };

  assert.equal(response.status, 200);
  assert.ok(document.paths?.['/api/expenses/summary']);
  assert.ok(document.paths?.['/auth/login']);
  assert.ok(document.paths?.['/auth/callback']);
});

void test('POST /auth/login rejects invalid input before calling the auth service', async () => {
  const response = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'invalid', password: 'short' }),
  });
  const data = (await response.json()) as { message?: string; issues?: unknown[] };

  assert.equal(response.status, 400);
  assert.equal(data.message, 'Request validation failed.');
  assert.ok(data.issues && data.issues.length >= 2);
});

void test('POST /auth/login returns 400 for malformed JSON', async () => {
  const response = await app.request('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalid',
  });

  assert.equal(response.status, 400);
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
